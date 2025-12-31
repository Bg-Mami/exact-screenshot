import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { TicketCard } from '@/components/TicketCard';
import { QRTicket } from '@/components/QRTicket';
import { useTicketStore } from '@/store/ticketStore';
import { TICKET_TYPES, TicketType, Ticket } from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Printer, RefreshCw, X } from 'lucide-react';

const SellTicket = () => {
  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const { addTicket, currentUser, staff } = useTicketStore();

  const handleSell = () => {
    if (!selectedType) {
      toast.error('Lütfen bir bilet türü seçin');
      return;
    }

    const seller = currentUser?.name || staff.find(s => s.isActive)?.name || 'Sistem';
    const ticket = addTicket(selectedType, seller);
    setLastTicket(ticket);
    
    const typeInfo = TICKET_TYPES.find(t => t.type === selectedType)!;
    toast.success(`${typeInfo.label} başarıyla satıldı!`, {
      description: `Kod: ${ticket.qrCode}`,
    });
  };

  const handleNewSale = () => {
    setSelectedType(null);
    setLastTicket(null);
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Bilet Satış</h1>
          <p className="text-muted-foreground mt-1">
            Bilet türünü seçin ve satışı tamamlayın
          </p>
        </div>

        {lastTicket ? (
          /* Ticket Generated View */
          <div className="flex flex-col items-center animate-scale-in">
            <div className="bg-success/10 border border-success rounded-2xl p-4 mb-6 text-center">
              <p className="text-success font-semibold">✓ Bilet Başarıyla Oluşturuldu!</p>
            </div>
            
            <QRTicket ticket={lastTicket} size="lg" />

            <div className="flex gap-4 mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.print()}
                className="gap-2"
              >
                <Printer className="w-5 h-5" />
                Yazdır
              </Button>
              <Button
                size="lg"
                onClick={handleNewSale}
                className="gap-2 gradient-primary border-0"
              >
                <RefreshCw className="w-5 h-5" />
                Yeni Satış
              </Button>
            </div>
          </div>
        ) : (
          /* Ticket Selection View */
          <div className="space-y-8">
            {/* Ticket Types Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TICKET_TYPES.map((type, index) => (
                <div 
                  key={type.type}
                  style={{ animationDelay: `${index * 100}ms` }}
                  className="animate-slide-up"
                >
                  <TicketCard
                    ticketType={type}
                    isSelected={selectedType === type.type}
                    onClick={() => setSelectedType(type.type)}
                  />
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-card/95 backdrop-blur-lg border-t border-border p-4 animate-slide-up">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex-1">
                  {selectedType ? (
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">Seçilen:</span>
                      <span className="font-semibold text-foreground">
                        {TICKET_TYPES.find(t => t.type === selectedType)?.label}
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        ₺{TICKET_TYPES.find(t => t.type === selectedType)?.price}
                      </span>
                      <button 
                        onClick={() => setSelectedType(null)}
                        className="p-1 hover:bg-secondary rounded-full"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Bilet türü seçin</p>
                  )}
                </div>
                
                <Button
                  size="lg"
                  onClick={handleSell}
                  disabled={!selectedType}
                  className="px-8 gradient-primary border-0 disabled:opacity-50"
                >
                  Satışı Tamamla
                </Button>
              </div>
            </div>

            {/* Bottom padding for fixed bar */}
            <div className="h-24" />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SellTicket;
