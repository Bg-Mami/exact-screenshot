import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Plus, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Session {
  id: string;
  museum_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  sold_count: number;
  is_active: boolean;
}

interface Museum {
  id: string;
  name: string;
}

export const SessionSettings = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    museum_id: '',
    session_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    capacity: 50,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [sessionsRes, museumsRes] = await Promise.all([
      supabase.from('sessions').select('*').order('session_date').order('start_time'),
      supabase.from('museums').select('id, name').eq('is_active', true),
    ]);

    if (sessionsRes.error) toast.error('Seanslar yüklenemedi');
    if (museumsRes.error) toast.error('Müzeler yüklenemedi');

    setSessions(sessionsRes.data || []);
    setMuseums(museumsRes.data || []);
    setLoading(false);
  };

  const handleAddSession = async () => {
    if (!newSession.museum_id) {
      toast.error('Lütfen müze seçin');
      return;
    }

    const { error } = await supabase.from('sessions').insert({
      museum_id: newSession.museum_id,
      session_date: newSession.session_date,
      start_time: newSession.start_time,
      end_time: newSession.end_time,
      capacity: newSession.capacity,
    });

    if (error) {
      toast.error('Seans eklenemedi');
      console.error(error);
    } else {
      toast.success('Seans eklendi');
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu seansı silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase.from('sessions').delete().eq('id', id);

    if (error) {
      toast.error('Silme başarısız');
    } else {
      toast.success('Seans silindi');
      fetchData();
    }
  };

  const getMuseumName = (museumId: string) => {
    return museums.find(m => m.id === museumId)?.name || 'Bilinmeyen';
  };

  const getOccupancyColor = (soldCount: number, capacity: number) => {
    const percentage = (soldCount / capacity) * 100;
    if (percentage >= 100) return 'destructive';
    if (percentage >= 80) return 'warning';
    return 'success';
  };

  const getOccupancyPercent = (soldCount: number, capacity: number) => {
    return Math.min(100, (soldCount / capacity) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const todaySessions = sessions.filter(s => s.session_date === format(new Date(), 'yyyy-MM-dd'));
  const futureSessions = sessions.filter(s => s.session_date > format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Seans Yönetimi</h2>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-primary border-0">
              <Plus className="w-4 h-4" />
              Seans Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Seans Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Müze *</Label>
                <Select 
                  value={newSession.museum_id} 
                  onValueChange={(v) => setNewSession({ ...newSession, museum_id: v })}
                >
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
                <Label>Tarih *</Label>
                <Input
                  type="date"
                  value={newSession.session_date}
                  onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Başlangıç</Label>
                  <Input
                    type="time"
                    value={newSession.start_time}
                    onChange={(e) => setNewSession({ ...newSession, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <Input
                    type="time"
                    value={newSession.end_time}
                    onChange={(e) => setNewSession({ ...newSession, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Kapasite</Label>
                <Input
                  type="number"
                  min="1"
                  value={newSession.capacity}
                  onChange={(e) => setNewSession({ ...newSession, capacity: parseInt(e.target.value) || 50 })}
                />
              </div>
              <Button onClick={handleAddSession} className="w-full gradient-primary border-0">
                Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {museums.length === 0 && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-sm">Önce bir müze eklemeniz gerekiyor</p>
          </CardContent>
        </Card>
      )}

      {/* Today's Sessions */}
      {todaySessions.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-foreground mb-3">Bugünün Seansları</h3>
          <div className="grid gap-3">
            {todaySessions.map((session) => {
              const isFull = session.sold_count >= session.capacity;
              return (
                <Card 
                  key={session.id} 
                  className={`border-l-4 ${isFull ? 'border-l-destructive' : 'border-l-success'}`}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[80px]">
                          <p className="text-lg font-bold text-foreground">{session.start_time.slice(0, 5)}</p>
                          <p className="text-xs text-muted-foreground">{session.end_time.slice(0, 5)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{getMuseumName(session.museum_id)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getOccupancyColor(session.sold_count, session.capacity) as any}>
                              {session.sold_count} / {session.capacity}
                            </Badge>
                            {isFull && (
                              <Badge variant="destructive" className="animate-pulse">
                                DOLU
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-1 max-w-xs">
                        <Progress 
                          value={getOccupancyPercent(session.sold_count, session.capacity)} 
                          className="h-2"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(session.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Future Sessions */}
      {futureSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-foreground mb-3">Gelecek Seanslar</h3>
          <div className="grid gap-3">
            {futureSessions.map((session) => (
              <Card key={session.id} className="border-border">
                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[80px] bg-secondary/50 rounded-lg p-2">
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(session.session_date), 'd MMM', { locale: tr })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.start_time.slice(0, 5)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{getMuseumName(session.museum_id)}</p>
                        <p className="text-sm text-muted-foreground">
                          Kapasite: {session.capacity}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(session.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && museums.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Henüz seans eklenmemiş</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
