import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  CloudOff,
  Cloud,
  Bell,
  BellOff
} from 'lucide-react';
import { fullSync } from '@/lib/syncService';
import { 
  requestNotificationPermission, 
  getNotificationPermission,
  isNotificationSupported
} from '@/lib/notificationService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SyncResult {
  tickets: { success: number; failed: number };
  usage: { success: number; failed: number };
}

export const OfflineSyncWidget = () => {
  const { isOnline, pendingCount } = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (isNotificationSupported()) {
      setNotificationPermission(getNotificationPermission());
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('İnternet bağlantısı yok');
      return;
    }

    setSyncing(true);
    try {
      const result = await fullSync();
      setLastResult(result);
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Senkronizasyon hatası');
    } finally {
      setSyncing(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      toast.success('Bildirimler açıldı');
    } else if (permission === 'denied') {
      toast.error('Bildirim izni reddedildi');
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Henüz senkronize edilmedi';
    
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 1000);
    
    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    return lastSync.toLocaleDateString('tr-TR');
  };

  const getTotalSuccess = () => {
    if (!lastResult) return 0;
    return lastResult.tickets.success + lastResult.usage.success;
  };

  const getTotalFailed = () => {
    if (!lastResult) return 0;
    return lastResult.tickets.failed + lastResult.usage.failed;
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      !isOnline && "ring-2 ring-warning"
    )}>
      {/* Status Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        isOnline ? "bg-success/10" : "bg-warning/10"
      )}>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="w-5 h-5 text-success" />
              <span className="font-medium text-success">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-warning" />
              <span className="font-medium text-warning">Offline</span>
            </>
          )}
        </div>
        
        {pendingCount > 0 && (
          <Badge variant="secondary" className="bg-warning/20 text-warning border-warning">
            {pendingCount} bekliyor
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Pending Items */}
        {pendingCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bekleyen Kayıtlar</span>
              <span className="font-medium text-foreground">{pendingCount}</span>
            </div>
            <Progress 
              value={isOnline ? (syncing ? 50 : 100) : 0} 
              className="h-2"
            />
            {!isOnline && (
              <p className="text-xs text-warning">
                İnternet bağlantısı sağlandığında otomatik senkronize edilecek
              </p>
            )}
          </div>
        )}

        {/* Sync Status */}
        {pendingCount === 0 && isOnline && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Tüm veriler senkronize</span>
          </div>
        )}

        {/* Last Sync Result */}
        {lastResult && (
          <div className="space-y-2 p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Son senkronizasyon: {formatLastSync()}</p>
            <div className="flex items-center gap-4 text-sm">
              {getTotalSuccess() > 0 && (
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{getTotalSuccess()} başarılı</span>
                </div>
              )}
              {getTotalFailed() > 0 && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  <span>{getTotalFailed()} başarısız</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={!isOnline || syncing || pendingCount === 0}
            className="flex-1 gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? 'Senkronize ediliyor...' : 'Senkronize Et'}
          </Button>
          
          {notificationPermission !== 'unsupported' && (
            <Button
              variant={notificationPermission === 'granted' ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleRequestNotificationPermission}
              disabled={notificationPermission === 'granted'}
              className="gap-2"
            >
              {notificationPermission === 'granted' ? (
                <>
                  <Bell className="w-4 h-4 text-success" />
                  Açık
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4" />
                  Bildirim
                </>
              )}
            </Button>
          )}
        </div>

        {/* Offline Mode Info */}
        {!isOnline && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
            <CloudOff className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <div className="text-xs text-warning">
              <p className="font-medium mb-1">Offline Mod Aktif</p>
              <p className="opacity-80">
                Bilet satışı ve doğrulama yapabilirsiniz. 
                Veriler internet bağlantısı sağlandığında otomatik olarak senkronize edilecektir.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
