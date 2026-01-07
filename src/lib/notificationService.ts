// Push Notification Service for PWA

export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Notification permission error:', error);
    return 'denied';
  }
};

export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (!isNotificationSupported()) {
    console.log('Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return;
  }

  try {
    // Use service worker for notifications when available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          ...options,
        });
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        icon: '/icons/icon-192.png',
        ...options,
      });
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};

// Predefined notification types
export const notifySyncComplete = (successCount: number, failedCount: number) => {
  if (successCount > 0) {
    sendNotification('Senkronizasyon Tamamlandı', {
      body: `${successCount} kayıt başarıyla senkronize edildi${failedCount > 0 ? `, ${failedCount} başarısız` : ''}`,
      tag: 'sync-complete',
    });
  }
};

export const notifyOfflineMode = () => {
  sendNotification('Offline Mod', {
    body: 'İnternet bağlantısı kesildi. Offline modda çalışıyorsunuz.',
    tag: 'offline-mode',
  });
};

export const notifyOnlineMode = () => {
  sendNotification('Online', {
    body: 'İnternet bağlantısı sağlandı. Veriler senkronize ediliyor...',
    tag: 'online-mode',
  });
};

export const notifyTicketSold = (count: number, isOffline: boolean) => {
  sendNotification('Bilet Satıldı', {
    body: `${count} adet bilet satıldı${isOffline ? ' (Offline - sonra senkronize edilecek)' : ''}`,
    tag: 'ticket-sold',
  });
};

export const notifyTicketValidated = (isValid: boolean, ticketType?: string) => {
  if (isValid) {
    sendNotification('Giriş Onaylandı', {
      body: ticketType ? `${ticketType} bileti doğrulandı` : 'Bilet doğrulandı',
      tag: 'ticket-validated',
    });
  }
};
