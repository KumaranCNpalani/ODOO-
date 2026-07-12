'use client';

import { useState, useTransition } from 'react';
import { 
  createDepartment, 
  updateDepartment, 
  deleteDepartment,
  createAssetCategory, 
  updateAssetCategory,
  deleteAssetCategory,
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
} from '@/app/actions/setupActions';
import { Plus, Check, X, Shield, Users, Layers, Award, Edit2, Trash2, ShieldAlert } from 'lucide-react';

interface SetupTabsProps {
  departments: any[];
  categories: any[];
  users: any[];
}

export default function SetupTabs({ departments, categories, users }: SetupTabsProps) {
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'employees'>('departments');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modals Controllers
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

  // Department Form States (Add & Edit)
  const [deptName, setDeptName] = useState('');
  const [parentDept, setParentDept] = useState('');
  const [headUser, setHeadUser] = useState('');
  
  const [editDeptName, setEditDeptName] = useState('');
  const [editParentDept, setEditParentDept] = useState('');
  const [editHeadUser, setEditHeadUser] = useState('');
  const [editDeptStatus, setEditDeptStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Category Form States (Add & Edit)
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [customFields, setCustomFields] = useState<{ name: string; type: string }[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');

  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCustomFields, setEditCustomFields] = useState<{ name: string; type: string }[]>([]);
  const [editNewFieldName, setEditNewFieldName] = useState('');
  const [editNewFieldType, setEditNewFieldType] = useState('string');

  // Employee Form States (Add & Edit)
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState('EMPLOYEE');
  const [empDeptId, setEmpDeptId] = useState('');

  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpRole, setEditEmpRole] = useState('EMPLOYEE');
  const [editEmpDeptId, setEditEmpDeptId] = useState('');
  const [editEmpStatus, setEditEmpStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Schema builder helpers
  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields([...customFields, { name: newFieldName.trim().toLowerCase().replace(/\s+/g, '_'), type: newFieldType }]);
    setNewFieldName('');
  };
  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const addEditCustomField = () => {
    if (!editNewFieldName.trim()) return;
    setEditCustomFields([...editCustomFields, { name: editNewFieldName.trim().toLowerCase().replace(/\s+/g, '_'), type: editNewFieldType }]);
    setEditNewFieldName('');
  };
  const removeEditCustomField = (index: number) => {
    setEditCustomFields(editCustomFields.filter((_, i) => i !== index));
  };

  // ==========================================
  // Department Submissions
  // ==========================================
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

  const handleUpdateDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setMessage(null);

    startTransition(async () => {
      const result = await updateDepartment(editingDept.id, {
        name: editDeptName,
        parentDepartmentId: editParentDept || null,
        headUserId: editHeadUser || null,
        status: editDeptStatus,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Department updated successfully!' });
        setEditingDept(null);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update department' });
      }
    });
  };

  const handleDeleteDept = (id: string) => {
    if (!confirm('Are you sure you want to delete this department? All child departments and employee ties will be unlinked.')) return;
    setMessage(null);

    startTransition(async () => {
      const result = await deleteDepartment(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Department deleted successfully!' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete department' });
      }
    });
  };

  // ==========================================
  // Category Submissions
  // ==========================================
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

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    setMessage(null);

    const schema: Record<string, string> = {};
    editCustomFields.forEach(field => {
      schema[field.name] = field.type;
    });

    startTransition(async () => {
      const result = await updateAssetCategory(editingCat.id, editCatName, editCatDesc, schema);
      if (result.success) {
        setMessage({ type: 'success', text: 'Asset Category updated successfully!' });
        setEditingCat(null);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update category' });
      }
    });
  };

  const handleDeleteCategory = (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This will fail if assets are currently registered under it.')) return;
    setMessage(null);

    startTransition(async () => {
      const result = await deleteAssetCategory(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Asset Category deleted successfully!' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete category' });
      }
    });
  };

  // ==========================================
  // Employee Submissions
  // ==========================================
  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createEmployee({
        name: empName,
        email: empEmail,
        role: empRole,
        departmentId: empDeptId || null,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Employee registered successfully!' });
        setEmpName('');
        setEmpEmail('');
        setEmpRole('EMPLOYEE');
        setEmpDeptId('');
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to create employee' });
      }
    });
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setMessage(null);

    startTransition(async () => {
      const result = await updateEmployee(editingEmployee.id, {
        name: editEmpName,
        email: editEmpEmail,
        role: editEmpRole,
        departmentId: editEmpDeptId || null,
        status: editEmpStatus,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Employee updated successfully!' });
        setEditingEmployee(null);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update employee' });
      }
    });
  };

  const handleDeleteEmployee = (id: string) => {
    if (!confirm('Are you sure you want to delete this employee? Any active asset allocations or resource bookings will block this deletion.')) return;
    setMessage(null);

    startTransition(async () => {
      const result = await deleteEmployee(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Employee deleted successfully!' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete employee' });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Tabs Controller */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setActiveTab('departments'); setMessage(null); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'departments' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          Departments
        </button>
        <button
          onClick={() => { setActiveTab('categories'); setMessage(null); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'categories' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="w-4 h-4" />
          Asset Categories
        </button>
        <button
          onClick={() => { setActiveTab('employees'); setMessage(null); }}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'employees' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
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
            <h3 className="font-bold text-foreground text-base">Add Department</h3>
            <form onSubmit={handleCreateDept} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality Assurance"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Parent Department</label>
                <select
                  value={parentDept}
                  onChange={(e) => setParentDept(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
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
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
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
                className="w-full py-2.5 mt-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Saving...' : 'Create Department'}
              </button>
            </form>
          </div>

          {/* Department List */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-foreground text-base">Departments List</h3>
            <div className="overflow-x-auto border border-border/50 rounded-lg">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border/50">
                  <tr>
                    <th className="p-4">Department</th>
                    <th className="p-4">Head</th>
                    <th className="p-4">Parent Dept</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-secondary/20 transition-all">
                      <td className="p-4 font-semibold text-foreground">{dept.name}</td>
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
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingDept(dept);
                              setEditDeptName(dept.name);
                              setEditParentDept(dept.parentDepartmentId || '');
                              setEditHeadUser(dept.headUserId || '');
                              setEditDeptStatus(dept.status);
                            }}
                            className="p-1.5 rounded hover:bg-secondary text-primary cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDept(dept.id)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Tab B: Asset Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Category Form */}
          <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-foreground text-base">Add Asset Category</h3>
            <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT Equipment"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Describe category..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  rows={2}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200 resize-none"
                />
              </div>

              {/* Dynamic Field Builder */}
              <div className="flex flex-col gap-2 border-t border-border pt-4 mt-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Category Fields Schema</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Field name (e.g. warranty)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-secondary border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="px-2 py-1.5 rounded bg-secondary border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="p-2 rounded bg-primary hover:bg-primary/95 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {customFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customFields.map((field, idx) => (
                      <span key={idx} className="px-2 py-1 rounded bg-secondary border border-border text-[10px] font-semibold text-foreground flex items-center gap-1.5">
                        {field.name} ({field.type})
                        <button type="button" onClick={() => removeCustomField(idx)} className="text-destructive cursor-pointer">
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
                className="w-full py-2.5 mt-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Saving...' : 'Create Category'}
              </button>
            </form>
          </div>

          {/* Categories List */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-foreground text-base">Categories List</h3>
            <div className="overflow-x-auto border border-border/50 rounded-lg">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border/50">
                  <tr>
                    <th className="p-4">Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Attributes Schema</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {categories.map((cat) => {
                    const schema = cat.customFieldsSchema ? Object.entries(cat.customFieldsSchema) : [];
                    return (
                      <tr key={cat.id} className="hover:bg-secondary/20 transition-all">
                        <td className="p-4 font-semibold text-foreground">{cat.name}</td>
                        <td className="p-4 text-xs">{cat.description || '--'}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {schema.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              schema.map(([k, v]) => (
                                <span key={k} className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-bold text-foreground">
                                  {k}: {String(v)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingCat(cat);
                                setEditCatName(cat.name);
                                setEditCatDesc(cat.description || '');
                                setEditCustomFields(schema.map(([name, type]) => ({ name, type: String(type) })));
                              }}
                              className="p-1.5 rounded hover:bg-secondary text-primary cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Employee Form */}
          <div className="lg:col-span-1 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-foreground text-base">Add Employee</h3>
            <form onSubmit={handleCreateEmployee} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="ASSET_MANAGER">Asset Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</label>
                <select
                  value={empDeptId}
                  onChange={(e) => setEmpDeptId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="">No Department Assigned</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 mt-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Saving...' : 'Register Employee'}
              </button>
            </form>
          </div>

          {/* Employee Directory List */}
          <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card flex flex-col gap-4">
            <h3 className="font-bold text-foreground text-base">Employee Directory</h3>
            <div className="overflow-x-auto border border-border/50 rounded-lg">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border/50">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-secondary/20 transition-all">
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4">{user.department?.name || 'Unassigned'}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.status === 'ACTIVE'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-zinc-800 text-muted-foreground'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingEmployee(user);
                              setEditEmpName(user.name);
                              setEditEmpEmail(user.email);
                              setEditEmpRole(user.role);
                              setEditEmpDeptId(user.departmentId || '');
                              setEditEmpStatus(user.status);
                            }}
                            className="p-1.5 rounded hover:bg-secondary text-primary cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(user.id)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ======================================================== */}
      {/* 1. Modal: Edit Department */}
      {/* ======================================================== */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 flex flex-col gap-4 relative">
            <button onClick={() => setEditingDept(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h4 className="font-bold text-lg text-foreground">Update Department Details</h4>
            
            <form onSubmit={handleUpdateDept} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Department Name</label>
                <input
                  type="text"
                  required
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Parent Department</label>
                <select
                  value={editParentDept}
                  onChange={(e) => setEditParentDept(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="">None (Top Level)</option>
                  {departments.filter(d => d.id !== editingDept.id).map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Department Head</label>
                <select
                  value={editHeadUser}
                  onChange={(e) => setEditHeadUser(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="">No Head User</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <select
                  value={editDeptStatus}
                  onChange={(e) => setEditDeptStatus(e.target.value as any)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Updating...' : 'Update Department'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Modal: Edit Category */}
      {/* ======================================================== */}
      {editingCat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 flex flex-col gap-4 relative my-8">
            <button onClick={() => setEditingCat(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h4 className="font-bold text-lg text-foreground">Update Asset Category</h4>
            
            <form onSubmit={handleUpdateCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Category Name</label>
                <input
                  type="text"
                  required
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                <textarea
                  value={editCatDesc}
                  onChange={(e) => setEditCatDesc(e.target.value)}
                  rows={2}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none resize-none"
                />
              </div>

              {/* Dynamic Field Builder (Edit) */}
              <div className="flex flex-col gap-2 border-t border-border pt-4 mt-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Attributes Schema</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={editNewFieldName}
                    onChange={(e) => setEditNewFieldName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-secondary border border-border text-foreground text-xs focus:outline-none"
                  />
                  <select
                    value={editNewFieldType}
                    onChange={(e) => setEditNewFieldType(e.target.value)}
                    className="px-2 py-1.5 rounded bg-secondary border border-border text-foreground text-xs focus:outline-none"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button
                    type="button"
                    onClick={addEditCustomField}
                    className="p-2 rounded bg-primary hover:bg-primary/95 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {editCustomFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editCustomFields.map((field, idx) => (
                      <span key={idx} className="px-2 py-1 rounded bg-secondary border border-border text-[10px] font-semibold text-foreground flex items-center gap-1.5">
                        {field.name} ({field.type})
                        <button type="button" onClick={() => removeEditCustomField(idx)} className="text-destructive cursor-pointer">
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
                className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Updating...' : 'Update Category'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. Modal: Edit Employee */}
      {/* ======================================================== */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 flex flex-col gap-4 relative">
            <button onClick={() => setEditingEmployee(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h4 className="font-bold text-lg text-foreground">Update Employee Details</h4>
            
            <form onSubmit={handleUpdateEmployee} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Role</label>
                <select
                  value={editEmpRole}
                  onChange={(e) => setEditEmpRole(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="ASSET_MANAGER">Asset Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Department</label>
                <select
                  value={editEmpDeptId}
                  onChange={(e) => setEditEmpDeptId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="">No Department Assigned</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <select
                  value={editEmpStatus}
                  onChange={(e) => setEditEmpStatus(e.target.value as any)}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isPending ? 'Updating...' : 'Update Employee'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
