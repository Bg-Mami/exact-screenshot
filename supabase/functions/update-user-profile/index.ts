import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Yetkilendirme gerekli' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if requesting user is admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin yetkisi gerekli' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, username, full_name, museum_ids } = await req.json();

    if (!userId || !username || !full_name) {
      return new Response(JSON.stringify({ error: 'Tüm alanlar gerekli' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Updating profile for user:', userId);

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ username, full_name })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(JSON.stringify({ error: 'Profil güncellenemedi: ' + profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update museum assignments if provided
    if (museum_ids !== undefined) {
      // Delete existing museum assignments
      await supabaseAdmin
        .from('user_museums')
        .delete()
        .eq('user_id', userId);

      // Insert new museum assignments
      if (museum_ids && museum_ids.length > 0) {
        const { error: museumError } = await supabaseAdmin
          .from('user_museums')
          .insert(museum_ids.map((museum_id: string) => ({ user_id: userId, museum_id })));

        if (museumError) {
          console.error('Museum assignment error:', museumError);
        }
      }
    }

    // Update user metadata in auth.users
    const sanitizeForEmail = (str: string) => {
      const turkishMap: Record<string, string> = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'I': 'I',
        'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
      };
      return str
        .split('')
        .map(char => turkishMap[char] || char)
        .join('')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    };
    
    const newEmail = `${sanitizeForEmail(username)}@local`;

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        user_metadata: { username, full_name }
      }
    );

    if (authUpdateError) {
      console.error('Auth update error:', authUpdateError);
      // Profile updated successfully, just log auth error
    }

    console.log('Profile update successful for user:', userId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Profil başarıyla güncellendi'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    return new Response(JSON.stringify({ error: 'Sunucu hatası: ' + errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
