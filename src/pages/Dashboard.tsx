import { Layout } from '@/components/Layout';
import { StatsCard } from '@/components/StatsCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Ticket, TrendingUp, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';

const Dashboard = () => {
  const { user, isAdmin, profile } = useAuth();

  // Fetch user's assigned museums
  const { data: userMuseumIds = [] } = useQuery({
    queryKey: ['user-museums', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Check if admin - admins see all
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const userIsAdmin = roles?.some(r => r.role === 'admin');
      if (userIsAdmin) return null; // null means all museums
      
      // Check direct museum assignments
      const { data: userMuseums } = await supabase
        .from('user_museums')
        .select('museum_id')
        .eq('user_id', user.id);
      
      if (userMuseums && userMuseums.length > 0) {
        return userMuseums.map(m => m.museum_id);
      }
      
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
          return [...new Set(groupMembers.map(m => m.museum_id))];
        }
      }
      
      // Fallback to old single assignment
      if (profile?.assigned_museum_id) {
        return [profile.assigned_museum_id];
      }
      
      return [];
    },
    enabled: !!user,
  });

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

  // Fetch tickets from database (filtered by user's museums)
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', userMuseumIds],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          ticket_type:ticket_types(*)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Filter by museums if not admin
      if (userMuseumIds !== null && userMuseumIds.length > 0) {
        query = query.in('museum_id', userMuseumIds);
      } else if (userMuseumIds !== null && userMuseumIds.length === 0) {
        return []; // No museums assigned
      }
      
      const { data, error } = await query;
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
    },
    enabled: userMuseumIds !== undefined,
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

  // Fetch today's stats (filtered by user's museums)
  const { data: todayStats } = useQuery({
    queryKey: ['today-stats', userMuseumIds],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('tickets')
        .select('price, ticket_type_id')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      
      // Filter by museums if not admin
      if (userMuseumIds !== null && userMuseumIds.length > 0) {
        query = query.in('museum_id', userMuseumIds);
      } else if (userMuseumIds !== null && userMuseumIds.length === 0) {
        return { total: 0, revenue: 0, byType: {} };
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const total = data.length;
      const revenue = data.reduce((sum, t) => sum + Number(t.price), 0);
      const byType: Record<string, number> = {};
      data.forEach(t => {
        byType[t.ticket_type_id] = (byType[t.ticket_type_id] || 0) + 1;
      });
      
      return { total, revenue, byType };
    },
    enabled: userMuseumIds !== undefined,
  });

  // Fetch total tickets count (filtered by user's museums)
  const { data: totalTickets = 0 } = useQuery({
    queryKey: ['total-tickets', userMuseumIds],
    queryFn: async () => {
      let query = supabase.from('tickets').select('*', { count: 'exact', head: true });
      
      // Filter by museums if not admin
      if (userMuseumIds !== null && userMuseumIds.length > 0) {
        query = query.in('museum_id', userMuseumIds);
      } else if (userMuseumIds !== null && userMuseumIds.length === 0) {
        return 0;
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: userMuseumIds !== undefined,
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
