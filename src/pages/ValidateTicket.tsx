import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QrCode, CheckCircle2, XCircle, Scan, Layers, Building2, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getCachedMuseums,
  getCachedTicketTypes,
  getLocalTicketByQR,
  updateLocalTicketCredits,
  addPendingUsage,
  type CachedMuseum,
  type CachedTicketType,
} from '@/lib/offlineDb';

interface Museum {
  id: string;
  name: string;
}

interface TicketType {
  id: string;
  name: string;
  color: string;
  credits: number;
  is_combo: boolean;
}

interface ComboMuseum {
  museum_id: string;
  credits: number;
}

interface TicketData {
  id: string;
  qr_code: string;
  is_used: boolean;
  remaining_credits: number;
  museum_id: string;
  ticket_type_id: string;
  ticket_type: TicketType;
  museum: Museum;
}

const ValidateTicket = () => {
  const [inputCode, setInputCode] = useState('');
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    ticketType?: string;
    remainingCredits?: number;
    isCombo?: boolean;
    isOffline?: boolean;
  } | null>(null);
  const { user, profile } = useAuth();
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      setOfflineMode(false);
      fetchMuseums();
    } else {
      setOfflineMode(true);
      loadOfflineData();
    }
  }, [profile, isOnline]);

  const loadOfflineData = async () => {
    try {
      const [cachedMuseums, cachedTypes] = await Promise.all([
        getCachedMuseums(),
        getCachedTicketTypes(),
      ]);

      const museumsList: Museum[] = cachedMuseums.map(m => ({ id: m.id, name: m.name }));
      const typesList: TicketType[] = cachedTypes.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        credits: t.credits,
        is_combo: t.is_combo,
      }));

      setMuseums(museumsList);
      setTicketTypes(typesList);

      if (museumsList.length === 1) {
        setSelectedMuseum(museumsList[0].id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Offline data load error:', err);
      toast.error('Offline veri yüklenemedi');
      setLoading(false);
    }
  };

  const fetchMuseums = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [museumsRes, rolesRes] = await Promise.all([
      supabase.from('museums').select('id, name').eq('is_active', true).order('name'),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);

    const allMuseums = museumsRes.data || [];
    const userRoles = rolesRes.data || [];
    const userIsAdmin = userRoles.some(r => r.role === 'admin');

    if (userIsAdmin) {
      // Admins see all museums
      setMuseums(allMuseums);
      if (allMuseums.length === 1) {
        setSelectedMuseum(allMuseums[0].id);
      }
    } else {
      // Non-admins: first check direct museum assignments (user_museums table)
      const { data: userMuseums } = await supabase
        .from('user_museums')
        .select('museum_id')
        .eq('user_id', user.id);

      if (userMuseums && userMuseums.length > 0) {
        // User has direct museum assignments
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
          // Fallback to old single museum assignment
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

  const handleValidate = async () => {
    if (!inputCode.trim()) return;
    if (!selectedMuseum) {
      toast.error('Lütfen müze seçin');
      return;
    }

    setValidating(true);
    const code = inputCode.trim().toUpperCase();

    try {
      if (isOnline && !offlineMode) {
        // Online doğrulama
        await handleOnlineValidation(code);
      } else {
        // Offline doğrulama
        await handleOfflineValidation(code);
      }
    } catch (error: any) {
      toast.error('Doğrulama hatası: ' + error.message);
      setValidationResult({
        valid: false,
        message: 'Sistem hatası',
      });
      autoReset();
    } finally {
      setValidating(false);
    }
  };

  const handleOnlineValidation = async (code: string) => {
    // Find the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        qr_code,
        is_used,
        remaining_credits,
        museum_id,
        ticket_type_id,
        ticket_types (
          id,
          name,
          color,
          credits,
          is_combo
        ),
        museums (
          id,
          name
        )
      `)
      .eq('qr_code', code)
      .maybeSingle();

    if (ticketError) throw ticketError;

    if (!ticket) {
      setValidationResult({
        valid: false,
        message: 'Bilet bulunamadı',
      });
      autoReset();
      return;
    }

    const ticketType = ticket.ticket_types as unknown as TicketType;

    // Check if combo ticket
    if (ticketType.is_combo) {
      // Get combo museum credits
      const { data: comboMuseums } = await supabase
        .from('combo_ticket_museums')
        .select('museum_id, credits')
        .eq('ticket_type_id', ticket.ticket_type_id);

      // Check if this museum is in the combo
      const comboEntry = (comboMuseums || []).find(cm => cm.museum_id === selectedMuseum);
      
      if (!comboEntry) {
        setValidationResult({
          valid: false,
          message: 'Bu bilet bu müze için geçerli değil',
          ticketType: ticketType.name,
          isCombo: true,
        });
        autoReset();
        return;
      }

      // Check usage for this specific museum
      const { data: usageData } = await supabase
        .from('ticket_usage')
        .select('used_credits')
        .eq('ticket_id', ticket.id)
        .eq('museum_id', selectedMuseum);

      const usedCredits = (usageData || []).reduce((sum, u) => sum + u.used_credits, 0);
      const remainingForMuseum = comboEntry.credits - usedCredits;

      if (remainingForMuseum <= 0) {
        setValidationResult({
          valid: false,
          message: 'Bu müze için giriş hakkı kalmadı',
          ticketType: ticketType.name,
          remainingCredits: 0,
          isCombo: true,
        });
        autoReset();
        return;
      }

      // Use one credit
      const { error: usageError } = await supabase
        .from('ticket_usage')
        .insert({
          ticket_id: ticket.id,
          museum_id: selectedMuseum,
          used_credits: 1,
          used_by: user?.id,
        });

      if (usageError) throw usageError;

      setValidationResult({
        valid: true,
        message: `Giriş onaylandı - ${remainingForMuseum - 1} kontör kaldı`,
        ticketType: ticketType.name,
        remainingCredits: remainingForMuseum - 1,
        isCombo: true,
      });
    } else {
      // Regular ticket - check museum matches
      if (ticket.museum_id !== selectedMuseum) {
        setValidationResult({
          valid: false,
          message: 'Bu bilet farklı bir müzeye ait',
          ticketType: ticketType.name,
        });
        autoReset();
        return;
      }

      // Check remaining credits
      if (ticket.remaining_credits <= 0) {
        setValidationResult({
          valid: false,
          message: 'Bilet kullanım hakkı dolmuş',
          ticketType: ticketType.name,
          remainingCredits: 0,
        });
        autoReset();
        return;
      }

      // Use one credit
      const newCredits = ticket.remaining_credits - 1;
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          remaining_credits: newCredits,
          is_used: newCredits === 0,
          used_at: newCredits === 0 ? new Date().toISOString() : null,
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // Record usage
      await supabase.from('ticket_usage').insert({
        ticket_id: ticket.id,
        museum_id: selectedMuseum,
        used_credits: 1,
        used_by: user?.id,
      });

      setValidationResult({
        valid: true,
        message: newCredits > 0 
          ? `Giriş onaylandı - ${newCredits} kontör kaldı`
          : 'Giriş onaylandı - Son kullanım',
        ticketType: ticketType.name,
        remainingCredits: newCredits,
      });
    }

    autoReset();
  };

  const handleOfflineValidation = async (code: string) => {
    // Local db'den bilet ara
    const localTicket = await getLocalTicketByQR(code);

    if (!localTicket) {
      setValidationResult({
        valid: false,
        message: 'Bilet bulunamadı (Offline)',
        isOffline: true,
      });
      autoReset();
      return;
    }

    // Bilet türünü bul
    const ticketType = ticketTypes.find(t => t.id === localTicket.ticket_type_id);

    // Müze kontrolü (kombine biletler hariç)
    if (!ticketType?.is_combo && localTicket.museum_id !== selectedMuseum) {
      setValidationResult({
        valid: false,
        message: 'Bu bilet farklı bir müzeye ait',
        ticketType: ticketType?.name,
        isOffline: true,
      });
      autoReset();
      return;
    }

    // Kalan kredi kontrolü
    if (localTicket.remaining_credits <= 0 || localTicket.is_used) {
      setValidationResult({
        valid: false,
        message: 'Bilet kullanım hakkı dolmuş',
        ticketType: ticketType?.name,
        remainingCredits: 0,
        isOffline: true,
      });
      autoReset();
      return;
    }

    // Bir kredi kullan
    const newCredits = localTicket.remaining_credits - 1;
    const isUsed = newCredits === 0;

    // Local db'yi güncelle
    await updateLocalTicketCredits(localTicket.id, newCredits, isUsed);

    // Pending usage ekle (sonra senkronize edilecek)
    await addPendingUsage({
      id: crypto.randomUUID(),
      ticket_id: localTicket.id,
      museum_id: selectedMuseum,
      used_credits: 1,
      used_by: user?.id || null,
      used_at: new Date().toISOString(),
      synced: false,
    });

    setValidationResult({
      valid: true,
      message: newCredits > 0 
        ? `Giriş onaylandı - ${newCredits} kontör kaldı (Offline)`
        : 'Giriş onaylandı - Son kullanım (Offline)',
      ticketType: ticketType?.name,
      remainingCredits: newCredits,
      isOffline: true,
    });

    autoReset();
  };

  const autoReset = () => {
    setTimeout(() => {
      setValidationResult(null);
      setInputCode('');
    }, 5000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="animate-fade-in text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Bilet Doğrulama</h1>
            {offlineMode && (
              <Badge variant="secondary" className="gap-1 bg-warning/20 text-warning border-warning">
                <WifiOff className="w-3 h-3" />
                Offline
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Turnike için QR kod veya bilet kodunu girin
          </p>
        </div>

        {/* Museum Selection */}
        <div className="animate-fade-in">
          <div className="space-y-2 max-w-md mx-auto">
            <label className="text-sm font-medium text-foreground">Müze Seçin *</label>
            <Select value={selectedMuseum} onValueChange={setSelectedMuseum}>
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
        </div>

        {/* Validation Result */}
        {validationResult ? (
          <div className={cn(
            "p-8 rounded-3xl text-center animate-scale-in",
            validationResult.valid 
              ? "bg-success text-success-foreground" 
              : "bg-destructive text-destructive-foreground"
          )}>
            <div className="mb-4">
              {validationResult.valid ? (
                <CheckCircle2 className="w-24 h-24 mx-auto animate-bounce" />
              ) : (
                <XCircle className="w-24 h-24 mx-auto animate-pulse" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {validationResult.valid ? 'GİRİŞ ONAYLANDI' : 'GİRİŞ REDDEDİLDİ'}
            </h2>
            <p className="text-lg opacity-90">{validationResult.message}</p>
            {validationResult.ticketType && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <p className="text-sm opacity-80">Bilet: {validationResult.ticketType}</p>
                {validationResult.isCombo && (
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="w-3 h-3" />
                    Kombine
                  </Badge>
                )}
              </div>
            )}
            {validationResult.remainingCredits !== undefined && validationResult.remainingCredits > 0 && (
              <div className="mt-2 flex items-center justify-center gap-1">
                <Layers className="w-4 h-4" />
                <span className="text-sm">{validationResult.remainingCredits} kontör kaldı</span>
              </div>
            )}
            {validationResult.isOffline && (
              <div className="mt-3 flex items-center justify-center gap-1 opacity-80">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm">Offline mod - sonra senkronize edilecek</span>
              </div>
            )}
          </div>
        ) : (
          /* Input Form */
          <div className="space-y-6 animate-slide-up">
            {/* Scanner Simulation */}
            <div className="bg-card rounded-3xl border border-border p-8 text-center">
              <div className="w-48 h-48 mx-auto mb-6 border-4 border-dashed border-primary/30 rounded-2xl flex items-center justify-center bg-primary/5">
                <div className="text-center">
                  <Scan className="w-16 h-16 mx-auto text-primary/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    QR Kod Tarayıcı
                  </p>
                </div>
              </div>
              
              <p className="text-muted-foreground mb-6">
                veya bilet kodunu manuel olarak girin
              </p>

              <div className="flex gap-3 max-w-md mx-auto">
                <div className="relative flex-1">
                  <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="TKT-XXXXXXXXXXXX"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    className="pl-12 h-14 text-lg font-mono uppercase"
                    disabled={validating}
                  />
                </div>
                <Button 
                  size="lg" 
                  onClick={handleValidate}
                  disabled={!inputCode.trim() || !selectedMuseum || validating}
                  className="px-8 gradient-primary border-0"
                >
                  {validating ? 'Kontrol...' : 'Doğrula'}
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-secondary/50 rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-3">Kullanım</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  QR kod okuyucuyu biletteki koda tutun
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Veya bilet kodunu (TKT-...) manuel olarak girin
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Yeşil onay = Giriş serbest, Kırmızı = Giriş yasak
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Grup biletleri birden fazla kez kullanılabilir (kontör sayısına göre)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Kombine biletler birden fazla müzede geçerlidir
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ValidateTicket;
