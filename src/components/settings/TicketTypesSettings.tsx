import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Save, Ticket, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TicketType {
  id: string;
  name: string;
  type_key: string;
  price: number;
  color: string;
  icon: string;
  is_active: boolean;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export const TicketTypesSettings = () => {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // New ticket form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  useEffect(() => {
    fetchTicketTypes();
  }, []);

  const fetchTicketTypes = async () => {
    const { data, error } = await supabase
      .from('ticket_types')
      .select('*')
      .order('created_at');

    if (error) {
      toast.error('Bilet türleri yüklenemedi');
      console.error(error);
    } else {
      setTicketTypes(data || []);
    }
    setLoading(false);
  };

  const handlePriceChange = (id: string, price: string) => {
    setTicketTypes(prev => 
      prev.map(t => t.id === id ? { ...t, price: parseFloat(price) || 0 } : t)
    );
  };

  const handleNameChange = (id: string, name: string) => {
    setTicketTypes(prev => 
      prev.map(t => t.id === id ? { ...t, name } : t)
    );
  };

  const handleColorChange = (id: string, color: string) => {
    setTicketTypes(prev => 
      prev.map(t => t.id === id ? { ...t, color } : t)
    );
  };

  const handleActiveToggle = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('ticket_types')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Durum güncellenemedi');
    } else {
      setTicketTypes(prev => 
        prev.map(t => t.id === id ? { ...t, is_active: isActive } : t)
      );
      toast.success('Durum güncellendi');
    }
  };

  const handleSave = async (ticketType: TicketType) => {
    setSaving(ticketType.id);
    
    const { error } = await supabase
      .from('ticket_types')
      .update({ 
        name: ticketType.name,
        price: ticketType.price,
        color: ticketType.color
      })
      .eq('id', ticketType.id);

    if (error) {
      toast.error('Kaydetme başarısız');
      console.error(error);
    } else {
      toast.success('Bilet türü güncellendi');
    }
    setSaving(null);
  };

  const handleAddTicketType = async () => {
    if (!newName.trim()) {
      toast.error('Bilet adı gereklidir');
      return;
    }

    const price = parseFloat(newPrice) || 0;
    const typeKey = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    setIsAdding(true);

    const { data, error } = await supabase
      .from('ticket_types')
      .insert({
        name: newName.trim(),
        type_key: typeKey,
        price: price,
        color: newColor,
        icon: 'Ticket',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      toast.error('Bilet türü eklenemedi: ' + error.message);
      console.error(error);
    } else {
      setTicketTypes(prev => [...prev, data]);
      toast.success('Bilet türü eklendi');
      setNewName('');
      setNewPrice('');
      setNewColor(COLORS[0]);
      setIsAddDialogOpen(false);
    }
    setIsAdding(false);
  };

  const handleDeleteTicketType = async (id: string, name: string) => {
    const { error } = await supabase
      .from('ticket_types')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.message.includes('violates foreign key')) {
        toast.error('Bu bilet türü kullanımda olduğu için silinemez. Pasif yapabilirsiniz.');
      } else {
        toast.error('Silme başarısız: ' + error.message);
      }
      console.error(error);
    } else {
      setTicketTypes(prev => prev.filter(t => t.id !== id));
      toast.success(`"${name}" bilet türü silindi`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Bilet Türleri ve Fiyatları</h2>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Yeni Bilet Türü
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Bilet Türü Ekle</DialogTitle>
              <DialogDescription>
                Yeni bir bilet türü oluşturun ve fiyatını belirleyin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newName">Bilet Adı</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Örn: Tam Bilet, Öğrenci, Yaşlı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPrice">Fiyat (₺)</Label>
                <Input
                  id="newPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Renk</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        newColor === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleAddTicketType} disabled={isAdding}>
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ekleniyor...
                  </>
                ) : (
                  'Ekle'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {ticketTypes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Ticket className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Henüz bilet türü yok</h3>
            <p className="text-muted-foreground mb-4">
              İlk bilet türünü ekleyerek başlayın.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Bilet Türü Ekle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ticketTypes.map((ticketType) => (
            <Card key={ticketType.id} className={`border-border ${!ticketType.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl"
                      style={{ backgroundColor: ticketType.color }}
                    >
                      🎫
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-5 h-5 rounded border transition-all ${
                            ticketType.color === color ? 'border-foreground ring-1 ring-foreground' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorChange(ticketType.id, color)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bilet Adı</Label>
                      <Input
                        value={ticketType.name}
                        onChange={(e) => handleNameChange(ticketType.id, e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fiyat (₺)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ticketType.price}
                        onChange={(e) => handlePriceChange(ticketType.id, e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ticketType.is_active}
                        onCheckedChange={(checked) => handleActiveToggle(ticketType.id, checked)}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {ticketType.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleSave(ticketType)}
                      disabled={saving === ticketType.id}
                      className="gap-2"
                    >
                      {saving === ticketType.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Kaydet
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-2">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Bilet Türünü Sil</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{ticketType.name}" bilet türünü silmek istediğinize emin misiniz? 
                            Bu işlem geri alınamaz. Eğer bu bilet türü ile satılmış biletler varsa silme işlemi başarısız olacaktır.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>İptal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTicketType(ticketType.id, ticketType.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sil
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};