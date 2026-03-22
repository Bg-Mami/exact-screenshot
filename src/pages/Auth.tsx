import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Ticket, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  
  const [loginUsername, setLoginUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // First admin setup
  const [showFirstAdmin, setShowFirstAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Check if admin exists
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-admin-exists');
        if (!error && data && !data.exists) {
          setShowFirstAdmin(true);
        }
      } catch (e) {
        console.error('Admin check failed:', e);
      } finally {
        setCheckingAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginUsername || !password) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    setIsLoading(true);

    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke('get-user-email', {
        body: { username: loginUsername }
      });

      if (emailError || emailData?.error) {
        toast.error(emailData?.error || 'Kullanıcı bulunamadı');
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(emailData.email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Kullanıcı adı veya şifre hatalı');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Giriş başarılı!');
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Giriş sırasında bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminUsername || !adminFullName || !adminPassword) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    if (adminPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setCreatingAdmin(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-first-admin', {
        body: { 
          username: adminUsername, 
          fullName: adminFullName, 
          password: adminPassword 
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Admin oluşturulamadı');
      } else {
        toast.success('Admin kullanıcısı oluşturuldu! Şimdi giriş yapabilirsiniz.');
        setShowFirstAdmin(false);
        setLoginUsername(adminUsername);
        setPassword(adminPassword);
      }
    } catch (error) {
      console.error('Create admin error:', error);
      toast.error('Admin oluşturulurken bir hata oluştu');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info('Şifrenizi sıfırlamak için sistem yöneticisi ile iletişime geçin.');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Ticket className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Müze Bilet Sistemi</CardTitle>
            <CardDescription>
              Devam etmek için giriş yapın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı girin"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
              <Button 
                type="button" 
                variant="link" 
                className="w-full text-muted-foreground"
                onClick={handleForgotPassword}
              >
                Şifremi Unuttum
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* First Admin Setup - only visible when no admin exists */}
        {showFirstAdmin && !checkingAdmin && (
          <Card className="border-primary/50">
            <CardHeader className="text-center pb-3">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-primary/10 rounded-full">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg">İlk Admin Kurulumu</CardTitle>
              <CardDescription className="text-xs">
                Sistemde henüz admin yok. İlk admin hesabını oluşturun.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateFirstAdmin} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-username" className="text-sm">Kullanıcı Adı</Label>
                  <Input
                    id="admin-username"
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Admin kullanıcı adı"
                    disabled={creatingAdmin}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-fullname" className="text-sm">Ad Soyad</Label>
                  <Input
                    id="admin-fullname"
                    type="text"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Ad Soyad"
                    disabled={creatingAdmin}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-password" className="text-sm">Şifre</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    disabled={creatingAdmin}
                  />
                </div>
                <Button type="submit" className="w-full" variant="default" disabled={creatingAdmin}>
                  {creatingAdmin ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    'Admin Oluştur'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;
