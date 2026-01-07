import { supabase } from '@/integrations/supabase/client';
import {
  getPendingTickets,
  markTicketSynced,
  deletePendingTicket,
  getPendingUsage,
  markUsageSynced,
  deletePendingUsage,
  cacheMuseums,
  cacheTicketTypes,
  cacheMuseumPrices,
  cacheSessions,
  getPendingCount,
  getDb,
} from './offlineDb';
import { 
  notifySyncComplete, 
  notifyOfflineMode, 
  notifyOnlineMode 
} from './notificationService';
import { toast } from 'sonner';

// Online durumu kontrol et
export const isOnline = () => navigator.onLine;

// Bekleyen biletleri senkronize et
export const syncPendingTickets = async (): Promise<{ success: number; failed: number }> => {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  const pendingTickets = await getPendingTickets();
  let success = 0;
  let failed = 0;

  for (const ticket of pendingTickets) {
    try {
      const { error } = await supabase.from('tickets').insert({
        id: ticket.id,
        qr_code: ticket.qr_code,
        ticket_type_id: ticket.ticket_type_id,
        museum_id: ticket.museum_id,
        session_id: ticket.session_id,
        price: ticket.price,
        sold_by: ticket.sold_by,
        remaining_credits: ticket.remaining_credits,
        created_at: ticket.created_at,
        is_used: false,
      });

      if (error) {
        // Duplicate key ise zaten senkronize edilmiş demektir
        if (error.code === '23505') {
          await markTicketSynced(ticket.id);
          success++;
        } else {
          console.error('Sync ticket error:', error);
          failed++;
        }
      } else {
        await markTicketSynced(ticket.id);
        success++;
      }
    } catch (err) {
      console.error('Sync ticket exception:', err);
      failed++;
    }
  }

  return { success, failed };
};

// Bekleyen kullanımları senkronize et
export const syncPendingUsage = async (): Promise<{ success: number; failed: number }> => {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  const pendingUsages = await getPendingUsage();
  let success = 0;
  let failed = 0;

  for (const usage of pendingUsages) {
    try {
      const { error } = await supabase.from('ticket_usage').insert({
        id: usage.id,
        ticket_id: usage.ticket_id,
        museum_id: usage.museum_id,
        used_credits: usage.used_credits,
        used_by: usage.used_by,
        used_at: usage.used_at,
      });

      if (error) {
        if (error.code === '23505') {
          await markUsageSynced(usage.id);
          success++;
        } else {
          console.error('Sync usage error:', error);
          failed++;
        }
      } else {
        // Bilet tablosunu da güncelle
        await supabase
          .from('tickets')
          .update({
            remaining_credits: await getTicketRemainingCredits(usage.ticket_id),
            is_used: true,
            used_at: usage.used_at,
          })
          .eq('id', usage.ticket_id);

        await markUsageSynced(usage.id);
        success++;
      }
    } catch (err) {
      console.error('Sync usage exception:', err);
      failed++;
    }
  }

  return { success, failed };
};

// Bilet kalan kredisini hesapla
const getTicketRemainingCredits = async (ticketId: string): Promise<number> => {
  const { data } = await supabase
    .from('ticket_usage')
    .select('used_credits')
    .eq('ticket_id', ticketId);
  
  const usedTotal = (data || []).reduce((sum, u) => sum + u.used_credits, 0);
  
  const { data: ticket } = await supabase
    .from('tickets')
    .select('remaining_credits')
    .eq('id', ticketId)
    .single();
  
  return Math.max(0, (ticket?.remaining_credits || 1) - usedTotal);
};

// Tüm verileri cache'le
export const cacheAllData = async () => {
  if (!isOnline()) {
    return;
  }

  try {
    // Müzeleri cache'le
    const { data: museums } = await supabase
      .from('museums')
      .select('id, name, address, is_active')
      .eq('is_active', true);
    
    if (museums) {
      await cacheMuseums(museums);
    }

    // Bilet türlerini cache'le
    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select('id, name, type_key, price, credits, color, icon, is_combo, is_active')
      .eq('is_active', true);
    
    if (ticketTypes) {
      await cacheTicketTypes(ticketTypes);
    }

    // Müze fiyatlarını cache'le
    const { data: prices } = await supabase
      .from('museum_ticket_prices')
      .select('id, museum_id, ticket_type_id, price, is_active')
      .eq('is_active', true);
    
    if (prices) {
      await cacheMuseumPrices(prices);
    }

    // Bugünkü seansları cache'le
    const today = new Date().toISOString().split('T')[0];
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, museum_id, session_date, start_time, end_time, capacity, sold_count, is_active')
      .eq('session_date', today)
      .eq('is_active', true);
    
    if (sessions) {
      await cacheSessions(sessions);
    }

    console.log('All data cached successfully');
  } catch (err) {
    console.error('Cache data error:', err);
  }
};

// Tam senkronizasyon
export const fullSync = async (): Promise<{ tickets: { success: number; failed: number }; usage: { success: number; failed: number } }> => {
  if (!isOnline()) {
    toast.error('İnternet bağlantısı yok');
    return { tickets: { success: 0, failed: 0 }, usage: { success: 0, failed: 0 } };
  }

  // Önce bekleyen verileri gönder
  const ticketResult = await syncPendingTickets();
  const usageResult = await syncPendingUsage();

  // Sonra verileri cache'le
  await cacheAllData();

  const totalSuccess = ticketResult.success + usageResult.success;
  const totalFailed = ticketResult.failed + usageResult.failed;

  if (totalSuccess > 0) {
    toast.success(`${totalSuccess} kayıt senkronize edildi`);
    notifySyncComplete(totalSuccess, totalFailed);
  }
  if (totalFailed > 0) {
    toast.warning(`${totalFailed} kayıt senkronize edilemedi`);
  }

  return { tickets: ticketResult, usage: usageResult };
};

// Otomatik senkronizasyon başlat
let syncInterval: NodeJS.Timeout | null = null;

export const startAutoSync = (intervalMs = 30000) => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // İlk yüklemede cache'le
  cacheAllData();

  // Periyodik senkronizasyon
  syncInterval = setInterval(async () => {
    if (isOnline()) {
      const pending = await getPendingCount();
      if (pending > 0) {
        console.log(`Auto-syncing ${pending} pending items...`);
        await fullSync();
      }
    }
  }, intervalMs);

  // Online olunca senkronize et
  window.addEventListener('online', async () => {
    toast.success('İnternet bağlantısı sağlandı');
    notifyOnlineMode();
    await fullSync();
  });

  window.addEventListener('offline', () => {
    toast.warning('İnternet bağlantısı kesildi - Offline modda çalışıyorsunuz');
    notifyOfflineMode();
  });
};

export const stopAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
};
