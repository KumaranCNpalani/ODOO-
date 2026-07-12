import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SetupTabs from './setupTabs';

export default async function SetupPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  // Fetch departments with relations
  const rawDepts = await query<any>(
    `SELECT d.*, u.id as head_id, u.name as head_name, pd.id as parent_id, pd.name as parent_name 
     FROM odoo_assetflow_departments d 
     LEFT JOIN odoo_assetflow_users u ON d.head_user_id = u.id 
     LEFT JOIN odoo_assetflow_departments pd ON d.parent_department_id = pd.id 
     ORDER BY d.name ASC`
  );
  
  const departments = rawDepts.map((d: any) => ({
    id: d.id,
    name: d.name,
    parentDepartmentId: d.parent_department_id,
    headUserId: d.head_user_id,
    status: d.status,
    headUser: d.head_id ? { id: d.head_id, name: d.head_name } : null,
    parentDepartment: d.parent_id ? { id: d.parent_id, name: d.parent_name } : null,
  }));

  // Fetch categories
  const categories = await query<any>(
    'SELECT * FROM odoo_assetflow_asset_categories ORDER BY name ASC'
  );

  // Fetch users
  const rawUsers = await query<any>(
    `SELECT u.*, d.id as dept_id, d.name as dept_name 
     FROM odoo_assetflow_users u 
     LEFT JOIN odoo_assetflow_departments d ON u.department_id = d.id 
     ORDER BY u.name ASC`
  );

  const users = rawUsers.map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.department_id,
    status: u.status,
    department: u.dept_id ? { id: u.dept_id, name: u.dept_name } : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight font-sans">Organization Setup</h2>
        <p className="text-sm text-muted-foreground">Admin panel for department management, categories, and promotions</p>
      </div>

      <SetupTabs 
        departments={departments} 
        categories={categories} 
        users={users} 
      />
    </div>
  );
}
