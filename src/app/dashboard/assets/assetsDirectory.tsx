'use client';

import { useState, useTransition } from 'react';
import { registerAsset } from '@/app/actions/assetActions';
import { importAssetsAction } from '@/app/actions/importActions';
import { parseCSV, downloadCSV } from '@/lib/csvUtils';
import { Plus, Search, Eye, X, BookOpen, AlertTriangle } from 'lucide-react';
import { AssetCondition } from '@prisma/client';

interface AssetsDirectoryProps {
  assets: any[];
  categories: any[];
  userRole: string;
}

export default function AssetsDirectory({ assets, categories, userRole }: AssetsDirectoryProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import assets from CSV
  const handleImportAssetsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length <= 1) {
          setMessage({ type: 'error', text: 'CSV is empty or missing headers.' });
          return;
        }

        const headers = parsed[0].map(h => h.toLowerCase().trim());
        const nameIdx = headers.indexOf('name');
        const catIdx = headers.indexOf('category');
        const serialIdx = headers.indexOf('serial number');
        const costIdx = headers.indexOf('acquisition cost');
        const dateIdx = headers.indexOf('acquisition date');
        const condIdx = headers.indexOf('condition');
        const locIdx = headers.indexOf('location');
        const bookableIdx = headers.indexOf('bookable');

        if (nameIdx === -1 || catIdx === -1) {
          setMessage({ type: 'error', text: 'CSV must contain at least "Name" and "Category" columns.' });
          return;
        }

        const assetsData = parsed.slice(1).map(row => {
          const costRaw = parseFloat(row[costIdx] || '');
          const isBookable = row[bookableIdx]?.toLowerCase().trim();
          return {
            name: row[nameIdx] || '',
            categoryName: row[catIdx] || '',
            serialNumber: serialIdx !== -1 ? row[serialIdx] || null : null,
            acquisitionCost: isNaN(costRaw) ? null : costRaw,
            acquisitionDate: dateIdx !== -1 ? row[dateIdx] || '' : '',
            condition: condIdx !== -1 ? row[condIdx]?.toUpperCase() || 'GOOD' : 'GOOD',
            location: locIdx !== -1 ? row[locIdx] || 'HQ Office' : 'HQ Office',
            sharedBookable: isBookable === 'yes' || isBookable === 'true' || isBookable === '1',
          };
        });

        startTransition(async () => {
          const result = await importAssetsAction(assetsData);
          if (result.success && 'createdCount' in result) {
            let msg = `Successfully imported ${result.createdCount} assets!`;
            if ('errors' in result && result.errors && result.errors.length > 0) {
              msg += ` Note: ${result.errors.length} rows skipped with errors. (Check developer console for details)`;
              console.warn('Import errors:', result.errors);
            }
            setMessage({
              type: 'success',
              text: msg,
            });
          } else {
            setMessage({ type: 'error', text: (result as any).message || 'Import failed.' });
          }
        });
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Error parsing CSV file.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportAssetsCSV = () => {
    const headers = ['Tag', 'Name', 'Category', 'Serial Number', 'Acquisition Date', 'Cost', 'Condition', 'Location', 'Status', 'Bookable'];
    const rows = filteredAssets.map(asset => [
      asset.assetTag,
      asset.name,
      asset.category?.name || 'Unassigned',
      asset.serialNumber || '',
      asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : '',
      asset.acquisitionCost || '',
      asset.currentCondition || asset.condition || '',
      asset.location,
      asset.status,
      asset.sharedBookable ? 'Yes' : 'No'
    ]);
    downloadCSV('assets_export.csv', headers, rows);
  };

  // Form States
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('GOOD');
  const [location, setLocation] = useState('');
  const [sharedBookable, setSharedBookable] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  
  // Custom Dynamic Category Fields
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});

  const selectedCategoryObj = categories.find(cat => cat.id === categoryId);
  const schemaFields = selectedCategoryObj?.customFieldsSchema 
    ? Object.entries(selectedCategoryObj.customFieldsSchema) 
    : [];

  const handleCustomFieldChange = (key: string, val: string) => {
    setCustomFieldsData({ ...customFieldsData, [key]: val });
  };

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const cost = parseFloat(acquisitionCost);

    // Cast custom fields to their correct types based on schema
    const formattedFields: Record<string, any> = {};
    if (selectedCategoryObj?.customFieldsSchema) {
      Object.entries(selectedCategoryObj.customFieldsSchema).forEach(([key, type]) => {
        const val = customFieldsData[key];
        if (val !== undefined && val !== '') {
          if (type === 'number') {
            formattedFields[key] = parseFloat(val);
          } else if (type === 'boolean') {
            formattedFields[key] = val === 'true';
          } else {
            formattedFields[key] = val;
          }
        }
      });
    }

    startTransition(async () => {
      const result = await registerAsset({
        name,
        categoryId,
        serialNumber: serialNumber || null,
        acquisitionDate,
        acquisitionCost: isNaN(cost) ? null : cost,
        condition,
        location,
        sharedBookable,
        customFieldValues: formattedFields,
        photoUrl: photoUrl || null,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Asset registered successfully!' });
        setName('');
        setCategoryId('');
        setSerialNumber('');
        setAcquisitionDate('');
        setAcquisitionCost('');
        setCondition('GOOD');
        setLocation('');
        setSharedBookable(false);
        setPhotoUrl('');
        setCustomFieldsData({});
        setShowDrawer(false);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to register asset' });
      }
    });
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.assetTag.toLowerCase().includes(search.toLowerCase()) ||
      asset.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      asset.location.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = 
      selectedCategoryFilter === '' || asset.categoryId === selectedCategoryFilter;

    const matchesStatus = 
      selectedStatusFilter === '' || asset.status === selectedStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const canManage = userRole === 'ADMIN' || userRole === 'ASSET_MANAGER';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-500/10 text-emerald-500';
      case 'ALLOCATED': return 'bg-blue-500/10 text-blue-500';
      case 'UNDER_MAINTENANCE': return 'bg-amber-500/10 text-amber-500';
      case 'LOST': return 'bg-rose-500/10 text-rose-500';
      default: return 'bg-zinc-800 text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Quick Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full flex items-center gap-3 bg-secondary/50 border border-border px-3.5 py-2.5 rounded-lg">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Tag, Serial number, Location, or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-3 justify-end">
          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="LOST">Lost</option>
            <option value="RETIRED">Retired</option>
          </select>

          <button
            onClick={handleExportAssetsCSV}
            className="px-3 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Export CSV
          </button>

          {canManage && (
            <>
              <label className="px-3 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-primary/20">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportAssetsCSV}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setShowDrawer(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Register Asset
              </button>
            </>
          )}
        </div>
      </div>

      {canManage && (
        <div className="p-2.5 rounded border border-border bg-secondary/50 text-[10px] text-muted-foreground">
          <strong>CSV Asset Import Guide</strong>: Required columns: <code>Name, Category</code>. Optional: <code>Serial Number, Acquisition Date, Acquisition Cost, Condition, Location, Bookable (yes/no)</code>.
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg border text-xs font-semibold text-center ${
          message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {message.text}
        </div>
      )}

      {/* Assets Table */}
      <div className="p-6 rounded-xl border border-border bg-card">
        <div className="overflow-x-auto border border-border/50 rounded-lg">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border/50">
              <tr>
                <th className="p-4">Tag</th>
                <th className="p-4">Asset Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Status</th>
                <th className="p-4">Location</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs">No assets found matching filters</td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-secondary/20 transition-all">
                    <td className="p-4 font-bold text-foreground tracking-wider">{asset.assetTag}</td>
                    <td className="p-4 font-semibold text-foreground">
                      <div>
                        <p>{asset.name}</p>
                        {asset.serialNumber && (
                          <p className="text-[10px] text-muted-foreground font-mono">S/N: {asset.serialNumber}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-xs">{asset.category.name}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${getStatusColor(asset.status)}`}>
                        {asset.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-xs">{asset.location}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setShowDetailModal(asset)}
                        className="p-2 rounded hover:bg-secondary text-primary cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer: Register Asset */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-card border-l border-border h-full p-6 flex flex-col gap-4 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-bold text-lg text-foreground">Register Corporate Asset</h3>
              <button onClick={() => setShowDrawer(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro M3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="">Select Category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Serial Number</label>
                  <input
                    type="text"
                    placeholder="S/N..."
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Acquisition Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500.00"
                    value={acquisitionCost}
                    onChange={(e) => setAcquisitionCost(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Acquisition Date *</label>
                  <input
                    type="date"
                    required
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Condition *</label>
                  <select
                    required
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                  >
                    <option value="NEW">New</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="POOR">Poor</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HQ Floor 3"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <input
                  type="checkbox"
                  id="sharedBookable"
                  checked={sharedBookable}
                  onChange={(e) => setSharedBookable(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="sharedBookable" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  Mark as shared/bookable resource (e.g. Rooms/Vehicles)
                </label>
              </div>

              {/* Dynamic Categories Attributes Injection */}
              {schemaFields.length > 0 && (
                <div className="flex flex-col gap-4 border-t border-border pt-4 mt-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">Category Attributes</span>
                  {schemaFields.map(([key, type]) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">
                        {key.replace('_', ' ')} ({String(type)})
                      </label>
                      <input
                        type={type === 'number' ? 'number' : 'text'}
                        value={customFieldsData[key] || ''}
                        onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                        className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 mt-4 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Registering...' : 'Register Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details & Actions */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 flex flex-col gap-6 relative">
            <button 
              onClick={() => setShowDetailModal(null)} 
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                Tag
              </div>
              <div>
                <h4 className="font-bold text-lg text-foreground">{showDetailModal.name}</h4>
                <p className="text-xs text-muted-foreground tracking-wider font-mono uppercase">Tag: {showDetailModal.assetTag}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-border py-4 text-xs">
              <div>
                <p className="text-muted-foreground font-semibold">Location</p>
                <p className="text-foreground font-medium mt-0.5">{showDetailModal.location}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold">Condition</p>
                <p className="text-foreground font-medium mt-0.5">{showDetailModal.currentCondition}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold">Acquisition Cost</p>
                <p className="text-foreground font-medium mt-0.5">
                  {showDetailModal.acquisitionCost ? `$${Number(showDetailModal.acquisitionCost).toFixed(2)}` : '--'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold">Acquisition Date</p>
                <p className="text-foreground font-medium mt-0.5">
                  {new Date(showDetailModal.acquisitionDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Custom attributes display */}
            {showDetailModal.customFieldValues && Object.keys(showDetailModal.customFieldValues).length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Attributes</span>
                <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3 rounded-lg border border-border/50 text-xs">
                  {Object.entries(showDetailModal.customFieldValues).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-muted-foreground font-bold capitalize">{k.replace('_', ' ')}: </span>
                      <span className="text-foreground font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active allocations status info */}
            {showDetailModal.status === 'ALLOCATED' && (
              <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Asset is currently allocated and held by an employee.
              </div>
            )}
            
            {showDetailModal.status === 'UNDER_MAINTENANCE' && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 animate-pulse-slow" />
                Asset is under active repair (Maintenance request pending resolution).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
