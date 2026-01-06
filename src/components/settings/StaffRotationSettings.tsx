import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Calendar, Download, RefreshCw, ArrowRight, Edit2, Building2, Settings2, Users } from 'lucide-react';
import { format, startOfMonth, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  is_active: boolean;
  assigned_museum_id: string | null;
}

interface Museum {
  id: string;
  name: string;
}

interface StaffRotation {
  id: string;
  user_id: string;
  museum_id: string;
  rotation_month: string;
  rotation_order: number;
  is_manual_override: boolean;
}

interface MuseumStaffConfig {
  museumId: string;
  staffCount: number;
  selected: boolean;
}

export const StaffRotationSettings = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [rotations, setRotations] = useState<StaffRotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => 
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRotation, setEditingRotation] = useState<StaffRotation | null>(null);
  const [selectedMuseumForEdit, setSelectedMuseumForEdit] = useState('');
  
  // Müze seçimi ve personel sayısı konfigürasyonu
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [museumConfigs, setMuseumConfigs] = useState<MuseumStaffConfig[]>([]);

  // Generate month options (current + next 6 months)
  const monthOptions = Array.from({ length: 7 }, (_, i) => {
    const date = startOfMonth(addMonths(new Date(), i));
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'MMMM yyyy', { locale: tr })
    };
  });

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    
    const [usersRes, museumsRes, rotationsRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true),
      supabase.from('museums').select('id, name').eq('is_active', true),
      supabase.from('staff_rotations').select('*').eq('rotation_month', selectedMonth),
      supabase.from('user_roles').select('*').eq('role', 'cashier'),
    ]);

    if (usersRes.error || museumsRes.error) {
      toast.error('Veriler yüklenemedi');
      setLoading(false);
      return;
    }

    // Filter only cashier users
    const cashierIds = new Set((rolesRes.data || []).map(r => r.user_id));
    const cashierUsers = (usersRes.data || []).filter(u => cashierIds.has(u.id));

    setUsers(cashierUsers);
    setMuseums(museumsRes.data || []);
    setRotations(rotationsRes.data || []);
    setLoading(false);
  };

  // Konfigürasyon dialog'unu aç
  const openConfigDialog = () => {
    // Mevcut müzeleri config'e dönüştür
    const configs = museums.map(m => ({
      museumId: m.id,
      staffCount: 1,
      selected: true
    }));
    setMuseumConfigs(configs);
    setConfigDialogOpen(true);
  };

  const toggleMuseumSelection = (museumId: string) => {
    setMuseumConfigs(prev => prev.map(c => 
      c.museumId === museumId ? { ...c, selected: !c.selected } : c
    ));
  };

  const updateStaffCount = (museumId: string, count: number) => {
    setMuseumConfigs(prev => prev.map(c => 
      c.museumId === museumId ? { ...c, staffCount: Math.max(1, Math.min(10, count)) } : c
    ));
  };

  const generateRotations = async () => {
    const selectedMuseums = museumConfigs.filter(c => c.selected);
    
    if (selectedMuseums.length === 0) {
      toast.error('En az bir müze seçmelisiniz');
      return;
    }

    const totalSlots = selectedMuseums.reduce((sum, c) => sum + c.staffCount, 0);
    
    if (users.length < totalSlots) {
      toast.warning(`Toplam ${totalSlots} personel gerekli, ancak ${users.length} aktif personel mevcut`);
    }

    setGenerating(true);
    setConfigDialogOpen(false);

    // Get previous month's rotations for sequential assignment
    const prevMonth = format(startOfMonth(addMonths(new Date(selectedMonth), -1)), 'yyyy-MM-dd');
    const { data: prevRotations } = await supabase
      .from('staff_rotations')
      .select('*')
      .eq('rotation_month', prevMonth);

    // Müzeleri slot sayısına göre genişlet (her müze için staffCount kadar slot)
    const expandedMuseumSlots: { museumId: string; slotIndex: number }[] = [];
    selectedMuseums.forEach(config => {
      for (let i = 0; i < config.staffCount; i++) {
        expandedMuseumSlots.push({ museumId: config.museumId, slotIndex: i });
      }
    });

    // Her personelin önceki ay hangi müzede olduğunu bul
    const usersWithPrevMuseum = users.map(user => {
      const prevRotation = prevRotations?.find(r => r.user_id === user.id);
      return { 
        user, 
        prevMuseumId: prevRotation?.museum_id || null,
        prevRotationOrder: prevRotation?.rotation_order ?? 999
      };
    });

    // Önceki rotasyon sırasına göre sırala
    usersWithPrevMuseum.sort((a, b) => a.prevRotationOrder - b.prevRotationOrder);

    // Hangi slotlar dolu takip et
    const slotAssignments: Map<number, string> = new Map();
    const newRotations: { user_id: string; museum_id: string; rotation_order: number }[] = [];

    // Her personeli sırayla ata
    usersWithPrevMuseum.forEach((item, userIndex) => {
      let assignedSlotIndex = -1;

      if (item.prevMuseumId) {
        // Önceki müzenin slot listesindeki ilk pozisyonunu bul
        const prevMuseumSlotIndices = expandedMuseumSlots
          .map((s, idx) => s.museumId === item.prevMuseumId ? idx : -1)
          .filter(idx => idx >= 0);

        if (prevMuseumSlotIndices.length > 0) {
          // Bir sonraki slot'a geç (döngüsel)
          const firstPrevSlot = prevMuseumSlotIndices[0];
          let nextSlotIndex = (firstPrevSlot + 1) % expandedMuseumSlots.length;
          
          // Boş slot bulana kadar dön
          let attempts = 0;
          while (slotAssignments.has(nextSlotIndex) && attempts < expandedMuseumSlots.length) {
            nextSlotIndex = (nextSlotIndex + 1) % expandedMuseumSlots.length;
            attempts++;
          }
          
          if (!slotAssignments.has(nextSlotIndex)) {
            assignedSlotIndex = nextSlotIndex;
          }
        }
      }

      // Eğer hala atama yapılmadıysa, ilk boş slotu bul
      if (assignedSlotIndex === -1) {
        for (let i = 0; i < expandedMuseumSlots.length; i++) {
          if (!slotAssignments.has(i)) {
            assignedSlotIndex = i;
            break;
          }
        }
      }

      // Atama yap
      if (assignedSlotIndex >= 0 && assignedSlotIndex < expandedMuseumSlots.length) {
        slotAssignments.set(assignedSlotIndex, item.user.id);
        newRotations.push({
          user_id: item.user.id,
          museum_id: expandedMuseumSlots[assignedSlotIndex].museumId,
          rotation_order: userIndex,
        });
      }
    });

    // Delete existing rotations for this month
    await supabase
      .from('staff_rotations')
      .delete()
      .eq('rotation_month', selectedMonth);

    // Insert new rotations
    const { error } = await supabase.from('staff_rotations').insert(
      newRotations.map(r => ({
        ...r,
        rotation_month: selectedMonth,
        is_manual_override: false,
      }))
    );

    if (error) {
      toast.error('Rotasyon oluşturulamadı');
    } else {
      toast.success('Rotasyonlar oluşturuldu');
      fetchData();
    }

    setGenerating(false);
  };

  const applyRotationsToProfiles = async () => {
    const currentMonthRotations = rotations;
    
    if (currentMonthRotations.length === 0) {
      toast.error('Uygulanacak rotasyon bulunamadı');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const rotation of currentMonthRotations) {
      // 1. assigned_museum_id güncelle
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_museum_id: rotation.museum_id })
        .eq('id', rotation.user_id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        errorCount++;
        continue;
      }

      // 2. user_museums tablosunu güncelle - önce mevcut atamaları sil
      await supabase
        .from('user_museums')
        .delete()
        .eq('user_id', rotation.user_id);

      // 3. Yeni müze atamasını ekle
      const { error: museumError } = await supabase
        .from('user_museums')
        .insert({
          user_id: rotation.user_id,
          museum_id: rotation.museum_id
        });

      if (museumError) {
        console.error('User museum insert error:', museumError);
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (errorCount > 0) {
      toast.warning(`${successCount} atama başarılı, ${errorCount} atama başarısız`);
    } else {
      toast.success(`${successCount} kullanıcının müze ataması güncellendi`);
    }
    
    fetchData();
  };

  const handleEditRotation = (rotation: StaffRotation) => {
    setEditingRotation(rotation);
    setSelectedMuseumForEdit(rotation.museum_id);
    setEditDialogOpen(true);
  };

  const saveEditedRotation = async () => {
    if (!editingRotation) return;

    const { error } = await supabase
      .from('staff_rotations')
      .update({ 
        museum_id: selectedMuseumForEdit,
        is_manual_override: true 
      })
      .eq('id', editingRotation.id);

    if (error) {
      toast.error('Güncelleme başarısız');
    } else {
      toast.success('Rotasyon güncellendi');
      setEditDialogOpen(false);
      fetchData();
    }
  };

  // Türkçe karakterleri ASCII'ye dönüştür (PDF uyumluluğu için)
  const turkishToAscii = (text: string): string => {
    const map: { [key: string]: string } = {
      'ç': 'c', 'Ç': 'C',
      'ğ': 'g', 'Ğ': 'G',
      'ı': 'i', 'İ': 'I',
      'ö': 'o', 'Ö': 'O',
      'ş': 's', 'Ş': 'S',
      'ü': 'u', 'Ü': 'U'
    };
    return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, char => map[char] || char);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    doc.setFontSize(18);
    doc.text(turkishToAscii(`Personel Gorev Listesi - ${monthLabel}`), 14, 20);
    
    // Date range
    const startDate = new Date(selectedMonth);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    doc.setFontSize(10);
    doc.text(turkishToAscii(`Tarih Araligi: ${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`), 14, 28);
    
    // Table data - Türkçe karakterleri dönüştür
    const tableData = rotations.map(rotation => {
      const user = users.find(u => u.id === rotation.user_id);
      const museum = museums.find(m => m.id === rotation.museum_id);
      return [
        turkishToAscii(user?.full_name || 'Bilinmeyen'),
        turkishToAscii(museum?.name || 'Bilinmeyen'),
        format(startDate, 'dd.MM.yyyy'),
        format(endDate, 'dd.MM.yyyy'),
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [[turkishToAscii('Personel Adi'), turkishToAscii('Atanan Muze'), turkishToAscii('Baslangic'), turkishToAscii('Bitis')]],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        turkishToAscii(`Olusturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`),
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`personel-gorev-listesi-${format(startDate, 'yyyy-MM')}.pdf`);
    toast.success('PDF indirildi');
  };

  const getMuseumName = (museumId: string) => {
    return museums.find(m => m.id === museumId)?.name || 'Bilinmeyen';
  };

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.full_name || 'Bilinmeyen';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Aylık Personel Rotasyonu</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={openConfigDialog}
            disabled={generating || users.length === 0 || museums.length === 0}
            className="gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
            Rotasyon Oluştur
          </Button>

          {rotations.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={applyRotationsToProfiles}
                className="gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Atamaları Uygula
              </Button>
              <Button
                onClick={exportToPDF}
                className="gap-2 gradient-primary border-0"
              >
                <Download className="w-4 h-4" />
                PDF İndir
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Aktif Personel</span>
            </div>
            <p className="text-2xl font-bold mt-1">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Aktif Müze</span>
            </div>
            <p className="text-2xl font-bold mt-1">{museums.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Bu Ay Atama</span>
            </div>
            <p className="text-2xl font-bold mt-1">{rotations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Manuel Değişiklik</span>
            </div>
            <p className="text-2xl font-bold mt-1">{rotations.filter(r => r.is_manual_override).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Rotasyon Oluştur:</strong> Rotasyon oluşturmadan önce hangi müzeler arasında yapılacağını ve her müzede kaç personel olacağını seçebilirsiniz.
            Personeller otomatik olarak seçilen müzelere dağıtılır. İstisna durumlar için herhangi bir atamayı manuel düzenleyebilirsiniz.
          </p>
        </CardContent>
      </Card>

      {/* Rotation List */}
      {rotations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Bu ay için rotasyon tanımlanmamış</p>
            <Button 
              onClick={openConfigDialog} 
              className="mt-4 gap-2"
              disabled={generating || users.length === 0 || museums.length === 0}
            >
              <Settings2 className="w-4 h-4" />
              Rotasyon Oluştur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rotations.map((rotation) => (
            <Card key={rotation.id} className="border-border">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-primary">
                        {getUserName(rotation.user_id).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{getUserName(rotation.user_id)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        <span>{getMuseumName(rotation.museum_id)}</span>
                        {rotation.is_manual_override && (
                          <Badge variant="outline" className="text-xs">Manuel</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditRotation(rotation)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Config Dialog - Müze Seçimi ve Personel Sayısı */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Rotasyon Ayarları
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rotasyona dahil edilecek müzeleri seçin ve her müzede kaç personel olacağını belirleyin.
            </p>
            
            <div className="text-sm text-muted-foreground flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Toplam Personel: <strong>{users.length}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Seçili Slot: <strong>{museumConfigs.filter(c => c.selected).reduce((sum, c) => sum + c.staffCount, 0)}</strong></span>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-3">
              {museumConfigs.map(config => {
                const museum = museums.find(m => m.id === config.museumId);
                return (
                  <div 
                    key={config.museumId}
                    className={`p-3 border rounded-lg transition-colors ${
                      config.selected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={config.museumId}
                          checked={config.selected}
                          onCheckedChange={() => toggleMuseumSelection(config.museumId)}
                        />
                        <Label 
                          htmlFor={config.museumId}
                          className={`cursor-pointer ${!config.selected && 'text-muted-foreground'}`}
                        >
                          {museum?.name || 'Bilinmeyen'}
                        </Label>
                      </div>
                      
                      {config.selected && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Personel:</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => updateStaffCount(config.museumId, config.staffCount - 1)}
                              disabled={config.staffCount <= 1}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              value={config.staffCount}
                              onChange={(e) => updateStaffCount(config.museumId, parseInt(e.target.value) || 1)}
                              className="w-12 h-7 text-center p-0"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => updateStaffCount(config.museumId, config.staffCount + 1)}
                              disabled={config.staffCount >= 10}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {users.length < museumConfigs.filter(c => c.selected).reduce((sum, c) => sum + c.staffCount, 0) && (
              <div className="text-sm text-orange-600 dark:text-orange-400 p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-900">
                ⚠️ Toplam slot sayısı ({museumConfigs.filter(c => c.selected).reduce((sum, c) => sum + c.staffCount, 0)}) 
                mevcut personel sayısından ({users.length}) fazla. Bazı slotlar boş kalacak.
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setConfigDialogOpen(false)}
                className="flex-1"
              >
                İptal
              </Button>
              <Button 
                onClick={generateRotations}
                disabled={generating || museumConfigs.filter(c => c.selected).length === 0}
                className="flex-1 gradient-primary border-0 gap-2"
              >
                {generating && <Loader2 className="w-4 h-4 animate-spin" />}
                Rotasyon Oluştur
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotasyon Düzenle</DialogTitle>
          </DialogHeader>
          {editingRotation && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{getUserName(editingRotation.user_id)}</strong> için müze atamasını değiştirin:
              </p>
              <Select value={selectedMuseumForEdit} onValueChange={setSelectedMuseumForEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {museums.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={saveEditedRotation} className="w-full gradient-primary border-0">
                Kaydet
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
