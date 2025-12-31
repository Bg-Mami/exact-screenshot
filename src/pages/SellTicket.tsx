import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { TicketCard } from '@/components/TicketCard';
import { QRTicket } from '@/components/QRTicket';
import { useTicketStore } from '@/store/ticketStore';
import { TICKET_TYPES, TicketType, Ticket } from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Printer, RefreshCw, X, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const SellTicket = () => {
  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [generatedTickets, setGeneratedTickets] = useState<Ticket[]>([]);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const { addTicket, currentUser, staff } = useTicketStore();

  const handleSell = () => {
    if (!selectedType) {
      toast.error('Lütfen bir bilet türü seçin');
      return;
    }

    const seller = currentUser?.name || staff.find(s => s.isActive)?.name || 'Sistem';
    const tickets: Ticket[] = [];
    
    for (let i = 0; i < quantity; i++) {
      const ticket = addTicket(selectedType, seller);
      tickets.push(ticket);
    }
    
    setGeneratedTickets(tickets);
    setCurrentTicketIndex(0);
    
    const typeInfo = TICKET_TYPES.find(t => t.type === selectedType)!;
    toast.success(`${quantity} adet ${typeInfo.label} başarıyla satıldı!`, {
      description: `Toplam: ₺${typeInfo.price * quantity}`,
    });
  };

  const handleNewSale = () => {
    setSelectedType(null);
    setQuantity(1);
    setGeneratedTickets([]);
    setCurrentTicketIndex(0);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(50, prev + delta)));
  };

  const selectedTypeInfo = selectedType ? TICKET_TYPES.find(t => t.type === selectedType) : null;
  const totalPrice = selectedTypeInfo ? selectedTypeInfo.price * quantity : 0;

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

        {generatedTickets.length > 0 ? (
          /* Tickets Generated View */
          <div className="flex flex-col items-center animate-scale-in">
            <div className="bg-success/10 border border-success rounded-2xl p-4 mb-6 text-center">
              <p className="text-success font-semibold">
                ✓ {generatedTickets.length} Adet Bilet Başarıyla Oluşturuldu!
              </p>
            </div>
            
            {/* Ticket Navigation */}
            {generatedTickets.length > 1 && (
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentTicketIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentTicketIndex === 0}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-lg font-semibold text-foreground">
                  {currentTicketIndex + 1} / {generatedTickets.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentTicketIndex(prev => Math.min(generatedTickets.length - 1, prev + 1))}
                  disabled={currentTicketIndex === generatedTickets.length - 1}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            <QRTicket ticket={generatedTickets[currentTicketIndex]} size="lg" />

            <div className="flex gap-4 mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.print()}
                className="gap-2"
              >
                <Printer className="w-5 h-5" />
                {generatedTickets.length > 1 ? 'Tümünü Yazdır' : 'Yazdır'}
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

            {/* Print All Tickets (hidden for print) */}
            <div className="hidden print:block">
              {generatedTickets.map((ticket, index) => (
                <div key={ticket.id} className={index > 0 ? 'page-break-before' : ''}>
                  <QRTicket ticket={ticket} size="lg" />
                </div>
              ))}
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
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 w-full sm:w-auto">
                  {selectedType ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-muted-foreground">Seçilen:</span>
                      <span className="font-semibold text-foreground">
                        {selectedTypeInfo?.label}
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

                {/* Quantity Selector */}
                {selectedType && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">Adet:</span>
                    <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                        className="w-16 h-8 text-center bg-transparent border-0 font-bold text-lg"
                        min={1}
                        max={50}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(1)}
                        disabled={quantity >= 50}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <span className="text-2xl font-bold text-primary min-w-[80px] text-right">
                      ₺{totalPrice}
                    </span>
                  </div>
                )}
                
                <Button
                  size="lg"
                  onClick={handleSell}
                  disabled={!selectedType}
                  className="px-8 gradient-primary border-0 disabled:opacity-50 w-full sm:w-auto"
                >
                  {quantity > 1 ? `${quantity} Bilet Sat` : 'Satışı Tamamla'}
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
