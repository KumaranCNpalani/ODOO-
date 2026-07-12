'use client';

import { useState, useTransition, useEffect } from 'react';
import { bookResource, cancelBooking } from '@/app/actions/bookingActions';
import { Clock, X, AlertTriangle, CalendarRange } from 'lucide-react';
import { downloadCSV } from '@/lib/csvUtils';

interface BookingsConsoleProps {
  resources: any[];
  bookings: any[];
  currentUserId: string;
}

export default function BookingsConsole({ resources, bookings, currentUserId }: BookingsConsoleProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedAssetId, setSelectedAssetId] = useState(resources[0]?.id || '');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExportBookingsCSV = () => {
    const headers = ['Booking ID', 'Resource Name', 'Booked By', 'Role', 'Start Time', 'End Time', 'Status'];
    const rows = bookings.map(b => [
      b.id,
      b.asset?.name || 'Unknown',
      b.bookedBy?.name || 'Unknown',
      b.bookedBy?.role || '',
      b.startTime ? new Date(b.startTime).toLocaleString() : '',
      b.endTime ? new Date(b.endTime).toLocaleString() : '',
      b.status
    ]);
    downloadCSV('bookings_export.csv', headers, rows);
  };

  // Mounted state to handle locale date hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // New Booking States
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const selectedResourceBookings = bookings.filter(
    (b) => b.assetId === selectedAssetId && 
           new Date(b.startTime).toISOString().split('T')[0] === bookingDate &&
           b.status !== 'CANCELLED'
  );

  const handleCancelBooking = (bookingId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Booking cancelled successfully' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to cancel booking' });
      }
    });
  };

  // Check overlap helper for inline UI feedback BEFORE submitting
  const checkOverlap = () => {
    if (!selectedAssetId) return false;
    const startStr = `${bookingDate}T${startTime}:00`;
    const endStr = `${bookingDate}T${endTime}:00`;
    const proposedStart = new Date(startStr);
    const proposedEnd = new Date(endStr);

    if (proposedStart >= proposedEnd) return false;

    return selectedResourceBookings.some((b) => {
      const existStart = new Date(b.startTime);
      const existEnd = new Date(b.endTime);
      return proposedStart < existEnd && proposedEnd > existStart;
    });
  };

  const hasConflict = checkOverlap();

  const handleBookSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;
    setMessage(null);

    const startStr = `${bookingDate}T${startTime}:00`;
    const endStr = `${bookingDate}T${endTime}:00`;

    startTransition(async () => {
      const result = await bookResource({
        assetId: selectedAssetId,
        startTime: startStr,
        endTime: endStr,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Time slot booked successfully!' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to book slot' });
      }
    });
  };

  const getTimelineSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 18; hour++) {
      const timeStr = `${String(hour).padStart(2, '0')}:00`;
      slots.push(timeStr);
    }
    return slots;
  };

  const renderBookingDate = () => {
    if (!mounted) return '';
    return new Date(bookingDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Booking Form and overlap validator widget */}
      <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-5">
        <h3 className="font-bold text-foreground text-base">Book a Time Slot</h3>
        
        <form onSubmit={handleBookSlot} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">Resource *</label>
            <select
              required
              value={selectedAssetId}
              onChange={(e) => { setSelectedAssetId(e.target.value); setMessage(null); }}
              className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
            >
              <option value="">Select Resource...</option>
              {resources.map((res) => (
                <option key={res.id} value={res.id}>{res.name} ({res.location})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">Booking Date *</label>
            <input
              type="date"
              required
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Start Time *</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
              >
                {getTimelineSlots().slice(0, -1).map((s) => (
                  <option key={s} value={s.substring(0, 5)}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">End Time *</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
              >
                {getTimelineSlots().slice(1).map((s) => (
                  <option key={s} value={s.substring(0, 5)}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Pre-submit Overlap warning card */}
          {hasConflict && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2.5 animate-pulse-slow">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Conflict: Requested time slot is unavailable.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || hasConflict || !selectedAssetId}
            className="w-full py-3 mt-2 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm shadow-lg shadow-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? 'Reserving...' : 'Confirm Reservation'}
          </button>
        </form>

        {message && (
          <div className={`p-3 rounded-lg border text-xs font-semibold text-center ${
            message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Middle & Right Column: Interactive Schedule & list */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {/* Scheduler Grid Sheet */}
        <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-foreground text-base">Timeline Schedule</h3>
              {bookings.length > 0 && (
                <button
                  onClick={handleExportBookingsCSV}
                  className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 border border-border text-foreground text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                >
                  Export CSV
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-primary" />
              {renderBookingDate()}
            </span>
          </div>

          <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
            {selectedResourceBookings.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <Clock className="w-8 h-8 opacity-30" />
                No active bookings scheduled for this date.
              </div>
            ) : (
              selectedResourceBookings.map((b) => {
                const isOwn = b.bookedById === currentUserId;
                const startHour = mounted ? new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const endHour = mounted ? new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                
                return (
                  <div 
                    key={b.id} 
                    className="p-4 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-between transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-10 rounded bg-primary"></div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Reserved Slot</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          {startHour} - {endHour}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs">
                        <p className="text-foreground font-bold">{b.bookedBy.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">{b.bookedBy.role}</p>
                      </div>

                      {isOwn && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="p-1.5 rounded hover:bg-destructive/15 text-destructive transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Overlap dynamic display marker */}
            {hasConflict && (
              <div className="p-4 rounded-lg border border-dashed border-rose-500/40 bg-rose-500/5 text-rose-500 text-xs font-semibold flex justify-between items-center animate-pulse-slow">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Requested Slot ({startTime} - {endTime}) is blocked due to conflict.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
