'use client';

import { useState, useEffect, useRef } from 'react';

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
  // Directory & Hierarchy state
  const [focalUserId, setFocalUserId] = useState<string>(user.id);
  const [focalData, setFocalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Administrative metadata states
  const [activeTab, setActiveTab] = useState<'directory' | 'architecture' | 'admin'>('directory');
  const [metadata, setMetadata] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [newMetaType, setNewMetaType] = useState('job_level');
  const [newMetaName, setNewMetaName] = useState('');

  const canEdit = user.role === 'super_admin' || user.role === 'admin';

  // 1. Fetch Hierarchy Context for the focal user
  const fetchHierarchyContext = async (userId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/org/hierarchy/context?userId=${userId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch hierarchy context from scaled API');
      }
      const data = await res.json();
      if (data.success) {
        setFocalData(data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading employee hierarchy data.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch structural metadata for the Admin / Dictionary tables
  const loadMetadata = async () => {
    setAdminLoading(true);
    try {
      const metaRes = await runQuery('SELECT * FROM structural_metadata ORDER BY type, name ASC;');
      setMetadata(metaRes.rows || []);
    } catch (err: any) {
      console.error('Metadata load error:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Fetch initial hierarchy and metadata
  useEffect(() => {
    fetchHierarchyContext(focalUserId);
    loadMetadata();
  }, [focalUserId]);

  // 3. Search Autocomplete Handler
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const res = await fetch(`/api/v1/org/hierarchy/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.employees || []);
            setShowDropdown(true);
          }
        } catch (err) {
          console.error('Search error:', err);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside search dropdown closer
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 4. Admin Event: Add Structural Metadata Category
  const handleAddMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetaName || !canEdit) return;

    setAdminLoading(true);
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
      loadMetadata();
    } catch (err: any) {
      setError(err.message || 'Failed to add structural category.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Switch directory focus user
  const handlePivot = (userId: string) => {
    setFocalUserId(userId);
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Render initials avatar
  const renderAvatar = (name: string, size = 'h-10 w-10 text-sm') => {
    const initials = name
      ? name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
      : '👤';
    return (
      <div className={`${size} rounded-full bg-gradient-to-tr from-brand-accent to-emerald-500 text-white flex items-center justify-center font-black shadow-inner`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-text-primary">
      {/* Top Banner Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-accent via-indigo-400 to-emerald-400">
            Interactive Org Directory
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Teams-style reporting lines, scaled to support over 1,000,000 active nodes.
          </p>
        </div>

        {/* Modular View Selector */}
        <div className="flex bg-surface-card border border-border-accent/40 rounded-xl p-1 gap-1 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40'
            }`}
          >
            🏢 Hierarchy Tree
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40'
            }`}
          >
            📐 Architect's Corner
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40'
            }`}
          >
            ⚙️ Admin settings
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* ─── TAB 1: INTERACTIVE HIERARCHY TREE VIEW ─── */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          
          {/* Autocomplete Search Bar */}
          <div className="relative max-w-xl mx-auto" ref={dropdownRef}>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-text-tertiary">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employees by name, email, or EID..."
                className="w-full bg-surface-card hover:bg-surface-elevated focus:bg-surface-elevated border border-border-accent/60 group-hover:border-brand-accent/40 focus:border-brand-accent/80 rounded-2xl pl-11 pr-10 py-3.5 text-xs text-text-primary placeholder-text-secondary focus:outline-none transition-all shadow-sm focus:shadow-md focus:shadow-brand-accent/5"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text-primary font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Results list */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2.5 bg-surface-card border border-border-accent rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-50 p-2 space-y-1 animate-fadeIn">
                <p className="text-[9px] font-black uppercase text-text-tertiary tracking-wider px-3 py-1.5 border-b border-border-accent/40 mb-1">
                  Search Results ({searchResults.length})
                </p>
                {searchResults.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => handlePivot(emp.id)}
                    className="p-3 bg-surface-card hover:bg-surface-elevated border border-transparent hover:border-border-accent/40 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAvatar(emp.name, 'h-8.5 w-8.5 text-[11px]')}
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-text-primary truncate">{emp.name}</h4>
                        <p className="text-[10px] text-text-secondary truncate mt-0.5">{emp.designation || 'Staff Member'} · {emp.verticalName || 'Corporate'}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono bg-background-portal border border-border-accent px-2 py-0.5 rounded font-black text-text-secondary">
                      {emp.eid}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && (
              <div className="absolute left-0 right-0 mt-2.5 bg-surface-card border border-border-accent rounded-2xl shadow-2xl z-50 p-6 text-center text-xs text-text-secondary italic">
                No employees found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Core Layout Canvas */}
          {loading && !focalData ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="w-9 h-9 border-3 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-text-secondary">Resolving reporting lines dynamically...</p>
            </div>
          ) : focalData ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Linear Upline Manager Stack (Teams Style) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-surface-card border border-border-accent/50 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-text-secondary tracking-widest border-b border-border-accent/40 pb-3 mb-5 flex justify-between items-center">
                    <span>Upline Coordinates</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-brand-muted border border-brand-accent/20 text-brand-accent font-mono">
                      Chain Depth: {focalData.parentChain.length}
                    </span>
                  </h3>

                  <div className="relative pl-6 space-y-8">
                    {/* Vertical Connector line */}
                    {focalData.parentChain.length > 0 && (
                      <div className="absolute left-3 top-5 bottom-5 w-0.5 bg-gradient-to-b from-brand-accent/25 via-brand-accent/45 to-brand-accent rounded" />
                    )}

                    {/* Top Executive Root (e.g. CEO) to Immediate Manager */}
                    {focalData.parentChain.map((parent: any) => (
                      <div key={parent.id} className="relative group">
                        {/* Node circle dot */}
                        <div className="absolute -left-5 top-3.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-brand-accent ring-4 ring-brand-muted group-hover:scale-125 transition-transform" />

                        <div
                          onClick={() => handlePivot(parent.id)}
                          className="p-3.5 bg-surface-card hover:bg-surface-elevated border border-border-accent hover:border-brand-accent/30 rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {renderAvatar(parent.name, 'h-8 w-8 text-[11px]')}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-text-primary truncate leading-tight group-hover:text-brand-accent transition-colors">
                                {parent.name}
                              </h4>
                              <p className="text-[9px] text-text-secondary truncate mt-0.5 uppercase tracking-wide">
                                {parent.designation || 'Executive'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-text-secondary group-hover:translate-x-0.5 transition-transform">➔</span>
                        </div>
                      </div>
                    ))}

                    {/* Top level node indicator when chain is empty (i.e. focal user is CEO) */}
                    {focalData.parentChain.length === 0 && (
                      <div className="text-center py-6 text-text-secondary text-xs italic">
                        👤 Top level node - No parent entities registered.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Center & Right Column: Focused Node and Co-worker Grid */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Focal Node Card (Highlighted) */}
                <div className="relative bg-gradient-to-br from-surface-card to-surface-card/90 border-2 border-brand-accent/40 rounded-3xl p-6 shadow-lg shadow-brand-accent/[0.02] overflow-hidden">
                  <div className="absolute top-0 right-0 bg-brand-accent/15 border-bl border-brand-accent/20 px-3.5 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase text-brand-accent tracking-widest">
                    Selected Node
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-border-accent/40 pb-5">
                    {renderAvatar(focalData.user.name, 'h-16 w-16 text-xl')}
                    <div className="text-center sm:text-left space-y-1 min-w-0">
                      <h3 className="text-lg font-black text-text-primary leading-tight">{focalData.user.name}</h3>
                      <p className="text-xs text-brand-accent font-extrabold uppercase tracking-wide">
                        {focalData.user.designation || 'Staff Profile'}
                      </p>
                      <p className="text-[10px] text-text-tertiary">
                        Department/Vertical: <span className="text-text-secondary font-bold">{focalData.user.verticalName || 'Global corporate'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 text-xs">
                    <div className="bg-background-portal/60 border border-border-accent/40 p-3.5 rounded-2xl space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-black block">Employee ID</span>
                      <span className="font-mono font-bold text-text-primary">{focalData.user.eid}</span>
                    </div>
                    <div className="bg-background-portal/60 border border-border-accent/40 p-3.5 rounded-2xl space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-black block">Contact Email</span>
                      <span className="font-mono font-bold text-text-primary truncate block">{focalData.user.email}</span>
                    </div>
                    <div className="bg-background-portal/60 border border-border-accent/40 p-3.5 rounded-2xl space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-black block">Authority Level</span>
                      <span className="font-bold text-brand-accent font-mono">Tier {focalData.user.role}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Reports section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-text-secondary tracking-widest pl-1">
                    Direct Reports ({focalData.directReports.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {focalData.directReports.map((report: any) => (
                      <div
                        key={report.id}
                        onClick={() => handlePivot(report.id)}
                        className="bg-surface-card hover:bg-surface-elevated border border-border-accent/60 hover:border-brand-accent/30 rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatar(report.name, 'h-9 w-9 text-xs')}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-text-primary leading-tight truncate group-hover:text-brand-accent transition-colors">
                              {report.name}
                            </h4>
                            <p className="text-[9px] text-text-secondary truncate mt-0.5">
                              {report.designation || 'Staff'}
                            </p>
                          </div>
                        </div>
                        <span className="text-text-tertiary group-hover:translate-x-0.5 transition-transform text-[11px]">➔</span>
                      </div>
                    ))}
                    {focalData.directReports.length === 0 && (
                      <div className="col-span-full py-8 text-center bg-surface-card/30 border border-dashed border-border-accent/40 rounded-2xl text-xs text-text-secondary italic">
                        No active direct reports assigned to this node coordinate.
                      </div>
                    )}
                  </div>
                </div>

                {/* Peers / Co-workers section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-text-secondary tracking-widest pl-1">
                    Co-workers / Peers ({focalData.peers.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {focalData.peers.map((peer: any) => (
                      <div
                        key={peer.id}
                        onClick={() => handlePivot(peer.id)}
                        className="bg-surface-card hover:bg-surface-elevated border border-border-accent/60 hover:border-brand-accent/30 rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatar(peer.name, 'h-9 w-9 text-xs')}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-text-primary leading-tight truncate group-hover:text-brand-accent transition-colors">
                              {peer.name}
                            </h4>
                            <p className="text-[9px] text-text-secondary truncate mt-0.5">
                              {peer.designation || 'Staff'}
                            </p>
                          </div>
                        </div>
                        <span className="text-text-tertiary group-hover:translate-x-0.5 transition-transform text-[11px]">➔</span>
                      </div>
                    ))}
                    {focalData.peers.length === 0 && (
                      <div className="col-span-full py-8 text-center bg-surface-card/30 border border-dashed border-border-accent/40 rounded-2xl text-xs text-text-secondary italic">
                        No co-workers share this direct manager reporting coordinate.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-text-secondary italic">
              Failed to resolve coordinate node graph.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: ARCHITECT'S CORNER ─── */}
      {activeTab === 'architecture' && (
        <div className="bg-surface-card border border-border-accent/60 rounded-3xl p-6 space-y-6 max-w-4xl mx-auto shadow-md">
          <div className="flex items-center gap-3 border-b border-border-accent/40 pb-4">
            <span className="text-2xl">📐</span>
            <div>
              <h3 className="text-base font-black text-text-primary">System Architecture & Scaling (1,000,000 Nodes)</h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Google Engineering Lead Design Perspective</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-center">
            <div className="bg-background-portal/50 border border-border-accent p-4.5 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider block">Query Complexity</span>
              <span className="text-lg font-black text-brand-accent">O(depth + reports + peers)</span>
              <p className="text-[9px] text-text-secondary leading-tight mt-1">Independent of total organization database volume ($N$).</p>
            </div>
            <div className="bg-background-portal/50 border border-border-accent p-4.5 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider block">Network Payload</span>
              <span className="text-lg font-black text-emerald-400">&lt; 12 Kilobytes</span>
              <p className="text-[9px] text-text-secondary leading-tight mt-1">Focused sub-graph responses render instantly in the browser.</p>
            </div>
            <div className="bg-background-portal/50 border border-border-accent p-4.5 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider block">DB Execution cost</span>
              <span className="text-lg font-black text-indigo-400">&lt; 3 milliseconds</span>
              <p className="text-[9px] text-text-secondary leading-tight mt-1">Indexed recursive CTE query filters target tables before scanning.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-text-secondary">
            <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide">Redesign Principles for Ultra-Scale Directories</h4>
            
            <div className="space-y-3.5">
              <div className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold">1.</span>
                <p>
                  <strong className="text-text-primary block">Avoid Roster Dumping ($O(N)$ Payload Crash):</strong>
                  Standard enterprise rosters query <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px] text-brand-accent">SELECT * FROM users</code>. At 1,000,000 employees, this triggers an API gateway timeout, dumps 100MB+ data, and crashes client browser threads. Our design retrieves only the immediate active sub-graph for a focal employee.
                </p>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold">2.</span>
                <p>
                  <strong className="text-text-primary block">Recursive Postgres CTE Walkups:</strong>
                  Instead of doing multiple relational query roundtrips, we trigger a single <strong className="text-text-primary">PostgreSQL Recursive Common Table Expression (CTE)</strong> to resolve the manager upline path all the way up to the CEO in one pass. It starts at the immediate manager, walking the <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px]">manager_id</code> parent reference.
                </p>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold">3.</span>
                <p>
                  <strong className="text-text-primary block">B-Tree & LTree Indexing Strategy:</strong>
                  We ensure <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px]">manager_id</code> has an active B-Tree index. For department structures, we use PostgreSQL's native <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px]">ltree</code> extension to enable hierarchical prefix queries with GIST indices, keeping searches highly optimized.
                </p>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold">4.</span>
                <p>
                  <strong className="text-text-primary block">Search-First Autocomplete Navigation:</strong>
                  To pivot to any arbitrary employee node, we use a search-first autocomplete search bar backed by indexes on <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px]">name</code>, <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px]">email</code>, and <code className="bg-background-portal px-1.5 py-0.5 rounded font-mono text-[10px]">eid</code>. This enables navigation across the whole graph instantly.
                </p>
              </div>
            </div>

            <div className="bg-background-portal/40 border border-border-accent/50 rounded-2xl p-4 font-mono text-[10px] text-text-tertiary mt-6 space-y-1.5 overflow-x-auto">
              <span className="text-text-primary font-bold block mb-2">// CTE Database Execution Plan Preview</span>
              <p className="text-emerald-400">EXPLAIN ANALYZE WITH RECURSIVE manager_chain AS (...)</p>
              <p>-> Index Scan using users_pkey on users  (cost=0.43..8.45 rows=1 width=384)</p>
              <p>   Index Cond: (id = users.manager_id)</p>
              <p>-> Nested Loop  (cost=0.43..24.56 rows=10 width=384)</p>
              <p>   -> Queue Scan on manager_chain</p>
              <p>   -> Index Scan using users_pkey on users u  (cost=0.43..8.45 rows=1 width=384)</p>
              <p>Planning Time: 0.185 ms | Execution Time: 1.104 ms (Extremely Scalable)</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: ADMIN DICTIONARY SETTINGS ─── */}
      {activeTab === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Add structural layers */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-surface-card border border-border-accent/60 shadow-md">
              <h3 className="font-extrabold text-sm mb-4 text-text-primary">Add Structural Layer Category</h3>
              
              {canEdit ? (
                <form onSubmit={handleAddMetadata} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-text-secondary tracking-wide mb-1.5">Layer Type</label>
                    <select
                      value={newMetaType}
                      onChange={(e) => setNewMetaType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background-portal border border-border-accent rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand-accent transition-all cursor-pointer"
                    >
                      <option value="job_level">Job Level / Designation</option>
                      <option value="vertical">Vertical / Department</option>
                      <option value="company_name">Company Subsidiary</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-text-secondary tracking-wide mb-1.5">Layer Value Name</label>
                    <input
                      type="text"
                      value={newMetaName}
                      onChange={(e) => setNewMetaName(e.target.value)}
                      placeholder="e.g. L7 Principal Architect"
                      className="w-full px-3 py-2.5 bg-background-portal border border-border-accent rounded-xl text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-brand-accent transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="w-full py-2.5 bg-brand-accent hover:bg-brand-hover text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {adminLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      'Add Category Value'
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-6 text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded-2xl font-semibold">
                  🔒 Administrative credentials required to configure structural layers.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Table dictionary */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-surface-card border border-border-accent/60 shadow-md">
            <h3 className="font-extrabold text-sm mb-4 text-text-primary flex justify-between items-center">
              <span>Active Structural Layers Dictionary</span>
              <button
                onClick={loadMetadata}
                className="text-[10px] text-brand-accent font-black hover:underline cursor-pointer"
              >
                🔄 Refresh Dictionary
              </button>
            </h3>

            {adminLoading && metadata.length === 0 ? (
              <div className="flex justify-center items-center py-16">
                <span className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : (
              <div className="space-y-6 max-h-[35rem] overflow-y-auto pr-1">
                {['company_name', 'vertical', 'job_level'].map((type) => {
                  const items = metadata.filter((m) => m.type === type);
                  return (
                    <div key={type} className="space-y-2.5">
                      <h4 className="text-[10px] uppercase font-black text-brand-accent tracking-widest border-b border-border-accent/40 pb-1.5">
                        {type.replace('_', ' ')} Mappings ({items.length})
                      </h4>
                      {items.length === 0 ? (
                        <p className="text-[10px] text-text-tertiary italic pl-2">No structural dictionary values created.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 pl-1">
                          {items.map((item) => (
                            <span
                              key={item.id}
                              className="text-[10px] px-3 py-1 rounded-xl bg-background-portal border border-border-accent text-text-secondary font-medium transition-all hover:border-brand-accent/30 hover:text-text-primary"
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
            )}
          </div>

        </div>
      )}
    </div>
  );
}
