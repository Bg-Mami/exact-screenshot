export type TicketType = 'full' | 'student' | 'group' | 'disabled' | 'free';

export interface Ticket {
  id: string;
  type: TicketType;
  price: number;
  createdAt: Date;
  soldBy: string;
  qrCode: string;
  isUsed: boolean;
  usedAt?: Date;
}

export interface TicketTypeInfo {
  type: TicketType;
  label: string;
  price: number;
  colorClass: string;
  icon: string;
}

export interface Staff {
  id: string;
  name: string;
  role: 'cashier' | 'admin';
  isActive: boolean;
}

export interface DailyStats {
  date: string;
  totalSales: number;
  totalRevenue: number;
  byType: Record<TicketType, number>;
}

export const TICKET_TYPES: TicketTypeInfo[] = [
  { type: 'full', label: 'Tam Bilet', price: 50, colorClass: 'bg-ticket-full', icon: '🎫' },
  { type: 'student', label: 'Öğrenci Bileti', price: 25, colorClass: 'bg-ticket-student', icon: '🎓' },
  { type: 'group', label: 'Grup Bileti', price: 40, colorClass: 'bg-ticket-group', icon: '👥' },
  { type: 'disabled', label: 'Engelli Bileti', price: 10, colorClass: 'bg-ticket-disabled', icon: '♿' },
  { type: 'free', label: 'Ücretsiz Geçiş', price: 0, colorClass: 'bg-ticket-free', icon: '🆓' },
];
