import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  
  const [loginUsername, setLoginUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  
  // Admin creation form state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Check if admin exists via edge function (bypasses RLS)
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-admin-exists');
        
        if (error) throw error;
        setHasAdmin(data?.exists ?? false);
      } catch (error) {
        console.error('Error checking admin:', error);
        // If check fails, assume admin exists and show login form
        setHasAdmin(true);
      } finally {
        setCheckingAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  // Redirect if already logged in
  if (user && !authLoading) {
    navigate('/', { replace: true });
    return null;
  }

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

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminUsername || !adminFullName || !adminPassword) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    if (adminPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setIsLoading(true);

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
        return;
      }

      toast.success('Admin hesabı oluşturuldu! Şimdi giriş yapabilirsiniz.');
      setHasAdmin(true);
      setLoginUsername(adminUsername);
      setPassword('');
    } catch (error) {
      console.error('Create admin error:', error);
      toast.error('Admin oluşturulurken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info('Şifrenizi sıfırlamak için sistem yöneticisi ile iletişime geçin.');
  };

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show admin creation form if no admin exists
  if (!hasAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Ticket className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">İlk Admin Hesabını Oluştur</CardTitle>
            <CardDescription>
              Sistemde henüz admin yok. İlk admin hesabını oluşturun.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminFullName">Ad Soyad</Label>
                <Input
                  id="adminFullName"
                  type="text"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="Örn: Muammer Çakır"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminUsername">Kullanıcı Adı</Label>
                <Input
                  id="adminUsername"
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Örn: admin"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Şifre</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  'Admin Hesabı Oluştur'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
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
    </div>
  );
};

export default Auth;
