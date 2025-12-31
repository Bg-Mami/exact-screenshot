import { QRCodeSVG } from 'qrcode.react';
import { Ticket } from '@/types/ticket';
import { TICKET_TYPES } from '@/types/ticket';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface QRTicketProps {
  ticket: Ticket;
  size?: 'sm' | 'md' | 'lg';
}

export const QRTicket = ({ ticket, size = 'md' }: QRTicketProps) => {
  const ticketInfo = TICKET_TYPES.find(t => t.type === ticket.type)!;
  
  const sizeStyles = {
    sm: 'p-4 w-64',
    md: 'p-6 w-80',
    lg: 'p-8 w-96',
  };

  const qrSizes = {
    sm: 120,
    md: 160,
    lg: 200,
  };

  return (
    <div className={cn(
      "bg-card rounded-3xl border border-border relative overflow-hidden animate-scale-in",
      sizeStyles[size]
    )}>
      {/* Decorative circles for ticket look */}
      <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background" />
      <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background" />
      
      {/* Header */}
      <div className="text-center mb-4">
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-primary-foreground",
          ticketInfo.colorClass
        )}>
          <span>{ticketInfo.icon}</span>
          <span>{ticketInfo.label}</span>
        </div>
      </div>

      {/* Dashed line */}
      <div className="border-t-2 border-dashed border-border my-4" />

      {/* QR Code */}
      <div className="flex justify-center my-6">
        <div className="p-4 bg-primary-foreground rounded-2xl shadow-inner">
          <QRCodeSVG 
            value={ticket.qrCode} 
            size={qrSizes[size]}
            level="H"
            includeMargin={false}
          />
        </div>
      </div>

      {/* Ticket Code */}
      <p className="text-center font-mono text-lg font-bold text-foreground tracking-wider">
        {ticket.qrCode}
      </p>

      {/* Dashed line */}
      <div className="border-t-2 border-dashed border-border my-4" />

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tarih:</span>
          <span className="font-medium text-foreground">
            {format(new Date(ticket.createdAt), 'dd MMM yyyy, HH:mm', { locale: tr })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fiyat:</span>
          <span className="font-bold text-primary">
            {ticket.price > 0 ? `₺${ticket.price}` : 'Ücretsiz'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Satış:</span>
          <span className="font-medium text-foreground">{ticket.soldBy}</span>
        </div>
      </div>

      {/* Status badge */}
      {ticket.isUsed && (
        <div className="absolute inset-0 bg-foreground/80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-xl font-bold text-primary-foreground">KULLANILDI</p>
            <p className="text-sm text-primary-foreground/70">
              {ticket.usedAt && format(new Date(ticket.usedAt), 'dd MMM yyyy, HH:mm', { locale: tr })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
