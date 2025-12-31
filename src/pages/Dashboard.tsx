import { Layout } from '@/components/Layout';
import { StatsCard } from '@/components/StatsCard';
import { useTicketStore } from '@/store/ticketStore';
import { TICKET_TYPES } from '@/types/ticket';
import { Ticket, TrendingUp, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { getTodayStats, tickets, staff } = useTicketStore();
  const stats = getTodayStats();

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
            value={stats.total}
            subtitle="Bugün satılan bilet"
            icon={Ticket}
            variant="primary"
          />
          <StatsCard
            title="Toplam Gelir"
            value={`₺${stats.revenue.toLocaleString('tr-TR')}`}
            subtitle="Bugünkü hasılat"
            icon={Wallet}
            variant="success"
          />
          <StatsCard
            title="Aktif Personel"
            value={staff.filter(s => s.isActive).length}
            subtitle={`${staff.length} personelden`}
            icon={Users}
          />
          <StatsCard
            title="Toplam Bilet"
            value={tickets.length}
            subtitle="Tüm zamanlar"
            icon={TrendingUp}
          />
        </div>

        {/* Ticket Types Breakdown */}
        <div className="bg-card rounded-2xl border border-border p-6 animate-slide-up">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Bilet Türlerine Göre Satış
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {TICKET_TYPES.map((type, index) => {
              const count = stats.byType[type.type];
              const revenue = count * type.price;
              
              return (
                <div 
                  key={type.type}
                  className="p-4 rounded-xl bg-secondary/50 border border-border animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                      type.colorClass
                    )}>
                      {type.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{type.label}</p>
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
                  {[...tickets].reverse().slice(0, 10).map((ticket) => {
                    const typeInfo = TICKET_TYPES.find(t => t.type === ticket.type)!;
                    
                    return (
                      <tr 
                        key={ticket.id} 
                        className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm text-foreground">
                            {ticket.qrCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span>{typeInfo.icon}</span>
                            <span className="text-sm text-foreground">{typeInfo.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground">
                            {ticket.price > 0 ? `₺${ticket.price}` : 'Ücretsiz'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {ticket.soldBy}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            ticket.isUsed 
                              ? "bg-muted text-muted-foreground" 
                              : "bg-success/10 text-success"
                          )}>
                            {ticket.isUsed ? 'Kullanıldı' : 'Aktif'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
