'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}

// 1. Create Audit Cycle
export async function createAuditCycle(data: {
  name: string;
  departmentScopeId: string | null;
  locationScope: string | null;
  startDate: string;
  endDate: string;
  auditorIds: string[];
}) {
  const session = await checkAdmin();

  try {
    const cycle = await executeTransaction(async (conn) => {
      // Create Audit Cycle
      const cycleId = crypto.randomUUID();
      await conn.execute(
        'INSERT INTO odoo_assetflow_audit_cycles (id, name, department_scope_id, location_scope, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, "IN_PROGRESS")',
        [
          cycleId,
          data.name.trim(),
          data.departmentScopeId || null,
          data.locationScope?.trim() || null,
          new Date(data.startDate),
          new Date(data.endDate),
        ]
      );

      // Link auditors
      for (const auditorId of data.auditorIds) {
        await conn.execute(
          'INSERT INTO odoo_assetflow_audit_auditors (audit_cycle_id, user_id) VALUES (?, ?)',
          [cycleId, auditorId]
        );
      }

      // Query scoped assets
      let assetsQuery = 'SELECT id, location FROM odoo_assetflow_assets WHERE status NOT IN ("RETIRED", "DISPOSED")';
      const params: any[] = [];

      if (data.locationScope) {
        assetsQuery += ' AND location LIKE ?';
        params.push(`%${data.locationScope}%`);
      }

      const [assets]: any[] = await conn.execute(assetsQuery, params);
      
      // Filter assets by department scope if specified (by locating active allocations)
      let scopedAssets = assets;
      if (data.departmentScopeId) {
        const [activeAllocations]: any[] = await conn.execute(
          'SELECT asset_id FROM odoo_assetflow_allocations WHERE allocated_to_dept_id = ? AND is_active = 1',
          [data.departmentScopeId]
        );
        const allocatedAssetIds = activeAllocations.map((a: any) => a.asset_id);
        scopedAssets = assets.filter((asset: any) => allocatedAssetIds.includes(asset.id));
      }

      // Create pending checklist items
      for (const asset of scopedAssets) {
        const itemId = crypto.randomUUID();
        await conn.execute(
          'INSERT INTO odoo_assetflow_audit_items (id, audit_cycle_id, asset_id, status) VALUES (?, ?, ?, "PENDING")',
          [itemId, cycleId, asset.id]
        );
      }

      return { id: cycleId };
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'CREATE_AUDIT_CYCLE', JSON.stringify({ cycleId: cycle.id, assetCount: data.auditorIds.length })]
    );

    // Send email to all assigned auditors
    if (data.auditorIds.length > 0) {
      try {
        const auditors = await query<any>(
          'SELECT name, email FROM odoo_assetflow_users WHERE id IN (?) AND status = "ACTIVE"',
          [data.auditorIds]
        );
        for (const auditor of auditors) {
          if (auditor.email) {
            await sendEmail({
              to: auditor.email,
              subject: `New Asset Audit Launched: ${data.name}`,
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h3 style="color: #0d9488;">New Audit Assignment</h3>
                  <p>Dear ${auditor.name},</p>
                  <p>A new physical asset verification cycle has been launched. You have been assigned as an auditor for this cycle:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Cycle Name:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${data.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Location Scope:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${data.locationScope || 'Company Wide'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Due Date:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${new Date(data.endDate).toLocaleDateString()}</td>
                    </tr>
                  </table>
                  <p style="font-size: 12px; color: #64748b;">
                    Please head over to the Audit Cycles dashboard to begin verifying the checklist of scoped assets.
                  </p>
                </div>
              `
            });
          }
        }
      } catch (err) {
        console.error('Failed to send auditor notification emails:', err);
      }
    }

    revalidatePath('/dashboard/audit');
    return { success: true, cycle };
  } catch (error) {
    console.error('Create audit cycle error:', error);
    return { success: false, message: 'Failed to create audit cycle' };
  }
}

// 2. Verify Audit Item
export async function verifyAuditItem(itemId: string, status: string, notes: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    const items = await query<any>(
      'SELECT id, audit_cycle_id FROM odoo_assetflow_audit_items WHERE id = ?',
      [itemId]
    );
    const item = items[0];

    if (!item) {
      return { success: false, message: 'Audit item not found' };
    }

    const cycles = await query<any>(
      'SELECT status FROM odoo_assetflow_audit_cycles WHERE id = ?',
      [item.audit_cycle_id]
    );
    const cycle = cycles[0];

    if (cycle?.status === 'CLOSED') {
      return { success: false, message: 'Cannot update locked audit items on a closed cycle' };
    }

    // Check if user is an assigned auditor, admin, or manager
    const auditors = await query<any>(
      'SELECT user_id FROM odoo_assetflow_audit_auditors WHERE audit_cycle_id = ?',
      [item.audit_cycle_id]
    );
    const isAssignedAuditor = auditors.some((a) => a.user_id === session.id);
    const isAuthorized = isAssignedAuditor || session.role === 'ADMIN' || session.role === 'ASSET_MANAGER';

    if (!isAuthorized) {
      return { success: false, message: 'Unauthorized to verify items in this cycle' };
    }

    await query(
      'UPDATE odoo_assetflow_audit_items SET status = ?, verified_by_id = ?, verification_notes = ?, verified_at = ? WHERE id = ?',
      [status, session.id, notes.trim() || null, new Date(), itemId]
    );

    revalidatePath('/dashboard/audit');
    return { success: true };
  } catch (error) {
    console.error('Verify audit item error:', error);
    return { success: false, message: 'Failed to verify item' };
  }
}

// 3. Close Audit Cycle (With Status Synchronization Triggers)
export async function closeAuditCycle(cycleId: string) {
  const session = await checkAdmin();

  try {
    await executeTransaction(async (conn) => {
      // 1. Lock cycle
      await conn.execute(
        'UPDATE odoo_assetflow_audit_cycles SET status = "CLOSED" WHERE id = ?',
        [cycleId]
      );

      // 2. Pull flagged items (Missing / Damaged)
      const [auditItems]: any[] = await conn.execute(
        'SELECT asset_id, status, verification_notes FROM odoo_assetflow_audit_items WHERE audit_cycle_id = ?',
        [cycleId]
      );

      for (const item of auditItems) {
        if (item.status === 'MISSING') {
          // Auto-update missing to LOST
          await conn.execute(
            'UPDATE odoo_assetflow_assets SET status = "LOST" WHERE id = ?',
            [item.asset_id]
          );
        } else if (item.status === 'DAMAGED') {
          // Auto-update to DAMAGED condition and create pending maintenance request
          await conn.execute(
            'UPDATE odoo_assetflow_assets SET current_condition = "DAMAGED" WHERE id = ?',
            [item.asset_id]
          );

          // Raise pending maintenance card
          const ticketId = crypto.randomUUID();
          await conn.execute(
            `INSERT INTO odoo_assetflow_maintenance_requests (id, asset_id, requested_by_id, priority, status, description) 
             VALUES (?, ?, ?, "HIGH", "PENDING", ?)`,
            [
              ticketId,
              item.asset_id,
              session.id,
              `Auto-generated from Audit: ${item.verification_notes || 'Damaged during verification'}.`,
            ]
          );
        }
      }
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'CLOSE_AUDIT_CYCLE', JSON.stringify({ cycleId })]
    );

    revalidatePath('/dashboard/audit');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Close audit cycle error:', error);
    return { success: false, message: 'Failed to close audit cycle' };
  }
}
