'use client';

import { useState, useTransition } from 'react';
import { 
  createDepartment, 
  createAssetCategory, 
  promoteUser, 
  toggleUserStatus 
} from '@/app/actions/setupActions';
import { Plus, Check, X, Shield, Users, Layers, Award } from 'lucide-react';

interface SetupTabsProps {
  departments: any[];
  categories: any[];
  users: any[];
}

export default function SetupTabs({ departments, categories, users }: SetupTabsProps) {
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'employees'>('departments');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Department Form States
  const [deptName, setDeptName] = useState('');
  const [parentDept, setParentDept] = useState('');
  const [headUser, setHeadUser] = useState('');

  // Category Form States
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [customFields, setCustomFields] = useState<{ name: string; type: string }[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields([...customFields, { name: newFieldName.trim().toLowerCase().replace(/\s+/g, '_'), type: newFieldType }]);
    setNewFieldName('');
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleCreateDept = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.append('name', deptName);
    formData.append('parentDepartmentId', parentDept);
    formData.append('headUserId', headUser);

    startTransition(async () => {
      const result = await createDepartment(formData);
      if (result.success) {
        setMessage({ type: 'success', text: 'Department created successfully' });
        setDeptName('');
        setParentDept('');
        setHeadUser('');
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to create department' });
      }
    });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const schema: Record<string, string> = {};
    customFields.forEach(field => {
      schema[field.name] = field.type;
    });

    startTransition(async () => {
      const result = await createAssetCategory(catName, catDesc, schema);
      if (result.success) {
        setMessage({ type: 'success', text: 'Asset Category created successfully' });
        setCatName('');
        setCatDesc('');
        setCustomFields([]);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to create category' });
      }
    });
  };

  const handlePromoteUser = (userId: string, role: string, departmentId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await promoteUser(userId, role as any, departmentId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Employee promoted successfully' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update employee' });
      }
    });
  };

  const handleToggleStatus = (userId: string, currentStatus: string) => {
    setMessage(null);
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    startTransition(async () => {
      const result = await toggleUserStatus(userId, newStatus);
      if (result.success) {
        setMessage({ type: 'success', text: 'Employee status updated successfully' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to toggle employee status' });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Tabs Controller */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setActiveTab('departments'); setMessage(null); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'departments' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Departments
        </button>
        <button
          onClick={() => { setActiveTab('categories'); setMessage(null); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'categories' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          Asset Categories
        </button>
        <button
          onClick={() => { setActiveTab('employees'); setMessage(null); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'employees' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Employee Directory
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-xs font-semibold text-center ${
          message.type === 'success' 
            ? 'bg-primary/10 border-primary/20 text-primary' 
            : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tab A: Departments */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Department Form */}
          <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-white text-base">Add Department</h3>
            <form onSubmit={handleCreateDept} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality Assurance"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Parent Department</label>
                <select
                  value={parentDept}
                  onChange={(e) => setParentDept(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none focus:border-primary transition-all duration-200"
                >
                  <option value="">None (Top Level)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department Head</label>
                <select
                  value={headUser}
                  onChange={(e) => setHeadUser(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none focus:border-primary transition-all duration-200"
                >
                  <option value="">Select Department Head...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 mt-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all"
              >
                {isPending ? 'Saving...' : 'Create Department'}
              </button>
            </form>
          </div>

          {/* Department List */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-white text-base">Departments List</h3>
            <div className="overflow-x-auto border border-border/50 rounded-lg">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-white border-b border-border/50">
                  <tr>
                    <th className="p-4">Department</th>
                    <th className="p-4">Head</th>
                    <th className="p-4">Parent Dept</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-secondary/20 transition-all">
                      <td className="p-4 font-semibold text-white">{dept.name}</td>
                      <td className="p-4">{dept.headUser?.name || '--'}</td>
                      <td className="p-4">{dept.parentDepartment?.name || '--'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          dept.status === 'ACTIVE' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-zinc-800 text-muted-foreground'
                        }`}>
                          {dept.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab B: Asset Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Category Form */}
          <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-white text-base">Add Asset Category</h3>
            <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT Equipment"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Describe category..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  rows={2}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-white text-sm focus:outline-none focus:border-primary transition-all duration-200 resize-none"
                />
              </div>

              {/* Dynamic Field Builder */}
              <div className="flex flex-col gap-2 border-t border-border pt-4 mt-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Category Fields Schema</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Field name (e.g. warranty)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-secondary border border-border text-white text-xs focus:outline-none focus:border-primary"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="px-2 py-1.5 rounded bg-secondary border border-border text-white text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="p-2 rounded bg-primary hover:bg-primary/95 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {customFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customFields.map((field, idx) => (
                      <span key={idx} className="px-2 py-1 rounded bg-secondary border border-border text-[10px] font-semibold text-white flex items-center gap-1.5">
                        {field.name} ({field.type})
                        <button type="button" onClick={() => removeCustomField(idx)} className="text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 mt-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all"
              >
                {isPending ? 'Saving...' : 'Create Category'}
              </button>
            </form>
          </div>

          {/* Categories List */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-white text-base">Categories List</h3>
            <div className="overflow-x-auto border border-border/50 rounded-lg">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-white border-b border-border/50">
                  <tr>
                    <th className="p-4">Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Attributes Schema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {categories.map((cat) => {
                    const schema = cat.customFieldsSchema ? Object.entries(cat.customFieldsSchema) : [];
                    return (
                      <tr key={cat.id} className="hover:bg-secondary/20 transition-all">
                        <td className="p-4 font-semibold text-white">{cat.name}</td>
                        <td className="p-4 text-xs">{cat.description || '--'}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {schema.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              schema.map(([k, v]) => (
                                <span key={k} className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-bold text-white">
                                  {k}: {String(v)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab C: Employees Directory */}
      {activeTab === 'employees' && (
        <div className="p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
          <h3 className="font-bold text-white text-base">Employee Directory</h3>
          <div className="overflow-x-auto border border-border/50 rounded-lg">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-white border-b border-border/50">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Promotions / Status Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-all">
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-white">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="p-4">{user.department?.name || 'Unassigned'}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-white font-semibold">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        disabled={isPending}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          user.status === 'ACTIVE'
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'bg-zinc-800 text-muted-foreground hover:bg-zinc-700'
                        }`}
                      >
                        {user.status}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Promote role inputs */}
                        <select
                          defaultValue={user.role}
                          onChange={(e) => handlePromoteUser(user.id, e.target.value, user.departmentId)}
                          disabled={isPending}
                          className="px-2 py-1 rounded bg-secondary border border-border text-white text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="EMPLOYEE">Employee</option>
                          <option value="DEPARTMENT_HEAD">Department Head</option>
                          <option value="ASSET_MANAGER">Asset Manager</option>
                          <option value="ADMIN">Admin</option>
                        </select>

                        {/* Assign department inline */}
                        <select
                          defaultValue={user.departmentId || ''}
                          onChange={(e) => handlePromoteUser(user.id, user.role, e.target.value)}
                          disabled={isPending}
                          className="px-2 py-1 rounded bg-secondary border border-border text-white text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="">No Dept</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
