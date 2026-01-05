import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { qr_code, museum_id, credits_to_use = 1 } = await req.json();

    console.log(`Validating ticket: ${qr_code} for museum: ${museum_id}, credits: ${credits_to_use}`);

    if (!qr_code || !museum_id) {
      return new Response(JSON.stringify({
        valid: false,
        open_gate: false,
        message: 'QR kod veya müze ID eksik',
        error_code: 'MISSING_PARAMS'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the ticket by QR code
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        ticket_types!inner(name, is_combo, credits),
        museums!inner(name)
      `)
      .eq('qr_code', qr_code)
      .single();

    if (ticketError || !ticket) {
      console.log('Ticket not found:', ticketError);
      return new Response(JSON.stringify({
        valid: false,
        open_gate: false,
        message: 'Bilet bulunamadı',
        error_code: 'TICKET_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if ticket is already fully used
    if (ticket.is_used) {
      console.log('Ticket already used');
      return new Response(JSON.stringify({
        valid: false,
        open_gate: false,
        message: 'Bu bilet daha önce tamamen kullanılmış',
        error_code: 'TICKET_USED',
        ticket_info: {
          type: ticket.ticket_types.name,
          museum: ticket.museums.name,
          used_at: ticket.used_at
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For combo tickets, check museum-specific credits
    if (ticket.ticket_types.is_combo) {
      const { data: comboCredits } = await supabase
        .from('combo_ticket_museums')
        .select('credits')
        .eq('ticket_type_id', ticket.ticket_type_id)
        .eq('museum_id', museum_id)
        .single();

      if (!comboCredits) {
        return new Response(JSON.stringify({
          valid: false,
          open_gate: false,
          message: 'Bu kombine bilet bu müze için geçerli değil',
          error_code: 'MUSEUM_NOT_IN_COMBO'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check existing usage for this museum
      const { data: existingUsage } = await supabase
        .from('ticket_usage')
        .select('used_credits')
        .eq('ticket_id', ticket.id)
        .eq('museum_id', museum_id);

      const usedCreditsForMuseum = existingUsage?.reduce((sum, u) => sum + u.used_credits, 0) || 0;
      const remainingForMuseum = comboCredits.credits - usedCreditsForMuseum;

      if (remainingForMuseum < credits_to_use) {
        return new Response(JSON.stringify({
          valid: false,
          open_gate: false,
          message: `Bu müze için yeterli kontör yok. Kalan: ${remainingForMuseum}`,
          error_code: 'INSUFFICIENT_CREDITS',
          remaining_credits: remainingForMuseum
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Regular ticket - check overall remaining credits
      if (ticket.remaining_credits < credits_to_use) {
        return new Response(JSON.stringify({
          valid: false,
          open_gate: false,
          message: `Yeterli kontör yok. Kalan: ${ticket.remaining_credits}`,
          error_code: 'INSUFFICIENT_CREDITS',
          remaining_credits: ticket.remaining_credits
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if ticket is for the correct museum (non-combo)
      if (ticket.museum_id !== museum_id) {
        return new Response(JSON.stringify({
          valid: false,
          open_gate: false,
          message: 'Bu bilet bu müze için geçerli değil',
          error_code: 'WRONG_MUSEUM'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Record the usage
    const { error: usageError } = await supabase
      .from('ticket_usage')
      .insert({
        ticket_id: ticket.id,
        museum_id: museum_id,
        used_credits: credits_to_use,
        used_by: null // API call, no user context
      });

    if (usageError) {
      console.log('Error recording usage:', usageError);
      return new Response(JSON.stringify({
        valid: false,
        open_gate: false,
        message: 'Kullanım kaydedilemedi',
        error_code: 'USAGE_RECORD_FAILED'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update remaining credits
    const newRemainingCredits = ticket.remaining_credits - credits_to_use;
    const isFullyUsed = newRemainingCredits <= 0;

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        remaining_credits: newRemainingCredits,
        is_used: isFullyUsed,
        used_at: isFullyUsed ? new Date().toISOString() : null
      })
      .eq('id', ticket.id);

    if (updateError) {
      console.log('Error updating ticket:', updateError);
    }

    console.log('Ticket validated successfully, opening gate');

    return new Response(JSON.stringify({
      valid: true,
      open_gate: true,
      message: 'Geçiş onaylandı',
      ticket_info: {
        id: ticket.id,
        type: ticket.ticket_types.name,
        museum: ticket.museums.name,
        remaining_credits: newRemainingCredits,
        is_fully_used: isFullyUsed,
        credits_used: credits_to_use
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-ticket-api:', error);
    return new Response(JSON.stringify({
      valid: false,
      open_gate: false,
      message: 'Sunucu hatası',
      error_code: 'SERVER_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
