import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Ticket, 
  QrCode, 
  Users, 
  BarChart3, 
  Menu,
  X,
  LogOut,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, hasPermission, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // Build nav items based on permissions
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/sell', label: 'Bilet Satış', icon: Ticket, show: hasPermission('sell_tickets') },
    { path: '/validate', label: 'Bilet Doğrulama', icon: QrCode, show: hasPermission('sell_tickets') },
    { path: '/reports', label: 'Raporlar', icon: BarChart3, show: hasPermission('view_reports') },
    { path: '/settings', label: 'Ayarlar', icon: Settings, show: isAdmin },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 gradient-dark z-50 flex items-center justify-between px-4">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-primary-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <Ticket className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-primary-foreground">E-Bilet</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-foreground/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 gradient-dark z-50 transition-transform duration-300",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center ticket-shadow">
                <Ticket className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-primary-foreground">E-Bilet</h1>
                <p className="text-xs text-sidebar-foreground/70">Yönetim Sistemi</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    isActive 
                      ? "gradient-primary text-primary-foreground ticket-shadow" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          {profile && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <span className="text-sm font-semibold text-sidebar-foreground">
                    {profile.full_name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-foreground truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-xs text-sidebar-foreground/70">
                    {isAdmin ? 'Yönetici' : 'Gişe Personeli'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Çıkış Yap
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "lg:ml-64 min-h-screen pt-16 lg:pt-0",
        "transition-all duration-300"
      )}>
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
