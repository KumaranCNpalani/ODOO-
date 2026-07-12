import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BookingsConsole from './bookingsConsole';

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Query all resources (shared bookable assets)
  const rawResources = await query<any>(
    `SELECT id, name, location FROM odoo_assetflow_assets 
     WHERE shared_bookable = 1 AND status NOT IN ('RETIRED', 'DISPOSED') 
     ORDER BY name ASC`
  );

  // Query all bookings
  const rawBookings = await query<any>(
    `SELECT b.*, u.name as user_name, u.role as user_role 
     FROM odoo_assetflow_bookings b 
     LEFT JOIN odoo_assetflow_users u ON b.booked_by_id = u.id 
     ORDER BY b.start_time ASC`
  );

  const bookings = rawBookings.map((b: any) => ({
    id: b.id,
    assetId: b.asset_id,
    bookedById: b.booked_by_id,
    startTime: b.start_time,
    endTime: b.end_time,
    status: b.status,
    bookedBy: { name: b.user_name, role: b.user_role },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Resource Booking</h2>
        <p className="text-sm text-muted-foreground">Reserve conference rooms, company vehicles, and shared hardware</p>
      </div>

      <BookingsConsole 
        resources={rawResources} 
        bookings={bookings} 
        currentUserId={session.id} 
      />
    </div>
  );
}
