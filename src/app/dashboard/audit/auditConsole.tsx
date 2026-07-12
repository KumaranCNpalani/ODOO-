'use client';

import { useState, useTransition } from 'react';
import { createAuditCycle, verifyAuditItem, closeAuditCycle } from '@/app/actions/auditActions';
import { ClipboardCheck, ShieldAlert, MapPin, User, Calendar, Check, X, Shield, Plus } from 'lucide-react';
import { AuditItemStatus } from '@prisma/client';

interface AuditConsoleProps {
  activeCycle: any | null;
  departments: any[];
  users: any[];
  currentUser: { id: string; role: string };
}

export default function AuditConsole({ activeCycle, departments, users, currentUser }: AuditConsoleProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Launch Cycle Form States
  const [cycleName, setCycleName] = useState('');
  const [departmentScopeId, setDepartmentScopeId] = useState('');
  const [locationScope, setLocationScope] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);

  const handleToggleAuditor = (userId: string) => {
    if (selectedAuditors.includes(userId)) {
      setSelectedAuditors(selectedAuditors.filter((id) => id !== userId));
    } else {
      setSelectedAuditors([...selectedAuditors, userId]);
    }
  };

  const handleLaunchCycle = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (selectedAuditors.length === 0) {
      setMessage({ type: 'error', text: 'You must assign at least one auditor' });
      return;
    }

    startTransition(async () => {
      const result = await createAuditCycle({
        name: cycleName,
        departmentScopeId: departmentScopeId || null,
        locationScope: locationScope || null,
        startDate,
        endDate,
        auditorIds: selectedAuditors,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Audit cycle launched successfully!' });
        setCycleName('');
        setDepartmentScopeId('');
        setLocationScope('');
        setStartDate('');
        setEndDate('');
        setSelectedAuditors([]);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to launch audit cycle' });
      }
    });
  };

  const handleVerifyItem = (itemId: string, status: AuditItemStatus) => {
    setMessage(null);
    startTransition(async () => {
      const result = await verifyAuditItem(itemId, status, '');
      if (!result.success) {
        setMessage({ type: 'error', text: result.message || 'Failed to update item status' });
      }
    });
  };

  const handleCloseCycle = () => {
    if (!activeCycle) return;
    setMessage(null);
    startTransition(async () => {
      const result = await closeAuditCycle(activeCycle.id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Audit cycle closed and discrepancy reports compiled!' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to finalize audit cycle' });
      }
    });
  };

  const isAdmin = currentUser.role === 'ADMIN';

  // Count flagged discrepancies
  const flaggedCount = activeCycle 
    ? activeCycle.items.filter((item: any) => item.status === 'MISSING' || item.status === 'DAMAGED').length 
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div className={`p-3 rounded-lg border text-xs font-semibold text-center ${
          message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {message.text}
        </div>
      )}

      {/* NO ACTIVE CYCLE: Launch new Audit Cycle */}
      {!activeCycle ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-5">
            <h3 className="font-bold text-white text-base">Launch Asset Verification Cycle</h3>
            
            {isAdmin ? (
              <form onSubmit={handleLaunchCycle} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Cycle Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q2 HQ Engineering Audit"
                    value={cycleName}
                    onChange={(e) => setCycleName(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Department Scope</label>
                    <select
                      value={departmentScopeId}
                      onChange={(e) => setDepartmentScopeId(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Location Filter</label>
                    <input
                      type="text"
                      placeholder="e.g. Bengaluru Office"
                      value={locationScope}
                      onChange={(e) => setLocationScope(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">End Date *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Auditors checklist selection */}
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Assign Auditor Teams *</span>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {users.map((user) => (
                      <label 
                        key={user.id} 
                        className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border/60 hover:bg-secondary cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAuditors.includes(user.id)}
                          onChange={() => handleToggleAuditor(user.id)}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <span className="text-white truncate font-semibold">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 mt-4 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm transition-all"
                >
                  {isPending ? 'Launching...' : 'Initialize Verification Cycle'}
                </button>
              </form>
            ) : (
              <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
                <ClipboardCheck className="w-10 h-10 opacity-30" />
                No active audit cycle running. Only Administrator can launch new audit cycles.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ACTIVE CYCLE Checklist Directory */
        <div className="flex flex-col gap-6">
          {/* Active Cycle Panel summary */}
          <div className="p-6 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ClipboardCheck className="w-6 h-6 animate-pulse-slow" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">{activeCycle.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Due: {new Date(activeCycle.endDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Scope: {activeCycle.locationScope || 'Company Wide'}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={handleCloseCycle}
                disabled={isPending}
                className="px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-border text-white font-semibold text-xs transition-all"
              >
                {isPending ? 'Finalizing...' : 'Close & Finalize Audit Cycle'}
              </button>
            )}
          </div>

          {/* Discrepancy warning banner */}
          {flaggedCount > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs font-semibold flex items-center gap-3 animate-pulse-slow">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <p>
                <strong>{flaggedCount} discrepancies flagged</strong> during this cycle. Final closing will automatically update asset states (Missing $\rightarrow$ LOST, Damaged $\rightarrow$ raise Repair card).
              </p>
            </div>
          )}

          {/* Verification Checklist Table */}
          <div className="p-6 rounded-xl border border-border bg-card">
            <h4 className="font-bold text-white text-base mb-4">Asset Verification Checklist</h4>
            <div className="overflow-x-auto border border-border/50 rounded-lg">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-white border-b border-border/50">
                  <tr>
                    <th className="p-4">Asset Tag</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Expected Location</th>
                    <th className="p-4">Checked By</th>
                    <th className="p-4 text-center">Verification Markers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {activeCycle.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-secondary/20 transition-all">
                      <td className="p-4 font-bold text-white tracking-wider">{item.asset.assetTag}</td>
                      <td className="p-4 font-semibold text-white">{item.asset.name}</td>
                      <td className="p-4 text-xs">{item.asset.location}</td>
                      <td className="p-4 text-xs">{item.verifiedBy?.name || '--'}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleVerifyItem(item.id, 'VERIFIED')}
                            disabled={isPending}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                              item.status === 'VERIFIED'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            }`}
                          >
                            Verified
                          </button>

                          <button
                            onClick={() => handleVerifyItem(item.id, 'MISSING')}
                            disabled={isPending}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                              item.status === 'MISSING'
                                ? 'bg-rose-500 text-white'
                                : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                            }`}
                          >
                            Missing
                          </button>

                          <button
                            onClick={() => handleVerifyItem(item.id, 'DAMAGED')}
                            disabled={isPending}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                              item.status === 'DAMAGED'
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                            }`}
                          >
                            Damaged
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
