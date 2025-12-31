import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { TicketCard } from '@/components/TicketCard';
import { QRTicket } from '@/components/QRTicket';
import { useTicketStore } from '@/store/ticketStore';
import { TICKET_TYPES, TicketType, Ticket } from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Printer, RefreshCw, X, Minus, Plus, ChevronLeft, ChevronRight, ShoppingCart, Trash2 } from 'lucide-react';

interface CartItem {
  type: TicketType;
  quantity: number;
}

const SellTicket = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [generatedTickets, setGeneratedTickets] = useState<Ticket[]>([]);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const { addTicket, currentUser, staff } = useTicketStore();

  const addToCart = (type: TicketType) => {
    setCart(prev => {
      const existing = prev.find(item => item.type === type);
      if (existing) {
        return prev.map(item => 
          item.type === type 
            ? { ...item, quantity: Math.min(50, item.quantity + 1) }
            : item
        );
      }
      return [...prev, { type, quantity: 1 }];
    });
  };

  const updateCartQuantity = (type: TicketType, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.type === type) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: Math.min(50, newQuantity) };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (type: TicketType) => {
    setCart(prev => prev.filter(item => item.type !== type));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleSell = () => {
    if (cart.length === 0) {
      toast.error('Lütfen sepete bilet ekleyin');
      return;
    }

    const seller = currentUser?.name || staff.find(s => s.isActive)?.name || 'Sistem';
    const tickets: Ticket[] = [];
    
    cart.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        const ticket = addTicket(item.type, seller);
        tickets.push(ticket);
      }
    });
    
    setGeneratedTickets(tickets);
    setCurrentTicketIndex(0);
    
    toast.success(`${totalTickets} adet bilet başarıyla satıldı!`, {
      description: `Toplam: ₺${totalPrice}`,
    });
  };

  const handleNewSale = () => {
    setCart([]);
    setGeneratedTickets([]);
    setCurrentTicketIndex(0);
  };

  const totalTickets = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const typeInfo = TICKET_TYPES.find(t => t.type === item.type)!;
    return sum + (typeInfo.price * item.quantity);
  }, 0);

  const getCartItemInfo = (type: TicketType) => TICKET_TYPES.find(t => t.type === type)!;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Bilet Satış</h1>
          <p className="text-muted-foreground mt-1">
            Bilet türlerini seçin, sepete ekleyin ve satışı tamamlayın
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
              {TICKET_TYPES.map((type, index) => {
                const cartItem = cart.find(item => item.type === type.type);
                return (
                  <div 
                    key={type.type}
                    style={{ animationDelay: `${index * 100}ms` }}
                    className="animate-slide-up relative"
                  >
                    <TicketCard
                      ticketType={type}
                      isSelected={!!cartItem}
                      onClick={() => addToCart(type.type)}
                    />
                    {cartItem && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg animate-scale-in">
                        {cartItem.quantity}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cart Section */}
            {cart.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    Sepet ({totalTickets} bilet)
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Temizle
                  </Button>
                </div>

                <div className="space-y-3">
                  {cart.map(item => {
                    const typeInfo = getCartItemInfo(item.type);
                    const itemTotal = typeInfo.price * item.quantity;
                    return (
                      <div 
                        key={item.type}
                        className="flex items-center justify-between bg-secondary/50 rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{typeInfo.icon}</span>
                          <div>
                            <p className="font-medium text-foreground">{typeInfo.label}</p>
                            <p className="text-sm text-muted-foreground">₺{typeInfo.price} / adet</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.type, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 0;
                                const diff = newQty - item.quantity;
                                if (newQty > 0 && newQty <= 50) {
                                  updateCartQuantity(item.type, diff);
                                }
                              }}
                              className="w-12 h-7 text-center bg-transparent border-0 font-bold"
                              min={1}
                              max={50}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.type, 1)}
                              disabled={item.quantity >= 50}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          <span className="font-bold text-primary min-w-[70px] text-right">
                            ₺{itemTotal}
                          </span>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromCart(item.type)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cart Total */}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-lg text-muted-foreground">Toplam Tutar:</span>
                  <span className="text-3xl font-bold text-primary">₺{totalPrice}</span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-card/95 backdrop-blur-lg border-t border-border p-4 animate-slide-up">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex-1">
                  {cart.length > 0 ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground">{totalTickets} bilet</span>
                      <span className="text-2xl font-bold text-primary">₺{totalPrice}</span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Sepete bilet eklemek için tıklayın</p>
                  )}
                </div>
                
                <Button
                  size="lg"
                  onClick={handleSell}
                  disabled={cart.length === 0}
                  className="px-8 gradient-primary border-0 disabled:opacity-50"
                >
                  {totalTickets > 1 ? `${totalTickets} Bilet Sat` : 'Satışı Tamamla'}
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