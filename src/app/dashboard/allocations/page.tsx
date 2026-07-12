import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AllocationsConsole from './allocationsConsole';

export default async function AllocationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch raw assets
  const rawAssets = await query<any>('SELECT * FROM odoo_assetflow_assets ORDER BY asset_tag ASC');

  // Fetch all allocations with user/dept info to map inline
  const allAllocations = await query<any>(
    `SELECT al.*, u.name as user_name, d.name as dept_name 
     FROM odoo_assetflow_allocations al 
     LEFT JOIN odoo_assetflow_users u ON al.allocated_to_user_id = u.id 
     LEFT JOIN odoo_assetflow_departments d ON al.allocated_to_dept_id = d.id 
     ORDER BY al.allocation_date DESC`
  );

  const assets = rawAssets.map((asset: any) => ({
    ...asset,
    allocations: allAllocations
      .filter((al: any) => al.asset_id === asset.id)
      .map((al: any) => ({
        id: al.id,
        assetId: al.asset_id,
        allocatedToUserId: al.allocated_to_user_id,
        allocatedToDeptId: al.allocated_to_dept_id,
        allocationDate: al.allocation_date,
        expectedReturnDate: al.expected_return_date,
        actualReturnDate: al.actual_return_date,
        isActive: al.is_active === 1,
        allocatedToUser: al.allocated_to_user_id ? { name: al.user_name } : null,
        allocatedToDept: al.allocated_to_dept_id ? { name: al.dept_name } : null,
      })),
  }));

  // Fetch active users/employees
  const users = await query<any>(
    'SELECT id, name, email, department_id as departmentId FROM odoo_assetflow_users WHERE status = "ACTIVE" ORDER BY name ASC'
  );

  // Fetch pending transfer requests
  const rawTransfers = await query<any>(
    `SELECT t.*, a.name as asset_name, a.asset_tag, ru.name as requester_name, ru.department_id as requester_dept_id, tu.name as target_user_name 
     FROM odoo_assetflow_transfer_requests t 
     LEFT JOIN odoo_assetflow_assets a ON t.asset_id = a.id 
     LEFT JOIN odoo_assetflow_users ru ON t.requesting_user_id = ru.id 
     LEFT JOIN odoo_assetflow_users tu ON t.target_user_id = tu.id 
     WHERE t.status = "REQUESTED" 
     ORDER BY t.created_at DESC`
  );

  const transfers = rawTransfers.map((t: any) => ({
    id: t.id,
    remarks: t.remarks,
    asset: { name: t.asset_name, assetTag: t.asset_tag },
    requestingUser: { name: t.requester_name, departmentId: t.requester_dept_id },
    targetUser: t.target_user_name ? { name: t.target_user_name } : null,
  }));

  // Fetch current user details
  const currentUsers = await query<any>(
    'SELECT id, role, department_id as departmentId FROM odoo_assetflow_users WHERE id = ?',
    [session.id]
  );
  const currentUser = currentUsers[0];

  if (!currentUser) redirect('/login');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Asset Allocation</h2>
        <p className="text-sm text-muted-foreground">Manage asset hand-outs, returns, and transfer approvals</p>
      </div>

      <AllocationsConsole 
        assets={assets} 
        users={users} 
        transfers={transfers} 
        currentUser={currentUser} 
      />
    </div>
  );
}
