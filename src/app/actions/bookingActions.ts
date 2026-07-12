'use server';

import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
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

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, message: 'Failed to cancel booking' };
  }
}
