import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import {
  LayoutDashboard,
  FileSpreadsheet,
  CalendarDays,
  ClipboardList,
  Settings,
  LogOut,
  TrendingUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Trophy,
  User } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navigation = [
{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
{ name: 'Budget Entry', href: '/budget', icon: FileSpreadsheet },
{ name: 'Daily Operational Entry', href: '/operations', icon: ClipboardList },
{ name: 'Operations Summary', href: '/operations/summary', icon: BarChart3 },
{ name: 'Reports', href: '/reports', icon: TrendingUp },
{ name: 'Program Rankings', href: '/reports/program-rankings', icon: Trophy },
{ name: 'KPI Summary', href: '/reports/kpi-summary', icon: BarChart3 }];


const adminNavigation = [
{ name: 'Admin Settings', href: '/admin', icon: Settings }];


const roleLabels: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  nursing: 'Nursing',
  service_development: 'Service Dev',
  program_administrator: 'Program Admin',
  adon: 'ADON',
  don: 'DON',
  him: 'HIM',
  sdd: 'SDD',
  human_resources: 'HR'
};

export function Sidebar() {
  const location = useLocation();
  const { user, signOut, role, isAdmin } = useAuth();
  const { logActivity } = useActivityLog();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await logActivity({ action: 'logout', resourceType: 'system' });
    signOut();
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}>
      
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed &&
        <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">
              OPS DASHBOARD
            </span>
          </Link>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
          
          {collapsed ?
          <ChevronRight className="h-4 w-4" /> :

          <ChevronLeft className="h-4 w-4" />
          }
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'nav-item',
                  isActive && 'active',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.name : undefined}>
                
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>);

          })}
        </div>

        {/* Admin section */}
        {isAdmin &&
        <div className="mt-6 pt-6 border-t border-sidebar-border">
            {!collapsed &&
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
          }
            <div className="space-y-1">
              {adminNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'nav-item',
                    isActive && 'active',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? item.name : undefined}>
                  
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>);

            })}
            </div>
          </div>
        }
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && user &&
        <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.email}
            </p>
            <p className="text-xs capitalize text-muted-foreground">{role ? roleLabels[role] || role : 'User'}</p>
          </div>
        }
        <Link
          to="/profile"
          className={cn(
            'nav-item mb-1',
            location.pathname === '/profile' && 'active',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Profile' : undefined}>
          
          <User className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Profile</span>}
        </Link>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            'w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed ? 'justify-center px-2' : 'justify-start gap-3 px-3'
          )}
          title={collapsed ? 'Sign Out' : undefined}>
          
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>);

}