import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Building2, Trash2, Save, Banknote } from 'lucide-react';

interface TicketType {
  id: string;
  name: string;
  price: number;
}

interface MuseumTicketPrice {
  id: string;
  museum_id: string;
  ticket_type_id: string;
  price: number;
  is_active: boolean;
}

interface Museum {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

export const MuseumSettings = () => {
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMuseum, setNewMuseum] = useState({ name: '', address: '' });
  
  // Pricing dialog state
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [selectedMuseum, setSelectedMuseum] = useState<Museum | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [museumPrices, setMuseumPrices] = useState<MuseumTicketPrice[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  useEffect(() => {
    fetchMuseums();
    fetchTicketTypes();
  }, []);

  const fetchTicketTypes = async () => {
    const { data, error } = await supabase
      .from('ticket_types')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setTicketTypes(data);
    }
  };

  const fetchMuseumPrices = async (museumId: string) => {
    const { data, error } = await supabase
      .from('museum_ticket_prices')
      .select('*')
      .eq('museum_id', museumId);

    if (!error && data) {
      setMuseumPrices(data);
      const inputs: Record<string, string> = {};
      data.forEach(p => {
        inputs[p.ticket_type_id] = p.price.toString();
      });
      setPriceInputs(inputs);
    }
  };

  const openPricingDialog = async (museum: Museum) => {
    setSelectedMuseum(museum);
    setPricingDialogOpen(true);
    await fetchMuseumPrices(museum.id);
  };

  const handleSavePrices = async () => {
    if (!selectedMuseum) return;
    setSavingPrices(true);

    try {
      for (const ticketType of ticketTypes) {
        const priceValue = parseFloat(priceInputs[ticketType.id] || '0');
        const existingPrice = museumPrices.find(p => p.ticket_type_id === ticketType.id);

        if (existingPrice) {
          await supabase
            .from('museum_ticket_prices')
            .update({ price: priceValue })
            .eq('id', existingPrice.id);
        } else if (priceValue > 0) {
          await supabase
            .from('museum_ticket_prices')
            .insert({
              museum_id: selectedMuseum.id,
              ticket_type_id: ticketType.id,
              price: priceValue
            });
        }
      }
      toast.success('Fiyatlar kaydedildi');
      setPricingDialogOpen(false);
    } catch {
      toast.error('Fiyatlar kaydedilemedi');
    }
    setSavingPrices(false);
  };

  const fetchMuseums = async () => {
    const { data, error } = await supabase
      .from('museums')
      .select('*')
      .order('created_at');

    if (error) {
      toast.error('Müzeler yüklenemedi');
    } else {
      setMuseums(data || []);
    }
    setLoading(false);
  };

  const handleAddMuseum = async () => {
    if (!newMuseum.name.trim()) {
      toast.error('Müze adı zorunludur');
      return;
    }

    const { error } = await supabase
      .from('museums')
      .insert({ name: newMuseum.name, address: newMuseum.address || null });

    if (error) {
      toast.error('Müze eklenemedi');
    } else {
      toast.success('Müze eklendi');
      setDialogOpen(false);
      setNewMuseum({ name: '', address: '' });
      fetchMuseums();
    }
  };

  const handleUpdate = async (museum: Museum) => {
    setSaving(museum.id);

    const { error } = await supabase
      .from('museums')
      .update({ name: museum.name, address: museum.address })
      .eq('id', museum.id);

    if (error) {
      toast.error('Güncelleme başarısız');
    } else {
      toast.success('Müze güncellendi');
    }
    setSaving(null);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('museums')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Durum güncellenemedi');
    } else {
      setMuseums(prev => prev.map(m => m.id === id ? { ...m, is_active: isActive } : m));
      toast.success('Durum güncellendi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu müzeyi silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('museums')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Silme başarısız. Müzeye bağlı biletler olabilir.');
    } else {
      toast.success('Müze silindi');
      fetchMuseums();
    }
  };

  const handleFieldChange = (id: string, field: keyof Museum, value: string) => {
    setMuseums(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
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
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Müzeler</h2>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-primary border-0">
              <Plus className="w-4 h-4" />
              Müze Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Müze Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Müze Adı *</Label>
                <Input
                  value={newMuseum.name}
                  onChange={(e) => setNewMuseum({ ...newMuseum, name: e.target.value })}
                  placeholder="Örn: Arkeoloji Müzesi"
                />
              </div>
              <div className="space-y-2">
                <Label>Adres</Label>
                <Input
                  value={newMuseum.address}
                  onChange={(e) => setNewMuseum({ ...newMuseum, address: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>
              <Button onClick={handleAddMuseum} className="w-full gradient-primary border-0">
                Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {museums.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Henüz müze eklenmemiş</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {museums.map((museum) => (
            <Card key={museum.id} className={`border-border ${!museum.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
                  >
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Müze Adı</Label>
                      <Input
                        value={museum.name}
                        onChange={(e) => handleFieldChange(museum.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adres</Label>
                      <Input
                        value={museum.address || ''}
                        onChange={(e) => handleFieldChange(museum.id, 'address', e.target.value)}
                        placeholder="Opsiyonel"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={museum.is_active}
                        onCheckedChange={(checked) => handleToggleActive(museum.id, checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {museum.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPricingDialog(museum)}
                      className="gap-2"
                    >
                      <Banknote className="w-4 h-4" />
                      Fiyatlandır
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleUpdate(museum)}
                      disabled={saving === museum.id}
                      className="gap-2"
                    >
                      {saving === museum.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(museum.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pricing Dialog */}
      <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              {selectedMuseum?.name} - Bilet Fiyatları
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {ticketTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz bilet türü eklenmemiş
              </p>
            ) : (
              ticketTypes.map((ticketType) => (
                <div key={ticketType.id} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{ticketType.name}</Label>
                    <p className="text-xs text-muted-foreground">
                      Varsayılan: ₺{ticketType.price}
                    </p>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="₺0.00"
                      value={priceInputs[ticketType.id] || ''}
                      onChange={(e) => setPriceInputs({
                        ...priceInputs,
                        [ticketType.id]: e.target.value
                      })}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <Button
            onClick={handleSavePrices}
            disabled={savingPrices}
            className="w-full gradient-primary border-0"
          >
            {savingPrices ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Kaydet
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
