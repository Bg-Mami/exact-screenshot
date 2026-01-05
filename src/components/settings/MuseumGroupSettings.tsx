import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MuseumGroup | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedMuseums, setSelectedMuseums] = useState<string[]>([]);

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

  const saveMutation = useMutation({
    mutationFn: async (params: { name: string; description: string; museums: string[]; id?: string }) => {
      if (params.id) {
        const { error: updateError } = await supabase
          .from('museum_groups')
          .update({ name: params.name, description: params.description || null })
          .eq('id', params.id);
        if (updateError) throw updateError;

        await supabase.from('museum_group_members').delete().eq('group_id', params.id);

        if (params.museums.length > 0) {
          const { error: insertError } = await supabase
            .from('museum_group_members')
            .insert(params.museums.map(museumId => ({ group_id: params.id!, museum_id: museumId })));
          if (insertError) throw insertError;
        }
      } else {
        const { data: newGroup, error: createError } = await supabase
          .from('museum_groups')
          .insert({ name: params.name, description: params.description || null })
          .select()
          .single();
        if (createError) throw createError;

        if (params.museums.length > 0) {
          const { error: insertError } = await supabase
            .from('museum_group_members')
            .insert(params.museums.map(museumId => ({ group_id: newGroup.id, museum_id: museumId })));
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['museum-groups'] });
      queryClient.invalidateQueries({ queryKey: ['museum-group-members'] });
      toast.success(editingGroup ? 'Grup güncellendi' : 'Grup oluşturuldu');
      closeSheet();
    },
    onError: (error) => {
      toast.error('Hata: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('museum_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['museum-groups'] });
      queryClient.invalidateQueries({ queryKey: ['museum-group-members'] });
      toast.success('Grup silindi');
    },
    onError: (error) => {
      toast.error('Silme başarısız: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('museum_groups').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['museum-groups'] });
      toast.success('Durum güncellendi');
    }
  });

  const openSheet = (group?: MuseumGroup) => {
    if (group) {
      setEditingGroup(group);
      setFormName(group.name);
      setFormDescription(group.description || '');
      const memberIds = groupMembers.filter(m => m.group_id === group.id).map(m => m.museum_id);
      setSelectedMuseums(memberIds);
    } else {
      setEditingGroup(null);
      setFormName('');
      setFormDescription('');
      setSelectedMuseums([]);
    }
    setIsSheetOpen(true);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    setEditingGroup(null);
    setFormName('');
    setFormDescription('');
    setSelectedMuseums([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Grup adı gerekli');
      return;
    }
    saveMutation.mutate({
      name: formName,
      description: formDescription,
      museums: selectedMuseums,
      id: editingGroup?.id
    });
  };

  const toggleMuseumSelection = (museumId: string) => {
    setSelectedMuseums(prev => 
      prev.includes(museumId) 
        ? prev.filter(id => id !== museumId) 
        : [...prev, museumId]
    );
  };

  const getGroupMuseums = (groupId: string) => {
    const memberIds = groupMembers.filter(m => m.group_id === groupId).map(m => m.museum_id);
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
        <Button onClick={() => openSheet()} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Grup
        </Button>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingGroup ? 'Grubu Düzenle' : 'Yeni Müze Grubu'}</SheetTitle>
            <SheetDescription>
              Müze grubu bilgilerini girin ve dahil edilecek müzeleri seçin.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Grup Adı</Label>
              <Input
                id="groupName"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Örn: Gişe 1 Müzeleri"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupDesc">Açıklama (Opsiyonel)</Label>
              <Textarea
                id="groupDesc"
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
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
                      onClick={() => toggleMuseumSelection(museum.id)}
                    >
                      <Checkbox
                        checked={selectedMuseums.includes(museum.id)}
                        onCheckedChange={() => toggleMuseumSelection(museum.id)}
                      />
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{museum.name}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedMuseums.length} müze seçildi
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeSheet}>
                İptal
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

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
            const isActive = group.is_active !== false;
            return (
              <Card key={group.id} className={cn(!isActive && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {group.name}
                          {!isActive && <Badge variant="secondary">Pasif</Badge>}
                        </CardTitle>
                        {group.description && (
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActiveMutation.mutate({ id: group.id, isActive: !isActive })}
                        title={isActive ? 'Pasif Yap' : 'Aktif Yap'}
                      >
                        <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-green-500" : "bg-gray-400")} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openSheet(group)}>
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
                      <span className="text-sm text-muted-foreground">Henüz müze eklenmemiş</span>
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
