import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BarChart3, TrendingUp, AlertCircle, Calendar, Download } from 'lucide-react';

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'ASSET_MANAGER')) {
    redirect('/dashboard');
  }

  // 1. Fetch Department Allocation Stats using direct subquery counts
  const departmentData = await query<any>(
    `SELECT d.name, 
      (SELECT COUNT(*) FROM odoo_assetflow_allocations al 
       WHERE al.allocated_to_dept_id = d.id AND al.is_active = 1) as count 
     FROM odoo_assetflow_departments d 
     WHERE d.status = "ACTIVE" 
     ORDER BY name ASC`
  );

  // 2. Fetch Maintenance Frequency by Category
  const maintenanceData = await query<any>(
    `SELECT c.name, 
      (SELECT COUNT(*) FROM odoo_assetflow_maintenance_requests r 
       LEFT JOIN odoo_assetflow_assets a ON r.asset_id = a.id 
       WHERE a.category_id = c.id) as count 
     FROM odoo_assetflow_asset_categories c 
     ORDER BY c.name ASC`
  );

  // 3. Most Used Resources (Bookings count)
  const mostUsedResources = await query<any>(
    `SELECT a.asset_tag, a.name, a.location, 
      (SELECT COUNT(*) FROM odoo_assetflow_bookings b 
       WHERE b.asset_id = a.id AND b.status != "CANCELLED") as bookings_count 
     FROM odoo_assetflow_assets a 
     WHERE a.shared_bookable = 1 
     ORDER BY bookings_count DESC LIMIT 3`
  );

  // 4. Idle Assets (Status Available, ordered by updatedAt - longest unused)
  const idleAssets = await query<any>(
    `SELECT a.asset_tag, a.name, a.updated_at 
     FROM odoo_assetflow_assets a 
     WHERE a.status = "AVAILABLE" AND a.shared_bookable = 0 
     ORDER BY a.updated_at ASC LIMIT 3`
  );

  // 5. Assets Due for Maintenance / Nearing Retirement
  const retiringAssets = await query<any>(
    `SELECT a.asset_tag, a.name, a.acquisition_date, a.current_condition 
     FROM odoo_assetflow_assets a 
     WHERE (a.current_condition = "DAMAGED" OR a.acquisition_date < DATE_SUB(NOW(), INTERVAL 5 YEAR)) 
       AND a.status NOT IN ("RETIRED", "DISPOSED") 
     ORDER BY a.acquisition_date ASC LIMIT 4`
  );

  // Helper calculation for SVG chart height
  const maxAllocations = Math.max(...departmentData.map((d: any) => d.count), 5);
  const maxMaintenance = Math.max(...maintenanceData.map((c: any) => c.count), 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">Actionable insights into corporate property utilization and life cycles</p>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-border text-white font-semibold text-xs transition-all shadow-md">
          <Download className="w-4 h-4" />
          Export PDF Report
        </button>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart A: Utilization by Department */}
        <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Active Asset Allocation by Department
          </h3>
          
          <div className="h-64 flex items-end justify-around gap-2 pt-6 border-b border-l border-border/60 pl-2 pb-2 relative">
            {departmentData.map((dept: any, index: number) => {
              const pct = (dept.count / maxAllocations) * 100;
              return (
                <div key={index} className="flex flex-col items-center group relative flex-1">
                  {/* Tooltip */}
                  <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-zinc-900 border border-border px-2 py-1 rounded text-[10px] font-bold text-white z-10">
                    {dept.count} allocated
                  </div>
                  {/* Bar */}
                  <div 
                    style={{ height: `${Math.max(pct, 5)}%` }} 
                    className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-primary/60 to-primary group-hover:opacity-80 transition-all duration-300 shadow-lg shadow-primary/10"
                  ></div>
                  <span className="text-[10px] text-muted-foreground font-semibold mt-2 text-center truncate max-w-[80px]">
                    {dept.name.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart B: Maintenance Frequency by Category */}
        <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            Repair Request Density by Category
          </h3>
          
          <div className="h-64 flex items-end justify-around gap-2 pt-6 border-b border-l border-border/60 pl-2 pb-2 relative">
            {maintenanceData.map((cat: any, index: number) => {
              const pct = (cat.count / maxMaintenance) * 100;
              return (
                <div key={index} className="flex flex-col items-center group relative flex-1">
                  {/* Tooltip */}
                  <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-zinc-900 border border-border px-2 py-1 rounded text-[10px] font-bold text-white z-10">
                    {cat.count} repairs
                  </div>
                  {/* Bar */}
                  <div 
                    style={{ height: `${Math.max(pct, 5)}%` }} 
                    className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-amber-500/50 to-amber-500 group-hover:opacity-80 transition-all duration-300 shadow-lg shadow-amber-500/10"
                  ></div>
                  <span className="text-[10px] text-muted-foreground font-semibold mt-2 text-center truncate max-w-[80px]">
                    {cat.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Grid Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Most Used vs Idle Card */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-5">
          <h3 className="font-bold text-white text-base">Asset Utilization Index</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Most Used */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Most-Used Resources</span>
              <div className="flex flex-col gap-2.5">
                {mostUsedResources.map((res: any) => (
                  <div key={res.asset_tag} className="p-3 rounded-lg bg-secondary/40 border border-border/50 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{res.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{res.asset_tag} | {res.location}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      {res.bookings_count} bookings
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Idle */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Idle/Unused Assets</span>
              <div className="flex flex-col gap-2.5">
                {idleAssets.map((res: any) => {
                  const daysIdle = Math.floor((new Date().getTime() - new Date(res.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={res.asset_tag} className="p-3 rounded-lg bg-secondary/40 border border-border/50 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-white">{res.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{res.asset_tag}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-muted-foreground font-bold">
                        Idle {daysIdle}d
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>
        </div>

        {/* Assets Due for Maintenance / Retirement */}
        <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-white text-base">Alerts & Retirement</h3>
          <div className="flex flex-col gap-3">
            {retiringAssets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No asset alerts active</p>
            ) : (
              retiringAssets.map((res: any) => {
                const age = new Date().getFullYear() - new Date(res.acquisition_date).getFullYear();
                const isDamaged = res.current_condition === 'DAMAGED';
                return (
                  <div key={res.asset_tag} className="p-3.5 rounded-lg bg-secondary/40 border border-border/40 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-white">{res.name}</p>
                      <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {res.asset_tag}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                      {isDamaged ? (
                        <span className="flex items-center gap-1 text-rose-500 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Marked Damaged
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500 font-semibold">
                          <Calendar className="w-3.5 h-3.5" />
                          Age: {age} years old
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
