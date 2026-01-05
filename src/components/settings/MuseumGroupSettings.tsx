import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MuseumGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface Museum {
  id: string;
  name: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  museum_id: string;
}

export const MuseumGroupSettings = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MuseumGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    selectedMuseums: [] as string[]
  });

  // Fetch museum groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['museum-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('museum_groups')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as MuseumGroup[];
    }
  });

  // Fetch all museums
  const { data: museums = [] } = useQuery({
    queryKey: ['museums'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('museums')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Museum[];
    }
  });

  // Fetch group members
  const { data: groupMembers = [] } = useQuery({
    queryKey: ['museum-group-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('museum_group_members')
        .select('*');
      if (error) throw error;
      return data as GroupMember[];
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; selectedMuseums: string[]; id?: string }) => {
      if (data.id) {
        // Update group
        const { error: updateError } = await supabase
          .from('museum_groups')
          .update({ name: data.name, description: data.description || null })
          .eq('id', data.id);
        if (updateError) throw updateError;

        // Delete existing members
        const { error: deleteError } = await supabase
          .from('museum_group_members')
          .delete()
          .eq('group_id', data.id);
        if (deleteError) throw deleteError;

        // Add new members
        if (data.selectedMuseums.length > 0) {
          const { error: insertError } = await supabase
            .from('museum_group_members')
            .insert(data.selectedMuseums.map(museumId => ({
              group_id: data.id!,
              museum_id: museumId
            })));
          if (insertError) throw insertError;
        }
      } else {
        // Create new group
        const { data: newGroup, error: createError } = await supabase
          .from('museum_groups')
          .insert({ name: data.name, description: data.description || null })
          .select()
          .single();
        if (createError) throw createError;

        // Add members
        if (data.selectedMuseums.length > 0) {
          const { error: insertError } = await supabase
            .from('museum_group_members')
            .insert(data.selectedMuseums.map(museumId => ({
              group_id: newGroup.id,
              museum_id: museumId
            })));
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['museum-groups'] });
      queryClient.invalidateQueries({ queryKey: ['museum-group-members'] });
      toast.success(editingGroup ? 'Grup güncellendi' : 'Grup oluşturuldu');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Bir hata oluştu: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('museum_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['museum-groups'] });
      queryClient.invalidateQueries({ queryKey: ['museum-group-members'] });
      toast.success('Grup silindi');
    },
    onError: (error) => {
      toast.error('Silme işlemi başarısız: ' + error.message);
    }
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('museum_groups')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['museum-groups'] });
      toast.success('Durum güncellendi');
    }
  });

  const handleOpenDialog = (group?: MuseumGroup) => {
    if (group) {
      setEditingGroup(group);
      const memberMuseumIds = groupMembers
        .filter(m => m.group_id === group.id)
        .map(m => m.museum_id);
      setFormData({
        name: group.name,
        description: group.description || '',
        selectedMuseums: memberMuseumIds
      });
    } else {
      setEditingGroup(null);
      setFormData({ name: '', description: '', selectedMuseums: [] });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGroup(null);
    setFormData({ name: '', description: '', selectedMuseums: [] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Grup adı gerekli');
      return;
    }
    saveMutation.mutate({
      name: formData.name,
      description: formData.description,
      selectedMuseums: formData.selectedMuseums,
      id: editingGroup?.id
    });
  };

  const toggleMuseum = (museumId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedMuseums: prev.selectedMuseums.includes(museumId)
        ? prev.selectedMuseums.filter(id => id !== museumId)
        : [...prev.selectedMuseums, museumId]
    }));
  };

  const getGroupMuseums = (groupId: string) => {
    const memberIds = groupMembers
      .filter(m => m.group_id === groupId)
      .map(m => m.museum_id);
    return museums.filter(m => memberIds.includes(m.id));
  };

  if (groupsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Müze Grupları</h3>
          <p className="text-sm text-muted-foreground">
            Gişelerin bilet satabileceği müze gruplarını tanımlayın
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Grup
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? 'Grubu Düzenle' : 'Yeni Müze Grubu'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Grup Adı</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Örn: Gişe 1 Müzeleri"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Açıklama (Opsiyonel)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Grup açıklaması..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Müzeler</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {museums.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Henüz müze eklenmemiş
                    </p>
                  ) : (
                    museums.map(museum => (
                      <div 
                        key={museum.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                        onClick={() => toggleMuseum(museum.id)}
                      >
                        <Checkbox
                          checked={formData.selectedMuseums.includes(museum.id)}
                          onCheckedChange={() => toggleMuseum(museum.id)}
                        />
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{museum.name}</span>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.selectedMuseums.length} müze seçildi
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  İptal
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Henüz müze grubu oluşturulmamış</p>
            <p className="text-sm text-muted-foreground/70">
              "Yeni Grup" butonuna tıklayarak başlayın
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map(group => {
            const groupMuseums = getGroupMuseums(group.id);
            return (
              <Card key={group.id} className={cn(group.is_active === false && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {group.name}
                          {group.is_active === false && (
                            <Badge variant="secondary">Pasif</Badge>
                          )}
                        </CardTitle>
                        {group.description && (
                          <p className="text-sm text-muted-foreground">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActiveMutation.mutate({ 
                          id: group.id, 
                          isActive: !group.is_active 
                        })}
                        title={group.is_active !== false ? 'Pasif Yap' : 'Aktif Yap'}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          group.is_active !== false ? "bg-green-500" : "bg-gray-400"
                        )} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(group)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Bu grubu silmek istediğinize emin misiniz?')) {
                            deleteMutation.mutate(group.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {groupMuseums.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Henüz müze eklenmemiş
                      </span>
                    ) : (
                      groupMuseums.map(museum => (
                        <Badge key={museum.id} variant="outline" className="gap-1">
                          <Building2 className="w-3 h-3" />
                          {museum.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
