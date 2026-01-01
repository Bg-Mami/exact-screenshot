import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Printer, RefreshCw, X, Minus, Plus, ChevronLeft, ChevronRight, ShoppingCart, Trash2, AlertTriangle, Clock } from 'lucide-react';

interface TicketType {
  id: string;
  name: string;
  type_key: string;
  price: number;
  color: string;
  icon: string;
  is_active: boolean;
}

interface Museum {
  id: string;
  name: string;
}

interface Session {
  id: string;
  museum_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  sold_count: number;
}

interface CartItem {
  ticketTypeId: string;
  quantity: number;
}

interface GeneratedTicket {
  id: string;
  qr_code: string;
  price: number;
  ticket_type: TicketType;
  museum: Museum;
  session?: Session;
  created_at: string;
}

const SellTicket = () => {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [generatedTickets, setGeneratedTickets] = useState<GeneratedTicket[]>([]);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedMuseum) {
      fetchSessions(selectedMuseum);
    } else {
      setSessions([]);
      setSelectedSession('');
    }
  }, [selectedMuseum]);

  const fetchData = async () => {
    const [typesRes, museumsRes] = await Promise.all([
      supabase.from('ticket_types').select('*').eq('is_active', true).order('created_at'),
      supabase.from('museums').select('*').eq('is_active', true).order('name'),
    ]);

    if (typesRes.error) toast.error('Bilet türleri yüklenemedi');
    if (museumsRes.error) toast.error('Müzeler yüklenemedi');

    setTicketTypes(typesRes.data || []);
    setMuseums(museumsRes.data || []);
    
    // Auto-select first museum if only one
    if (museumsRes.data?.length === 1) {
      setSelectedMuseum(museumsRes.data[0].id);
    }
    
    setLoading(false);
  };

  const fetchSessions = async (museumId: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('museum_id', museumId)
      .eq('session_date', today)
      .eq('is_active', true)
      .order('start_time');

    if (error) {
      toast.error('Seanslar yüklenemedi');
    } else {
      setSessions(data || []);
    }
  };

  const addToCart = (ticketTypeId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.ticketTypeId === ticketTypeId);
      if (existing) {
        return prev.map(item => 
          item.ticketTypeId === ticketTypeId 
            ? { ...item, quantity: Math.min(50, item.quantity + 1) }
            : item
        );
      }
      return [...prev, { ticketTypeId, quantity: 1 }];
    });
  };

  const updateCartQuantity = (ticketTypeId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.ticketTypeId === ticketTypeId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: Math.min(50, newQuantity) };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (ticketTypeId: string) => {
    setCart(prev => prev.filter(item => item.ticketTypeId !== ticketTypeId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const generateQRCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TKT-';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSell = async () => {
    if (cart.length === 0) {
      toast.error('Lütfen sepete bilet ekleyin');
      return;
    }

    if (!selectedMuseum) {
      toast.error('Lütfen müze seçin');
      return;
    }

    // Check session capacity if session selected
    if (selectedSession) {
      const session = sessions.find(s => s.id === selectedSession);
      if (session) {
        const remaining = session.capacity - session.sold_count;
        if (totalTickets > remaining) {
          toast.error(`Bu seansta sadece ${remaining} kişilik yer kaldı!`);
          return;
        }
      }
    }

    setSelling(true);
    const tickets: GeneratedTicket[] = [];
    const museum = museums.find(m => m.id === selectedMuseum)!;
    const session = sessions.find(s => s.id === selectedSession);

    try {
      for (const item of cart) {
        const ticketType = ticketTypes.find(t => t.id === item.ticketTypeId)!;
        
        for (let i = 0; i < item.quantity; i++) {
          const qrCode = generateQRCode();
          
          const { data, error } = await supabase.from('tickets').insert({
            ticket_type_id: item.ticketTypeId,
            museum_id: selectedMuseum,
            session_id: selectedSession || null,
            qr_code: qrCode,
            price: ticketType.price,
            sold_by: user!.id,
          }).select().single();

          if (error) throw error;

          tickets.push({
            id: data.id,
            qr_code: data.qr_code,
            price: data.price,
            ticket_type: ticketType,
            museum,
            session,
            created_at: data.created_at,
          });
        }
      }

      setGeneratedTickets(tickets);
      setCurrentTicketIndex(0);
      
      toast.success(`${totalTickets} adet bilet başarıyla satıldı!`, {
        description: `Toplam: ₺${totalPrice}`,
      });

      // Refresh sessions to update sold count
      if (selectedSession) {
        fetchSessions(selectedMuseum);
      }
    } catch (error: any) {
      toast.error('Bilet satışı başarısız: ' + error.message);
    } finally {
      setSelling(false);
    }
  };

  const handleNewSale = () => {
    setCart([]);
    setGeneratedTickets([]);
    setCurrentTicketIndex(0);
  };

  const getTicketTypeById = (id: string) => ticketTypes.find(t => t.id === id);

  const totalTickets = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const ticketType = getTicketTypeById(item.ticketTypeId);
    return sum + ((ticketType?.price || 0) * item.quantity);
  }, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Bilet Satış</h1>
          <p className="text-muted-foreground mt-1">
            Müze ve seans seçin, biletleri sepete ekleyin
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

            {/* Inline QR Ticket */}
            <Card className="w-96 overflow-hidden">
              <div className="p-4 text-center" style={{ backgroundColor: generatedTickets[currentTicketIndex].ticket_type.color }}>
                <h3 className="text-lg font-bold text-white">{generatedTickets[currentTicketIndex].museum.name}</h3>
                <p className="text-white/80 text-sm">{generatedTickets[currentTicketIndex].ticket_type.name}</p>
              </div>
              <CardContent className="p-6 flex flex-col items-center bg-white">
                <QRCodeSVG value={generatedTickets[currentTicketIndex].qr_code} size={180} level="H" />
                <p className="mt-3 text-lg font-mono font-bold tracking-wider">{generatedTickets[currentTicketIndex].qr_code}</p>
                <p className="mt-2 text-2xl font-bold text-primary">₺{generatedTickets[currentTicketIndex].price}</p>
              </CardContent>
            </Card>

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

          </div>
        ) : (
          /* Ticket Selection View */
          <div className="space-y-8">
            {/* Museum & Session Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Müze Seçin *</label>
                <Select value={selectedMuseum} onValueChange={setSelectedMuseum}>
                  <SelectTrigger>
                    <SelectValue placeholder="Müze seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {museums.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Seans (Opsiyonel)</label>
                <Select 
                  value={selectedSession} 
                  onValueChange={setSelectedSession}
                  disabled={!selectedMuseum || sessions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={sessions.length === 0 ? 'Seans yok' : 'Seans seçin'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Seanssız</SelectItem>
                    {sessions.map(s => {
                      const remaining = s.capacity - s.sold_count;
                      const isFull = remaining <= 0;
                      return (
                        <SelectItem key={s.id} value={s.id} disabled={isFull}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                            <Badge variant={isFull ? 'destructive' : 'secondary'}>
                              {isFull ? 'DOLU' : `${remaining} kişi`}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Session Capacity Warning */}
            {selectedSession && (() => {
              const session = sessions.find(s => s.id === selectedSession);
              if (session) {
                const remaining = session.capacity - session.sold_count;
                const percent = (session.sold_count / session.capacity) * 100;
                if (percent >= 80) {
                  return (
                    <div className="bg-warning/10 border border-warning rounded-xl p-4 flex items-center gap-3 animate-fade-in">
                      <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-warning">
                          Bu seansta sadece {remaining} kişilik yer kaldı!
                        </p>
                        <Progress value={percent} className="h-2 mt-2" />
                      </div>
                    </div>
                  );
                }
              }
              return null;
            })()}

            {/* Ticket Types Grid */}
            {museums.length === 0 ? (
              <div className="bg-warning/10 border border-warning rounded-xl p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                <p className="text-warning font-medium">Önce Ayarlar'dan müze eklemeniz gerekiyor</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ticketTypes.map((type, index) => {
                  const cartItem = cart.find(item => item.ticketTypeId === type.id);
                  return (
                    <div 
                      key={type.id}
                      style={{ animationDelay: `${index * 100}ms` }}
                      className="animate-slide-up relative cursor-pointer"
                      onClick={() => selectedMuseum ? addToCart(type.id) : toast.error('Önce müze seçin')}
                    >
                      <Card className={`p-4 transition-all ${cartItem ? 'ring-2 ring-primary' : ''}`} style={{ borderLeftColor: type.color, borderLeftWidth: 4 }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: type.color }}>🎫</div>
                          <div className="flex-1">
                            <p className="font-medium">{type.name}</p>
                            <p className="text-lg font-bold text-primary">₺{type.price}</p>
                          </div>
                        </div>
                      </Card>
                      {cartItem && (
                        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg animate-scale-in">
                          {cartItem.quantity}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

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
                    const ticketType = getTicketTypeById(item.ticketTypeId);
                    if (!ticketType) return null;
                    const itemTotal = ticketType.price * item.quantity;
                    return (
                      <div 
                        key={item.ticketTypeId}
                        className="flex items-center justify-between bg-secondary/50 rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                            style={{ backgroundColor: ticketType.color }}
                          >
                            🎫
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{ticketType.name}</p>
                            <p className="text-sm text-muted-foreground">₺{ticketType.price} / adet</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.ticketTypeId, -1)}
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
                                  updateCartQuantity(item.ticketTypeId, diff);
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
                              onClick={() => updateCartQuantity(item.ticketTypeId, 1)}
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
                            onClick={() => removeFromCart(item.ticketTypeId)}
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
                  disabled={cart.length === 0 || !selectedMuseum || selling}
                  className="px-8 gradient-primary border-0 disabled:opacity-50"
                >
                  {selling ? 'Satılıyor...' : totalTickets > 1 ? `${totalTickets} Bilet Sat` : 'Satışı Tamamla'}
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
