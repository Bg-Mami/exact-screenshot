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

    console.log('Starting cleanup of orphan users...');

    // Get all auth users
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Failed to list users:', listError);
      return new Response(JSON.stringify({ error: 'Kullanıcılar listelenemedi' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all profiles
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
    const profileIds = new Set((profiles || []).map(p => p.id));

    // Get all admin user IDs
    const { data: adminRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    const adminIds = new Set((adminRoles || []).map(r => r.user_id));

    const deletedUsers: string[] = [];
    const errors: string[] = [];

    for (const user of authUsers.users) {
      // Skip if user is admin
      if (adminIds.has(user.id)) {
        console.log(`Skipping admin user: ${user.email}`);
        continue;
      }

      // Delete if user has no profile OR is not admin
      const hasProfile = profileIds.has(user.id);
      
      // Delete non-admin users (orphans or regular users)
      if (!adminIds.has(user.id)) {
        console.log(`Deleting user: ${user.email} (hasProfile: ${hasProfile})`);
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`Failed to delete ${user.email}:`, deleteError);
          errors.push(`${user.email}: ${deleteError.message}`);
        } else {
          deletedUsers.push(user.email || user.id);
        }
      }
    }

    console.log(`Cleanup complete. Deleted ${deletedUsers.length} users.`);

    return new Response(JSON.stringify({ 
      success: true,
      deleted: deletedUsers,
      errors: errors,
      message: `${deletedUsers.length} kullanıcı silindi (adminler hariç)`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Sunucu hatası' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
