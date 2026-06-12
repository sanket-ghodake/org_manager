'use client';

import { useState, useEffect } from 'react';

interface EmployeesAppProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  runQuery: (sql: string) => Promise<{ rows: any[]; rowCount: number }>;
}

export default function EmployeesApp({ user, runQuery }: EmployeesAppProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [newMetaType, setNewMetaType] = useState('job_level');
  const [newMetaName, setNewMetaName] = useState('');

  const canEdit = user.role === 'super_admin' || user.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const empRes = await runQuery('SELECT * FROM users ORDER BY name ASC;');
      const metaRes = await runQuery('SELECT * FROM structural_metadata ORDER BY type, name ASC;');
      setEmployees(empRes.rows || []);
      setMetadata(metaRes.rows || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch directory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [runQuery]);

  const handleAddMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetaName || !canEdit) return;

    setLoading(true);
    try {
      const sanitizedName = newMetaName.replace(/'/g, "''");
      await runQuery(`
        INSERT INTO structural_metadata (type, name)
        VALUES ('${newMetaType}', '${sanitizedName}');
      `);

      // Log metadata modification
      const payload = JSON.stringify({ type: newMetaType, name: newMetaName });
      await runQuery(`
        INSERT INTO system_logs (user_id, action, severity, payload)
        VALUES ('${user.id}', 'Created Metadata Structure', 'INFO', '${payload}'::jsonb);
      `);

      setNewMetaName('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add structural category.');
    } finally {
      setLoading(false);
    }
  };

  const getMetadataName = (id: string | null) => {
    if (!id) return '-';
    const match = metadata.find(m => m.id === id);
    return match ? match.name : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-brand-accent">Corporate Employee Directory</h2>
          <p className="text-xs text-gray-400">Browse company hierarchy, positions, department verticals, and team structures.</p>
        </div>
        <div className="mt-2 sm:mt-0 text-right">
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full border border-teal-500/30">
            Enterprise Directory
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Organization Metadata */}
        <div className="space-y-6">
          {canEdit && (
            <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md">
              <h3 className="font-bold text-sm mb-4">Add Structural Layer</h3>
              <form onSubmit={handleAddMetadata} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Layer Type</label>
                  <select
                    value={newMetaType}
                    onChange={(e) => setNewMetaType(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  >
                    <option value="job_level">Job Level / Designation</option>
                    <option value="vertical">Vertical / Department</option>
                    <option value="company_name">Company Subsidiary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Layer Value Name</label>
                  <input
                    type="text"
                    value={newMetaName}
                    onChange={(e) => setNewMetaName(e.target.value)}
                    placeholder="e.g. Frontend Engineer, Marketing"
                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    'Add Category Value'
                  )}
                </button>
              </form>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md">
            <h3 className="font-bold text-sm mb-3">Structural Matrix Values</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {['company_name', 'vertical', 'job_level'].map((type) => {
                const items = metadata.filter(m => m.type === type);
                return (
                  <div key={type} className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                      {type.replace('_', ' ')}
                    </h4>
                    {items.length === 0 ? (
                      <p className="text-[10px] text-gray-500 italic pl-2">No structural values</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {items.map((item) => (
                          <span
                            key={item.id}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                          >
                            {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Employees List */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md">
          <h3 className="font-bold text-sm mb-4">Employee Roster</h3>
          {loading && employees.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <span className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="min-w-full divide-y divide-white/5 text-left text-xs">
                <thead className="bg-white/5 text-gray-300 font-mono">
                  <tr>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-400">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-text-primary">{emp.eid}</td>
                      <td className="px-4 py-3 font-semibold text-text-primary">{emp.name}</td>
                      <td className="px-4 py-3">{emp.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          emp.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          emp.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-gray-500/20 text-gray-400 border border-white/10'
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getMetadataName(emp.vertical_id)}</td>
                      <td className="px-4 py-3">{getMetadataName(emp.designation_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
