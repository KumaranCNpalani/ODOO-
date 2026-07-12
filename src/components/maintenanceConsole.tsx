'use client';

import { useState, useTransition } from 'react';
import { createMaintenanceRequest, updateMaintenanceStatus } from '@/app/actions/maintenanceActions';
import { Plus, ArrowLeft, ArrowRight, Wrench, Clock, CheckCircle2, User, AlertCircle, X } from 'lucide-react';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';

interface MaintenanceConsoleProps {
  requests: any[];
  assets: any[];
  technicians: any[];
  currentUser: { id: string; role: string };
}

export default function MaintenanceConsole({ requests, assets, technicians, currentUser }: MaintenanceConsoleProps) {
  const [isPending, startTransition] = useTransition();
  const [showDrawer, setShowDrawer] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form States
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Kanban Columns Definition
  const columns: { label: string; status: MaintenanceStatus; color: string }[] = [
    { label: 'Pending', status: 'PENDING', color: 'border-t-zinc-500' },
    { label: 'Approved', status: 'APPROVED', color: 'border-t-blue-500' },
    { label: 'Technician Assigned', status: 'TECHNICIAN_ASSIGNED', color: 'border-t-purple-500' },
    { label: 'In Progress', status: 'IN_PROGRESS', color: 'border-t-amber-500' },
    { label: 'Resolved', status: 'RESOLVED', color: 'border-t-emerald-500' },
  ];

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL': return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      case 'HIGH': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'MEDIUM': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      default: return 'bg-zinc-800 text-muted-foreground border border-zinc-700';
    }
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createMaintenanceRequest({
        assetId: selectedAssetId,
        priority,
        description,
        photoUrl: photoUrl || null,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Maintenance request submitted!' });
        setSelectedAssetId('');
        setPriority('MEDIUM');
        setDescription('');
        setPhotoUrl('');
        setShowDrawer(false);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to submit request' });
      }
    });
  };

  const handleMoveCard = (requestId: string, currentStatus: MaintenanceStatus, direction: 'left' | 'right') => {
    const statusOrder: MaintenanceStatus[] = ['PENDING', 'APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0 || nextIndex >= statusOrder.length) return;
    const newStatus = statusOrder[nextIndex];

    setMessage(null);
    startTransition(async () => {
      const result = await updateMaintenanceStatus(requestId, newStatus);
      if (!result.success) {
        setMessage({ type: 'error', text: result.message || 'Failed to update status' });
      }
    });
  };

  const handleAssignTechnician = (requestId: string, techId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateMaintenanceStatus(requestId, 'TECHNICIAN_ASSIGNED', {
        technicianId: techId || null,
      });
      if (!result.success) {
        setMessage({ type: 'error', text: result.message || 'Failed to assign technician' });
      }
    });
  };

  const canManage = currentUser.role === 'ADMIN' || currentUser.role === 'ASSET_MANAGER';

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">
            Move cards to update asset statuses automatically
          </p>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-xs transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          Raise Request
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-xs font-semibold text-center ${
          message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {message.text}
        </div>
      )}

      {/* Kanban Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-[550px] overflow-x-auto pb-4">
        {columns.map((col) => {
          const colRequests = requests.filter((r) => r.status === col.status);
          return (
            <div 
              key={col.status} 
              className={`flex-shrink-0 w-80 lg:w-auto bg-card rounded-xl border border-border border-t-4 ${col.color} p-4 flex flex-col gap-4 overflow-y-auto max-h-full`}
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="font-bold text-white text-xs uppercase tracking-wider">{col.label}</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-[10px] font-bold text-white">
                  {colRequests.length}
                </span>
              </div>

              {/* Card stack */}
              <div className="flex flex-col gap-3">
                {colRequests.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                    No tickets
                  </div>
                ) : (
                  colRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className={`p-4 rounded-lg bg-secondary/35 border border-border/70 flex flex-col gap-3 hover:border-border transition-all ${
                        req.status === 'RESOLVED' ? 'bg-emerald-500/5 border-emerald-500/20' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-white tracking-wider font-mono bg-secondary px-1.5 py-0.5 rounded">
                          {req.asset.assetTag}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${getPriorityColor(req.priority)}`}>
                          {req.priority}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-white leading-tight">{req.asset.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                          {req.description}
                        </p>
                      </div>

                      {/* Technician details display */}
                      {req.technician && (
                        <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-primary" />
                          <span>Tech: {req.technician.name}</span>
                        </div>
                      )}

                      {/* Admin inline technician assignment */}
                      {canManage && req.status === 'APPROVED' && (
                        <div className="border-t border-border/40 pt-2 flex flex-col gap-1">
                          <label className="text-[9px] font-bold uppercase text-muted-foreground">Assign Technician</label>
                          <select
                            defaultValue={req.technicianId || ''}
                            onChange={(e) => handleAssignTechnician(req.id, e.target.value)}
                            className="px-2 py-1 rounded bg-secondary border border-border text-white text-[10px] focus:outline-none"
                          >
                            <option value="">Choose Tech...</option>
                            {technicians.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Card movements buttons */}
                      {canManage && (
                        <div className="flex justify-between items-center border-t border-border/40 pt-2">
                          <button
                            onClick={() => handleMoveCard(req.id, req.status, 'left')}
                            disabled={req.status === 'PENDING' || isPending}
                            className="p-1 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-white disabled:opacity-30"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => handleMoveCard(req.id, req.status, 'right')}
                            disabled={req.status === 'RESOLVED' || isPending || (req.status === 'APPROVED' && !req.technicianId)}
                            className="p-1 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-white disabled:opacity-30"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer: Raise Request */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-card border-l border-border h-full p-6 flex flex-col gap-4 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-bold text-lg text-white">Raise Maintenance Ticket</h3>
              <button onClick={() => setShowDrawer(false)} className="text-muted-foreground hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Select Asset *</label>
                <select
                  required
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                >
                  <option value="">Select Asset Tag...</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      [{asset.assetTag}] {asset.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Priority *</label>
                <select
                  required
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description of Issue *</label>
                <textarea
                  required
                  placeholder="Provide details about the fault (e.g. flickering screen, fan noise...)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 mt-4 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm transition-all"
              >
                {isPending ? 'Submitting...' : 'File Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
