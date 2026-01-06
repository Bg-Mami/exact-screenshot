import { openDB, IDBPDatabase } from 'idb';

// Types
interface PendingTicket {
  id: string;
  qr_code: string;
  ticket_type_id: string;
  museum_id: string;
  session_id: string | null;
  price: number;
  sold_by: string;
  remaining_credits: number;
  created_at: string;
  synced: boolean;
}

interface CachedMuseum {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

interface CachedTicketType {
  id: string;
  name: string;
  type_key: string;
  price: number;
  credits: number;
  color: string;
  icon: string;
  is_combo: boolean;
  is_active: boolean;
}

interface CachedMuseumPrice {
  id: string;
  museum_id: string;
  ticket_type_id: string;
  price: number;
  is_active: boolean;
}

interface CachedSession {
  id: string;
  museum_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  sold_count: number;
  is_active: boolean;
}

interface LocalTicket {
  id: string;
  qr_code: string;
  ticket_type_id: string;
  museum_id: string;
  remaining_credits: number;
  is_used: boolean;
  created_at: string;
}

interface PendingUsage {
  id: string;
  ticket_id: string;
  museum_id: string;
  used_credits: number;
  used_by: string | null;
  used_at: string;
  synced: boolean;
}

const DB_NAME = 'ebilet-offline';
const DB_VERSION = 2;

let db: IDBPDatabase | null = null;

export const initOfflineDb = async (): Promise<IDBPDatabase> => {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Pending tickets
      if (!database.objectStoreNames.contains('pendingTickets')) {
        const pendingStore = database.createObjectStore('pendingTickets', { keyPath: 'id' });
        pendingStore.createIndex('by-synced', 'synced');
      }

      // Cached data stores
      if (!database.objectStoreNames.contains('cachedMuseums')) {
        database.createObjectStore('cachedMuseums', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('cachedTicketTypes')) {
        database.createObjectStore('cachedTicketTypes', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('cachedMuseumPrices')) {
        const pricesStore = database.createObjectStore('cachedMuseumPrices', { keyPath: 'id' });
        pricesStore.createIndex('by-museum', 'museum_id');
      }
      if (!database.objectStoreNames.contains('cachedSessions')) {
        const sessionsStore = database.createObjectStore('cachedSessions', { keyPath: 'id' });
        sessionsStore.createIndex('by-museum-date', 'museum_id');
      }

      // Local tickets for offline validation
      if (!database.objectStoreNames.contains('localTickets')) {
        const localStore = database.createObjectStore('localTickets', { keyPath: 'id' });
        localStore.createIndex('by-qr', 'qr_code');
      }

      // Pending usage
      if (!database.objectStoreNames.contains('pendingUsage')) {
        const usageStore = database.createObjectStore('pendingUsage', { keyPath: 'id' });
        usageStore.createIndex('by-synced', 'synced');
      }

      // Sync metadata
      if (!database.objectStoreNames.contains('syncMeta')) {
        database.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    },
  });

  return db;
};

export const getDb = async (): Promise<IDBPDatabase> => {
  if (!db) {
    return initOfflineDb();
  }
  return db;
};

// Pending ticket işlemleri
export const addPendingTicket = async (ticket: PendingTicket) => {
  const database = await getDb();
  await database.put('pendingTickets', ticket);
  // Aynı zamanda local tickets'a da ekle (offline doğrulama için)
  const localTicket: LocalTicket = {
    id: ticket.id,
    qr_code: ticket.qr_code,
    ticket_type_id: ticket.ticket_type_id,
    museum_id: ticket.museum_id,
    remaining_credits: ticket.remaining_credits,
    is_used: false,
    created_at: ticket.created_at,
  };
  await database.put('localTickets', localTicket);
};

export const getPendingTickets = async (): Promise<PendingTicket[]> => {
  const database = await getDb();
  const all = await database.getAll('pendingTickets');
  return all.filter(t => t.synced === false);
};

export const markTicketSynced = async (id: string) => {
  const database = await getDb();
  const ticket = await database.get('pendingTickets', id);
  if (ticket) {
    ticket.synced = true;
    await database.put('pendingTickets', ticket);
  }
};

export const deletePendingTicket = async (id: string) => {
  const database = await getDb();
  await database.delete('pendingTickets', id);
};

// Cache işlemleri
export const cacheMuseums = async (museums: CachedMuseum[]) => {
  const database = await getDb();
  const tx = database.transaction('cachedMuseums', 'readwrite');
  await tx.store.clear();
  for (const museum of museums) {
    await tx.store.put(museum);
  }
  await tx.done;
};

export const getCachedMuseums = async (): Promise<CachedMuseum[]> => {
  const database = await getDb();
  return database.getAll('cachedMuseums');
};

export const cacheTicketTypes = async (types: CachedTicketType[]) => {
  const database = await getDb();
  const tx = database.transaction('cachedTicketTypes', 'readwrite');
  await tx.store.clear();
  for (const type of types) {
    await tx.store.put(type);
  }
  await tx.done;
};

export const getCachedTicketTypes = async (): Promise<CachedTicketType[]> => {
  const database = await getDb();
  return database.getAll('cachedTicketTypes');
};

export const cacheMuseumPrices = async (prices: CachedMuseumPrice[]) => {
  const database = await getDb();
  const tx = database.transaction('cachedMuseumPrices', 'readwrite');
  await tx.store.clear();
  for (const price of prices) {
    await tx.store.put(price);
  }
  await tx.done;
};

export const getCachedMuseumPrices = async (museumId?: string): Promise<CachedMuseumPrice[]> => {
  const database = await getDb();
  if (museumId) {
    return database.getAllFromIndex('cachedMuseumPrices', 'by-museum', museumId);
  }
  return database.getAll('cachedMuseumPrices');
};

export const cacheSessions = async (sessions: CachedSession[]) => {
  const database = await getDb();
  const tx = database.transaction('cachedSessions', 'readwrite');
  await tx.store.clear();
  for (const session of sessions) {
    await tx.store.put(session);
  }
  await tx.done;
};

export const getCachedSessions = async (museumId?: string): Promise<CachedSession[]> => {
  const database = await getDb();
  if (museumId) {
    return database.getAllFromIndex('cachedSessions', 'by-museum-date', museumId);
  }
  return database.getAll('cachedSessions');
};

// Local ticket doğrulama
export const getLocalTicketByQR = async (qrCode: string): Promise<LocalTicket | undefined> => {
  const database = await getDb();
  return database.getFromIndex('localTickets', 'by-qr', qrCode);
};

export const updateLocalTicketCredits = async (id: string, remainingCredits: number, isUsed: boolean) => {
  const database = await getDb();
  const ticket = await database.get('localTickets', id);
  if (ticket) {
    ticket.remaining_credits = remainingCredits;
    ticket.is_used = isUsed;
    await database.put('localTickets', ticket);
  }
};

// Pending usage işlemleri
export const addPendingUsage = async (usage: PendingUsage) => {
  const database = await getDb();
  await database.put('pendingUsage', usage);
};

export const getPendingUsage = async (): Promise<PendingUsage[]> => {
  const database = await getDb();
  const all = await database.getAll('pendingUsage');
  return all.filter(u => u.synced === false);
};

export const markUsageSynced = async (id: string) => {
  const database = await getDb();
  const usage = await database.get('pendingUsage', id);
  if (usage) {
    usage.synced = true;
    await database.put('pendingUsage', usage);
  }
};

export const deletePendingUsage = async (id: string) => {
  const database = await getDb();
  await database.delete('pendingUsage', id);
};

// Pending count
export const getPendingCount = async (): Promise<number> => {
  const database = await getDb();
  const allTickets = await database.getAll('pendingTickets');
  const allUsages = await database.getAll('pendingUsage');
  const pendingTickets = allTickets.filter(t => t.synced === false);
  const pendingUsages = allUsages.filter(u => u.synced === false);
  return pendingTickets.length + pendingUsages.length;
};

// Export types
export type { PendingTicket, CachedMuseum, CachedTicketType, CachedMuseumPrice, CachedSession, LocalTicket, PendingUsage };
