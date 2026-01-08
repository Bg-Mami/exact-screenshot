import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, Ticket, TrendingUp, Wallet, Monitor, RefreshCw, QrCode, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Museum {
  id: string;
  name: string;
}

interface TicketType {
  id: string;
  name: string;
  color: string;
}

interface OnlineTicket {
  id: string;
  qr_code: string;
  price: number;
  is_used: boolean;
  remaining_credits: number;
  created_at: string;
  ticket_type: TicketType;
  museum: Museum;
}

const OnlineSalesReport = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMuseum, setSelectedMuseum] = useState<string>('all');
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [tickets, setTickets] = useState<OnlineTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMuseums();
  }, []);

  useEffect(() => {
    fetchOnlineTickets();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('online-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
          filter: 'sold_by=eq.00000000-0000-0000-0000-000000000000'
        },
        () => {
          fetchOnlineTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedMuseum]);

  const fetchMuseums = async () => {
    const { data } = await supabase
      .from('museums')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (data) setMuseums(data);
  };

  const fetchOnlineTickets = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    let query = supabase
      .from('tickets')
      .select(`
        id,
        qr_code,
        price,
        is_used,
        remaining_credits,
        created_at,
        ticket_types (id, name, color),
        museums (id, name)
      `)
      .eq('sold_by', '00000000-0000-0000-0000-000000000000') // Kiosk/Online sales
      .gte('created_at', `${dateStr}T00:00:00`)
      .lt('created_at', `${dateStr}T23:59:59.999999`)
      .order('created_at', { ascending: false });

    if (selectedMuseum !== 'all') {
      query = query.eq('museum_id', selectedMuseum);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Veriler yüklenemedi');
      console.error(error);
    } else {
      const formattedTickets: OnlineTicket[] = (data || []).map(t => ({
        id: t.id,
        qr_code: t.qr_code,
        price: t.price,
        is_used: t.is_used,
        remaining_credits: t.remaining_credits,
        created_at: t.created_at,
        ticket_type: t.ticket_types as unknown as TicketType,
        museum: t.museums as unknown as Museum,
      }));
      setTickets(formattedTickets);
    }
    
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOnlineTickets();
    setRefreshing(false);
    toast.success('Veriler güncellendi');
  };

  const stats = {
    total: tickets.length,
    revenue: tickets.reduce((sum, t) => sum + t.price, 0),
    used: tickets.filter(t => t.is_used).length,
  };

  const ticketsByHour = tickets.reduce((acc, ticket) => {
    const hour = new Date(ticket.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const ticketsByMuseum = tickets.reduce((acc, ticket) => {
    const museumName = ticket.museum?.name || 'Bilinmeyen';
    if (!acc[museumName]) {
      acc[museumName] = { count: 0, revenue: 0 };
    }
    acc[museumName].count += 1;
    acc[museumName].revenue += ticket.price;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Monitor className="w-8 h-8" />
              Online/Kiosk Satışları
            </h1>
            <p className="text-muted-foreground mt-1">
              Kiosk ve online kanallardan yapılan satışları takip edin
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedMuseum} onValueChange={setSelectedMuseum}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Müze seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Müzeler</SelectItem>
                {museums.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(selectedDate, 'dd MMMM yyyy', { locale: tr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={tr}
                />
              </PopoverContent>
            </Popover>
            
            <Button onClick={handleRefresh} variant="outline" className="gap-2" disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Satış</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Gelir</p>
                  <p className="text-3xl font-bold">₺{stats.revenue.toLocaleString('tr-TR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kullanılan</p>
                  <p className="text-3xl font-bold">{stats.used} / {stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sales by Museum */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Müze Bazlı Dağılım
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(ticketsByMuseum).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Bu tarihte online/kiosk satış yok
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(ticketsByMuseum)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([museum, data]) => (
                      <div key={museum} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{museum}</p>
                          <p className="text-sm text-muted-foreground">{data.count} bilet</p>
                        </div>
                        <span className="font-bold text-primary">₺{data.revenue.toLocaleString('tr-TR')}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales by Hour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Saatlik Dağılım
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(ticketsByHour).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Bu tarihte online/kiosk satış yok
                </p>
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: 24 }, (_, i) => i)
                    .filter(hour => ticketsByHour[hour])
                    .map(hour => {
                      const count = ticketsByHour[hour] || 0;
                      const maxCount = Math.max(...Object.values(ticketsByHour));
                      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      
                      return (
                        <div key={hour} className="flex items-center gap-3">
                          <span className="w-12 text-sm text-muted-foreground">
                            {hour.toString().padStart(2, '0')}:00
                          </span>
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-8 text-sm font-medium">{count}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Tickets List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Son Online/Kiosk Satışları
            </CardTitle>
            <CardDescription>
              Gerçek zamanlı güncellenir
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Bu tarihte online/kiosk satış bulunmuyor</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Saat</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">QR Kod</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tür</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Müze</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fiyat</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 50).map(ticket => (
                      <tr key={ticket.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(ticket.created_at), 'HH:mm:ss')}
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {ticket.qr_code}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant="outline"
                            style={{ borderColor: ticket.ticket_type?.color, color: ticket.ticket_type?.color }}
                          >
                            {ticket.ticket_type?.name || 'Bilinmiyor'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {ticket.museum?.name || 'Bilinmiyor'}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          ₺{ticket.price}
                        </td>
                        <td className="py-3 px-4">
                          {ticket.is_used ? (
                            <Badge variant="secondary">Kullanıldı</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500">Aktif</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default OnlineSalesReport;
