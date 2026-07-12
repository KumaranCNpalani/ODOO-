'use client';

import { useState } from 'react';
import { Bell, ShieldAlert, Award, FileSpreadsheet, KeyRound, Wrench } from 'lucide-react';

interface NotificationsConsoleProps {
  logs: any[];
}

export default function NotificationsConsole({ logs }: NotificationsConsoleProps) {
  const [filter, setFilter] = useState<'ALL' | 'ALERTS' | 'APPROVALS' | 'BOOKINGS'>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    
    if (filter === 'ALERTS') {
      return log.action === 'RETURN_ASSET' && log.details?.condition === 'DAMAGED' ||
             log.action === 'CLOSE_AUDIT_CYCLE' ||
             log.action === 'CREATE_MAINTENANCE_REQUEST';
    }

    if (filter === 'APPROVALS') {
      return log.action === 'PROMOTE_USER' || 
             log.action === 'SUBMIT_TRANSFER_REQUEST' ||
             log.action === 'ALLOCATE_ASSET';
    }

    if (filter === 'BOOKINGS') {
      return log.action === 'BOOK_RESOURCE';
    }

    return true;
  });

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'REGISTER_ASSET': return <Award className="w-5 h-5 text-primary" />;
      case 'ALLOCATE_ASSET': return <KeyRound className="w-5 h-5 text-blue-500" />;
      case 'RETURN_ASSET': return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case 'BOOK_RESOURCE': return <Bell className="w-5 h-5 text-purple-500" />;
      case 'CREATE_MAINTENANCE_REQUEST': return <Wrench className="w-5 h-5 text-amber-500" />;
      default: return <ShieldAlert className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getActionHeading = (action: string) => {
    return action.replace(/_/g, ' ');
  };

  const getActionDescription = (log: any) => {
    const name = log.user?.name || 'System';
    const d = log.details as Record<string, any> || {};
    
    switch (log.action) {
      case 'REGISTER_ASSET':
        return `New asset registered by ${name}. Tag assigned: ${d.assetTag || 'N/A'}`;
      case 'ALLOCATE_ASSET':
        return `Asset allocated by ${name} to user ID ${d.targetUserId?.substring(0, 8) || 'N/A'}`;
      case 'SUBMIT_TRANSFER_REQUEST':
        return `Transfer request raised by ${name} for asset ID ${d.assetId?.substring(0, 8) || 'N/A'}`;
      case 'RETURN_ASSET':
        return `Asset check-in processed by ${name}. Condition returned: ${d.condition || 'N/A'}`;
      case 'BOOK_RESOURCE':
        return `Shared resource booking reserved by ${name}`;
      case 'CREATE_MAINTENANCE_REQUEST':
        return `Equipment repair ticket filed by ${name}`;
      case 'UPDATE_MAINTENANCE_STATUS':
        return `Maintenance ticket updated by ${name} to status ${d.newStatus || 'N/A'}`;
      case 'CREATE_AUDIT_CYCLE':
        return `Corporate stock audit launched by ${name}`;
      case 'CLOSE_AUDIT_CYCLE':
        return `Verification audit closed and reports compiled by ${name}`;
      case 'PROMOTE_USER':
        return `Privileges modified by ${name}. Target user role updated to ${d.newRole || 'N/A'}`;
      default:
        return `Action ${log.action} performed by ${name}`;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Buttons Row */}
      <div className="flex gap-2.5 border-b border-border pb-3">
        {(['ALL', 'ALERTS', 'APPROVALS', 'BOOKINGS'] as const).map((btn) => (
          <button
            key={btn}
            onClick={() => setFilter(btn)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              filter === btn
                ? 'bg-primary text-white shadow-md shadow-primary/10'
                : 'bg-secondary hover:bg-muted text-muted-foreground hover:text-white'
            }`}
          >
            {btn}
          </button>
        ))}
      </div>

      {/* Activity Timeline List */}
      <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
        <h3 className="font-bold text-white text-base">Timeline Logs</h3>

        <div className="flex flex-col gap-4 relative pl-4 border-l border-border/60">
          {filteredLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 pl-2">No activity events logged in this category</p>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="relative flex flex-col gap-1 text-xs">
                {/* Timeline Bullet Bullet */}
                <div className="absolute -left-[29px] top-1 w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center">
                  {getLogIcon(log.action)}
                </div>

                <div className="pl-5 py-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white uppercase text-[10px] tracking-wider text-primary">
                      {getActionHeading(log.action)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {new Date(log.createdAt).toLocaleString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed font-semibold">
                    {getActionDescription(log)}
                  </p>
                  
                  {log.ipAddress && (
                    <span className="text-[9px] text-muted-foreground/60 font-mono mt-1 block">
                      IP: {log.ipAddress}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
