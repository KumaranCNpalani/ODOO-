import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MaintenanceConsole from '@/components/maintenanceConsole';

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch all maintenance tickets
  const rawRequests = await query<any>(
    `SELECT r.*, a.id as asset_uuid, a.name as asset_name, a.asset_tag, u.name as requester_name, t.id as tech_id, t.name as tech_name 
     FROM odoo_assetflow_maintenance_requests r 
     LEFT JOIN odoo_assetflow_assets a ON r.asset_id = a.id 
     LEFT JOIN odoo_assetflow_users u ON r.requested_by_id = u.id 
     LEFT JOIN odoo_assetflow_users t ON r.technician_id = t.id 
     ORDER BY r.created_at DESC`
  );

  const requests = rawRequests.map((r: any) => ({
    id: r.id,
    assetId: r.asset_id,
    requestedById: r.requested_by_id,
    priority: r.priority,
    status: r.status,
    description: r.description,
    photoUrl: r.photo_url,
    technicianId: r.technician_id,
    resolutionNotes: r.resolution_notes,
    approvedById: r.approved_by_id,
    createdAt: r.created_at,
    asset: { id: r.asset_uuid, name: r.asset_name, assetTag: r.asset_tag },
    requestedBy: { name: r.requester_name },
    technician: r.tech_id ? { id: r.tech_id, name: r.tech_name } : null,
  }));

  // Fetch assets list for file ticket dropdown
  const assets = await query<any>(
    'SELECT id, name, asset_tag as assetTag FROM odoo_assetflow_assets WHERE status NOT IN ("RETIRED", "DISPOSED") ORDER BY asset_tag ASC'
  );

  // Fetch active technician selection
  const technicians = await query<any>(
    'SELECT id, name FROM odoo_assetflow_users WHERE status = "ACTIVE" AND role IN ("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD") ORDER BY name ASC'
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
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Maintenance Pipeline</h2>
        <p className="text-sm text-muted-foreground">Manage and track equipment repairs, technician assignments, and resolutions</p>
      </div>

      <MaintenanceConsole 
        requests={requests} 
        assets={assets} 
        technicians={technicians} 
        currentUser={currentUser} 
      />
    </div>
  );
}
