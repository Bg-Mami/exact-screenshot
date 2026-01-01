import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Save, Ticket } from 'lucide-react';

interface TicketType {
  id: string;
  name: string;
  type_key: string;
  price: number;
  color: string;
  icon: string;
  is_active: boolean;
}

export const TicketTypesSettings = () => {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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
        price: ticketType.price 
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Ticket className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Bilet Türleri ve Fiyatları</h2>
      </div>

      <div className="grid gap-4">
        {ticketTypes.map((ticketType) => (
          <Card key={ticketType.id} className={`border-border ${!ticketType.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shrink-0"
                  style={{ backgroundColor: ticketType.color }}
                >
                  🎫
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

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ticketType.is_active}
                      onCheckedChange={(checked) => handleActiveToggle(ticketType.id, checked)}
                    />
                    <span className="text-sm text-muted-foreground">
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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
