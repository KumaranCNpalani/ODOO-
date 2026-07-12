import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { 
  Package, 
  ArrowLeftRight, 
  CalendarDays, 
  Wrench, 
  AlertTriangle,
  ArrowUpRight,
  ClipboardList
} from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch counts
  const availableRes = await query<any>('SELECT COUNT(*) as count FROM odoo_assetflow_assets WHERE status = "AVAILABLE"');
  const allocatedRes = await query<any>('SELECT COUNT(*) as count FROM odoo_assetflow_assets WHERE status = "ALLOCATED"');
  const maintenanceRes = await query<any>(
    'SELECT COUNT(*) as count FROM odoo_assetflow_maintenance_requests WHERE status IN ("PENDING", "APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS")'
  );
  const bookingRes = await query<any>('SELECT COUNT(*) as count FROM odoo_assetflow_bookings WHERE status IN ("UPCOMING", "ONGOING")');
  const transferRes = await query<any>('SELECT COUNT(*) as count FROM odoo_assetflow_transfer_requests WHERE status = "REQUESTED"');

  const availableCount = availableRes[0]?.count || 0;
  const allocatedCount = allocatedRes[0]?.count || 0;
  const maintenanceCount = maintenanceRes[0]?.count || 0;
  const bookingCount = bookingRes[0]?.count || 0;
  const transferCount = transferRes[0]?.count || 0;

  // Overdue calculations
  const overdueAllocations = await query<any>(
    `SELECT a.*, asst.asset_tag, asst.name as asset_name, u.name as user_name 
     FROM odoo_assetflow_allocations a 
     LEFT JOIN odoo_assetflow_assets asst ON a.asset_id = asst.id 
     LEFT JOIN odoo_assetflow_users u ON a.allocated_to_user_id = u.id 
     WHERE a.is_active = 1 AND a.expected_return_date < NOW()`
  );

  // Recent activity logs
  const logs = await query<any>(
    `SELECT l.*, u.name as user_name 
     FROM odoo_assetflow_audit_logs l 
     LEFT JOIN odoo_assetflow_users u ON l.user_id = u.id 
     ORDER BY l.created_at DESC LIMIT 6`
  );

  // Format activity action helper
  const getActionText = (log: any) => {
    const userName = log.user_name || 'System';
    const details = log.details || {};

    switch (log.action) {
      case 'REGISTER_ASSET':
        return `${userName} registered a new asset (${details.assetTag || 'N/A'})`;
      case 'ALLOCATE_ASSET':
        return `${userName} allocated an asset (ID: ${details.assetId?.substring(0, 8)})`;
      case 'SUBMIT_TRANSFER_REQUEST':
        return `${userName} submitted a transfer request for asset`;
      case 'RETURN_ASSET':
        return `${userName} processed return for asset. Condition: ${details.condition || 'N/A'}`;
      case 'BOOK_RESOURCE':
        return `${userName} booked a shared resource slot`;
      case 'CREATE_MAINTENANCE_REQUEST':
        return `${userName} raised a maintenance request`;
      case 'UPDATE_MAINTENANCE_STATUS':
        return `${userName} updated maintenance ticket status to ${details.newStatus || 'N/A'}`;
      case 'CREATE_AUDIT_CYCLE':
        return `${userName} launched a new audit cycle (${details.cycleId?.substring(0, 8)})`;
      case 'CLOSE_AUDIT_CYCLE':
        return `${userName} closed and finalized audit cycle`;
      case 'PROMOTE_USER':
        return `${userName} promoted a user to role ${details.newRole || 'N/A'}`;
      default:
        return `${userName} performed action ${log.action}`;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Heading */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Overview Console</h2>
          <p className="text-sm text-muted-foreground">Real-time status of Odoo corporate assets</p>
        </div>
      </div>

      {/* Overdue Alerts Banner */}
      {overdueAllocations.length > 0 && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive flex items-center justify-between shadow-lg shadow-destructive/5 animate-pulse-slow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Overdue Returns Detected</p>
              <p className="text-xs text-destructive/80">
                {overdueAllocations.length} asset(s) are past their expected return date. Please follow up.
              </p>
            </div>
          </div>
          <Link 
            href="/dashboard/allocations" 
            className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-xs font-bold transition-all duration-200"
          >
            Review Allocations
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Available Card */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between group hover:border-primary/40 transition-all duration-200">
          <div>
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Available Assets</span>
            <p className="text-3xl font-extrabold text-white mt-1">{availableCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-all">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Allocated Card */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between group hover:border-blue-500/40 transition-all duration-200">
          <div>
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Allocated Assets</span>
            <p className="text-3xl font-extrabold text-white mt-1">{allocatedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-all">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>

        {/* Maintenance Card */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between group hover:border-amber-500/40 transition-all duration-200">
          <div>
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Maintenance</span>
            <p className="text-3xl font-extrabold text-white mt-1">{maintenanceCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-all">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Active Bookings Card */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between group hover:border-emerald-500/40 transition-all duration-200">
          <div>
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Active Bookings</span>
            <p className="text-3xl font-extrabold text-white mt-1">{bookingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-all">
            <CalendarDays className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Transfers Card */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between group hover:border-purple-500/40 transition-all duration-200">
          <div>
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Transfers</span>
            <p className="text-3xl font-extrabold text-white mt-1">{transferCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-all">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Console */}
        <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-white text-base">Quick Actions</h3>
          
          <div className="flex flex-col gap-3">
            {/* Action 1 */}
            <Link 
              href="/dashboard/assets"
              className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-muted border border-border transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Register Asset</p>
                  <p className="text-[10px] text-muted-foreground">Add equipment or property</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            {/* Action 2 */}
            <Link 
              href="/dashboard/bookings"
              className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-muted border border-border transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Book Resource</p>
                  <p className="text-[10px] text-muted-foreground">Reserve meeting rooms or cars</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            {/* Action 3 */}
            <Link 
              href="/dashboard/maintenance"
              className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-muted border border-border transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Raise Request</p>
                  <p className="text-[10px] text-muted-foreground">Report issues for repairs</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Recent Activity Log Feed */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-white text-base">Recent Activities</h3>

          <div className="flex flex-col gap-3">
            {logs.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <ClipboardList className="w-10 h-10 opacity-30" />
                <p className="text-xs">No recent activity logged</p>
              </div>
            ) : (
              logs.map((log: any) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3.5 rounded-lg bg-secondary/40 border border-border/40 hover:border-border transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary/80"></div>
                    <p className="text-sm text-white font-medium">{getActionText(log)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
