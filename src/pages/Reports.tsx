import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useTicketStore } from '@/store/ticketStore';
import { TICKET_TYPES, TicketType } from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, Download, TrendingUp, Wallet, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

const Reports = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { getTicketsByDate, tickets } = useTicketStore();

  const dateTickets = getTicketsByDate(selectedDate);
  
  const stats = {
    total: dateTickets.length,
    revenue: dateTickets.reduce((sum, t) => sum + t.price, 0),
    used: dateTickets.filter(t => t.isUsed).length,
    byType: TICKET_TYPES.reduce((acc, type) => {
      acc[type.type] = dateTickets.filter(t => t.type === type.type).length;
      return acc;
    }, {} as Record<TicketType, number>),
  };

  const exportReport = () => {
    const reportData = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      summary: {
        totalTickets: stats.total,
        totalRevenue: stats.revenue,
        usedTickets: stats.used,
      },
      byType: TICKET_TYPES.map(type => ({
        type: type.label,
        count: stats.byType[type.type],
        revenue: stats.byType[type.type] * type.price,
      })),
      tickets: dateTickets.map(t => ({
        code: t.qrCode,
        type: TICKET_TYPES.find(tt => tt.type === t.type)?.label,
        price: t.price,
        soldBy: t.soldBy,
        isUsed: t.isUsed,
        createdAt: t.createdAt,
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
          
          <div className="flex items-center gap-3">
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
            {TICKET_TYPES.map((type) => {
              const count = stats.byType[type.type];
              const revenue = count * type.price;
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              
              return (
                <div key={type.type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                        type.colorClass
                      )}>
                        {type.icon}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{type.label}</p>
                        <p className="text-sm text-muted-foreground">₺{type.price} / bilet</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{count} adet</p>
                      <p className="text-sm text-primary">₺{revenue.toLocaleString('tr-TR')}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", type.colorClass)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ticket List */}
        <div className="bg-card rounded-2xl border border-border p-6 animate-slide-up">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Satış Detayları ({format(selectedDate, 'dd MMMM yyyy', { locale: tr })})
          </h2>
          
          {dateTickets.length === 0 ? (
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
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fiyat</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Satan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {dateTickets.map((ticket) => {
                    const typeInfo = TICKET_TYPES.find(t => t.type === ticket.type)!;
                    return (
                      <tr key={ticket.id} className="border-b border-border/50">
                        <td className="py-3 px-4 text-sm text-foreground">
                          {format(new Date(ticket.createdAt), 'HH:mm')}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-foreground">
                          {ticket.qrCode}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span>{typeInfo.icon}</span>
                            <span className="text-sm text-foreground">{typeInfo.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {ticket.price > 0 ? `₺${ticket.price}` : 'Ücretsiz'}
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

export default Reports;
