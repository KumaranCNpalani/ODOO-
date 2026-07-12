'use server';

import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}

// 1. Departments Management
export async function createDepartment(formData: FormData) {
  await checkAdmin();

  const name = formData.get('name') as string;
  const parentDepartmentId = formData.get('parentDepartmentId') as string || null;
  const headUserId = formData.get('headUserId') as string || null;

  if (!name || name.trim() === '') {
    return { success: false, message: 'Department name is required' };
  }

  try {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_departments (id, name, parent_department_id, head_user_id, status) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), parentDepartmentId || null, headUserId || null, 'ACTIVE']
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error: any) {
    console.error('Create department error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, message: 'A department with this name already exists' };
    }
    return { success: false, message: 'Failed to create department' };
  }
}

export async function updateDepartment(id: string, data: { name: string; parentDepartmentId?: string | null; headUserId?: string | null; status: 'ACTIVE' | 'INACTIVE' }) {
  await checkAdmin();

  try {
    await query(
      'UPDATE odoo_assetflow_departments SET name = ?, parent_department_id = ?, head_user_id = ?, status = ? WHERE id = ?',
      [data.name.trim(), data.parentDepartmentId || null, data.headUserId || null, data.status, id]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Update department error:', error);
    return { success: false, message: 'Failed to update department' };
  }
}

// 2. Categories Management
export async function createAssetCategory(name: string, description: string | null, schema: Record<string, string>) {
  await checkAdmin();

  if (!name || name.trim() === '') {
    return { success: false, message: 'Category name is required' };
  }

  try {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_asset_categories (id, name, description, custom_fields_schema) VALUES (?, ?, ?, ?)',
      [id, name.trim(), description?.trim() || null, JSON.stringify(schema)]
    );

    revalidatePath('/dashboard/setup');
    revalidatePath('/dashboard/assets');
    return { success: true };
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, message: 'A category with this name already exists' };
    }
    return { success: false, message: 'Failed to create category' };
  }
}

// 3. User Role Management
export async function promoteUser(targetUserId: string, role: string, departmentId?: string | null) {
  const adminSession = await checkAdmin();

  if (targetUserId === adminSession.id) {
    return { success: false, message: 'Cannot demote or change your own admin role' };
  }

  try {
    await query(
      'UPDATE odoo_assetflow_users SET role = ?, department_id = ? WHERE id = ?',
      [role, departmentId || null, targetUserId]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, adminSession.id, 'PROMOTE_USER', JSON.stringify({ targetUserId, newRole: role, departmentId })]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Promote user error:', error);
    return { success: false, message: 'Failed to update user role' };
  }
}

export async function toggleUserStatus(targetUserId: string, status: 'ACTIVE' | 'INACTIVE') {
  const adminSession = await checkAdmin();

  if (targetUserId === adminSession.id) {
    return { success: false, message: 'Cannot deactivate yourself' };
  }

  try {
    await query(
      'UPDATE odoo_assetflow_users SET status = ? WHERE id = ?',
      [status, targetUserId]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Toggle user status error:', error);
    return { success: false, message: 'Failed to update user status' };
  }
}
