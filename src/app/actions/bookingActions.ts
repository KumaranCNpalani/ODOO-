'use server';

import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';
import { revalidatePath } from 'next/cache';

export async function bookResource(data: {
  assetId: string;
  startTime: string;
  endTime: string;
}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);

  if (start >= end) {
    return { success: false, message: 'Start time must be before end time' };
  }

  try {
    // 1. Verify resource exists and is shared bookable
    const assets = await query<any>(
      'SELECT shared_bookable, status FROM odoo_assetflow_assets WHERE id = ?',
      [data.assetId]
    );
    const asset = assets[0];

    if (!asset || !asset.shared_bookable) {
      return { success: false, message: 'This resource is not available for public booking' };
    }

    if (asset.status === 'UNDER_MAINTENANCE' || asset.status === 'RETIRED' || asset.status === 'DISPOSED') {
      return { success: false, message: `Cannot book resource that is currently ${asset.status.toLowerCase().replace('_', ' ')}` };
    }

    // 2. Validate overlaps: (StartA < EndB) AND (EndA > StartB)
    const overlappingBookings = await query<any>(
      `SELECT id FROM odoo_assetflow_bookings 
       WHERE asset_id = ?
         AND status IN ('UPCOMING', 'ONGOING')
         AND start_time < ? AND end_time > ?`,
      [data.assetId, end, start]
    );

    if (overlappingBookings.length > 0) {
      return {
        success: false,
        message: 'Conflict: Slot overlaps with an existing booking for this resource.',
      };
    }

    // 3. Create booking
    const bookingId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_bookings (id, asset_id, booked_by_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?)',
      [bookingId, data.assetId, session.id, start, end, 'UPCOMING']
    );

    // Write audit log
    const logId = crypto.randomUUID();
    await query(
      'INSERT INTO odoo_assetflow_audit_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [logId, session.id, 'BOOK_RESOURCE', JSON.stringify({ bookingId, assetId: data.assetId })]
    );

    // Send booking confirmation email to the user
    try {
      const assets = await query<any>('SELECT name, asset_tag FROM odoo_assetflow_assets WHERE id = ?', [data.assetId]);
      const asset = assets[0];
      const users = await query<any>('SELECT name, email FROM odoo_assetflow_users WHERE id = ?', [session.id]);
      const user = users[0];

      if (user && user.email && asset) {
        await sendEmail({
          to: user.email,
          subject: `Booking Confirmed: ${asset.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h3 style="color: #0d9488;">Resource Booking Confirmed</h3>
              <p>Dear ${user.name},</p>
              <p>Your booking request for the resource listed below has been confirmed:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Resource Name:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${asset.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Resource Tag:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #0d9488; font-size: 13px;">${asset.asset_tag}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Start Time:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${start.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">End Time:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${end.toLocaleString()}</td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #64748b;">
                If you need to change or cancel this booking, please do so from the Resource Booking panel.
              </p>
            </div>
          `
        });
      }
    } catch (err) {
      console.error('Failed to send booking confirmation email:', err);
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Book resource error:', error);
    return { success: false, message: 'Failed to complete booking' };
  }
}

export async function cancelBooking(bookingId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  try {
    const bookings = await query<any>(
      'SELECT booked_by_id FROM odoo_assetflow_bookings WHERE id = ?',
      [bookingId]
    );
    const booking = bookings[0];

    if (!booking) {
      return { success: false, message: 'Booking not found' };
    }

    // Only Admin, Asset Manager, or the user who made the booking can cancel
    if (
      session.role !== 'ADMIN' &&
      session.role !== 'ASSET_MANAGER' &&
      booking.booked_by_id !== session.id
    ) {
      return { success: false, message: 'Unauthorized to cancel this booking' };
    }

    await query(
      'UPDATE odoo_assetflow_bookings SET status = "CANCELLED" WHERE id = ?',
      [bookingId]
    );

    // Send booking cancellation email
    try {
      const details = await query<any>(
        `SELECT b.*, a.name as asset_name, a.asset_tag, u.name as user_name, u.email as user_email 
         FROM odoo_assetflow_bookings b 
         JOIN odoo_assetflow_assets a ON b.asset_id = a.id 
         JOIN odoo_assetflow_users u ON b.booked_by_id = u.id 
         WHERE b.id = ?`,
        [bookingId]
      );
      const bDetail = details[0];
      if (bDetail && bDetail.user_email) {
        await sendEmail({
          to: bDetail.user_email,
          subject: `Booking Cancelled: ${bDetail.asset_name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h3 style="color: #e11d48;">Resource Booking Cancelled</h3>
              <p>Dear ${bDetail.user_name},</p>
              <p>Your booking for the resource below has been cancelled:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Resource Name:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${bDetail.asset_name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Resource Tag:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #e11d48; font-size: 13px;">${bDetail.asset_tag}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">Booking Window:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${new Date(bDetail.start_time).toLocaleString()} - ${new Date(bDetail.end_time).toLocaleString()}</td>
                </tr>
              </table>
            </div>
          `
        });
      }
    } catch (err) {
      console.error('Failed to send booking cancellation email:', err);
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, message: 'Failed to cancel booking' };
  }
}
