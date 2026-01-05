import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TicketTypesSettings } from '@/components/settings/TicketTypesSettings';
import { MuseumSettings } from '@/components/settings/MuseumSettings';
import { MuseumGroupSettings } from '@/components/settings/MuseumGroupSettings';
import { SessionSettings } from '@/components/settings/SessionSettings';
import { UserSettings } from '@/components/settings/UserSettings';
import { StaffRotationSettings } from '@/components/settings/StaffRotationSettings';
import { Ticket, Building2, Clock, Users, CalendarDays, FolderOpen } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const Settings = () => {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('ticket-types');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Ayarlar</h1>
          <p className="text-muted-foreground mt-1">
            Sistem ayarlarını yönetin
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="ticket-types"
              className="data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground gap-2 py-3"
            >
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">Bilet Türleri</span>
              <span className="sm:hidden">Biletler</span>
            </TabsTrigger>
            <TabsTrigger 
              value="museums"
              className="data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground gap-2 py-3"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Müzeler</span>
              <span className="sm:hidden">Müze</span>
            </TabsTrigger>
            <TabsTrigger 
              value="museum-groups"
              className="data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground gap-2 py-3"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Müze Grupları</span>
              <span className="sm:hidden">Gruplar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sessions"
              className="data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground gap-2 py-3"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Seanslar</span>
              <span className="sm:hidden">Seans</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground gap-2 py-3"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Kullanıcılar</span>
              <span className="sm:hidden">Kullanıcı</span>
            </TabsTrigger>
            <TabsTrigger 
              value="rotations"
              className="data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground gap-2 py-3"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Rotasyon</span>
              <span className="sm:hidden">Rotasyon</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="ticket-types" className="mt-0">
              <TicketTypesSettings />
            </TabsContent>
            <TabsContent value="museums" className="mt-0">
              <MuseumSettings />
            </TabsContent>
            <TabsContent value="museum-groups" className="mt-0">
              <MuseumGroupSettings />
            </TabsContent>
            <TabsContent value="sessions" className="mt-0">
              <SessionSettings />
            </TabsContent>
            <TabsContent value="users" className="mt-0">
              <UserSettings />
            </TabsContent>
            <TabsContent value="rotations" className="mt-0">
              <StaffRotationSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
