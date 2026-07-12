'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';
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

    // Send email to allocated employee
    if (data.allocatedToUserId) {
      try {
        const users = await query<any>('SELECT name, email FROM odoo_assetflow_users WHERE id = ?', [data.allocatedToUserId]);
        const assets = await query<any>('SELECT name, asset_tag FROM odoo_assetflow_assets WHERE id = ?', [data.assetId]);
        const user = users[0];
        const asset = assets[0];
        if (user && user.email) {
          await sendEmail({
            to: user.email,
            subject: `Asset Custody Checkout: ${asset.name} (${asset.asset_tag})`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                <h3 style="color: #0d9488;">Asset Custody Allocated</h3>
                <p>Dear ${user.name},</p>
                <p>The following asset has been allocated and checked out to you:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${asset.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #0d9488; font-size: 13px;">${asset.asset_tag}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Expected Return:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${data.expectedReturnDate ? new Date(data.expectedReturnDate).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                </table>
                <p style="font-size: 12px; color: #64748b;">
                  Please ensure the asset is kept secure and returned in its original condition.
                </p>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('Failed to send allocation email:', err);
      }
    }

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

    // Send email to target user
    if (data.targetUserId) {
      try {
        const assets = await query<any>('SELECT name, asset_tag FROM odoo_assetflow_assets WHERE id = ?', [data.assetId]);
        const asset = assets[0];
        const targets = await query<any>('SELECT name, email FROM odoo_assetflow_users WHERE id = ?', [data.targetUserId]);
        const target = targets[0];
        if (target && target.email) {
          await sendEmail({
            to: target.email,
            subject: `Custody Transfer Requested: ${asset.name} (${asset.asset_tag})`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                <h3 style="color: #0d9488;">Custody Transfer Requested</h3>
                <p>Dear ${target.name},</p>
                <p>An asset transfer has been requested to change the custody holder to you.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${asset.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #0d9488; font-size: 13px;">${asset.asset_tag}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Remarks:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-style: italic;">"${data.remarks}"</td>
                  </tr>
                </table>
                <p style="font-size: 12px; color: #64748b;">
                  This request is currently pending approval by management. No action is required from you at this moment.
                </p>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('Failed to send submit transfer email:', err);
      }
    }

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

  // Fetch active holder info for email notification
  let holderEmail = '';
  let holderName = '';
  let assetName = '';
  let assetTag = '';
  try {
    const holders = await query<any>(
      `SELECT u.name, u.email, a.name as asset_name, a.asset_tag 
       FROM odoo_assetflow_allocations al 
       JOIN odoo_assetflow_users u ON al.allocated_to_user_id = u.id 
       JOIN odoo_assetflow_assets a ON al.asset_id = a.id 
       WHERE al.asset_id = ? AND al.is_active = 1 LIMIT 1`,
      [data.assetId]
    );
    if (holders[0]) {
      holderEmail = holders[0].email;
      holderName = holders[0].name;
      assetName = holders[0].asset_name;
      assetTag = holders[0].asset_tag;
    }
  } catch (err) {
    console.error('Failed to pre-fetch holder info for email:', err);
  }

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

    // Send check-in confirmation email
    if (holderEmail) {
      try {
        await sendEmail({
          to: holderEmail,
          subject: `Asset Custody Check-in: ${assetName} (${assetTag})`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h3 style="color: #0d9488;">Asset Custody Returned</h3>
              <p>Dear ${holderName},</p>
              <p>This email confirms that the following asset has been checked in and returned to the registry:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${assetName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #0d9488; font-size: 13px;">${assetTag}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Returned Condition:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${data.condition}</td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #64748b;">
                Thank you for checking in this resource.
              </p>
            </div>
          `
        });
      } catch (err) {
        console.error('Failed to send check-in confirmation email:', err);
      }
    }

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

    // Fetch request details for email notification
    try {
      const details = await query<any>(
        `SELECT r.*, a.name as asset_name, a.asset_tag, 
                u.name as requester_name, u.email as requester_email, 
                tu.name as target_name, tu.email as target_email 
         FROM odoo_assetflow_transfer_requests r 
         JOIN odoo_assetflow_assets a ON r.asset_id = a.id 
         JOIN odoo_assetflow_users u ON r.requesting_user_id = u.id 
         LEFT JOIN odoo_assetflow_users tu ON r.target_user_id = tu.id 
         WHERE r.id = ?`,
        [requestId]
      );
      const req = details[0];
      if (req) {
        // Send email to target user (new holder)
        if (req.target_email) {
          await sendEmail({
            to: req.target_email,
            subject: `Asset Custody Approved: ${req.asset_name} (${req.asset_tag})`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                <h3 style="color: #0d9488;">Custody Transfer Approved</h3>
                <p>Dear ${req.target_name},</p>
                <p>The custody of the following asset has been successfully transferred to you:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.asset_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #0d9488; font-size: 13px;">${req.asset_tag}</td>
                  </tr>
                </table>
              </div>
            `
          });
        }
        // Send email to requester (previous holder)
        if (req.requester_email) {
          await sendEmail({
            to: req.requester_email,
            subject: `Custody Transfer Completed: ${req.asset_name} (${req.asset_tag})`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                <h3 style="color: #0d9488;">Custody Transfer Completed</h3>
                <p>Dear ${req.requester_name},</p>
                <p>The transfer of custody for the following asset has been completed. The asset has been checked out to ${req.target_name || 'department'}.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.asset_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #0d9488; font-size: 13px;">${req.asset_tag}</td>
                  </tr>
                </table>
              </div>
            `
          });
        }
      }
    } catch (err) {
      console.error('Failed to send transfer approval emails:', err);
    }

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

    // Fetch request details for email notification
    try {
      const details = await query<any>(
        `SELECT r.*, a.name as asset_name, a.asset_tag, 
                u.name as requester_name, u.email as requester_email 
         FROM odoo_assetflow_transfer_requests r 
         JOIN odoo_assetflow_assets a ON r.asset_id = a.id 
         JOIN odoo_assetflow_users u ON r.requesting_user_id = u.id 
         WHERE r.id = ?`,
        [requestId]
      );
      const req = details[0];
      if (req && req.requester_email) {
        await sendEmail({
          to: req.requester_email,
          subject: `Custody Transfer Rejected: ${req.asset_name} (${req.asset_tag})`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h3 style="color: #e11d48;">Custody Transfer Rejected</h3>
              <p>Dear ${req.requester_name},</p>
              <p>Your transfer request for the following asset has been declined by management:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.asset_name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #e11d48; font-size: 13px;">${req.asset_tag}</td>
                </tr>
              </table>
            </div>
          `
        });
      }
    } catch (err) {
      console.error('Failed to send transfer rejection email:', err);
    }

    revalidatePath('/dashboard/allocations');
    return { success: true };
  } catch (error: any) {
    console.error('Reject transfer error:', error);
    return { success: false, message: error.message || 'Failed to reject transfer request' };
  }
}
