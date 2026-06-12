'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminPanel from './components/AdminPanel';
import SettingsPanel from './components/SettingsPanel';

export default function DashboardPage() {
  const router = useRouter();

  // Settings & App States
  const [session, setSession] = useState<any>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [activeTab, setActiveTab] = useState<'canvas' | 'dashboard' | 'users' | 'metadata' | 'access' | 'database' | 'logs' | 'settings'>('dashboard');
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDebugDock, setShowDebugDock] = useState(false);

  // Database / User / Metadata Lists
  const [users, setUsers] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [simulatedRole, setSimulatedRole] = useState('super_admin');

  // Canvas States
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [highlightedUserPath, setHighlightedUserPath] = useState<string[]>([]);
  const [selectedUserNode, setSelectedUserNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Admin sub-tab navigation state
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'ingest' | 'structure' | 'logs'>('users');

  // Omni-Search (Cmd+K)
  const [omniOpen, setOmniOpen] = useState(false);
  const [omniQuery, setOmniQuery] = useState('');

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

  // 1. Initial Authentication & Theme setup
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Read session cookie
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('session_token='));
    if (sessionCookie) {
      try {
        // Cookie is base64url encoded (no +, /, = chars) - restore standard base64
        const b64url = sessionCookie.trim().substring('session_token='.length);
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
        const parsed = JSON.parse(atob(padded));
        setSession(parsed);
        setSimulatedRole(parsed.role);
        setIsSessionLoading(false);

        // Auto-redirect if password not reset
        if (parsed.isPasswordChanged === false) {
          router.replace('/force-reset');
        }
      } catch (err) {
        // Clear corrupt cookie and redirect to login
        document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.replace('/login');
      }
    } else {
      router.replace('/login');
    }
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

  // 2. Global Keyboard listener for Cmd+K / Ctrl+K & Cmd+D / Ctrl+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmniOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebugDock(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Tree Positions Calculation (Dynamic hierarchical drawing)
  const computePositions = () => {
    const spacingX = 280;
    const spacingY = 220;
    const positions: { [key: string]: { x: number; y: number } } = {};
    const childrenMap: { [key: string]: string[] } = {};

    // Group children by manager
    users.forEach(u => {
      if (u.manager_id) {
        if (!childrenMap[u.manager_id]) childrenMap[u.manager_id] = [];
        childrenMap[u.manager_id].push(u.id);
      }
    });

    // Roots are users whose manager_id is null or not in the user list
    const roots = users.filter(u => !u.manager_id || !users.some(parent => parent.id === u.manager_id));

    let nextX = 0;

    const traverse = (nodeId: string, depth: number): number => {
      const children = childrenMap[nodeId] || [];
      const childrenX: number[] = [];

      children.forEach(childId => {
        childrenX.push(traverse(childId, depth + 1));
      });

      let x = 0;
      if (children.length > 0) {
        const minX = Math.min(...childrenX);
        const maxX = Math.max(...childrenX);
        x = (minX + maxX) / 2;
      } else {
        x = nextX;
        nextX += spacingX;
      }

      positions[nodeId] = { x, y: depth * spacingY };
      return x;
    };

    roots.forEach(r => {
      traverse(r.id, 0);
      nextX += spacingX; // Space out disjoint trees
    });

    return positions;
  };

  const nodePositions = computePositions();

  // Find User Reporting Line Path to C-suite
  const highlightReportingLine = (userId: string) => {
    const path: string[] = [];
    let currentId: string | null = userId;
    
    while (currentId) {
      path.push(currentId);
      const currentUser = users.find(u => u.id === currentId);
      currentId = currentUser ? currentUser.manager_id : null;
    }
    setHighlightedUserPath(path);
  };

  // Center Canvas on specific User
  const centerCanvasOnNode = (userId: string) => {
    const pos = nodePositions[userId];
    if (pos && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newPanX = rect.width / 2 - pos.x * 1.5;
      const newPanY = rect.height / 2 - pos.y * 1.5;
      setZoom(1.5); // Micro Level
      setPan({ x: newPanX, y: newPanY });
      setSelectedUserNode(userId);
      highlightReportingLine(userId);
    }
  };

  const handleWhereAmI = () => {
    if (session) {
      const currentUser = users.find(u => u.email.toLowerCase() === session.email.toLowerCase());
      if (currentUser) {
        centerCanvasOnNode(currentUser.id);
      }
    }
  };

  // 4. Canvas Mouse Panning & Zooming handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler — attached imperatively with { passive: false } to allow preventDefault
  // React's synthetic onWheel is passive by default in modern browsers and cannot call preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      setZoom(prev => e.deltaY < 0
        ? Math.min(prev * zoomFactor, 2.5)
        : Math.max(prev / zoomFactor, 0.4)
      );
    };
    // { passive: false } is required to allow preventDefault inside the wheel handler
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

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

  // Filter Employees in Omni-search
  const filteredOmniUsers = users.filter(u => 
    u.name.toLowerCase().includes(omniQuery.toLowerCase()) || 
    u.eid.toLowerCase().includes(omniQuery.toLowerCase())
  );

  // Show a premium loading screen while session is being read from cookie
  if (isSessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16]">
        <div className="flex flex-col items-center gap-4">
          <span className="p-3 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold text-xl tracking-wider shadow-lg shadow-brand-accent/20">AC</span>
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
              <span className="p-2 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold text-sm tracking-wider shadow-lg shadow-brand-accent/20 flex-shrink-0">
                AC
              </span>
              {!sidebarCollapsed && (
                <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-text-primary via-text-primary to-brand-accent bg-clip-text text-transparent whitespace-nowrap">
                  Acme Corp
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
                  const themes = ['dark', 'cyberpunk', 'forest', 'sunset', 'ocean', 'midnight', 'light'];
                  const currentIndex = themes.indexOf(theme);
                  const nextTheme = themes[(currentIndex + 1) % themes.length];
                  setTheme(nextTheme);
                }}
                className="p-2 rounded-xl hover:bg-background-portal border border-border-accent/40 text-text-secondary hover:text-text-primary transition-all flex items-center gap-2 text-xs font-bold w-full justify-center"
                title="Cycle UI Theme"
              >
                <span>{
                  theme === 'light' ? '☀️' :
                  theme === 'cyberpunk' ? '🌸' :
                  theme === 'forest' ? '🌿' :
                  theme === 'sunset' ? '🌅' :
                  theme === 'ocean' ? '🌊' :
                  theme === 'midnight' ? '🔮' : '🌙'
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
                  onClick={() => {
                    document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
          <div className="flex-1 flex flex-col relative overflow-hidden h-full">
            
            {/* Top Canvas Controls Panel */}
            <div className="absolute top-4 left-4 z-10 bg-surface-card/90 backdrop-blur border border-border-accent p-3 rounded-2xl shadow-xl flex items-center gap-3">
              <div className="text-xs">
                <span className="font-bold text-text-secondary mr-2">Zoom Level:</span>
                <span className="font-black text-brand-accent px-2 py-0.5 bg-background-portal border border-border-accent rounded">
                  {zoom < 0.8 ? 'Macro (Verticals)' : zoom < 1.4 ? 'Meso (Managers)' : 'Micro (Cards)'} ({Math.round(zoom * 100)}%)
                </span>
              </div>
              
              <div className="h-4 w-[1px] bg-border-accent"></div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))}
                  className="p-1.5 rounded-lg hover:bg-background-portal border border-border-accent text-text-primary transition-all font-extrabold text-sm"
                  title="Zoom In"
                >
                  ＋
                </button>
                <button
                  onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
                  className="p-1.5 rounded-lg hover:bg-background-portal border border-border-accent text-text-primary transition-all font-extrabold text-sm"
                  title="Zoom Out"
                >
                  －
                </button>
                <button
                  onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); setHighlightedUserPath([]); setSelectedUserNode(null); }}
                  className="px-2.5 py-1.5 rounded-lg hover:bg-background-portal border border-border-accent text-xs font-bold transition-all"
                  title="Reset View"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Main Interactive Zoom / Pan SVG viewport Canvas */}
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`flex-1 w-full relative outline-none select-none overflow-hidden bg-[radial-gradient(var(--border-accent)_1px,transparent_1px)] bg-[size:24px_24px] cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
            >
              <div
                className="absolute origin-top-left transition-transform duration-100 ease-out"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {/* SVG Connections Layer */}
                {zoom >= 0.8 && (
                  <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: 2000, height: 2000 }}>
                    <defs>
                      <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    
                    {users.map(u => {
                      if (!u.manager_id || !nodePositions[u.id] || !nodePositions[u.manager_id]) return null;
                      const from = nodePositions[u.manager_id];
                      const to = nodePositions[u.id];
                      
                      const isHighlighted = highlightedUserPath.includes(u.id) && highlightedUserPath.includes(u.manager_id);
                      
                      // Beautiful cubic bezier curves
                      const controlY = (from.y + to.y) / 2;
                      const d = `M ${from.x + 100} ${from.y + 60} C ${from.x + 100} ${controlY}, ${to.x + 100} ${controlY}, ${to.x + 100} ${to.y}`;

                      return (
                        <path
                          key={u.id}
                          d={d}
                          fill="none"
                          stroke={isHighlighted ? 'var(--brand-accent)' : 'var(--border-accent)'}
                          strokeWidth={isHighlighted ? 4 : 2}
                          strokeDasharray={isHighlighted ? '0' : '4 4'}
                          style={{
                            filter: isHighlighted ? 'url(#neon-glow)' : 'none',
                            opacity: highlightedUserPath.length > 0 && !isHighlighted ? 0.25 : 1.0,
                          }}
                          className="transition-all duration-300"
                        />
                      );
                    })}
                  </svg>
                )}

                {/* ZOOM LEVEL 1: MACRO VIEW */}
                {zoom < 0.8 && (
                  <div className="absolute grid grid-cols-2 gap-12 p-24 w-[1200px]" style={{ left: 100, top: 100 }}>
                    {metadata.filter(m => m.type === 'vertical').map(v => {
                      const deptUsers = users.filter(u => u.vertical_id === v.id);
                      return (
                        <div
                          key={v.id}
                          className="p-8 rounded-3xl bg-surface-card border-2 border-border-accent shadow-2xl hover:border-brand-accent transition-all duration-300 transform hover:scale-[1.02]"
                        >
                          <div className="flex items-center justify-between mb-4 border-b border-border-accent pb-4">
                            <h2 className="text-2xl font-black text-brand-accent">{v.name} Department</h2>
                            <span className="px-3.5 py-1 bg-brand-accent/10 border border-brand-accent/20 rounded-full text-xs font-bold text-brand-accent">
                              {deptUsers.length} Members
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-2">
                            {deptUsers.map(du => (
                              <div key={du.id} className="p-3 bg-background-portal rounded-xl border border-border-accent flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-[10px] uppercase">
                                  {du.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold truncate">{du.name}</p>
                                  <p className="text-[10px] text-text-secondary truncate">{du.designation || 'Specialist'}</p>
                                </div>
                              </div>
                            ))}
                            {deptUsers.length === 0 && (
                              <p className="text-xs text-text-secondary italic">No active structural assignments in this vertical</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ZOOM LEVEL 2: MESO VIEW */}
                {zoom >= 0.8 && zoom < 1.4 && (
                  <div className="absolute" style={{ left: 0, top: 0 }}>
                    {users.map(u => {
                      const pos = nodePositions[u.id];
                      if (!pos) return null;

                      const isHighlighted = highlightedUserPath.includes(u.id);
                      const isSelected = selectedUserNode === u.id;

                      return (
                        <div
                          key={u.id}
                          onClick={() => { setSelectedUserNode(u.id); highlightReportingLine(u.id); }}
                          className={`absolute p-4 rounded-2xl bg-surface-card border-2 shadow-lg cursor-pointer transition-all duration-300 w-[200px] hover:border-brand-accent ${
                            isSelected ? 'border-success scale-105 shadow-success/25' : isHighlighted ? 'border-brand-accent' : 'border-border-accent'
                          }`}
                          style={{
                            left: pos.x,
                            top: pos.y,
                            opacity: highlightedUserPath.length > 0 && !isHighlighted ? 0.4 : 1.0,
                          }}
                        >
                          <p className="text-xs font-bold truncate text-text-primary">{u.name}</p>
                          <p className="text-[10px] truncate text-brand-accent font-semibold">{u.designation || 'Specialist'}</p>
                          <div className="mt-2 flex items-center justify-between text-[8px] text-text-secondary uppercase font-semibold">
                            <span>{u.eid}</span>
                            <span>{u.vertical || 'Acme'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ZOOM LEVEL 3: MICRO VIEW */}
                {zoom >= 1.4 && (
                  <div className="absolute" style={{ left: 0, top: 0 }}>
                    {users.map(u => {
                      const pos = nodePositions[u.id];
                      if (!pos) return null;

                      const isHighlighted = highlightedUserPath.includes(u.id);
                      const isSelected = selectedUserNode === u.id;

                      return (
                        <div
                          key={u.id}
                          onClick={() => { setSelectedUserNode(u.id); highlightReportingLine(u.id); }}
                          className={`absolute p-5 rounded-2xl bg-surface-card border-2 shadow-2xl cursor-pointer transition-all duration-300 w-[240px] flex gap-4 ${
                            isSelected ? 'border-success scale-105 shadow-success/20 ring-4 ring-success/20' : isHighlighted ? 'border-brand-accent shadow-brand-accent/20 ring-2 ring-brand-accent/20' : 'border-border-accent'
                          }`}
                          style={{
                            left: pos.x,
                            top: pos.y,
                            opacity: highlightedUserPath.length > 0 && !isHighlighted ? 0.3 : 1.0,
                          }}
                        >
                          <div className="relative flex-shrink-0">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-accent to-success flex items-center justify-center text-white text-base font-extrabold shadow-inner">
                              {u.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-success rounded-full border-2 border-surface-card animate-pulse shadow-md"></span>
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="text-sm font-black truncate text-text-primary leading-tight">{u.name}</h4>
                              <p className="text-[10px] text-brand-accent font-extrabold uppercase tracking-wide truncate mt-0.5">{u.designation || 'Staff Member'}</p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-accent/40 text-[9px] text-text-secondary font-bold uppercase tracking-wider">
                              <span>EID: {u.eid}</span>
                              <span className="px-1.5 py-0.5 bg-background-portal border border-border-accent rounded text-[8px] truncate max-w-[80px]">
                                {u.vertical || 'Corporate'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>

            <button
              onClick={handleWhereAmI}
              className="absolute bottom-6 right-6 p-4 rounded-full bg-brand-accent text-white hover:bg-brand-accent/90 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/20 z-10 flex items-center justify-center"
              title="Locate Myself and trace reporting line"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}

        {/* Tab 2: Premium Admin Command Center Modules */}
        {['dashboard', 'users', 'metadata', 'access', 'database', 'logs'].includes(activeTab) && (simulatedRole === 'super_admin' || simulatedRole === 'admin' || simulatedRole === 'read_only_admin') && (
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
          />
        )}

      </main>

      {/* ─── FLOATING DEBUG DOCK (Ctrl + D) ─── */}
      {showDebugDock && (
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
                      className="p-3 bg-background-portal border border-border-accent hover:border-brand-accent rounded-xl text-left text-xs font-bold transition-all"
                    >
                      🌐 Go to Org Canvas
                    </button>
                    <button
                      onClick={() => { setActiveTab('dashboard'); setOmniOpen(false); }}
                      className="p-3 bg-background-portal border border-border-accent hover:border-brand-accent rounded-xl text-left text-xs font-bold transition-all"
                    >
                      🛠️ Go to Admin Controls
                    </button>
                    <button
                      onClick={() => { setActiveTab('database'); setOmniOpen(false); }}
                      className="p-3 bg-background-portal border border-border-accent hover:border-brand-accent rounded-xl text-left text-xs font-bold transition-all"
                    >
                      💻 Go to SQL Studio
                    </button>
                    <button
                      onClick={() => {
                        document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                        router.push('/login');
                      }}
                      className="p-3 bg-background-portal border border-border-accent hover:border-warning rounded-xl text-left text-xs font-bold text-warning transition-all"
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
                    {['light', 'dark', 'cyberpunk'].map(t => (
                      <button
                        key={t}
                        onClick={() => { setTheme(t); setOmniOpen(false); }}
                        className="px-4 py-2 bg-background-portal border border-border-accent hover:border-brand-accent rounded-xl text-xs font-bold capitalize transition-all"
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
                  {filteredOmniUsers.slice(0, 5).map(u => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setActiveTab('canvas');
                        setOmniOpen(false);
                        // Delay centering slightly so canvas can render/mount if tab changes
                        setTimeout(() => centerCanvasOnNode(u.id), 200);
                      }}
                      className="p-3 bg-background-portal border border-border-accent hover:border-brand-accent rounded-xl flex items-center justify-between cursor-pointer transition-all"
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
                  ))}

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
