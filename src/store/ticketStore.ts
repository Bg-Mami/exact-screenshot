import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Ticket, TicketType, Staff, TICKET_TYPES } from '@/types/ticket';

interface TicketStore {
  tickets: Ticket[];
  staff: Staff[];
  currentUser: Staff | null;
  
  // Actions
  addTicket: (type: TicketType, soldBy: string) => Ticket;
  useTicket: (ticketId: string) => boolean;
  validateTicket: (qrCode: string) => { valid: boolean; ticket?: Ticket; message: string };
  addStaff: (name: string, role: 'cashier' | 'admin') => void;
  removeStaff: (id: string) => void;
  setCurrentUser: (staff: Staff | null) => void;
  toggleStaffStatus: (id: string) => void;
  
  // Stats
  getTodayStats: () => { total: number; revenue: number; byType: Record<TicketType, number> };
  getTicketsByDate: (date: Date) => Ticket[];
}

const generateQRCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'TKT-';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

export const useTicketStore = create<TicketStore>()(
  persist(
    (set, get) => ({
      tickets: [],
      staff: [
        { id: '1', name: 'Admin Kullanıcı', role: 'admin', isActive: true },
        { id: '2', name: 'Gişe 1 - Ahmet', role: 'cashier', isActive: true },
        { id: '3', name: 'Gişe 2 - Ayşe', role: 'cashier', isActive: true },
      ],
      currentUser: null,

      addTicket: (type, soldBy) => {
        const ticketInfo = TICKET_TYPES.find(t => t.type === type)!;
        const newTicket: Ticket = {
          id: generateId(),
          type,
          price: ticketInfo.price,
          createdAt: new Date(),
          soldBy,
          qrCode: generateQRCode(),
          isUsed: false,
        };
        
        set(state => ({
          tickets: [...state.tickets, newTicket]
        }));
        
        return newTicket;
      },

      useTicket: (ticketId) => {
        const ticket = get().tickets.find(t => t.id === ticketId);
        if (!ticket || ticket.isUsed) return false;
        
        set(state => ({
          tickets: state.tickets.map(t => 
            t.id === ticketId 
              ? { ...t, isUsed: true, usedAt: new Date() }
              : t
          )
        }));
        return true;
      },

      validateTicket: (qrCode) => {
        const ticket = get().tickets.find(t => t.qrCode === qrCode);
        
        if (!ticket) {
          return { valid: false, message: 'Bilet bulunamadı!' };
        }
        
        if (ticket.isUsed) {
          return { 
            valid: false, 
            ticket, 
            message: `Bu bilet zaten kullanılmış! (${new Date(ticket.usedAt!).toLocaleString('tr-TR')})` 
          };
        }
        
        // Mark as used
        get().useTicket(ticket.id);
        
        return { 
          valid: true, 
          ticket, 
          message: 'Giriş onaylandı! ✓' 
        };
      },

      addStaff: (name, role) => {
        const newStaff: Staff = {
          id: generateId(),
          name,
          role,
          isActive: true,
        };
        set(state => ({
          staff: [...state.staff, newStaff]
        }));
      },

      removeStaff: (id) => {
        set(state => ({
          staff: state.staff.filter(s => s.id !== id)
        }));
      },

      setCurrentUser: (staff) => {
        set({ currentUser: staff });
      },

      toggleStaffStatus: (id) => {
        set(state => ({
          staff: state.staff.map(s => 
            s.id === id ? { ...s, isActive: !s.isActive } : s
          )
        }));
      },

      getTodayStats: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTickets = get().tickets.filter(t => {
          const ticketDate = new Date(t.createdAt);
          ticketDate.setHours(0, 0, 0, 0);
          return ticketDate.getTime() === today.getTime();
        });

        const byType: Record<TicketType, number> = {
          full: 0,
          student: 0,
          group: 0,
          disabled: 0,
          free: 0,
        };

        let revenue = 0;
        todayTickets.forEach(t => {
          byType[t.type]++;
          revenue += t.price;
        });

        return {
          total: todayTickets.length,
          revenue,
          byType,
        };
      },

      getTicketsByDate: (date) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        return get().tickets.filter(t => {
          const ticketDate = new Date(t.createdAt);
          ticketDate.setHours(0, 0, 0, 0);
          return ticketDate.getTime() === targetDate.getTime();
        });
      },
    }),
    {
      name: 'ticket-store',
    }
  )
);
