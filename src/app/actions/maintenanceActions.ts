'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createMaintenanceRequest(data: {
  assetId: string;
  priority: string;
  description: string;
  photoUrl: string | null;
}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_maintenance_requests (id, asset_id, requested_by_id, priority, status, description, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.assetId, session.id, data.priority, 'PENDING', data.description.trim(), data.photoUrl || null]
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'CREATE_MAINTENANCE_REQUEST', JSON.stringify({ requestId: id, assetId: data.assetId })]
    );

    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Create maintenance request error:', error);
    return { success: false, message: 'Failed to submit maintenance request' };
  }
}

// Kanban Drag-and-Drop Handler Action
export async function updateMaintenanceStatus(
  requestId: string,
  newStatus: string,
  extraData?: {
    technicianId?: string | null;
    resolutionNotes?: string;
  }
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  // Must be Admin or Asset Manager to change statuses
  if (session.role !== 'ADMIN' && session.role !== 'ASSET_MANAGER') {
    return { success: false, message: 'Unauthorized: Managers only' };
  }

  try {
    await executeTransaction(async (conn) => {
      const [requests]: any[] = await conn.execute(
        'SELECT asset_id FROM odoo_assetflow_maintenance_requests WHERE id = ?',
        [requestId]
      );
      const request = requests[0];

      if (!request) {
        throw new Error('Maintenance request not found');
      }

      // 1. Update the request status
      if (extraData?.technicianId !== undefined) {
        await conn.execute(
          'UPDATE odoo_assetflow_maintenance_requests SET status = ?, technician_id = ? WHERE id = ?',
          [newStatus, extraData.technicianId || null, requestId]
        );
      } else if (extraData?.resolutionNotes !== undefined) {
        await conn.execute(
          'UPDATE odoo_assetflow_maintenance_requests SET status = ?, resolution_notes = ? WHERE id = ?',
          [newStatus, extraData.resolutionNotes.trim(), requestId]
        );
      } else {
        await conn.execute(
          'UPDATE odoo_assetflow_maintenance_requests SET status = ?, approved_by_id = ? WHERE id = ?',
          [newStatus, newStatus === 'APPROVED' ? session.id : null, requestId]
        );
      }

      // 2. State transition side effects:
      if (newStatus === 'APPROVED' || newStatus === 'TECHNICIAN_ASSIGNED' || newStatus === 'IN_PROGRESS') {
        // Flipping asset to UNDER_MAINTENANCE on approval
        await conn.execute(
          'UPDATE odoo_assetflow_assets SET status = "UNDER_MAINTENANCE" WHERE id = ?',
          [request.asset_id]
        );
      } else if (newStatus === 'RESOLVED') {
        // Restoring to AVAILABLE on completion
        await conn.execute(
          'UPDATE odoo_assetflow_assets SET status = "AVAILABLE" WHERE id = ?',
          [request.asset_id]
        );
      } else if (newStatus === 'REJECTED') {
        // Reverting back to AVAILABLE if rejected (or kept as previous status)
        const [assets]: any[] = await conn.execute(
          'SELECT status FROM odoo_assetflow_assets WHERE id = ?',
          [request.asset_id]
        );
        const currentAsset = assets[0];
        if (currentAsset?.status === 'UNDER_MAINTENANCE') {
          await conn.execute(
            'UPDATE odoo_assetflow_assets SET status = "AVAILABLE" WHERE id = ?',
            [request.asset_id]
          );
        }
      }
    });

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'UPDATE_MAINTENANCE_STATUS', JSON.stringify({ requestId, newStatus })]
    );

    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Update maintenance error:', error);
    return { success: false, message: error.message || 'Failed to update maintenance request' };
  }
}
