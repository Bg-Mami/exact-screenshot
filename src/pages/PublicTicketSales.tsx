import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, ShoppingCart, Plus, Minus, Trash2, CreditCard, QrCode, MapPin, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';

interface Museum {
  id: string;
  name: string;
  address: string | null;
}

interface TicketType {
  id: string;
  name: string;
  type_key: string;
  price: number;
  credits: number;
  color: string;
  is_combo: boolean;
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

interface MuseumPrice {
  id: string;
  museum_id: string;
  ticket_type_id: string;
  price: number;
}

interface CartItem {
  ticketTypeId: string;
  quantity: number;
}

interface PurchasedTicket {
  id: string;
  qr_code: string;
  price: number;
  ticket_type: TicketType;
  museum: Museum;
  session: Session | null;
}

const PublicTicketSales = () => {
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [museumPrices, setMuseumPrices] = useState<MuseumPrice[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>([]);
  const [showTickets, setShowTickets] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMuseum) {
      loadSessions();
      setCart([]);
      setSelectedSession('');
    }
  }, [selectedMuseum]);

  const loadData = async () => {
    try {
      const [museumsRes, ticketTypesRes, pricesRes] = await Promise.all([
        supabase.from('museums').select('id, name, address').eq('is_active', true),
        supabase.from('ticket_types').select('id, name, type_key, price, credits, color, is_combo').eq('is_active', true),
        supabase.from('museum_ticket_prices').select('id, museum_id, ticket_type_id, price').eq('is_active', true),
      ]);

      if (museumsRes.data) setMuseums(museumsRes.data);
      if (ticketTypesRes.data) {
        // Filter out free tickets for public sales
        const paidTickets = ticketTypesRes.data.filter(t => 
          !t.type_key.includes('cretsiz') && !t.type_key.includes('ehit')
        );
        setTicketTypes(paidTickets);
      }
      if (pricesRes.data) setMuseumPrices(pricesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('museum_id', selectedMuseum)
      .eq('session_date', today)
      .eq('is_active', true)
      .order('start_time');
    
    if (data) setSessions(data);
  };

  const getAvailableTicketTypes = () => {
    if (!selectedMuseum) return [];
    
    const museumPriceIds = museumPrices
      .filter(mp => mp.museum_id === selectedMuseum)
      .map(mp => mp.ticket_type_id);

    return ticketTypes.filter(tt => museumPriceIds.includes(tt.id));
  };

  const getTicketPrice = (ticketTypeId: string) => {
    const museumPrice = museumPrices.find(
      mp => mp.museum_id === selectedMuseum && mp.ticket_type_id === ticketTypeId
    );
    return museumPrice?.price ?? ticketTypes.find(t => t.id === ticketTypeId)?.price ?? 0;
  };

  const addToCart = (ticketTypeId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.ticketTypeId === ticketTypeId);
      if (existing) {
        return prev.map(item =>
          item.ticketTypeId === ticketTypeId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ticketTypeId, quantity: 1 }];
    });
  };

  const removeFromCart = (ticketTypeId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.ticketTypeId === ticketTypeId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.ticketTypeId === ticketTypeId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter(item => item.ticketTypeId !== ticketTypeId);
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      return total + getTicketPrice(item.ticketTypeId) * item.quantity;
    }, 0);
  };

  const getTotalQuantity = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const generateQRCode = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `KIOSK-${timestamp}-${random}`.toUpperCase();
  };

  const handlePurchase = async () => {
    if (cart.length === 0) {
      toast.error('Sepetiniz boş');
      return;
    }

    setIsPurchasing(true);
    const tickets: PurchasedTicket[] = [];
    const museum = museums.find(m => m.id === selectedMuseum)!;
    const session = sessions.find(s => s.id === selectedSession) || null;

    try {
      for (const item of cart) {
        const ticketType = ticketTypes.find(t => t.id === item.ticketTypeId)!;
        const price = getTicketPrice(item.ticketTypeId);
        const credits = ticketType.is_combo ? ticketType.credits : ticketType.credits;

        for (let i = 0; i < item.quantity; i++) {
          const qrCode = generateQRCode();

          const { data, error } = await supabase.from('tickets').insert({
            ticket_type_id: item.ticketTypeId,
            museum_id: selectedMuseum,
            session_id: selectedSession || null,
            qr_code: qrCode,
            price: price,
            sold_by: '00000000-0000-0000-0000-000000000000', // Kiosk/Online sale
            remaining_credits: credits,
          }).select().single();

          if (error) throw error;

          tickets.push({
            id: data.id,
            qr_code: data.qr_code,
            price: data.price,
            ticket_type: ticketType,
            museum,
            session,
          });
        }
      }

      // Update session sold count if session selected
      if (selectedSession && session) {
        const newSoldCount = session.sold_count + getTotalQuantity();
        await supabase
          .from('sessions')
          .update({ sold_count: newSoldCount })
          .eq('id', selectedSession);
      }

      setPurchasedTickets(tickets);
      setShowTickets(true);
      setCart([]);
      toast.success(`${tickets.length} bilet başarıyla satın alındı!`);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Satın alma işlemi başarısız');
    } finally {
      setIsPurchasing(false);
    }
  };

  const resetPurchase = () => {
    setShowTickets(false);
    setPurchasedTickets([]);
    setSelectedMuseum('');
    setSelectedSession('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show purchased tickets
  if (showTickets && purchasedTickets.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500 text-white mb-4">
              <Ticket className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
              Satın Alma Başarılı!
            </h1>
            <p className="text-muted-foreground">
              Biletlerinizi aşağıda görebilir veya ekran görüntüsü alabilirsiniz
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {purchasedTickets.map((ticket, index) => (
              <Card key={ticket.id} className="overflow-hidden">
                <CardHeader className="bg-primary text-primary-foreground py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="w-5 h-5" />
                    Bilet #{index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center mb-4">
                    <QRCodeSVG
                      value={ticket.qr_code}
                      size={150}
                      level="H"
                      includeMargin
                    />
                    <p className="mt-2 font-mono text-sm text-muted-foreground">
                      {ticket.qr_code}
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Müze:</span>
                      <span className="font-medium">{ticket.museum.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bilet Türü:</span>
                      <span className="font-medium">{ticket.ticket_type.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fiyat:</span>
                      <span className="font-medium">{ticket.price} ₺</span>
                    </div>
                    {ticket.session && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seans:</span>
                        <span className="font-medium">
                          {ticket.session.start_time.slice(0, 5)} - {ticket.session.end_time.slice(0, 5)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tarih:</span>
                      <span className="font-medium">
                        {format(new Date(), 'dd MMMM yyyy', { locale: tr })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button onClick={resetPurchase} size="lg" className="gap-2">
              <ShoppingCart className="w-5 h-5" />
              Yeni Satın Alma
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Ticket className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">E-Bilet</h1>
              <p className="text-xs text-muted-foreground">Online Bilet Satış</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <QrCode className="w-3 h-3" />
            Kiosk Modu
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 pb-32">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Museum & Session Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Müze Seçin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedMuseum} onValueChange={setSelectedMuseum}>
                  <SelectTrigger className="w-full text-lg h-12">
                    <SelectValue placeholder="Müze seçiniz..." />
                  </SelectTrigger>
                  <SelectContent>
                    {museums.map(museum => (
                      <SelectItem key={museum.id} value={museum.id} className="text-lg py-3">
                        {museum.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedMuseum && sessions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Seans Seçin (Opsiyonel)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sessions.map(session => {
                      const isFull = session.sold_count >= session.capacity;
                      const remaining = session.capacity - session.sold_count;
                      
                      return (
                        <button
                          key={session.id}
                          onClick={() => !isFull && setSelectedSession(session.id === selectedSession ? '' : session.id)}
                          disabled={isFull}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            selectedSession === session.id
                              ? 'border-primary bg-primary/10'
                              : isFull
                              ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 hover:border-primary/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                              </p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Users className="w-3 h-3" />
                                {remaining} kişilik yer
                              </p>
                            </div>
                            {isFull && (
                              <Badge variant="destructive" className="text-xs">DOLU</Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedMuseum && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="w-5 h-5" />
                    Bilet Türleri
                  </CardTitle>
                  <CardDescription>Almak istediğiniz biletleri seçin</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {getAvailableTicketTypes().map(ticketType => {
                      const price = getTicketPrice(ticketType.id);
                      const cartItem = cart.find(c => c.ticketTypeId === ticketType.id);
                      const quantity = cartItem?.quantity || 0;

                      return (
                        <div
                          key={ticketType.id}
                          className="p-4 rounded-xl border-2 border-gray-200 hover:border-primary/50 transition-all"
                          style={{ borderLeftColor: ticketType.color, borderLeftWidth: 4 }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold">{ticketType.name}</h3>
                              {ticketType.is_combo && (
                                <Badge variant="secondary" className="text-xs mt-1">Kombine</Badge>
                              )}
                            </div>
                            <span className="text-xl font-bold text-primary">{price} ₺</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            {quantity > 0 ? (
                              <div className="flex items-center gap-3">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => removeFromCart(ticketType.id)}
                                >
                                  {quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                </Button>
                                <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                                <Button
                                  size="icon"
                                  onClick={() => addToCart(ticketType.id)}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={() => addToCart(ticketType.id)}
                                className="gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Ekle
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Sepetiniz
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Sepetiniz boş
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => {
                      const ticketType = ticketTypes.find(t => t.id === item.ticketTypeId)!;
                      const price = getTicketPrice(item.ticketTypeId);
                      
                      return (
                        <div key={item.ticketTypeId} className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{ticketType.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} x {price} ₺
                            </p>
                          </div>
                          <span className="font-bold">{item.quantity * price} ₺</span>
                        </div>
                      );
                    })}
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Toplam</span>
                      <span className="font-bold text-primary">{getTotalPrice()} ₺</span>
                    </div>
                    
                    <Button
                      onClick={handlePurchase}
                      disabled={isPurchasing || cart.length === 0}
                      size="lg"
                      className="w-full gap-2 text-lg h-14"
                    >
                      {isPurchasing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          İşleniyor...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          Satın Al
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicTicketSales;
