'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';
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

    // Fetch maintenance and user details for email notifications
    try {
      const details = await query<any>(
        `SELECT r.*, a.name as asset_name, a.asset_tag, 
                u.name as requester_name, u.email as requester_email,
                t.name as tech_name, t.email as tech_email
         FROM odoo_assetflow_maintenance_requests r
         JOIN odoo_assetflow_assets a ON r.asset_id = a.id
         JOIN odoo_assetflow_users u ON r.requested_by_id = u.id
         LEFT JOIN odoo_assetflow_users t ON r.technician_id = t.id
         WHERE r.id = ?`,
        [requestId]
      );
      const req = details[0];

      if (req) {
        if (newStatus === 'TECHNICIAN_ASSIGNED') {
          // Notify technician
          if (req.tech_email) {
            await sendEmail({
              to: req.tech_email,
              subject: `New Maintenance Ticket Assigned: ${req.asset_name}`,
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h3 style="color: #0d9488;">New Maintenance Assignment</h3>
                  <p>Dear ${req.tech_name},</p>
                  <p>You have been assigned to repair the following asset:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.asset_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Tag:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.asset_tag}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Priority:</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #e11d48; font-size: 13px;">${req.priority}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Description:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.description}</td>
                    </tr>
                  </table>
                </div>
              `
            });
          }
          // Notify requester
          if (req.requester_email) {
            await sendEmail({
              to: req.requester_email,
              subject: `Technician Assigned: ${req.asset_name}`,
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h3 style="color: #0d9488;">Technician Assigned</h3>
                  <p>Dear ${req.requester_name},</p>
                  <p>A technician has been assigned to look into your maintenance request for <strong>${req.asset_name}</strong>.</p>
                  <p><strong>Assigned Technician:</strong> ${req.tech_name || 'Support Staff'}</p>
                </div>
              `
            });
          }
        } else if (newStatus === 'RESOLVED') {
          // Notify requester
          if (req.requester_email) {
            await sendEmail({
              to: req.requester_email,
              subject: `Maintenance Request Resolved: ${req.asset_name}`,
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h3 style="color: #0d9488;">Maintenance Request Resolved</h3>
                  <p>Dear ${req.requester_name},</p>
                  <p>Your maintenance request for the following asset has been resolved successfully:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Asset Name:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${req.asset_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Resolution Notes:</td>
                      <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-style: italic;">"${req.resolution_notes || 'Resolved and verified'}"</td>
                    </tr>
                  </table>
                  <p>The asset status is now set to <strong>Available</strong>.</p>
                </div>
              `
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to send maintenance status emails:', err);
    }

    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Update maintenance error:', error);
    return { success: false, message: error.message || 'Failed to update maintenance request' };
  }
}
