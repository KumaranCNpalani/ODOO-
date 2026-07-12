import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AuditConsole from './auditConsole';

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch the currently active audit cycle (if any)
  const cycles = await query<any>(
    'SELECT * FROM odoo_assetflow_audit_cycles WHERE status = "IN_PROGRESS" LIMIT 1'
  );
  let activeCycle = cycles[0] || null;

  if (activeCycle) {
    const rawItems = await query<any>(
      `SELECT i.*, a.id as asset_uuid, a.name as asset_name, a.asset_tag, a.location as asset_location, u.name as verifier_name 
       FROM odoo_assetflow_audit_items i 
       LEFT JOIN odoo_assetflow_assets a ON i.asset_id = a.id 
       LEFT JOIN odoo_assetflow_users u ON i.verified_by_id = u.id 
       WHERE i.audit_cycle_id = ? 
       ORDER BY a.asset_tag ASC`,
      [activeCycle.id]
    );

    activeCycle.items = rawItems.map((item: any) => ({
      id: item.id,
      auditCycleId: item.audit_cycle_id,
      assetId: item.asset_id,
      status: item.status,
      verifiedById: item.verified_by_id,
      verificationNotes: item.verification_notes,
      verifiedAt: item.verified_at,
      asset: { id: item.asset_uuid, name: item.asset_name, assetTag: item.asset_tag, location: item.asset_location },
      verifiedBy: item.verifier_name ? { name: item.verifier_name } : null,
    }));
  }

  // Fetch departments list
  const departments = await query<any>(
    'SELECT id, name FROM odoo_assetflow_departments WHERE status = "ACTIVE" ORDER BY name ASC'
  );

  // Fetch active users list (for auditor selection dropdown)
  const users = await query<any>(
    'SELECT id, name, email FROM odoo_assetflow_users WHERE status = "ACTIVE" ORDER BY name ASC'
  );

  // Fetch logged in user full role
  const currentUsers = await query<any>(
    'SELECT id, role FROM odoo_assetflow_users WHERE id = ?',
    [session.id]
  );
  const currentUser = currentUsers[0];

  if (!currentUser) redirect('/login');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Audit Cycles</h2>
        <p className="text-sm text-muted-foreground">Perform asset stock verification and auto-resolve stock discrepancies</p>
      </div>

      <AuditConsole 
        activeCycle={activeCycle} 
        departments={departments} 
        users={users} 
        currentUser={currentUser} 
      />
    </div>
  );
}
