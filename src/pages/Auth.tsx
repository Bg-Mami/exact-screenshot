import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Ticket, Loader2, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkForExistingAdmin();
  }, []);

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const checkForExistingAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);
      
      if (error) {
        console.error('Error checking admin:', error);
        setHasAdmin(true); // Assume there is an admin on error
      } else {
        setHasAdmin(data && data.length > 0);
      }
    } catch (err) {
      console.error('Error:', err);
      setHasAdmin(true);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Lütfen e-posta ve şifre girin');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Geçersiz e-posta veya şifre');
      } else {
        toast.error('Giriş yapılamadı: ' + error.message);
      }
    } else {
      toast.success('Giriş başarılı!');
      navigate('/');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !fullName || !username) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-first-admin', {
        body: { email, password, fullName, username }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Admin oluşturulamadı: ' + error.message);
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setIsLoading(false);
        return;
      }

      toast.success('İlk admin kullanıcısı oluşturuldu! Şimdi giriş yapabilirsiniz.');
      setHasAdmin(true);
      setPassword('');
      setFullName('');
      setUsername('');
    } catch (err) {
      console.error('Error creating admin:', err);
      toast.error('Beklenmeyen bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 gradient-primary rounded-2xl mb-4 ticket-shadow">
            <Ticket className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">E-Bilet Sistemi</h1>
          <p className="text-muted-foreground mt-2">
            {hasAdmin ? 'Devam etmek için giriş yapın' : 'İlk admin hesabını oluşturun'}
          </p>
        </div>

        {hasAdmin ? (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                Giriş Yap
              </CardTitle>
              <CardDescription>
                Personel girişi için e-posta ve şifrenizi girin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ornek@muze.gov.tr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full gradient-primary border-0"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Giriş yapılıyor...
                    </>
                  ) : (
                    'Giriş Yap'
                  )}
                </Button>
              </form>
              
              <p className="text-xs text-muted-foreground text-center mt-6">
                Hesabınız yok mu? Yöneticinizle iletişime geçin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                İlk Admin Hesabını Oluştur
              </CardTitle>
              <CardDescription>
                Sistemde henüz admin bulunmuyor. İlk admin hesabını oluşturun.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Ad Soyad</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Ahmet Yılmaz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Kullanıcı Adı</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@muze.gov.tr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="En az 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full gradient-primary border-0"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    'Admin Hesabı Oluştur'
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
