'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function checkAssetManager() {
  const session = await getSession();
  if (!session || (session.role !== 'ASSET_MANAGER' && session.role !== 'ADMIN')) {
    throw new Error('Unauthorized: Asset Manager access required');
  }
  return session;
}

// 1. Register Asset
export async function registerAsset(data: {
  name: string;
  categoryId: string;
  serialNumber: string | null;
  acquisitionDate: string;
  acquisitionCost: number | null;
  condition: string;
  location: string;
  sharedBookable: boolean;
  customFieldValues: Record<string, any>;
  photoUrl: string | null;
}) {
  const session = await checkAssetManager();

  try {
    // Generate sequential tag: AF-0001, AF-0002...
    const lastAssets = await query<any>(
      'SELECT asset_tag FROM odoo_assetflow_assets ORDER BY asset_tag DESC LIMIT 1'
    );
    const lastAsset = lastAssets[0];

    let nextNum = 1;
    if (lastAsset && lastAsset.asset_tag) {
      const numMatch = lastAsset.asset_tag.match(/AF-(\d+)/);
      if (numMatch) {
        nextNum = parseInt(numMatch[1], 10) + 1;
      }
    }
    const assetTag = `AF-${String(nextNum).padStart(4, '0')}`;
    const id = crypto.randomUUID();

    await query(
      'INSERT INTO odoo_assetflow_assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, current_condition, location, status, shared_bookable, custom_field_values, photo_url, document_urls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        assetTag,
        data.name.trim(),
        data.categoryId,
        data.serialNumber?.trim() || null,
        new Date(data.acquisitionDate),
        data.acquisitionCost,
        data.condition,
        data.location.trim(),
        'AVAILABLE',
        data.sharedBookable ? 1 : 0,
        JSON.stringify(data.customFieldValues),
        data.photoUrl || null,
        JSON.stringify([]),
      ]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'REGISTER_ASSET', JSON.stringify({ assetId: id, assetTag })]
    );

    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Register asset error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, message: 'Serial number already exists' };
    }
    return { success: false, message: 'Failed to register asset' };
  }
}

// 2. Allocate Asset (With Safe Double-Allocation Prevention Transaction)
export async function allocateAsset(data: {
  assetId: string;
  allocatedToUserId: string | null;
  allocatedToDeptId: string | null;
  expectedReturnDate: string | null;
}) {
  const session = await checkAssetManager();

  try {
    const result = await executeTransaction(async (conn) => {
      // Find and lock asset row
      const [assets]: any[] = await conn.execute(
        'SELECT status, name, asset_tag FROM odoo_assetflow_assets WHERE id = ? FOR UPDATE',
        [data.assetId]
      );
      const asset = assets[0];

      if (!asset) {
        throw new Error('Asset not found');
      }

      if (asset.status !== 'AVAILABLE') {
        // Find current holder
        const [activeAllocs]: any[] = await conn.execute(
          `SELECT u.name as user_name, d.name as dept_name 
           FROM odoo_assetflow_allocations a
           LEFT JOIN odoo_assetflow_users u ON a.allocated_to_user_id = u.id
           LEFT JOIN odoo_assetflow_departments d ON a.allocated_to_dept_id = d.id
           WHERE a.asset_id = ? AND a.is_active = 1 LIMIT 1`,
          [data.assetId]
        );
        const activeAllocation = activeAllocs[0];

        const holderName = activeAllocation?.user_name || 
                           activeAllocation?.dept_name || 
                           'another department';
        throw new Error(`DOUBLE_ALLOCATION_CONFLICT:${holderName}`);
      }

      // Update asset status
      await conn.execute(
        'UPDATE odoo_assetflow_assets SET status = "ALLOCATED" WHERE id = ?',
        [data.assetId]
      );

      // Create allocation record
      const allocationId = crypto.randomUUID();
      await conn.execute(
        'INSERT INTO odoo_assetflow_allocations (id, asset_id, allocated_to_user_id, allocated_to_dept_id, allocated_by_id, expected_return_date, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [
          allocationId,
          data.assetId,
          data.allocatedToUserId || null,
          data.allocatedToDeptId || null,
          session.id,
          data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        ]
      );

      return { id: allocationId };
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'ALLOCATE_ASSET', JSON.stringify({ assetId: data.assetId, allocationId: result.id })]
    );

    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/allocations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Allocate asset error:', error);
    if (error.message?.startsWith('DOUBLE_ALLOCATION_CONFLICT:')) {
      const holder = error.message.split(':')[1];
      return { success: false, conflict: true, holder };
    }
    return { success: false, message: error.message || 'Failed to allocate asset' };
  }
}

// 3. Submit Transfer Request
export async function submitTransferRequest(data: {
  assetId: string;
  targetUserId: string | null;
  targetDeptId: string | null;
  remarks: string;
}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_transfer_requests (id, asset_id, requesting_user_id, target_user_id, target_dept_id, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.assetId,
        session.id,
        data.targetUserId || null,
        data.targetDeptId || null,
        'REQUESTED',
        data.remarks.trim(),
      ]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'SUBMIT_TRANSFER_REQUEST', JSON.stringify({ requestId: id, assetId: data.assetId })]
    );

    revalidatePath('/dashboard/allocations');
    return { success: true };
  } catch (error) {
    console.error('Submit transfer request error:', error);
    return { success: false, message: 'Failed to submit transfer request' };
  }
}

// 4. Return Asset
export async function returnAsset(data: {
  assetId: string;
  condition: string;
  notes: string;
}) {
  const session = await checkAssetManager();

  try {
    await executeTransaction(async (conn) => {
      // Find active allocation
      const [allocs]: any[] = await conn.execute(
        'SELECT id FROM odoo_assetflow_allocations WHERE asset_id = ? AND is_active = 1 LIMIT 1',
        [data.assetId]
      );
      const activeAllocation = allocs[0];

      if (activeAllocation) {
        await conn.execute(
          'UPDATE odoo_assetflow_allocations SET is_active = 0, actual_return_date = ?, condition_on_return = ?, return_notes = ? WHERE id = ?',
          [new Date(), data.condition, data.notes.trim(), activeAllocation.id]
        );
      }

      // Update asset state
      await conn.execute(
        'UPDATE odoo_assetflow_assets SET status = "AVAILABLE", current_condition = ? WHERE id = ?',
        [data.condition, data.assetId]
      );
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'RETURN_ASSET', JSON.stringify({ assetId: data.assetId, condition: data.condition })]
    );

    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/allocations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Return asset error:', error);
    return { success: false, message: 'Failed to process asset return' };
  }
}

// 5. Approve Transfer Request
export async function approveTransferRequest(requestId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    const result = await executeTransaction(async (conn) => {
      // 1. Fetch the request details
      const [requests]: any[] = await conn.execute(
        'SELECT * FROM odoo_assetflow_transfer_requests WHERE id = ? FOR UPDATE',
        [requestId]
      );
      const request = requests[0];
      if (!request) throw new Error('Transfer request not found');
      if (request.status !== 'REQUESTED') throw new Error('Request already processed');

      // Check permission: Admin, Asset Manager, or Department Head
      if (session.role !== 'ADMIN' && session.role !== 'ASSET_MANAGER') {
        if (session.role === 'DEPARTMENT_HEAD') {
          // Fetch Department Head's department_id from DB
          const [deptHeads]: any[] = await conn.execute(
            'SELECT department_id FROM odoo_assetflow_users WHERE id = ?',
            [session.id]
          );
          const deptHead = deptHeads[0];

          // Verify requesting user matches Dept Head's department
          const [requesters]: any[] = await conn.execute(
            'SELECT department_id FROM odoo_assetflow_users WHERE id = ?',
            [request.requesting_user_id]
          );
          const requester = requesters[0];
          
          if (!deptHead || !requester || requester.department_id !== deptHead.department_id) {
            throw new Error('Unauthorized: Department Head can only approve internal requests');
          }
        } else {
          throw new Error('Unauthorized: Insufficient permissions');
        }
      }

      // 2. Mark older allocations for this asset as inactive
      await conn.execute(
        'UPDATE odoo_assetflow_allocations SET is_active = 0, actual_return_date = ? WHERE asset_id = ? AND is_active = 1',
        [new Date(), request.asset_id]
      );

      // 3. Create the new allocation
      const allocationId = crypto.randomUUID();
      await conn.execute(
        'INSERT INTO odoo_assetflow_allocations (id, asset_id, allocated_to_user_id, allocated_to_dept_id, allocated_by_id, expected_return_date, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [
          allocationId,
          request.asset_id,
          request.target_user_id || null,
          request.target_dept_id || null,
          session.id,
          null
        ]
      );

      // 4. Update the asset status (ensure it is ALLOCATED)
      await conn.execute(
        'UPDATE odoo_assetflow_assets SET status = "ALLOCATED" WHERE id = ?',
        [request.asset_id]
      );

      // 5. Update transfer request status
      await conn.execute(
        'UPDATE odoo_assetflow_transfer_requests SET status = "APPROVED", approved_by_id = ? WHERE id = ?',
        [session.id, requestId]
      );

      return { assetId: request.asset_id };
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'APPROVE_TRANSFER', JSON.stringify({ requestId, assetId: result.assetId })]
    );

    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/allocations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Approve transfer error:', error);
    return { success: false, message: error.message || 'Failed to approve transfer request' };
  }
}

// 6. Reject Transfer Request
export async function rejectTransferRequest(requestId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    // Check permission: Admin, Asset Manager, or Department Head
    const [requests]: any[] = await query<any>(
      'SELECT * FROM odoo_assetflow_transfer_requests WHERE id = ?',
      [requestId]
    );
    const request = requests[0];
    if (!request) throw new Error('Transfer request not found');
    if (request.status !== 'REQUESTED') throw new Error('Request already processed');

    if (session.role !== 'ADMIN' && session.role !== 'ASSET_MANAGER') {
      if (session.role === 'DEPARTMENT_HEAD') {
        const [deptHeads]: any[] = await query<any>(
          'SELECT department_id FROM odoo_assetflow_users WHERE id = ?',
          [session.id]
        );
        const deptHead = deptHeads[0];

        const [requesters]: any[] = await query<any>(
          'SELECT department_id FROM odoo_assetflow_users WHERE id = ?',
          [request.requesting_user_id]
        );
        const requester = requesters[0];

        if (!deptHead || !requester || requester.department_id !== deptHead.department_id) {
          throw new Error('Unauthorized: Department Head can only reject internal requests');
        }
      } else {
        throw new Error('Unauthorized: Insufficient permissions');
      }
    }

    await query(
      'UPDATE odoo_assetflow_transfer_requests SET status = "REJECTED" WHERE id = ?',
      [requestId]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'REJECT_TRANSFER', JSON.stringify({ requestId })]
    );

    revalidatePath('/dashboard/allocations');
    return { success: true };
  } catch (error: any) {
    console.error('Reject transfer error:', error);
    return { success: false, message: error.message || 'Failed to reject transfer request' };
  }
}
