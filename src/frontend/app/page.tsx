'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminPanel from './components/AdminPanel';
import SettingsPanel from './components/SettingsPanel';
import { OrgCanvas, OrgCanvasRef } from './components/OrgCanvas';

export default function DashboardPage() {
  const router = useRouter();

  // Settings & App States
  const [session, setSession] = useState<any>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [theme, setTheme] = useState('default');
  const [font, setFont] = useState('default');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [activeTab, setActiveTab] = useState<'canvas' | 'dashboard' | 'users' | 'metadata' | 'access' | 'database' | 'logs' | 'settings' | 'apps'>('dashboard');
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDebugDock, setShowDebugDock] = useState(false);

  // Database / User / Metadata Lists
  const [users, setUsers] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [simulatedRole, setSimulatedRole] = useState('super_admin');

  // Canvas Ref (decoupled states are managed internally inside OrgCanvas component)
  const orgCanvasRef = useRef<OrgCanvasRef>(null);

  // Admin sub-tab navigation state
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'ingest' | 'structure' | 'logs'>('users');

  // Omni-Search (Cmd+K)
  const [omniOpen, setOmniOpen] = useState(false);
  const [omniQuery, setOmniQuery] = useState('');
  const [omniActiveIndex, setOmniActiveIndex] = useState(0);

  // Bulk Ingestion Upload States
  const [csvRawText, setCsvRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ [key: number]: string[] }>({});
  const [showErrorDrawer, setShowErrorDrawer] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  // Metadata Configurator States
  const [selectedMetaType, setSelectedMetaType] = useState<'vertical' | 'job_level'>('vertical');
  const [metaNameInput, setMetaNameInput] = useState('');
  const [metaParentInput, setMetaParentInput] = useState('');

  // SQL Workbench States
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState('');
  const [isQueryRunning, setIsQueryRunning] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    usersCount: 0,
    logsCount: 0,
    metadataCount: 0,
  });

  // Table Schemas Left Panel Details
  const tablesSchema = [
    {
      name: 'users',
      rows: stats.usersCount,
      limit: 'Unlimited',
      columns: ['id (UUID)', 'eid (VARCHAR)', 'name (VARCHAR)', 'email (VARCHAR)', 'role (VARCHAR)', 'designation_id (UUID)', 'vertical_id (UUID)', 'manager_id (UUID)'],
      indexes: ['users_pkey (id)', 'users_eid_key (eid)', 'users_email_key (email)']
    },
    {
      name: 'structural_metadata',
      rows: stats.metadataCount,
      limit: 'Unlimited',
      columns: ['id (UUID)', 'type (VARCHAR)', 'name (VARCHAR)', 'parent_id (UUID)', 'sort_order (INT)', 'extended_attributes (JSONB)'],
      indexes: ['structural_metadata_pkey (id)']
    },
    {
      name: 'system_logs',
      rows: stats.logsCount,
      limit: '100,000 (pruning trigger active)',
      columns: ['id (UUID)', 'user_id (UUID)', 'action (VARCHAR)', 'severity (VARCHAR)', 'payload (JSONB)', 'ip_address (VARCHAR)', 'timestamp (TIMESTAMP)'],
      indexes: ['system_logs_pkey (id)']
    }
  ];

  // 1. Initial Authentication & Theme / Font setup
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'default';
    setTheme(savedTheme);
    const savedFont = localStorage.getItem('font') || 'default';
    setFont(savedFont);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', font);
    localStorage.setItem('font', font);
  }, [font]);
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) {
          throw new Error('Unauthorized');
        }
        const data = await res.json();
        const parsed = data.session;
        if (!parsed) {
          throw new Error('No session');
        }

        // Redirect standard users to the User launchpad
        if (parsed.role === 'user') {
          router.replace('/user');
          return;
        }

        setSession(parsed);
        setSimulatedRole(parsed.role);
        setIsSessionLoading(false);

        // Auto-redirect if password not reset
        if (parsed.isPasswordChanged === false) {
          router.replace('/force-reset');
        }
      } catch (err) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        router.replace('/login');
      }
    };

    fetchSession();
  }, [router]);

  // Load Data
  const loadWorkspaceData = async () => {
    try {
      const usersRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT u.*, m.name as designation, v.name as vertical FROM users u LEFT JOIN structural_metadata m ON u.designation_id = m.id LEFT JOIN structural_metadata v ON u.vertical_id = v.id ORDER BY u.eid;' })
      });
      const usersData = await usersRes.json();
      if (usersData.rows) setUsers(usersData.rows);

      const metaRes = await fetch('/api/admin/metadata');
      const metaData = await metaRes.json();
      if (metaData.metadata) setMetadata(metaData.metadata);

      const logsCountRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT count(*)::integer FROM system_logs;' })
      });
      const logsCountData = await logsCountRes.json();

      const logsRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 200;' })
      });
      const logsData = await logsRes.json();
      if (logsData.rows) setSystemLogs(logsData.rows);

      setStats({
        usersCount: usersData.rows?.length || 0,
        logsCount: logsCountData.rows?.[0]?.count || 0,
        metadataCount: metaData.metadata?.length || 0,
      });
    } catch (e) {
      console.error('Failed to retrieve workspace datasets', e);
    }
  };

  useEffect(() => {
    if (session) {
      loadWorkspaceData();
    }
  }, [session]);

  // 2. Global Keyboard listener for Cmd+K / Ctrl+K & Cmd+D / Ctrl+D (development only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmniOpen(prev => !prev);
      }
      if (process.env.NODE_ENV === 'development' && (e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebugDock(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Tree Positions Calculation (Dynamic hierarchical drawing)
  // Proxy centering to decoupled OrgCanvas ref
  const centerCanvasOnNode = (userId: string) => {
    orgCanvasRef.current?.centerNode(userId);
  };

  // Filter Employees in Omni-search
  const filteredOmniUsers = users.filter(u => 
    u.name.toLowerCase().includes(omniQuery.toLowerCase()) || 
    u.eid.toLowerCase().includes(omniQuery.toLowerCase())
  );

  // Define flat items array for command palette keyboard navigation
  const getOmniItems = () => {
    const items: any[] = [];
    if (!omniQuery) {
      items.push({ type: 'nav', label: 'Go to Org Canvas', action: () => { setActiveTab('canvas'); setOmniOpen(false); } });
      items.push({ type: 'nav', label: 'Go to Admin Controls', action: () => { setActiveTab('dashboard'); setOmniOpen(false); } });
      items.push({ type: 'nav', label: 'Go to SQL Studio', action: () => { setActiveTab('database'); setOmniOpen(false); } });
      items.push({
        type: 'nav',
        label: 'Log Out Session',
        action: async () => {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login');
        }
      });
      ['light', 'dark', 'cyberpunk'].forEach(t => {
        items.push({ type: 'theme', label: `Theme: ${t}`, action: () => { setTheme(t); setOmniOpen(false); } });
      });
    }
    
    filteredOmniUsers.slice(0, 5).forEach(u => {
      items.push({
        type: 'user',
        label: `Employee: ${u.name} (${u.eid})`,
        user: u,
        action: () => {
          setActiveTab('canvas');
          setOmniOpen(false);
          setTimeout(() => centerCanvasOnNode(u.id), 200);
        }
      });
    });
    return items;
  };
  
  const omniItems = getOmniItems();

  useEffect(() => {
    setOmniActiveIndex(0);
  }, [omniQuery]);

  useEffect(() => {
    if (!omniOpen || omniItems.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOmniActiveIndex(prev => (prev + 1) % omniItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOmniActiveIndex(prev => (prev - 1 + omniItems.length) % omniItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (omniItems[omniActiveIndex]) {
          omniItems[omniActiveIndex].action();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [omniOpen, omniActiveIndex, omniItems]);

  // 5. Admin Bulk CSV Parser & Inline Edit Validation
  const handleCsvUpload = (text: string) => {
    setCsvRawText(text);
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const parsed: any[] = [];
    const errors: { [key: number]: string[] } = {};

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = lines[i].split(',').map(c => c.trim());
      
      const rowData: any = {};
      headers.forEach((h, index) => {
        rowData[h] = cells[index] || '';
      });

      // Validations
      const rowErrors: string[] = [];
      const eidRegex = /^E\d{4}$/;
      if (!rowData.eid || !eidRegex.test(rowData.eid)) {
        rowErrors.push('EID format invalid (Must be E followed by 4 digits)');
      }
      if (!rowData.name) {
        rowErrors.push('Name field is missing');
      }
      if (!rowData.email || !rowData.email.includes('@')) {
        rowErrors.push('Email address invalid');
      }
      if (!rowData.designation) {
        rowErrors.push('Missing Designation');
      }

      parsed.push(rowData);
      if (rowErrors.length > 0) {
        errors[i - 1] = rowErrors;
      }
    }

    setParsedRows(parsed);
    setValidationErrors(errors);
    setShowErrorDrawer(true);
  };

  // Inline Cell Editor
  const handleCellEdit = (rowIndex: number, field: string, val: string) => {
    const updated = [...parsedRows];
    updated[rowIndex][field] = val;
    setParsedRows(updated);

    // Revalidate row
    const rowData = updated[rowIndex];
    const rowErrors: string[] = [];
    const eidRegex = /^E\d{4}$/;
    if (!rowData.eid || !eidRegex.test(rowData.eid)) {
      rowErrors.push('EID format invalid (Must be E followed by 4 digits)');
    }
    if (!rowData.name) {
      rowErrors.push('Name field is missing');
    }
    if (!rowData.email || !rowData.email.includes('@')) {
      rowErrors.push('Email address invalid');
    }
    if (!rowData.designation) {
      rowErrors.push('Missing Designation');
    }

    setValidationErrors(prev => {
      const next = { ...prev };
      if (rowErrors.length > 0) {
        next[rowIndex] = rowErrors;
      } else {
        delete next[rowIndex];
      }
      return next;
    });
  };

  // Commit Parsed & Validated CSV to Database
  const handleCommitIngest = async () => {
    if (Object.keys(validationErrors).length > 0) return;
    setCommitLoading(true);
    try {
      const res = await fetch('/api/admin/bulk-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedRows })
      });
      const data = await res.json();
      if (res.ok) {
        setShowErrorDrawer(false);
        setParsedRows([]);
        setCsvRawText('');
        await loadWorkspaceData();
      } else {
        alert(data.error || 'Ingestion failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCommitLoading(false);
    }
  };

  // 6. Metadata Hierarchy updates
  const handleAddMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaNameInput) return;

    try {
      const res = await fetch('/api/admin/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedMetaType,
          name: metaNameInput,
          parentId: metaParentInput || null,
          sortOrder: metadata.filter(m => m.type === selectedMetaType).length + 1
        })
      });
      if (res.ok) {
        setMetaNameInput('');
        setMetaParentInput('');
        await loadWorkspaceData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMetadataReorder = async (id: string, direction: 'up' | 'down') => {
    const index = metadata.findIndex(m => m.id === id);
    if (index === -1) return;
    
    const targetType = metadata[index].type;
    const sameTypeList = metadata.filter(m => m.type === targetType);
    const innerIndex = sameTypeList.findIndex(m => m.id === id);
    
    let swapWith: any = null;
    if (direction === 'up' && innerIndex > 0) {
      swapWith = sameTypeList[innerIndex - 1];
    } else if (direction === 'down' && innerIndex < sameTypeList.length - 1) {
      swapWith = sameTypeList[innerIndex + 1];
    }

    if (swapWith) {
      const currentSort = metadata[index].sort_order;
      const targetSort = swapWith.sort_order;

      // Update both
      await fetch('/api/admin/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, sortOrder: targetSort })
      });

      await fetch('/api/admin/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swapWith.id, sortOrder: currentSort })
      });

      await loadWorkspaceData();
    }
  };

  // Delete metadata
  const handleMetadataDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this structure element?')) return;
    try {
      const res = await fetch(`/api/admin/metadata?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadWorkspaceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 7. SQL Query Console Executions
  const handleRunSQL = async (queryStr = sqlQuery) => {
    setIsQueryRunning(true);
    setQueryError('');
    setQueryResult(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr })
      });
      const data = await res.json();
      
      if (res.ok) {
        setQueryResult(data);
        await loadWorkspaceData();
      } else {
        setQueryError(data.error || 'Execution failed.');
      }
    } catch (err: any) {
      setQueryError(err.message || 'Error occurred.');
    } finally {
      setIsQueryRunning(false);
    }
  };

  // SQL syntax highlighter markup generator
  const highlightSQLKeywords = (code: string) => {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'DROP', 'TABLE', 'JOIN', 'LEFT', 'ON', 'LIMIT', 'ORDER', 'BY', 'ASC', 'DESC', 'AND', 'OR', 'NOT', 'NULL', 'PRIMARY', 'KEY', 'REFERENCES', 'CREATE', 'IF', 'EXISTS', 'CASCADE', 'ON CONFLICT', 'DO', 'NOTHING'];
    let highlighted = code;
    
    // Simple regex replacement (excluding tags)
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<span class="text-brand-accent font-bold">${kw.toUpperCase()}</span>`);
    });
    
    return highlighted;
  };

  // Show a premium loading screen while session is being read from cookie
  if (isSessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16]">
        <div className="flex flex-col items-center gap-4">
          <span className="p-3 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold text-xl tracking-wider shadow-lg shadow-brand-accent/20">SG</span>
          <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const startResizing = (
    e: React.MouseEvent,
    initialSize: number,
    direction: 'horizontal' | 'vertical',
    minVal: number,
    maxVal: number,
    setter: (val: number) => void
  ) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const newVal = initialSize + delta;
      setter(Math.max(minVal, Math.min(maxVal, newVal)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const companyMeta = metadata.find(m => m.type === 'company_name');
  const brandingTitle = companyMeta?.name || 'SG Forge';
  const brandingLogo = companyMeta?.extendedAttributes?.logo || '';

  return (
    <div className={`min-h-screen bg-background-portal text-text-primary transition-colors duration-200 flex overflow-hidden`}>
      
      {/* ─── LEFT SIDEBAR NAVIGATION (Unified & Resizable) ─── */}
      <aside
        className="relative bg-sidebar-bg border-r border-border-accent flex flex-col transition-all flex-shrink-0 h-screen overflow-hidden animate-fadeIn"
        style={{ width: sidebarCollapsed ? 64 : sidebarWidth }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Logo / Brand identity */}
          <div className="p-4.5 border-b border-border-accent flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-3">
              {brandingLogo ? (
                <div 
                  className="h-8 w-8 rounded-lg bg-surface-card p-1 border border-border-accent overflow-hidden flex-shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-brand-accent"
                  dangerouslySetInnerHTML={{ __html: brandingLogo }} 
                />
              ) : (
                <span className="p-2 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold text-sm tracking-wider shadow-lg shadow-brand-accent/20 flex-shrink-0">
                  {brandingTitle.substring(0, 2).toUpperCase()}
                </span>
              )}
              {!sidebarCollapsed && (
                <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-text-primary via-text-primary to-brand-accent bg-clip-text text-transparent whitespace-nowrap">
                  {brandingTitle}
                </span>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1 rounded hover:bg-background-portal text-text-secondary text-[10px]"
              >
                ◀
              </button>
            )}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="w-full py-2 hover:bg-background-portal text-text-secondary text-[10px] flex justify-center"
              >
                ▶
              </button>
            )}
          </div>

          {/* Omni Search Box */}
          <div className="p-3 border-b border-border-accent">
            {sidebarCollapsed ? (
              <button
                onClick={() => setOmniOpen(true)}
                className="w-10 h-10 rounded-xl hover:bg-background-portal border border-border-accent/40 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all mx-auto"
                title="Search (⌘K)"
              >
                🔍
              </button>
            ) : (
              <button
                onClick={() => setOmniOpen(true)}
                className="w-full flex items-center justify-between bg-background-portal border border-border-accent hover:border-brand-accent/40 rounded-xl px-3 py-2 text-[11px] text-text-secondary hover:text-text-primary transition-all"
              >
                <div className="flex items-center gap-2">
                  <span>🔍</span>
                  <span className="font-medium">Search...</span>
                </div>
                <kbd className="bg-surface-card px-1.5 py-0.5 rounded border border-border-accent text-[9px] font-sans font-semibold tracking-widest text-text-primary">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'users', label: 'Users & Ingest', icon: '👥' },
              {
                id: 'metadata_group',
                label: 'Metadata/Org',
                icon: '🪢',
                subItems: [
                  { id: 'metadata', label: 'Hierarchy Blueprint', icon: '🌳' },
                  { id: 'canvas', label: 'Semantic Canvas', icon: '🌐' }
                ]
              },
              { id: 'access', label: 'Access Control', icon: '🔐' },
              { id: 'database', label: 'DB Terminal', icon: '🗄️' },
              { id: 'logs', label: 'Audit Logs', icon: '📜' },
              { id: 'apps', label: 'App Registry', icon: '🔌' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map(item => {
              if (item.subItems) {
                return (
                  <div key={item.id} className="space-y-0.5 pt-2">
                    {!sidebarCollapsed && (
                      <div className="px-3 py-1 text-[9px] text-text-tertiary font-black uppercase tracking-wider">
                        {item.label}
                      </div>
                    )}
                    {item.subItems.map(subItem => (
                      <button
                        key={subItem.id}
                        onClick={() => setActiveTab(subItem.id as any)}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                          activeTab === subItem.id
                            ? 'bg-sidebar-active text-sidebar-text-active shadow-sm font-black'
                            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
                        }`}
                        title={subItem.label}
                      >
                        <span className="text-sm">{subItem.icon}</span>
                        {!sidebarCollapsed && <span className="truncate">{subItem.label}</span>}
                      </button>
                    ))}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                    activeTab === item.id
                      ? 'bg-sidebar-active text-sidebar-text-active shadow-sm font-black'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
                  }`}
                  title={item.label}
                >
                  <span className="text-sm">{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Bottom Sidebar Tools */}
          <div className="p-3 border-t border-border-accent bg-surface-card/10 space-y-3">
            
            {/* Theme Toggle icon */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const themes = ['default', 'light', 'dark', 'solarized-dark', 'solarized-light'];
                  const currentIndex = themes.indexOf(theme);
                  const nextTheme = themes[currentIndex !== -1 ? (currentIndex + 1) % themes.length : 0];
                  setTheme(nextTheme);
                }}
                className="p-2 rounded-xl hover:bg-background-portal border border-border-accent/40 text-text-secondary hover:text-text-primary transition-all flex items-center gap-2 text-xs font-bold w-full justify-center"
                title="Cycle UI Theme"
              >
                <span>{
                  theme === 'light' ? '☀️' :
                  theme === 'solarized-dark' ? '🕶️' :
                  theme === 'solarized-light' ? '📄' :
                  theme === 'dark' ? '🌙' : '✨'
                }</span>
                {!sidebarCollapsed && <span className="capitalize">{theme}</span>}
              </button>
            </div>

            {/* Profile badge + Logout */}
            {session && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-background-portal/50 border border-border-accent/40">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs flex-shrink-0">
                    {session.name.charAt(0)}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-black truncate text-text-primary leading-tight">{session.name}</p>
                      <p className="text-[8px] text-text-secondary uppercase tracking-widest font-semibold mt-0.5">{session.role}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                    router.push('/login');
                  }}
                  className="p-1.5 hover:bg-background-portal rounded-lg text-warning hover:scale-105 transition-all flex-shrink-0"
                  title="Log Out"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Resizer Handle */}
        {!sidebarCollapsed && (
          <div
            className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
            onMouseDown={(e) => startResizing(e, sidebarWidth, 'horizontal', 180, 400, setSidebarWidth)}
          />
        )}
      </aside>

      {/* ─── MAIN WORKSPACE CANVAS (Native Full Height, Overflow Clean) ─── */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col relative bg-background-portal">
        
        {/* Tab 1: Semantic Canvas */}
        {activeTab === 'canvas' && (
          <OrgCanvas
            ref={orgCanvasRef}
            users={users}
            metadata={metadata}
            session={session}
          />
        )}

        {/* Tab 2: Premium Admin Command Center Modules */}
        {['dashboard', 'users', 'metadata', 'access', 'database', 'logs', 'apps'].includes(activeTab) && (simulatedRole === 'super_admin' || simulatedRole === 'admin' || simulatedRole === 'read_only_admin') && (
          <AdminPanel
            session={session}
            users={users}
            metadata={metadata}
            systemLogs={systemLogs}
            simulatedRole={simulatedRole}
            loadWorkspaceData={loadWorkspaceData}
            csvRawText={csvRawText}
            parsedRows={parsedRows}
            validationErrors={validationErrors}
            showErrorDrawer={showErrorDrawer}
            commitLoading={commitLoading}
            setCsvRawText={setCsvRawText}
            handleCsvUpload={handleCsvUpload}
            handleCellEdit={handleCellEdit}
            handleCommitIngest={handleCommitIngest}
            setParsedRows={setParsedRows}
            setShowErrorDrawer={setShowErrorDrawer}
            selectedMetaType={selectedMetaType}
            metaNameInput={metaNameInput}
            metaParentInput={metaParentInput}
            setSelectedMetaType={setSelectedMetaType}
            setMetaNameInput={setMetaNameInput}
            setMetaParentInput={setMetaParentInput}
            handleAddMetadata={handleAddMetadata}
            handleMetadataReorder={handleMetadataReorder}
            handleMetadataDelete={handleMetadataDelete}
            sub={activeTab as any}
            onSubChange={(v) => setActiveTab(v)}
            hideSidebar={true}
          />
        )}

        {/* Tab 3: Settings Page */}
        {activeTab === 'settings' && (
          <SettingsPanel
            session={session}
            users={users}
            metadata={metadata}
            theme={theme}
            setTheme={setTheme}
            density={density}
            setDensity={setDensity}
            simulatedRole={simulatedRole}
            loadWorkspaceData={loadWorkspaceData}
            font={font}
            setFont={setFont}
          />
        )}

      </main>

      {/* ─── FLOATING DEBUG DOCK (Ctrl + D) ─── */}
      {process.env.NODE_ENV === 'development' && showDebugDock && (
        <div className="fixed bottom-6 right-20 z-50 p-4 bg-surface-elevated border-2 border-brand-accent/50 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[200px] animate-fadeIn">
          <div className="flex items-center justify-between border-b border-border-accent pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-accent">Developer Sandbox Dock</span>
            <button onClick={() => setShowDebugDock(false)} className="text-[9px] hover:text-brand-accent font-bold">✕</button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-text-secondary">Simulated Local Role:</label>
            <select
              value={simulatedRole}
              onChange={(e) => setSimulatedRole(e.target.value)}
              className="px-2 py-1.5 bg-input-bg border border-input-border rounded-lg text-xs font-bold text-text-primary focus:outline-none focus:border-brand-accent cursor-pointer"
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="read_only_admin">Read-Only Admin</option>
              <option value="user">Standard User</option>
            </select>
          </div>
          <span className="text-[8px] text-text-tertiary italic text-center">Toggle debug mode using Ctrl + D</span>
        </div>
      )}
      {/* 3. Global Command Omni-Search Backdrop Modal (Cmd+K) */}
      {omniOpen && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all">
            
            {/* Search Input */}
            <div className="p-6 border-b border-border-accent/40 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={omniQuery}
                onChange={(e) => setOmniQuery(e.target.value)}
                placeholder="Type to search page settings, navigation, or employees..."
                className="flex-1 bg-transparent text-text-primary placeholder-text-secondary focus:outline-none font-bold text-base"
                autoFocus
              />
              <button
                onClick={() => setOmniOpen(false)}
                className="px-2 py-1 rounded hover:bg-background-portal text-[10px] border border-border-accent text-text-secondary uppercase font-semibold"
              >
                Esc
              </button>
            </div>

            {/* Suggestions list */}
            <div className="p-6 max-h-[350px] overflow-y-auto space-y-6">
              
              {/* Navigation Options */}
              {!omniQuery && (
                <div className="space-y-2">
                  <span className="text-[10px] text-text-secondary font-black uppercase tracking-wider block">Application Navigation</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setActiveTab('canvas'); setOmniOpen(false); }}
                      className={`p-3 bg-background-portal border rounded-xl text-left text-xs font-bold transition-all ${
                        omniActiveIndex === 0 ? 'border-brand-accent bg-surface-elevated ring-1 ring-brand-accent/50' : 'border-border-accent'
                      }`}
                    >
                      🌐 Go to Org Canvas
                    </button>
                    <button
                      onClick={() => { setActiveTab('dashboard'); setOmniOpen(false); }}
                      className={`p-3 bg-background-portal border rounded-xl text-left text-xs font-bold transition-all ${
                        omniActiveIndex === 1 ? 'border-brand-accent bg-surface-elevated ring-1 ring-brand-accent/50' : 'border-border-accent'
                      }`}
                    >
                      🛠️ Go to Admin Controls
                    </button>
                    <button
                      onClick={() => { setActiveTab('database'); setOmniOpen(false); }}
                      className={`p-3 bg-background-portal border rounded-xl text-left text-xs font-bold transition-all ${
                        omniActiveIndex === 2 ? 'border-brand-accent bg-surface-elevated ring-1 ring-brand-accent/50' : 'border-border-accent'
                      }`}
                    >
                      💻 Go to SQL Studio
                    </button>
                    <button
                      onClick={async () => {
                        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                        router.push('/login');
                      }}
                      className={`p-3 bg-background-portal border rounded-xl text-left text-xs font-bold text-warning transition-all ${
                        omniActiveIndex === 3 ? 'border-warning bg-surface-elevated ring-1 ring-warning/50' : 'border-border-accent'
                      }`}
                    >
                      🚪 Log Out Session
                    </button>
                  </div>
                </div>
              )}

              {/* Theme Settings shortcuts */}
              {!omniQuery && (
                <div className="space-y-2">
                  <span className="text-[10px] text-text-secondary font-black uppercase tracking-wider block">Theme Shortcuts</span>
                  <div className="flex gap-2">
                    {['light', 'dark', 'cyberpunk'].map((t, idx) => (
                      <button
                        key={t}
                        onClick={() => { setTheme(t); setOmniOpen(false); }}
                        className={`px-4 py-2 bg-background-portal border rounded-xl text-xs font-bold capitalize transition-all ${
                          omniActiveIndex === 4 + idx ? 'border-brand-accent bg-surface-elevated ring-1 ring-brand-accent/50' : 'border-border-accent'
                        }`}
                      >
                        {t} mode
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Employee Directory Results */}
              <div className="space-y-2">
                <span className="text-[10px] text-text-secondary font-black uppercase tracking-wider block">
                  {omniQuery ? 'Employee Search Results' : 'Quick Employee Finder'}
                </span>
                
                <div className="space-y-2">
                  {filteredOmniUsers.slice(0, 5).map((u, idx) => {
                    const itemIdx = omniQuery ? idx : 7 + idx;
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setActiveTab('canvas');
                          setOmniOpen(false);
                          // Delay centering slightly so canvas can render/mount if tab changes
                          setTimeout(() => centerCanvasOnNode(u.id), 200);
                        }}
                        className={`p-3 bg-background-portal border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                          omniActiveIndex === itemIdx ? 'border-brand-accent bg-surface-elevated ring-1 ring-brand-accent/50' : 'border-border-accent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-primary">{u.name}</p>
                            <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5">{u.designation || 'Staff Member'}</p>
                          </div>
                        </div>

                        <div className="text-right text-[10px] text-text-secondary font-bold font-mono">
                          <span>{u.eid}</span>
                        </div>
                      </div>
                    );
                  })}

                  {filteredOmniUsers.length === 0 && (
                    <p className="text-xs text-text-secondary italic">No employees match "{omniQuery}"</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
