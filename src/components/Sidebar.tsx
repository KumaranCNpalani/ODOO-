'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/authActions';
import { 
  LayoutDashboard, 
  Settings, 
  Package, 
  ArrowLeftRight, 
  CalendarDays, 
  Wrench, 
  ClipboardCheck, 
  BarChart3, 
  Bell, 
  LogOut,
  User2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    },
    {
      name: 'Organization Setup',
      href: '/dashboard/setup',
      icon: Settings,
      roles: ['ADMIN'],
    },
    {
      name: 'Assets Directory',
      href: '/dashboard/assets',
      icon: Package,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    },
    {
      name: 'Allocation & Transfer',
      href: '/dashboard/allocations',
      icon: ArrowLeftRight,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    },
    {
      name: 'Resource Booking',
      href: '/dashboard/bookings',
      icon: CalendarDays,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    },
    {
      name: 'Maintenance',
      href: '/dashboard/maintenance',
      icon: Wrench,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    },
    {
      name: 'Audit Cycles',
      href: '/dashboard/audit',
      icon: ClipboardCheck,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'], // Visible to all, but actions restricted inside cycle based on assignment
    },
    {
      name: 'Reports & Analytics',
      href: '/dashboard/reports',
      icon: BarChart3,
      roles: ['ADMIN', 'ASSET_MANAGER'],
    },
    {
      name: 'Notifications',
      href: '/dashboard/notifications',
      icon: Bell,
      roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    },
  ];

  // Filter items based on user role
  const filteredItems = navigationItems.filter(item => item.roles.includes(user.role));

  const formatRole = (role: string) => {
    return role.replace('_', ' ');
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 glass-panel border-r border-border flex flex-col justify-between p-4 z-50">
      <div className="flex flex-col gap-6">
        {/* Header Logo */}
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-white shadow-md shadow-primary/20">
            AF
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground">AssetFlow</h1>
            <span className="text-xs text-muted-foreground font-semibold">Odoo ERP Module</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-105",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-primary"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Info & Footer */}
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
            <User2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate uppercase font-bold tracking-wider">
              {formatRole(user.role)}
            </p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
