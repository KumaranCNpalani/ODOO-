import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import NotificationsConsole from './notificationsConsole';

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Query recent system audit logs
  const rawLogs = await query<any>(
    `SELECT l.*, u.name as user_name, u.role as user_role 
     FROM odoo_assetflow_audit_logs l 
     LEFT JOIN odoo_assetflow_users u ON l.user_id = u.id 
     ORDER BY l.created_at DESC LIMIT 30`
  );

  const logs = rawLogs.map((log: any) => ({
    id: log.id,
    action: log.action,
    details: log.details,
    ipAddress: log.ip_address,
    createdAt: log.created_at,
    user: { name: log.user_name, role: log.user_role },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">System Notifications</h2>
        <p className="text-sm text-muted-foreground">Chronological audit trail of administrative, allocations, and booking events</p>
      </div>

      <NotificationsConsole logs={logs} />
    </div>
  );
}
