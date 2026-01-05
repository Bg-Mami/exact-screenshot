import { Layout } from '@/components/Layout';
import { StatsCard } from '@/components/StatsCard';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, TrendingUp, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';

const Dashboard = () => {
  // Fetch ticket types from database
  const { data: ticketTypes = [] } = useQuery({
    queryKey: ['ticket-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch tickets from database
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_type:ticket_types(*)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      
      // Fetch seller names separately
      const ticketsWithSellers = await Promise.all(
        data.map(async (ticket) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', ticket.sold_by)
            .single();
          return { ...ticket, seller_name: profile?.full_name || 'Bilinmiyor' };
        })
      );
      
      return ticketsWithSellers;
    }
  });

  // Fetch active staff count
  const { data: staffData } = useQuery({
    queryKey: ['staff-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, is_active');
      if (error) throw error;
      const total = data.length;
      const active = data.filter(s => s.is_active).length;
      return { total, active };
    }
  });

  // Fetch today's stats
  const { data: todayStats } = useQuery({
    queryKey: ['today-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tickets')
        .select('price, ticket_type_id')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      if (error) throw error;
      
      const total = data.length;
      const revenue = data.reduce((sum, t) => sum + Number(t.price), 0);
      const byType: Record<string, number> = {};
      data.forEach(t => {
        byType[t.ticket_type_id] = (byType[t.ticket_type_id] || 0) + 1;
      });
      
      return { total, revenue, byType };
    }
  });

  // Fetch total tickets count
  const { data: totalTickets = 0 } = useQuery({
    queryKey: ['total-tickets'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  const getIconComponent = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <Ticket className="w-5 h-5" />;
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bugünkü satış özeti ve istatistikler
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Toplam Satış"
            value={todayStats?.total || 0}
            subtitle="Bugün satılan bilet"
            icon={Ticket}
            variant="primary"
          />
          <StatsCard
            title="Toplam Gelir"
            value={`₺${(todayStats?.revenue || 0).toLocaleString('tr-TR')}`}
            subtitle="Bugünkü hasılat"
            icon={Wallet}
            variant="success"
          />
          <StatsCard
            title="Aktif Personel"
            value={staffData?.active || 0}
            subtitle={`${staffData?.total || 0} personelden`}
            icon={Users}
          />
          <StatsCard
            title="Toplam Bilet"
            value={totalTickets}
            subtitle="Tüm zamanlar"
            icon={TrendingUp}
          />
        </div>

        {/* Ticket Types Breakdown - Only show if there are ticket types */}
        {ticketTypes.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6 animate-slide-up">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Bilet Türlerine Göre Satış
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {ticketTypes.map((type, index) => {
                const count = todayStats?.byType[type.id] || 0;
                const revenue = count * Number(type.price);
                
                return (
                  <div 
                    key={type.id}
                    className="p-4 rounded-xl bg-secondary/50 border border-border animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: type.color }}
                      >
                        {getIconComponent(type.icon)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{type.name}</p>
                        <p className="text-xs text-muted-foreground">₺{type.price}</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{count}</p>
                        <p className="text-xs text-muted-foreground">adet</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-primary">
                          ₺{revenue.toLocaleString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Sales */}
        <div className="bg-card rounded-2xl border border-border p-6 animate-slide-up">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Son Satışlar
          </h2>
          
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Henüz satış yapılmadı</p>
              <p className="text-sm text-muted-foreground/70">
                Bilet satışı yapmak için "Bilet Satış" sayfasına gidin
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Bilet Kodu
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Tür
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Fiyat
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Satan
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr 
                      key={ticket.id} 
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-foreground">
                          {ticket.qr_code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-6 h-6 rounded flex items-center justify-center text-white"
                            style={{ backgroundColor: ticket.ticket_type?.color }}
                          >
                            {getIconComponent(ticket.ticket_type?.icon || 'Ticket')}
                          </span>
                          <span className="text-sm text-foreground">
                            {ticket.ticket_type?.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-foreground">
                          {Number(ticket.price) > 0 ? `₺${ticket.price}` : 'Ücretsiz'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {ticket.seller_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          ticket.is_used 
                            ? "bg-muted text-muted-foreground" 
                            : "bg-success/10 text-success"
                        )}>
                          {ticket.is_used ? 'Kullanıldı' : 'Aktif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
