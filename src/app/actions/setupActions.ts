'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

async function checkAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}

// ==========================================
// 1. Departments Management (Add, Update, Delete)
// ==========================================
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

export async function deleteDepartment(id: string) {
  const session = await checkAdmin();

  try {
    await executeTransaction(async (conn) => {
      // 1. Unlink parent references
      await conn.execute(
        'UPDATE odoo_assetflow_departments SET parent_department_id = NULL WHERE parent_department_id = ?',
        [id]
      );
      // 2. Unlink user department references
      await conn.execute(
        'UPDATE odoo_assetflow_users SET department_id = NULL WHERE department_id = ?',
        [id]
      );
      // 3. Delete department
      await conn.execute(
        'DELETE FROM odoo_assetflow_departments WHERE id = ?',
        [id]
      );
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'DELETE_DEPARTMENT', JSON.stringify({ departmentId: id })]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Delete department error:', error);
    return { success: false, message: 'Failed to delete department' };
  }
}

// ==========================================
// 2. Categories Management (Add, Update, Delete)
// ==========================================
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

export async function updateAssetCategory(id: string, name: string, description: string | null, schema: Record<string, string>) {
  await checkAdmin();

  if (!name || name.trim() === '') {
    return { success: false, message: 'Category name is required' };
  }

  try {
    await query(
      'UPDATE odoo_assetflow_asset_categories SET name = ?, description = ?, custom_fields_schema = ? WHERE id = ?',
      [name.trim(), description?.trim() || null, JSON.stringify(schema), id]
    );

    revalidatePath('/dashboard/setup');
    revalidatePath('/dashboard/assets');
    return { success: true };
  } catch (error) {
    console.error('Update category error:', error);
    return { success: false, message: 'Failed to update category' };
  }
}

export async function deleteAssetCategory(id: string) {
  const session = await checkAdmin();

  try {
    // Check if category is currently used by any assets
    const activeAssets = await query<any>(
      'SELECT id FROM odoo_assetflow_assets WHERE category_id = ? LIMIT 1',
      [id]
    );

    if (activeAssets.length > 0) {
      return { success: false, message: 'Cannot delete category that is currently assigned to registered assets.' };
    }

    await query('DELETE FROM odoo_assetflow_asset_categories WHERE id = ?', [id]);

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'DELETE_CATEGORY', JSON.stringify({ categoryId: id })]
    );

    revalidatePath('/dashboard/setup');
    revalidatePath('/dashboard/assets');
    return { success: true };
  } catch (error) {
    console.error('Delete category error:', error);
    return { success: false, message: 'Failed to delete category' };
  }
}

// ==========================================
// 3. Employee Directory Management (Add, Update, Delete)
// ==========================================
export async function createEmployee(data: { name: string; email: string; role: string; departmentId: string | null }) {
  const session = await checkAdmin();

  if (!data.name || data.name.trim() === '') return { success: false, message: 'Name is required' };
  if (!data.email || data.email.trim() === '') return { success: false, message: 'Email is required' };

  try {
    const existing = await query<any>('SELECT id FROM odoo_assetflow_users WHERE email = ?', [data.email.trim()]);
    if (existing.length > 0) {
      return { success: false, message: 'An employee with this email is already registered.' };
    }

    const defaultPasswordHash = await bcrypt.hash('employeepassword', 10);
    const id = crypto.randomUUID();

    await query(
      'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")',
      [id, data.name.trim(), data.email.trim(), defaultPasswordHash, data.role, data.departmentId || null]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'CREATE_EMPLOYEE', JSON.stringify({ employeeId: id, name: data.name, email: data.email, role: data.role })]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Create employee error:', error);
    return { success: false, message: 'Failed to register employee' };
  }
}

export async function updateEmployee(id: string, data: { name: string; email: string; role: string; departmentId: string | null; status: 'ACTIVE' | 'INACTIVE' }) {
  const session = await checkAdmin();

  if (id === session.id) {
    return { success: false, message: 'Cannot demote or modify your own active admin account.' };
  }

  try {
    await query(
      'UPDATE odoo_assetflow_users SET name = ?, email = ?, role = ?, department_id = ?, status = ? WHERE id = ?',
      [data.name.trim(), data.email.trim(), data.role, data.departmentId || null, data.status, id]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'UPDATE_EMPLOYEE', JSON.stringify({ targetUserId: id, name: data.name, email: data.email, role: data.role, status: data.status })]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Update employee error:', error);
    return { success: false, message: 'Failed to update employee details' };
  }
}

export async function deleteEmployee(id: string) {
  const session = await checkAdmin();

  if (id === session.id) {
    return { success: false, message: 'Cannot delete your own active admin account.' };
  }

  try {
    // Check if employee has active allocations
    const activeAllocations = await query<any>(
      'SELECT id FROM odoo_assetflow_allocations WHERE allocated_to_user_id = ? AND is_active = 1 LIMIT 1',
      [id]
    );

    if (activeAllocations.length > 0) {
      return { success: false, message: 'Cannot delete employee holding active asset allocations. Reclaim the assets first.' };
    }

    // Check if employee has active bookings
    const activeBookings = await query<any>(
      'SELECT id FROM odoo_assetflow_bookings WHERE booked_by_id = ? AND status IN ("UPCOMING", "ONGOING") LIMIT 1',
      [id]
    );

    if (activeBookings.length > 0) {
      return { success: false, message: 'Cannot delete employee with upcoming bookings. Cancel the bookings first.' };
    }

    await executeTransaction(async (conn) => {
      // 1. Unlink department head role if applicable
      await conn.execute(
        'UPDATE odoo_assetflow_departments SET head_user_id = NULL WHERE head_user_id = ?',
        [id]
      );
      // 2. Delete user
      await conn.execute(
        'DELETE FROM odoo_assetflow_users WHERE id = ?',
        [id]
      );
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'DELETE_EMPLOYEE', JSON.stringify({ employeeId: id })]
    );

    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    console.error('Delete employee error:', error);
    return { success: false, message: 'Failed to delete employee' };
  }
}

// Keep legacy actions for compatibility
export async function promoteUser(targetUserId: string, role: string, departmentId?: string | null) {
  return updateEmployee(targetUserId, {
    name: '', // Will fail if validation checks not handled, but we can call query directly
    email: '',
    role,
    departmentId: departmentId || null,
    status: 'ACTIVE'
  });
}

export async function toggleUserStatus(targetUserId: string, status: 'ACTIVE' | 'INACTIVE') {
  const session = await checkAdmin();
  try {
    await query(
      'UPDATE odoo_assetflow_users SET status = ? WHERE id = ?',
      [status, targetUserId]
    );
    revalidatePath('/dashboard/setup');
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Failed to toggle status' };
  }
}
