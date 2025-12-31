import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useTicketStore } from '@/store/ticketStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, UserCheck, UserX, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const Staff = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'cashier' | 'admin'>('cashier');
  
  const { staff, addStaff, removeStaff, toggleStaffStatus, setCurrentUser, currentUser } = useTicketStore();

  const handleAddStaff = () => {
    if (!newName.trim()) {
      toast.error('Lütfen personel adını girin');
      return;
    }

    addStaff(newName.trim(), newRole);
    toast.success('Personel başarıyla eklendi');
    setNewName('');
    setNewRole('cashier');
    setIsDialogOpen(false);
  };

  const handleRemove = (id: string, name: string) => {
    removeStaff(id);
    toast.success(`${name} başarıyla silindi`);
  };

  const handleLogin = (staffMember: typeof staff[0]) => {
    setCurrentUser(staffMember);
    toast.success(`${staffMember.name} olarak giriş yapıldı`);
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Personel Yönetimi</h1>
            <p className="text-muted-foreground mt-1">
              Gişe personellerini yönetin
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Personel Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Personel Ekle</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Personel Adı</Label>
                  <Input
                    id="name"
                    placeholder="Örn: Gişe 3 - Mehmet"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as 'cashier' | 'admin')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Gişe Personeli</SelectItem>
                      <SelectItem value="admin">Yönetici</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddStaff} className="w-full">
                  Ekle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Current User */}
        {currentUser && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                <span className="font-semibold text-primary-foreground">
                  {currentUser.name.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktif Kullanıcı</p>
                <p className="font-semibold text-foreground">{currentUser.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Staff List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member, index) => (
            <div 
              key={member.id}
              className={cn(
                "bg-card rounded-2xl border p-6 animate-fade-in transition-all duration-200",
                member.isActive ? "border-border" : "border-destructive/30 opacity-60",
                currentUser?.id === member.id && "ring-2 ring-primary"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    member.role === 'admin' 
                      ? "bg-warning/10 text-warning" 
                      : "bg-primary/10 text-primary"
                  )}>
                    {member.role === 'admin' ? (
                      <Shield className="w-6 h-6" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {member.role === 'admin' ? 'Yönetici' : 'Gişe Personeli'}
                    </p>
                  </div>
                </div>
                
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium",
                  member.isActive 
                    ? "bg-success/10 text-success" 
                    : "bg-destructive/10 text-destructive"
                )}>
                  {member.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleLogin(member)}
                  disabled={!member.isActive}
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  Giriş Yap
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleStaffStatus(member.id)}
                >
                  {member.isActive ? (
                    <UserX className="w-4 h-4" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(member.id, member.name)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {staff.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <User className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Henüz personel eklenmedi</p>
            <p className="text-sm text-muted-foreground/70">
              "Personel Ekle" butonuna tıklayarak başlayın
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Staff;
