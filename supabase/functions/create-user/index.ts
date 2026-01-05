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

    const { email, password, username, full_name, role, permissions, museum_groups, museum_ids } = await req.json();

    if (!email || !password || !username || !full_name) {
      return new Response(JSON.stringify({ error: 'Tüm alanlar gerekli' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Creating user:', email);

    // Create user with admin API (doesn't switch session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username,
        full_name,
      }
    });

    if (createError) {
      console.error('Create error:', createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user.id;
    console.log('User created:', userId);

    // Wait a bit for the trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile (trigger already created it via handle_new_user)
    const { error: profileError } = await supabaseAdmin.from('profiles')
      .update({
        username,
        full_name,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile error:', profileError);
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: 'Profil güncellenemedi: ' + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: role || 'cashier',
    });

    if (roleError) {
      console.error('Role error:', roleError);
    }

    // Assign permissions (for non-admin users)
    if (role !== 'admin' && permissions && permissions.length > 0) {
      await supabaseAdmin.from('user_permissions').insert(
        permissions.map((permission: string) => ({ user_id: userId, permission }))
      );
    }

    // Assign museum groups
    if (museum_groups && museum_groups.length > 0) {
      await supabaseAdmin.from('user_museum_groups').insert(
        museum_groups.map((group_id: string) => ({ user_id: userId, group_id }))
      );
    }

    // Assign direct museum assignments
    if (museum_ids && museum_ids.length > 0) {
      await supabaseAdmin.from('user_museums').insert(
        museum_ids.map((museum_id: string) => ({ user_id: userId, museum_id }))
      );
    }

    console.log('User setup complete');

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      message: 'Kullanıcı başarıyla oluşturuldu'
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
