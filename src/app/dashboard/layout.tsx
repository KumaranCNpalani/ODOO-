import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { initializeDatabase } from '@/lib/initDb';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Auto-verify and create tables if they do not exist
  try {
    await initializeDatabase();
  } catch (err) {
    console.error('Database initialization error:', err);
  }

  // Fetch fresh user details
  const users = await query<any>(
    'SELECT name, email, role FROM odoo_assetflow_users WHERE id = ?',
    [session.id]
  );
  const user = users[0];

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar Navigation */}
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />

      {/* Main Console Workspace */}
      <main className="flex-1 pl-64 min-h-screen flex flex-col">
        {/* Top bar styling */}
        <header className="h-16 border-b border-border/40 px-8 flex items-center justify-between glass-panel sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-slow"></span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Secure Session Active
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Local time: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {/* Console view child container */}
        <div className="flex-1 p-8 bg-gradient-to-b from-background via-background to-background/95">
          {children}
        </div>
      </main>
    </div>
  );
}
