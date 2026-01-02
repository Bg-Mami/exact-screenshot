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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if any admin user exists
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (checkError) {
      console.error('Error checking existing admins:', checkError);
      throw new Error('Mevcut admin kontrolü başarısız oldu');
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log('Admin user already exists, rejecting request');
      return new Response(
        JSON.stringify({ error: 'Sistemde zaten bir admin kullanıcısı mevcut' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get request body
    const { email, password, fullName, username } = await req.json();

    if (!email || !password || !fullName || !username) {
      return new Response(
        JSON.stringify({ error: 'Email, şifre, tam ad ve kullanıcı adı gereklidir' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Şifre en az 6 karakter olmalıdır' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Creating first admin user:', email);

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new Error(`Kullanıcı oluşturulamadı: ${authError.message}`);
    }

    const userId = authData.user.id;
    console.log('Auth user created with ID:', userId);

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        username: username,
        is_active: true
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Profil oluşturulamadı: ${profileError.message}`);
    }

    console.log('Profile created for user:', userId);

    // Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin'
      });

    if (roleError) {
      console.error('Error assigning admin role:', roleError);
      // Rollback: delete profile and auth user
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Admin rolü atanamadı: ${roleError.message}`);
    }

    console.log('Admin role assigned to user:', userId);

    // Grant all permissions to admin
    const allPermissions = [
      'sell_tickets',
      'view_reports', 
      'manage_staff',
      'manage_museums',
      'manage_sessions',
      'manage_ticket_types',
      'manage_settings'
    ];

    const permissionInserts = allPermissions.map(permission => ({
      user_id: userId,
      permission
    }));

    const { error: permError } = await supabaseAdmin
      .from('user_permissions')
      .insert(permissionInserts);

    if (permError) {
      console.error('Error assigning permissions:', permError);
      // Continue anyway, admin role is enough
    }

    console.log('First admin user created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'İlk admin kullanıcısı başarıyla oluşturuldu',
        userId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-first-admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
