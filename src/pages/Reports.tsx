import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, Download, TrendingUp, Wallet, Ticket, Trash2, Loader2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TicketType {
  id: string;
  name: string;
  color: string;
  price: number;
  credits: number;
  is_combo: boolean;
}

interface Museum {
  id: string;
  name: string;
}

interface TicketData {
  id: string;
  qr_code: string;
  price: number;
  is_used: boolean;
  remaining_credits: number;
  created_at: string;
  sold_by: string;
  ticket_type: TicketType;
  museum: Museum;
  sold_by_name?: string;
}

const Reports = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMuseum, setSelectedMuseum] = useState<string>('all');
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [canDeleteTickets, setCanDeleteTickets] = useState(false);
  const [deleteDialogTicket, setDeleteDialogTicket] = useState<TicketData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (museums.length > 0) {
      fetchTickets();
    }
  }, [selectedDate, selectedMuseum, museums]);

  const fetchInitialData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [museumsRes, typesRes, permsRes, rolesRes] = await Promise.all([
      supabase.from('museums').select('id, name').eq('is_active', true).order('name'),
      supabase.from('ticket_types').select('*'),
      supabase.from('user_permissions').select('permission').eq('user_id', user.id),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);

    const allMuseums = museumsRes.data || [];
    setTicketTypes(typesRes.data || []);

    const permissions = (permsRes.data || []).map(p => p.permission);
    const roles = (rolesRes.data || []).map(r => r.role);
    const isAdmin = roles.includes('admin');
    
    // Admin has delete_tickets permission implicitly
    setCanDeleteTickets(isAdmin || permissions.includes('delete_tickets'));

    // Filter museums based on user assignments
    if (isAdmin) {
      setMuseums(allMuseums);
    } else {
      // Check direct museum assignments
      const { data: userMuseums } = await supabase
        .from('user_museums')
        .select('museum_id')
        .eq('user_id', user.id);

      if (userMuseums && userMuseums.length > 0) {
        const allowedMuseumIds = userMuseums.map(m => m.museum_id);
        const filteredMuseums = allMuseums.filter(m => allowedMuseumIds.includes(m.id));
        setMuseums(filteredMuseums);
        if (filteredMuseums.length === 1) {
          setSelectedMuseum(filteredMuseums[0].id);
        }
      } else {
        // Fallback to museum groups
        const { data: userGroups } = await supabase
          .from('user_museum_groups')
          .select('group_id')
          .eq('user_id', user.id);

        if (userGroups && userGroups.length > 0) {
          const groupIds = userGroups.map(g => g.group_id);
          const { data: groupMembers } = await supabase
            .from('museum_group_members')
            .select('museum_id')
            .in('group_id', groupIds);

          if (groupMembers && groupMembers.length > 0) {
            const allowedMuseumIds = [...new Set(groupMembers.map(m => m.museum_id))];
            const filteredMuseums = allMuseums.filter(m => allowedMuseumIds.includes(m.id));
            setMuseums(filteredMuseums);
            if (filteredMuseums.length === 1) {
              setSelectedMuseum(filteredMuseums[0].id);
            }
          } else {
            setMuseums([]);
          }
        } else if (profile?.assigned_museum_id) {
          const assignedMuseum = allMuseums.filter(m => m.id === profile.assigned_museum_id);
          setMuseums(assignedMuseum);
          if (assignedMuseum.length === 1) {
            setSelectedMuseum(assignedMuseum[0].id);
          }
        } else {
          setMuseums([]);
        }
      }
    }
    
    setLoading(false);
  };

  const fetchTickets = async () => {
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
        sold_by,
        ticket_types (
          id,
          name,
          color,
          price,
          credits,
          is_combo
        ),
        museums (
          id,
          name
        )
      `)
      .gte('created_at', `${dateStr}T00:00:00`)
      .lt('created_at', `${dateStr}T23:59:59.999999`)
      .order('created_at', { ascending: false });

    if (selectedMuseum !== 'all') {
      query = query.eq('museum_id', selectedMuseum);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Biletler yüklenemedi');
      console.error(error);
      return;
    }

    // Fetch profiles for sold_by
    const soldByIds = [...new Set((data || []).map(t => t.sold_by))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', soldByIds);

    const profilesMap = new Map((profilesData || []).map(p => [p.id, p.full_name]));

    const formattedTickets: TicketData[] = (data || []).map(t => ({
      id: t.id,
      qr_code: t.qr_code,
      price: t.price,
      is_used: t.is_used,
      remaining_credits: t.remaining_credits,
      created_at: t.created_at,
      sold_by: t.sold_by,
      ticket_type: t.ticket_types as unknown as TicketType,
      museum: t.museums as unknown as Museum,
      sold_by_name: profilesMap.get(t.sold_by) || 'Bilinmeyen',
    }));

    setTickets(formattedTickets);
  };

  const handleDeleteTicket = async () => {
    if (!deleteDialogTicket) return;
    
    setDeleting(true);
    
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', deleteDialogTicket.id);

    if (error) {
      toast.error('Bilet silinemedi: ' + error.message);
    } else {
      toast.success('Bilet silindi');
      setTickets(prev => prev.filter(t => t.id !== deleteDialogTicket.id));
    }
    
    setDeleting(false);
    setDeleteDialogTicket(null);
  };

  const stats = {
    total: tickets.length,
    revenue: tickets.reduce((sum, t) => sum + t.price, 0),
    used: tickets.filter(t => t.is_used).length,
    byType: ticketTypes.reduce((acc, type) => {
      const typeTickets = tickets.filter(t => t.ticket_type?.id === type.id);
      acc[type.id] = {
        count: typeTickets.length,
        revenue: typeTickets.reduce((sum, t) => sum + t.price, 0),
      };
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>),
  };

  const exportReport = () => {
    const reportData = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      museum: selectedMuseum === 'all' ? 'Tüm Müzeler' : museums.find(m => m.id === selectedMuseum)?.name,
      summary: {
        totalTickets: stats.total,
        totalRevenue: stats.revenue,
        usedTickets: stats.used,
      },
      byType: ticketTypes.map(type => ({
        type: type.name,
        count: stats.byType[type.id]?.count || 0,
        revenue: stats.byType[type.id]?.revenue || 0,
      })),
      tickets: tickets.map(t => ({
        code: t.qr_code,
        type: t.ticket_type?.name,
        price: t.price,
        museum: t.museum?.name,
        soldBy: t.sold_by_name || 'Bilinmeyen',
        isUsed: t.is_used,
        remainingCredits: t.remaining_credits,
        createdAt: t.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapor-${format(selectedDate, 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Raporlar</h1>
            <p className="text-muted-foreground mt-1">
              Günlük satış raporları ve istatistikler
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
            
            <Button onClick={exportReport} className="gap-2">
              <Download className="w-4 h-4" />
              Dışa Aktar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam Satış</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam Gelir</p>
                <p className="text-3xl font-bold text-foreground">
                  ₺{stats.revenue.toLocaleString('tr-TR')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kullanılan</p>
                <p className="text-3xl font-bold text-foreground">
                  {stats.used} / {stats.total}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Type */}
        <div className="bg-card rounded-2xl border border-border p-6 animate-slide-up">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Bilet Türüne Göre Dağılım
          </h2>
          
          <div className="space-y-4">
            {ticketTypes.filter(t => stats.byType[t.id]?.count > 0).map((type) => {
              const typeStats = stats.byType[type.id] || { count: 0, revenue: 0 };
              const percentage = stats.total > 0 ? (typeStats.count / stats.total) * 100 : 0;
              
              return (
                <div key={type.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg text-white"
                        style={{ backgroundColor: type.color }}
                      >
                        🎫
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{type.name}</p>
                          {type.credits > 1 && (
                            <Badge variant="secondary" className="gap-1">
                              <Layers className="w-3 h-3" />
                              {type.credits} Kontör
                            </Badge>
                          )}
                          {type.is_combo && (
                            <Badge variant="outline">Kombine</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">₺{type.price} / bilet</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{typeStats.count} adet</p>
                      <p className="text-sm text-primary">₺{typeStats.revenue.toLocaleString('tr-TR')}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: type.color }}
                    />
                  </div>
                </div>
              );
            })}
            
            {ticketTypes.filter(t => stats.byType[t.id]?.count > 0).length === 0 && (
              <p className="text-muted-foreground text-center py-4">Bu tarihte satış bulunmuyor</p>
            )}
          </div>
        </div>

        {/* Ticket List */}
        <div className="bg-card rounded-2xl border border-border p-6 animate-slide-up">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Satış Detayları ({format(selectedDate, 'dd MMMM yyyy', { locale: tr })})
          </h2>
          
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Bu tarihte satış bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Saat</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Kod</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tür</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Müze</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fiyat</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Kontör</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Satan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Durum</th>
                    {canDeleteTickets && (
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">İşlem</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-border/50">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {format(new Date(ticket.created_at), 'HH:mm')}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-foreground">
                        {ticket.qr_code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded flex items-center justify-center text-xs text-white"
                            style={{ backgroundColor: ticket.ticket_type?.color }}
                          >
                            🎫
                          </div>
                          <span className="text-sm text-foreground">{ticket.ticket_type?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {ticket.museum?.name}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {ticket.price > 0 ? `₺${ticket.price}` : 'Ücretsiz'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="gap-1">
                          <Layers className="w-3 h-3" />
                          {ticket.remaining_credits}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {ticket.sold_by_name || 'Bilinmeyen'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          ticket.is_used 
                            ? "bg-muted text-muted-foreground" 
                            : "bg-success/10 text-success"
                        )}>
                          {ticket.is_used ? 'Tükenmiş' : 'Aktif'}
                        </span>
                      </td>
                      {canDeleteTickets && (
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteDialogTicket(ticket)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialogTicket} onOpenChange={(open) => !open && setDeleteDialogTicket(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bileti Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteDialogTicket?.qr_code}</strong> kodlu bileti silmek istediğinize emin misiniz?
              <br /><br />
              <span className="text-destructive font-medium">Bu işlem geri alınamaz!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTicket}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Reports;
