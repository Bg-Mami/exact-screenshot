import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Smartphone, Check, Wifi, WifiOff, HardDrive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success('Uygulama başarıyla kuruldu!');
    };

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.info('Tarayıcınızın menüsünden "Ana Ekrana Ekle" seçeneğini kullanın');
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('Uygulama kuruluyor...');
    }
    setDeferredPrompt(null);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Uygulamayı Kur</h1>
          <p className="text-muted-foreground">
            E-Bilet uygulamasını cihazınıza kurarak offline modda çalışabilirsiniz
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={isOnline ? 'border-green-500/50' : 'border-red-500/50'}>
            <CardContent className="pt-6 text-center">
              {isOnline ? (
                <>
                  <Wifi className="w-8 h-8 mx-auto text-green-500 mb-2" />
                  <p className="font-medium text-green-600">Çevrimiçi</p>
                </>
              ) : (
                <>
                  <WifiOff className="w-8 h-8 mx-auto text-red-500 mb-2" />
                  <p className="font-medium text-red-600">Çevrimdışı</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={isInstalled ? 'border-green-500/50' : 'border-blue-500/50'}>
            <CardContent className="pt-6 text-center">
              {isInstalled ? (
                <>
                  <Check className="w-8 h-8 mx-auto text-green-500 mb-2" />
                  <p className="font-medium text-green-600">Kurulu</p>
                </>
              ) : (
                <>
                  <Download className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                  <p className="font-medium text-blue-600">Kurulmadı</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Install Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Uygulama Kurulumu
            </CardTitle>
            <CardDescription>
              Uygulamayı cihazınıza kurarak daha hızlı erişim ve offline çalışma imkanı elde edin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="bg-green-500/10 text-green-600 p-4 rounded-lg flex items-center gap-3">
                <Check className="w-5 h-5" />
                <span>Uygulama zaten kurulu! Cihazınızın ana ekranından erişebilirsiniz.</span>
              </div>
            ) : (
              <>
                <Button 
                  onClick={handleInstall} 
                  size="lg" 
                  className="w-full gap-2"
                  disabled={!deferredPrompt}
                >
                  <Download className="w-5 h-5" />
                  Uygulamayı Kur
                </Button>

                {!deferredPrompt && (
                  <div className="bg-blue-500/10 text-blue-600 p-4 rounded-lg text-sm">
                    <p className="font-medium mb-2">Manuel Kurulum:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>iPhone/iPad:</strong> Safari'de Paylaş → Ana Ekrana Ekle</li>
                      <li><strong>Android:</strong> Chrome menüsü → Ana Ekrana Ekle</li>
                      <li><strong>Masaüstü:</strong> Adres çubuğundaki kurulum simgesi</li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Offline Özellikler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Bilet Satışı</p>
                  <p className="text-sm text-muted-foreground">İnternet olmadan bilet satın, QR kod üretin</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Bilet Doğrulama</p>
                  <p className="text-sm text-muted-foreground">Offline satılan biletleri anında doğrulayın</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Otomatik Senkronizasyon</p>
                  <p className="text-sm text-muted-foreground">İnternet geldiğinde veriler otomatik olarak sunucuya aktarılır</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium">Veri Önbelleği</p>
                  <p className="text-sm text-muted-foreground">Müze, bilet türü ve seans bilgileri cihazda saklanır</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Install;
