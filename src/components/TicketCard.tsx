import { cn } from '@/lib/utils';
import { TicketTypeInfo } from '@/types/ticket';
import { Check } from 'lucide-react';

interface TicketCardProps {
  ticketType: TicketTypeInfo;
  isSelected?: boolean;
  onClick?: () => void;
}

export const TicketCard = ({ ticketType, isSelected, onClick }: TicketCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full p-6 rounded-2xl border-2 transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        "animate-fade-in",
        isSelected 
          ? "border-primary bg-primary/5 shadow-lg" 
          : "border-border bg-card hover:border-primary/50"
      )}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center text-2xl",
          ticketType.colorClass
        )}>
          {ticketType.icon}
        </div>
        
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">
            {ticketType.label}
          </h3>
          <p className="text-2xl font-bold text-primary mt-1">
            {ticketType.price > 0 ? `₺${ticketType.price}` : 'Ücretsiz'}
          </p>
        </div>
      </div>
    </button>
  );
};
