import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, ShoppingCart, Plus, Minus, Trash2, CreditCard, QrCode, MapPin, Clock, Users, Maximize, Minimize } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  const isKioskMode = searchParams.get('mode') === 'kiosk';
  
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idleTimer, setIdleTimer] = useState<NodeJS.Timeout | null>(null);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Auto-reset for kiosk mode after 60 seconds of inactivity
  const resetIdleTimer = useCallback(() => {
    if (idleTimer) clearTimeout(idleTimer);
    if (isKioskMode && !showTickets) {
      const timer = setTimeout(() => {
        setCart([]);
        setSelectedMuseum('');
        setSelectedSession('');
      }, 60000); // 60 seconds
      setIdleTimer(timer);
    }
  }, [isKioskMode, showTickets, idleTimer]);

  useEffect(() => {
    loadData();
    
    // Kiosk mode: enter fullscreen automatically
    if (isKioskMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }

    // Prevent right-click in kiosk mode
    const handleContextMenu = (e: MouseEvent) => {
      if (isKioskMode) e.preventDefault();
    };

    // Prevent keyboard shortcuts in kiosk mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isKioskMode) {
        // Block F11, Escape, Alt+Tab, Ctrl+W, etc.
        if (e.key === 'F11' || e.key === 'Escape' || 
            (e.altKey && e.key === 'Tab') || 
            (e.ctrlKey && e.key === 'w') ||
            (e.ctrlKey && e.key === 'r')) {
          e.preventDefault();
        }
      }
      resetIdleTimer();
    };

    const handleActivity = () => resetIdleTimer();

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [isKioskMode]);

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
    resetIdleTimer();
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
    resetIdleTimer();
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
        const credits = ticketType.credits;

        for (let i = 0; i < item.quantity; i++) {
          const qrCode = generateQRCode();

          const { data, error } = await supabase.from('tickets').insert({
            ticket_type_id: item.ticketTypeId,
            museum_id: selectedMuseum,
            session_id: selectedSession || null,
            qr_code: qrCode,
            price: price,
            sold_by: '00000000-0000-0000-0000-000000000000',
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

      // Auto-reset after showing tickets in kiosk mode
      if (isKioskMode) {
        setTimeout(() => {
          resetPurchase();
        }, 30000); // 30 seconds to view tickets
      }
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-xl text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show purchased tickets
  if (showTickets && purchasedTickets.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4 select-none">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500 text-white mb-4 animate-bounce">
              <Ticket className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold text-green-700 dark:text-green-400 mb-2">
              Satın Alma Başarılı!
            </h1>
            <p className="text-lg text-muted-foreground">
              Biletlerinizi ekran görüntüsü alarak saklayabilirsiniz
            </p>
            {isKioskMode && (
              <p className="text-sm text-orange-600 mt-2">
                Ekran 30 saniye sonra sıfırlanacak
              </p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {purchasedTickets.map((ticket, index) => (
              <Card key={ticket.id} className="overflow-hidden shadow-lg">
                <CardHeader className="bg-primary text-primary-foreground py-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Ticket className="w-6 h-6" />
                    Bilet #{index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center mb-4">
                    <QRCodeSVG
                      value={ticket.qr_code}
                      size={180}
                      level="H"
                      includeMargin
                    />
                    <p className="mt-2 font-mono text-base text-muted-foreground">
                      {ticket.qr_code}
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-3 text-base">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Müze:</span>
                      <span className="font-semibold text-right">{ticket.museum.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bilet Türü:</span>
                      <span className="font-semibold">{ticket.ticket_type.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fiyat:</span>
                      <span className="font-bold text-primary text-lg">{ticket.price} ₺</span>
                    </div>
                    {ticket.session && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seans:</span>
                        <span className="font-semibold">
                          {ticket.session.start_time.slice(0, 5)} - {ticket.session.end_time.slice(0, 5)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tarih:</span>
                      <span className="font-semibold">
                        {format(new Date(), 'dd MMMM yyyy', { locale: tr })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button onClick={resetPurchase} size="lg" className="gap-2 text-lg h-14 px-8">
              <ShoppingCart className="w-6 h-6" />
              Yeni Satın Alma
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 select-none ${isKioskMode ? 'cursor-default' : ''}`}>
      {/* Header */}
      <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Ticket className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">E-Bilet</h1>
              <p className="text-sm text-muted-foreground">Online Bilet Satış</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-base py-1 px-3">
              <QrCode className="w-4 h-4" />
              {isKioskMode ? 'Kiosk' : 'Online'}
            </Badge>
            {!isKioskMode && (
              <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 pb-32">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Museum & Session Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MapPin className="w-6 h-6" />
                  Müze Seçin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedMuseum} onValueChange={setSelectedMuseum}>
                  <SelectTrigger className="w-full text-lg h-14">
                    <SelectValue placeholder="Müze seçiniz..." />
                  </SelectTrigger>
                  <SelectContent>
                    {museums.map(museum => (
                      <SelectItem key={museum.id} value={museum.id} className="text-lg py-4">
                        {museum.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedMuseum && sessions.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock className="w-6 h-6" />
                    Seans Seçin (Opsiyonel)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {sessions.map(session => {
                      const isFull = session.sold_count >= session.capacity;
                      const remaining = session.capacity - session.sold_count;
                      
                      return (
                        <button
                          key={session.id}
                          onClick={() => !isFull && setSelectedSession(session.id === selectedSession ? '' : session.id)}
                          disabled={isFull}
                          className={`p-5 rounded-xl border-2 text-left transition-all ${
                            selectedSession === session.id
                              ? 'border-primary bg-primary/10 shadow-md'
                              : isFull
                              ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xl font-bold">
                                {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                              </p>
                              <p className="text-base text-muted-foreground flex items-center gap-1 mt-2">
                                <Users className="w-4 h-4" />
                                {remaining} kişilik yer
                              </p>
                            </div>
                            {isFull && (
                              <Badge variant="destructive" className="text-sm">DOLU</Badge>
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
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Ticket className="w-6 h-6" />
                    Bilet Türleri
                  </CardTitle>
                  <CardDescription className="text-base">Almak istediğiniz biletleri seçin</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-5">
                    {getAvailableTicketTypes().map(ticketType => {
                      const price = getTicketPrice(ticketType.id);
                      const cartItem = cart.find(c => c.ticketTypeId === ticketType.id);
                      const quantity = cartItem?.quantity || 0;

                      return (
                        <div
                          key={ticketType.id}
                          className="p-5 rounded-xl border-2 border-gray-200 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
                          style={{ borderLeftColor: ticketType.color, borderLeftWidth: 6 }}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-bold">{ticketType.name}</h3>
                              {ticketType.is_combo && (
                                <Badge variant="secondary" className="text-sm mt-1">Kombine</Badge>
                              )}
                            </div>
                            <span className="text-2xl font-bold text-primary">{price} ₺</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            {quantity > 0 ? (
                              <div className="flex items-center gap-4">
                                <Button
                                  size="lg"
                                  variant="outline"
                                  onClick={() => removeFromCart(ticketType.id)}
                                  className="h-12 w-12"
                                >
                                  {quantity === 1 ? <Trash2 className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                                </Button>
                                <span className="text-3xl font-bold w-12 text-center">{quantity}</span>
                                <Button
                                  size="lg"
                                  onClick={() => addToCart(ticketType.id)}
                                  className="h-12 w-12"
                                >
                                  <Plus className="w-5 h-5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="lg"
                                onClick={() => addToCart(ticketType.id)}
                                className="gap-2 text-lg h-12"
                              >
                                <Plus className="w-5 h-5" />
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
            <Card className="sticky top-24 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShoppingCart className="w-6 h-6" />
                  Sepetiniz
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12 text-lg">
                    Sepetiniz boş
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => {
                      const ticketType = ticketTypes.find(t => t.id === item.ticketTypeId)!;
                      const price = getTicketPrice(item.ticketTypeId);
                      
                      return (
                        <div key={item.ticketTypeId} className="flex justify-between items-center py-2">
                          <div>
                            <p className="font-semibold text-base">{ticketType.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} x {price} ₺
                            </p>
                          </div>
                          <span className="font-bold text-lg">{item.quantity * price} ₺</span>
                        </div>
                      );
                    })}
                    
                    <Separator className="my-4" />
                    
                    <div className="flex justify-between items-center text-xl">
                      <span className="font-semibold">Toplam</span>
                      <span className="font-bold text-primary text-2xl">{getTotalPrice()} ₺</span>
                    </div>
                    
                    <Button
                      onClick={handlePurchase}
                      disabled={isPurchasing || cart.length === 0}
                      size="lg"
                      className="w-full gap-2 text-xl h-16 mt-4"
                    >
                      {isPurchasing ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          İşleniyor...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-6 h-6" />
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
