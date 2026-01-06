import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, CloudOff, Cloud } from 'lucide-react';
import { fullSync } from '@/lib/syncService';
import { useState } from 'react';
import { toast } from 'sonner';

export const OnlineStatusBadge = () => {
  const { isOnline, pendingCount } = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('İnternet bağlantısı yok');
      return;
    }
    setSyncing(true);
    await fullSync();
    setSyncing(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Online/Offline durumu */}
      <Badge 
        variant={isOnline ? "default" : "destructive"} 
        className="flex items-center gap-1.5"
      >
        {isOnline ? (
          <>
            <Wifi className="w-3 h-3" />
            <span>Çevrimiçi</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            <span>Çevrimdışı</span>
          </>
        )}
      </Badge>

      {/* Bekleyen senkronizasyon */}
      {pendingCount > 0 && (
        <Badge variant="outline" className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          <CloudOff className="w-3 h-3" />
          <span>{pendingCount} bekliyor</span>
        </Badge>
      )}

      {/* Senkronize butonu */}
      {isOnline && pendingCount > 0 && (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleSync}
          disabled={syncing}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Senkronize Et
        </Button>
      )}

      {/* Tamamen senkronize */}
      {isOnline && pendingCount === 0 && (
        <Badge variant="outline" className="flex items-center gap-1.5 bg-green-500/10 text-green-600 border-green-500/30">
          <Cloud className="w-3 h-3" />
          <span>Senkron</span>
        </Badge>
      )}
    </div>
  );
};
