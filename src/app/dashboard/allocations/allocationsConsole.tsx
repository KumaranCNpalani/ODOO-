'use client';

import { useState, useTransition } from 'react';
import { 
  allocateAsset, 
  submitTransferRequest, 
  returnAsset, 
  approveTransferRequest, 
  rejectTransferRequest 
} from '@/app/actions/assetActions';
import { Search, AlertTriangle, Calendar, Check, X } from 'lucide-react';
import { AssetCondition } from '@prisma/client';

interface AllocationsConsoleProps {
  assets: any[];
  users: any[];
  transfers: any[];
  currentUser: { id: string; role: string; departmentId: string | null };
}

export default function AllocationsConsole({ assets, users, transfers, currentUser }: AllocationsConsoleProps) {
  const [isPending, startTransition] = useTransition();
  const [searchTag, setSearchTag] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Allocation Form
  const [targetUserId, setTargetUserId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  // Transfer Form (Triggered on Conflict)
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [conflictHolder, setConflictHolder] = useState<string | null>(null);

  // Return Form
  const [returnCondition, setReturnCondition] = useState<AssetCondition>('GOOD');
  const [returnNotes, setReturnNotes] = useState('');

  const handleSearchAsset = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setConflictHolder(null);

    const asset = assets.find(
      (a) => a.assetTag.toLowerCase() === searchTag.trim().toLowerCase()
    );

    if (!asset) {
      setMessage({ type: 'error', text: `Asset Tag ${searchTag} not found in directory.` });
      setSelectedAsset(null);
      return;
    }

    setSelectedAsset(asset);
    
    // Check if it's already allocated to extract the active holder
    if (asset.status === 'ALLOCATED') {
      const activeAlloc = asset.allocations.find((al: any) => al.isActive);
      const holder = activeAlloc?.allocatedToUser?.name || activeAlloc?.allocatedToDept?.name || 'Another User';
      setConflictHolder(holder);
    }
  };

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setMessage(null);

    startTransition(async () => {
      const result = await allocateAsset({
        assetId: selectedAsset.id,
        allocatedToUserId: targetUserId || null,
        allocatedToDeptId: null, // Default to user-allocation in standard form
        expectedReturnDate: expectedReturnDate || null,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Asset allocated successfully!' });
        setSelectedAsset(null);
        setSearchTag('');
        setTargetUserId('');
        setExpectedReturnDate('');
      } else if (result.conflict) {
        setConflictHolder(result.holder || 'another user');
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to allocate asset' });
      }
    });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setMessage(null);

    startTransition(async () => {
      const result = await submitTransferRequest({
        assetId: selectedAsset.id,
        targetUserId: transferTargetUserId || null,
        targetDeptId: null,
        remarks: transferReason,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Transfer request submitted successfully. Awaiting Manager approval.' });
        setSelectedAsset(null);
        setSearchTag('');
        setTransferTargetUserId('');
        setTransferReason('');
        setConflictHolder(null);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to submit transfer request' });
      }
    });
  };

  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setMessage(null);

    startTransition(async () => {
      const result = await returnAsset({
        assetId: selectedAsset.id,
        condition: returnCondition,
        notes: returnNotes,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Asset marked returned and condition updated to Available.' });
        setSelectedAsset(null);
        setSearchTag('');
        setReturnNotes('');
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to process return' });
      }
    });
  };

  const handleApproveTransfer = (requestId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await approveTransferRequest(requestId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Transfer request approved! Asset has been re-allocated.' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to approve transfer' });
      }
    });
  };

  const handleRejectTransfer = (requestId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await rejectTransferRequest(requestId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Transfer request rejected.' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to reject transfer' });
      }
    });
  };

  // Helper check: can approve transfer
  const canApproveTransfer = (request: any) => {
    if (currentUser.role === 'ADMIN' || currentUser.role === 'ASSET_MANAGER') return true;
    if (currentUser.role === 'DEPARTMENT_HEAD') {
      // Dept head can approve if target department matches departmentId
      return request.requestingUser?.departmentId === currentUser.departmentId;
    }
    return false;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Columns: Search & Form Workflows */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {/* Search Asset Console */}
        <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-foreground text-base">Select Asset for Allocation</h3>
          <form onSubmit={handleSearchAsset} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-secondary border border-border px-3 rounded-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                required
                placeholder="Enter Asset Tag (e.g. AF-0012)"
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                className="flex-1 py-2.5 bg-transparent text-foreground text-sm focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm transition-all cursor-pointer"
            >
              Verify Tag
            </button>
          </form>
        </div>

        {message && (
          <div className={`p-3 rounded-lg border text-xs font-semibold text-center ${
            message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            {message.text}
          </div>
        )}

        {/* Selected Asset Workflows */}
        {selectedAsset && (
          <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-6">
            
            {/* Header: Selected Asset Header info */}
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <h4 className="font-bold text-lg text-foreground">{selectedAsset.name}</h4>
                <p className="text-xs text-muted-foreground tracking-wider font-mono uppercase">Tag: {selectedAsset.assetTag} | Location: {selectedAsset.location}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedAsset.status === 'AVAILABLE' 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : selectedAsset.status === 'ALLOCATED'
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'bg-zinc-800 text-muted-foreground'
              }`}>
                {selectedAsset.status}
              </span>
            </div>

            {/* FLOW 1: Double-Allocation CONFLICT flow */}
            {conflictHolder && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs font-semibold flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse-slow" />
                  <p>
                    Already Allocated to <strong>{conflictHolder}</strong>. Direct re-allocation is blocked. Submit a transfer request below.
                  </p>
                </div>

                <form onSubmit={handleTransfer} className="flex flex-col gap-4 bg-secondary/20 p-4 rounded-lg border border-border/50">
                  <h5 className="font-bold text-foreground text-xs uppercase tracking-wider">Raise Transfer Request</h5>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Current Holder</label>
                      <input
                        type="text"
                        disabled
                        value={conflictHolder}
                        className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-muted-foreground text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Transfer To *</label>
                      <select
                        required
                        value={transferTargetUserId}
                        onChange={(e) => setTransferTargetUserId(e.target.value)}
                        className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                      >
                        <option value="">Select Target Employee...</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Reason for Transfer *</label>
                    <textarea
                      required
                      placeholder="Explain why this transfer is needed..."
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      rows={3}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all cursor-pointer"
                  >
                    {isPending ? 'Submitting...' : 'Submit Transfer Request'}
                  </button>
                </form>
              </div>
            )}

            {/* FLOW 2: Standard ALLOCATION flow (Available Asset) */}
            {selectedAsset.status === 'AVAILABLE' && (
              <form onSubmit={handleAllocate} className="flex flex-col gap-4">
                <h5 className="font-bold text-foreground text-xs uppercase tracking-wider">Allocate Asset</h5>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Allocate To *</label>
                    <select
                      required
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                    >
                      <option value="">Select Target Employee...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Expected Return Date</label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  {isPending ? 'Allocating...' : 'Complete Allocation'}
                </button>
              </form>
            )}

            {/* FLOW 3: RETURN asset flow (If Allocated, show return options at bottom) */}
            {selectedAsset.status === 'ALLOCATED' && (
              <form onSubmit={handleReturn} className="flex flex-col gap-4 border-t border-border pt-6">
                <h5 className="font-bold text-foreground text-xs uppercase tracking-wider">Process Return</h5>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Condition on Return *</label>
                    <select
                      required
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value as any)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                    >
                      <option value="NEW">New</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="POOR">Poor</option>
                      <option value="DAMAGED">Damaged</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Check-in Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Scratches on lid, missing charger"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="py-2.5 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground font-semibold text-sm transition-all cursor-pointer"
                >
                  {isPending ? 'Processing...' : 'Mark Asset Returned'}
                </button>
              </form>
            )}
            
          </div>
        )}
      </div>

      {/* Right Column: Transfer approvals & Allocation history timeline */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        
        {/* Active Transfer Requests */}
        <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-foreground text-base">Transfer Approvals</h3>
          <div className="flex flex-col gap-3">
            {transfers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No pending transfers found</p>
            ) : (
              transfers.map((req) => (
                <div key={req.id} className="p-3.5 rounded-lg bg-secondary/40 border border-border/40 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-foreground">{req.asset.name}</p>
                      <p className="text-[10px] text-muted-foreground tracking-wider font-mono">{req.asset.assetTag}</p>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    <p><strong className="text-foreground">From:</strong> {req.requestingUser.name}</p>
                    <p><strong className="text-foreground">To:</strong> {req.targetUser?.name || 'No User'}</p>
                    {req.remarks && <p className="italic mt-1">"{req.remarks}"</p>}
                  </div>

                  {canApproveTransfer(req) && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-border/30 justify-end">
                      <button 
                        onClick={() => handleRejectTransfer(req.id)}
                        disabled={isPending}
                        className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleApproveTransfer(req.id)}
                        disabled={isPending}
                        className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Asset Allocation History */}
        {selectedAsset && (
          <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-foreground text-base">Allocation History</h3>
            <div className="flex flex-col gap-4 relative pl-4 border-l border-border/60">
              {selectedAsset.allocations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 pl-2">No history recorded</p>
              ) : (
                selectedAsset.allocations.map((alloc: any) => (
                  <div key={alloc.id} className="relative flex flex-col gap-1 text-xs">
                    {/* Bullet marker */}
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card"></div>
                    <p className="font-semibold text-foreground">
                      {alloc.isActive ? 'Active Allocation' : 'Returned'}
                    </p>
                    <p className="text-muted-foreground">
                      Held by: {alloc.allocatedToUser?.name || alloc.allocatedToDept?.name || 'Unassigned'}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(alloc.allocationDate).toLocaleDateString()} 
                      {alloc.actualReturnDate && ` - ${new Date(alloc.actualReturnDate).toLocaleDateString()}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
