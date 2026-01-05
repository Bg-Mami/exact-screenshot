import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Plus, Users, Trash2, Shield, Key, Building2, UserCog } from 'lucide-react';

type AppRole = 'admin' | 'cashier';
type AppPermission = 'sell_tickets' | 'view_reports' | 'manage_staff' | 'manage_museums' | 'manage_sessions' | 'manage_ticket_types' | 'manage_settings';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  is_active: boolean;
  assigned_museum_id: string | null;
  roles: AppRole[];
  permissions: AppPermission[];
}

interface Museum {
  id: string;
  name: string;
}

const PERMISSION_LABELS: Record<AppPermission, string> = {
  sell_tickets: 'Bilet Satışı',
  view_reports: 'Raporları Görme',
  manage_staff: 'Personel Yönetimi',
  manage_museums: 'Müze Yönetimi',
  manage_sessions: 'Seans Yönetimi',
  manage_ticket_types: 'Bilet Türü Yönetimi',
  manage_settings: 'Ayarlar',
};

const ALL_PERMISSIONS: AppPermission[] = [
  'sell_tickets',
  'view_reports',
  'manage_staff',
  'manage_museums',
  'manage_sessions',
  'manage_ticket_types',
  'manage_settings',
];

export const UserSettings = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permDialogUser, setPermDialogUser] = useState<UserProfile | null>(null);
  const [museumDialogUser, setMuseumDialogUser] = useState<UserProfile | null>(null);
  const [roleDialogUser, setRoleDialogUser] = useState<UserProfile | null>(null);
  const [selectedRoleForUser, setSelectedRoleForUser] = useState<AppRole>('cashier');
  const [selectedMuseumForUser, setSelectedMuseumForUser] = useState<string>('');
  const [newUser, setNewUser] = useState({
    password: '',
    username: '',
    full_name: '',
    role: 'cashier' as AppRole,
    museum_id: '',
  });
  const [creating, setCreating] = useState(false);
  const [updatingMuseum, setUpdatingMuseum] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [profilesRes, rolesRes, permsRes, museumsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.from('user_permissions').select('*'),
      supabase.from('museums').select('id, name').eq('is_active', true),
    ]);

    if (profilesRes.error || rolesRes.error || permsRes.error) {
      toast.error('Kullanıcılar yüklenemedi');
      setLoading(false);
      return;
    }

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const permissions = permsRes.data || [];

    const usersWithRoles: UserProfile[] = profiles.map(p => ({
      ...p,
      roles: roles.filter(r => r.user_id === p.id).map(r => r.role as AppRole),
      permissions: permissions.filter(pr => pr.user_id === p.id).map(pr => pr.permission as AppPermission),
    }));

    setUsers(usersWithRoles);
    setMuseums(museumsRes.data || []);
    setLoading(false);
  };

  const handleCreateUser = async () => {
    if (!newUser.password || !newUser.username || !newUser.full_name) {
      toast.error('Tüm alanları doldurun');
      return;
    }

    if (newUser.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setCreating(true);

    // Generate internal email from username
    const internalEmail = `${newUser.username.toLowerCase().replace(/\s+/g, '')}@local`;

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: internalEmail,
      password: newUser.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username: newUser.username,
          full_name: newUser.full_name,
        }
      }
    });

    if (authError || !authData.user) {
      toast.error('Kullanıcı oluşturulamadı: ' + (authError?.message || 'Bilinmeyen hata'));
      setCreating(false);
      return;
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      username: newUser.username,
      full_name: newUser.full_name,
      assigned_museum_id: newUser.museum_id || null,
    });

    if (profileError) {
      toast.error('Profil oluşturulamadı');
      setCreating(false);
      return;
    }

    // Assign role
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: newUser.role,
    });

    if (roleError) {
      toast.error('Rol atanamadı');
    }

    // If cashier, give default permissions
    if (newUser.role === 'cashier') {
      await supabase.from('user_permissions').insert([
        { user_id: userId, permission: 'sell_tickets' },
        { user_id: userId, permission: 'view_reports' },
      ]);
    }

    toast.success('Kullanıcı oluşturuldu');
    setDialogOpen(false);
    setNewUser({ password: '', username: '', full_name: '', role: 'cashier', museum_id: '' });
    setCreating(false);
    fetchData();
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (error) {
      toast.error('Durum güncellenemedi');
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: isActive } : u));
      toast.success(isActive ? 'Kullanıcı aktif edildi' : 'Kullanıcı pasif edildi');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;

    // Note: This only deletes the profile, the auth user remains
    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) {
      toast.error('Silme başarısız');
    } else {
      toast.success('Kullanıcı silindi');
      fetchData();
    }
  };

  const handlePermissionToggle = async (userId: string, permission: AppPermission, enabled: boolean) => {
    if (enabled) {
      const { error } = await supabase.from('user_permissions').insert({
        user_id: userId,
        permission,
      });
      if (error && !error.message.includes('duplicate')) {
        toast.error('Yetki eklenemedi');
        return;
      }
    } else {
      const { error } = await supabase.from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission', permission);
      if (error) {
        toast.error('Yetki kaldırılamadı');
        return;
      }
    }

    // Update local state
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          permissions: enabled 
            ? [...u.permissions, permission]
            : u.permissions.filter(p => p !== permission)
        };
      }
      return u;
    }));

    if (permDialogUser && permDialogUser.id === userId) {
      setPermDialogUser(prev => prev ? {
        ...prev,
        permissions: enabled 
          ? [...prev.permissions, permission]
          : prev.permissions.filter(p => p !== permission)
      } : null);
    }

    toast.success('Yetki güncellendi');
  };

  const handleUpdateMuseum = async () => {
    if (!museumDialogUser) return;
    
    setUpdatingMuseum(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ assigned_museum_id: selectedMuseumForUser || null })
      .eq('id', museumDialogUser.id);

    if (error) {
      toast.error('Müze atanamadı');
    } else {
      setUsers(prev => prev.map(u => 
        u.id === museumDialogUser.id 
          ? { ...u, assigned_museum_id: selectedMuseumForUser || null }
          : u
      ));
      toast.success('Müze atandı');
      setMuseumDialogUser(null);
    }
    
    setUpdatingMuseum(false);
  };

  const openMuseumDialog = (user: UserProfile) => {
    setMuseumDialogUser(user);
    setSelectedMuseumForUser(user.assigned_museum_id || '');
  };

  const openRoleDialog = (user: UserProfile) => {
    setRoleDialogUser(user);
    setSelectedRoleForUser(user.roles[0] || 'cashier');
  };

  const handleUpdateRole = async () => {
    if (!roleDialogUser) return;
    
    setUpdatingRole(true);
    
    // Delete existing roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', roleDialogUser.id);
    
    // Insert new role
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: roleDialogUser.id, role: selectedRoleForUser });

    if (error) {
      toast.error('Rol güncellenemedi');
    } else {
      setUsers(prev => prev.map(u => 
        u.id === roleDialogUser.id 
          ? { ...u, roles: [selectedRoleForUser] }
          : u
      ));
      toast.success('Rol güncellendi');
      setRoleDialogUser(null);
    }
    
    setUpdatingRole(false);
  };

  const getMuseumName = (museumId: string | null) => {
    if (!museumId) return 'Atanmamış';
    return museums.find(m => m.id === museumId)?.name || 'Bilinmeyen';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Kullanıcı Yönetimi</h2>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-primary border-0">
              <Plus className="w-4 h-4" />
              Kullanıcı Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kullanıcı Adı *</Label>
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="orn: ahmet.yilmaz"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ad Soyad *</Label>
                  <Input
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    placeholder="Ahmet Yılmaz"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Şifre * (min 6 karakter)</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(v: AppRole) => setNewUser({ ...newUser, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Yönetici (Admin)</SelectItem>
                    <SelectItem value="cashier">Gişe Personeli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atanacak Müze</Label>
                <Select 
                  value={newUser.museum_id} 
                  onValueChange={(v) => setNewUser({ ...newUser, museum_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçiniz (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {museums.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleCreateUser} 
                className="w-full gradient-primary border-0"
                disabled={creating}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Kullanıcı Oluştur
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {users.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Henüz kullanıcı eklenmemiş</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => {
            const isAdmin = user.roles.includes('admin');
            return (
              <Card key={user.id} className={`border-border ${!user.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {user.full_name.charAt(0)}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{user.full_name}</p>
                        <Badge variant={isAdmin ? 'default' : 'secondary'}>
                          {isAdmin ? 'Admin' : 'Gişe'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Müze: {getMuseumName(user.assigned_museum_id)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={(checked) => handleToggleActive(user.id, checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {user.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRoleDialog(user)}
                        className="gap-2"
                      >
                        <UserCog className="w-4 h-4" />
                        Rol
                      </Button>

                      {!isAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openMuseumDialog(user)}
                            className="gap-2"
                          >
                            <Building2 className="w-4 h-4" />
                            Müze Ata
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPermDialogUser(user)}
                            className="gap-2"
                          >
                            <Key className="w-4 h-4" />
                            Yetkiler
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Permissions display */}
                  {!isAdmin && user.permissions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {user.permissions.map(p => (
                        <Badge key={p} variant="outline" className="text-xs">
                          {PERMISSION_LABELS[p]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Permissions Dialog */}
      <Dialog open={!!permDialogUser} onOpenChange={(open) => !open && setPermDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {permDialogUser?.full_name} - Yetkiler
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {ALL_PERMISSIONS.map((permission) => (
              <div key={permission} className="flex items-center justify-between">
                <Label className="cursor-pointer">{PERMISSION_LABELS[permission]}</Label>
                <Checkbox
                  checked={permDialogUser?.permissions.includes(permission) || false}
                  onCheckedChange={(checked) => {
                    if (permDialogUser) {
                      handlePermissionToggle(permDialogUser.id, permission, !!checked);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Museum Assignment Dialog */}
      <Dialog open={!!museumDialogUser} onOpenChange={(open) => !open && setMuseumDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {museumDialogUser?.full_name} - Müze Ata
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atanacak Müze</Label>
              <Select 
                value={selectedMuseumForUser} 
                onValueChange={setSelectedMuseumForUser}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Müze seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Atanmamış</SelectItem>
                  {museums.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kullanıcı sadece atandığı müzede bilet satabilecektir.
              </p>
            </div>
            <Button 
              onClick={handleUpdateMuseum} 
              className="w-full gradient-primary border-0"
              disabled={updatingMuseum}
            >
              {updatingMuseum ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Müze Ata
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              {roleDialogUser?.full_name} - Rol Değiştir
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kullanıcı Rolü</Label>
              <Select 
                value={selectedRoleForUser} 
                onValueChange={(v: AppRole) => setSelectedRoleForUser(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Yönetici (Admin)</SelectItem>
                  <SelectItem value="cashier">Gişe Personeli</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin kullanıcılar tüm yetkilere sahiptir. Gişe personeli sadece atanan yetkileri kullanabilir.
              </p>
            </div>
            <Button 
              onClick={handleUpdateRole} 
              className="w-full gradient-primary border-0"
              disabled={updatingRole}
            >
              {updatingRole ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Rol Güncelle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
