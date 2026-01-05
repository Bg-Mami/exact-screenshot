import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Calendar, Download, RefreshCw, ArrowRight, Edit2, Building2 } from 'lucide-react';
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

  const generateRotations = async () => {
    if (users.length === 0 || museums.length === 0) {
      toast.error('Personel veya müze bulunamadı');
      return;
    }

    setGenerating(true);

    // Get previous month's rotations for sequential assignment
    const prevMonth = format(startOfMonth(addMonths(new Date(selectedMonth), -1)), 'yyyy-MM-dd');
    const { data: prevRotations } = await supabase
      .from('staff_rotations')
      .select('*')
      .eq('rotation_month', prevMonth);

    // Build rotation order based on previous assignments
    const newRotations: { user_id: string; museum_id: string; rotation_order: number }[] = [];
    
    users.forEach((user, index) => {
      const prevRotation = prevRotations?.find(r => r.user_id === user.id);
      let nextMuseumIndex = 0;

      if (prevRotation) {
        const prevMuseumIndex = museums.findIndex(m => m.id === prevRotation.museum_id);
        nextMuseumIndex = (prevMuseumIndex + 1) % museums.length;
      } else {
        // First time assignment - distribute evenly
        nextMuseumIndex = index % museums.length;
      }

      newRotations.push({
        user_id: user.id,
        museum_id: museums[nextMuseumIndex].id,
        rotation_order: index,
      });
    });

    // Delete existing rotations for this month (only non-manual ones)
    await supabase
      .from('staff_rotations')
      .delete()
      .eq('rotation_month', selectedMonth)
      .eq('is_manual_override', false);

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
    // Update each user's assigned_museum_id based on current month's rotation
    const currentMonthRotations = rotations;
    
    for (const rotation of currentMonthRotations) {
      await supabase
        .from('profiles')
        .update({ assigned_museum_id: rotation.museum_id })
        .eq('id', rotation.user_id);
    }

    toast.success('Müze atamaları güncellendi');
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    doc.setFontSize(18);
    doc.text(`Personel Gorev Listesi - ${monthLabel}`, 14, 20);
    
    // Date range
    const startDate = new Date(selectedMonth);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    doc.setFontSize(10);
    doc.text(`Tarih Araligi: ${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`, 14, 28);
    
    // Table data
    const tableData = rotations.map(rotation => {
      const user = users.find(u => u.id === rotation.user_id);
      const museum = museums.find(m => m.id === rotation.museum_id);
      return [
        user?.full_name || 'Bilinmeyen',
        museum?.name || 'Bilinmeyen',
        format(startDate, 'dd.MM.yyyy'),
        format(endDate, 'dd.MM.yyyy'),
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Personel Adi', 'Atanan Muze', 'Baslangic', 'Bitis']],
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
        `Olusturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
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
            onClick={generateRotations}
            disabled={generating}
            className="gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Sıralı Döngü:</strong> Her personel ayın 1'inde bir sonraki müzeye geçer. 
            "Rotasyon Oluştur" ile otomatik atama yapabilir, sonra "Atamaları Uygula" ile profillere uygulayabilirsiniz.
            İstisna durumlar için herhangi bir atamayı manuel düzenleyebilirsiniz.
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
              onClick={generateRotations} 
              className="mt-4 gap-2"
              disabled={generating}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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
