import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Plus, Clock, Trash2, AlertTriangle, Calendar, Power } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface SessionTemplate {
  id: string;
  museum_id: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}

interface Session {
  id: string;
  museum_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  sold_count: number;
  is_active: boolean;
  template_id: string | null;
}

interface Museum {
  id: string;
  name: string;
}

export const SessionSettings = () => {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMuseum, setSelectedMuseum] = useState<string>('all');
  const [newTemplate, setNewTemplate] = useState({
    museum_id: '',
    name: '',
    start_time: '09:00',
    end_time: '10:00',
    capacity: 50,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const [templatesRes, sessionsRes, museumsRes] = await Promise.all([
      supabase.from('session_templates').select('*').order('start_time'),
      supabase.from('sessions').select('*').eq('session_date', today).order('start_time'),
      supabase.from('museums').select('id, name').eq('is_active', true),
    ]);

    if (templatesRes.error) toast.error('Şablonlar yüklenemedi');
    if (sessionsRes.error) toast.error('Seanslar yüklenemedi');
    if (museumsRes.error) toast.error('Müzeler yüklenemedi');

    setTemplates(templatesRes.data || []);
    setTodaySessions(sessionsRes.data || []);
    setMuseums(museumsRes.data || []);
    setLoading(false);
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.museum_id || !newTemplate.name) {
      toast.error('Müze ve seans adı zorunludur');
      return;
    }

    const { error } = await supabase.from('session_templates').insert({
      museum_id: newTemplate.museum_id,
      name: newTemplate.name,
      start_time: newTemplate.start_time,
      end_time: newTemplate.end_time,
      capacity: newTemplate.capacity,
    });

    if (error) {
      toast.error('Şablon eklenemedi');
      console.error(error);
    } else {
      toast.success('Seans şablonu eklendi');
      setDialogOpen(false);
      setNewTemplate({ museum_id: '', name: '', start_time: '09:00', end_time: '10:00', capacity: 50 });
      fetchData();
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Bu seans şablonunu silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase.from('session_templates').delete().eq('id', id);

    if (error) {
      toast.error('Silme başarısız');
    } else {
      toast.success('Şablon silindi');
      fetchData();
    }
  };

  const handleToggleTemplate = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('session_templates')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Durum güncellenemedi');
    } else {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: isActive } : t));
      toast.success(isActive ? 'Seans şablonu aktif edildi' : 'Seans şablonu pasif edildi');
    }
  };

  const handleToggleTodaySession = async (templateId: string, isActive: boolean) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Check if session exists for today
    const existingSession = todaySessions.find(s => s.template_id === templateId);

    if (existingSession) {
      // Update existing session
      const { error } = await supabase
        .from('sessions')
        .update({ is_active: isActive })
        .eq('id', existingSession.id);

      if (error) {
        toast.error('Güncelleme başarısız');
      } else {
        setTodaySessions(prev => prev.map(s => 
          s.id === existingSession.id ? { ...s, is_active: isActive } : s
        ));
        toast.success(isActive ? 'Bugünkü seans açıldı' : 'Bugünkü seans kapatıldı');
      }
    } else {
      // Create session for today
      const { data, error } = await supabase.from('sessions').insert({
        museum_id: template.museum_id,
        session_date: today,
        start_time: template.start_time,
        end_time: template.end_time,
        capacity: template.capacity,
        is_active: isActive,
        template_id: templateId,
      }).select().single();

      if (error) {
        toast.error('Seans oluşturulamadı');
      } else {
        setTodaySessions(prev => [...prev, data]);
        toast.success(isActive ? 'Bugünkü seans oluşturuldu ve açıldı' : 'Bugünkü seans oluşturuldu ve kapatıldı');
      }
    }
  };

  const getMuseumName = (museumId: string) => {
    return museums.find(m => m.id === museumId)?.name || 'Bilinmeyen';
  };

  const getTodaySessionStatus = (templateId: string) => {
    const session = todaySessions.find(s => s.template_id === templateId);
    if (!session) return { exists: false, isActive: true, soldCount: 0 };
    return { exists: true, isActive: session.is_active, soldCount: session.sold_count };
  };

  const filteredTemplates = selectedMuseum === 'all' 
    ? templates 
    : templates.filter(t => t.museum_id === selectedMuseum);

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const museumId = template.museum_id;
    if (!acc[museumId]) acc[museumId] = [];
    acc[museumId].push(template);
    return acc;
  }, {} as Record<string, SessionTemplate[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Seans Şablonları</h2>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedMuseum} onValueChange={setSelectedMuseum}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Müze filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Müzeler</SelectItem>
              {museums.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-primary border-0">
                <Plus className="w-4 h-4" />
                Şablon Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Seans Şablonu</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Müze *</Label>
                  <Select 
                    value={newTemplate.museum_id} 
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, museum_id: v })}
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
                  <Label>Seans Adı *</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="örn: Sabah Seansı, Öğle Turu"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Başlangıç</Label>
                    <Input
                      type="time"
                      value={newTemplate.start_time}
                      onChange={(e) => setNewTemplate({ ...newTemplate, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitiş</Label>
                    <Input
                      type="time"
                      value={newTemplate.end_time}
                      onChange={(e) => setNewTemplate({ ...newTemplate, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Kapasite</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newTemplate.capacity}
                    onChange={(e) => setNewTemplate({ ...newTemplate, capacity: parseInt(e.target.value) || 50 })}
                  />
                </div>
                <Button onClick={handleAddTemplate} className="w-full gradient-primary border-0">
                  Şablon Ekle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {museums.length === 0 && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-sm">Önce bir müze eklemeniz gerekiyor</p>
          </CardContent>
        </Card>
      )}

      {/* Today's Status Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">
                Bugün: {format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr })}
              </p>
              <p className="text-sm text-muted-foreground">
                Aşağıdaki "Bugün" butonları ile günlük seansları açıp kapatabilirsiniz
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates grouped by museum */}
      {Object.keys(groupedTemplates).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Henüz seans şablonu eklenmemiş</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedTemplates).map(([museumId, museumTemplates]) => (
          <Card key={museumId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                {getMuseumName(museumId)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {museumTemplates.map((template) => {
                const todayStatus = getTodaySessionStatus(template.id);
                return (
                  <div 
                    key={template.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border ${
                      !template.is_active ? 'bg-muted/50 opacity-60' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[70px]">
                        <p className="text-lg font-bold text-foreground">{template.start_time.slice(0, 5)}</p>
                        <p className="text-xs text-muted-foreground">{template.end_time.slice(0, 5)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{template.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">Kapasite: {template.capacity}</Badge>
                          {todayStatus.exists && (
                            <Badge variant={todayStatus.isActive ? 'default' : 'secondary'}>
                              Bugün: {todayStatus.soldCount} satış
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Today toggle */}
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50">
                        <Power className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Bugün</span>
                        <Switch
                          checked={todayStatus.exists ? todayStatus.isActive : true}
                          onCheckedChange={(checked) => handleToggleTodaySession(template.id, checked)}
                          disabled={!template.is_active}
                        />
                      </div>

                      {/* Template toggle */}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={(checked) => handleToggleTemplate(template.id, checked)}
                        />
                        <span className="text-sm text-muted-foreground w-12">
                          {template.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
