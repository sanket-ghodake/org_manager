import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Folder, Database, Terminal, FileText, Settings, 
  ShieldAlert, BarChart2, GitBranch, Play, RefreshCw, 
  X, ChevronRight, Search, ShieldCheck, LogOut, CheckCircle2,
  Clock, ArrowUpDown, ChevronDown, Check, Activity
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// Global styles loaded from variables
const themeNames: Record<string, string> = {
  'default': 'Midnight Theme',
  'light': 'Light Theme',
  'dark': 'Dark Theme',
  'solarized-dark': 'Solarized Dark',
  'solarized-light': 'Solarized Light'
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // App tabs
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'overview';
  });
  // Unit test compatibility hook
  const activeTabId = activeTab;

  // Panel sizing & state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('sidebarWidth') || '260', 10);
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  
  // DB Explorer sizing
  const [dbSidebarWidth, setDbSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('dbSidebarWidth') || '280', 10);
  });
  const [dbSidebarCollapsed, setDbSidebarCollapsed] = useState(() => {
    return localStorage.getItem('dbSidebarCollapsed') === 'true';
  });

  // UI preferences
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('devCenterTheme') || 'default';
  });
  const [compactMode, setCompactMode] = useState(() => {
    return localStorage.getItem('compactMode') === 'true';
  });

  // Telemetry stream state
  const [telemetry, setTelemetry] = useState<any>({
    docsDrift: { freshnessPercentage: 100, totalStaleFiles: 0, synchronizedRepos: 1, driftGrid: [] },
    testCoverage: { lineCoverage: 0, branchCoverage: 0, dirtyCount: 0, coverageMatrix: [] },
    workspaceTopology: { tree: [], details: {} }
  });

  // Overview status API state
  const [overviewData, setOverviewData] = useState<any>({
    tableCount: 0,
    logsCount: 0,
    lastTestRun: null,
    tables: []
  });
  const [overviewLoading, setOverviewLoading] = useState(false);

  // DB Explorer State
  const [dbTables, setDbTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedTableSchema, setSelectedTableSchema] = useState<any[]>([]);
  const [queryText, setQueryText] = useState('SELECT * FROM users LIMIT 10;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [fullscreenResults, setFullscreenResults] = useState(false);

  // System Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsSeverity, setLogsSeverity] = useState('ALL');
  const [logsAutoPoll, setLogsAutoPoll] = useState('off');
  const [expandedLogId, setExpandedLogId] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // Test Runner Console State
  const [testConsole, setTestConsole] = useState('Waiting to trigger testing execution pipeline...');
  const [runningTests, setRunningTests] = useState(false);
  const [testRunTime, setTestRunTime] = useState('-');
  const [testSummaryPill, setTestSummaryPill] = useState<any>(null);

  // Modals / Overlays
  const [activeDiff, setActiveDiff] = useState<any>(null);
  const [selectedTopologyNode, setSelectedTopologyNode] = useState<string>('core');

  // Search filter for code coverage
  const [coverageSearch, setCoverageSearch] = useState('');
  const [coverageFilterLow, setCoverageFilterLow] = useState(false);

  // Dropdown States
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [pollMenuOpen, setPollMenuOpen] = useState(false);
  const [severityMenuOpen, setSeverityMenuOpen] = useState(false);
  const [queryTemplateMenuOpen, setQueryTemplateMenuOpen] = useState(false);

  // Refs for resizers
  const sidebarResizerRef = useRef<boolean>(false);
  const dbResizerRef = useRef<boolean>(false);

  // 1. Initial Authentication & Theme Check
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }

    const verifyAuth = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.status === 200) {
          setIsAuthenticated(true);
          const data = await res.json();
          setOverviewData(data);
          loadDbExplorerData();
          loadTelemetryLogs();
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error('API server unreachable.', e);
      } finally {
        setLoading(false);
      }
    };
    verifyAuth();
  }, [theme, compactMode]);

  // 2. Set up SSE connection once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const eventSource = new EventSource('/api/telemetry');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTelemetry(data);
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.warn('SSE disconnected. Reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated]);

  // 3. Tab Cache
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    if (activeTab === 'overview') {
      refreshOverview();
    }
  }, [activeTab]);

  // 4. Logs auto-polling
  useEffect(() => {
    if (!isAuthenticated || logsAutoPoll === 'off') return;
    const interval = setInterval(() => {
      if (activeTab === 'logs') {
        loadTelemetryLogs(true);
      } else if (activeTab === 'overview') {
        refreshOverview(true);
      }
    }, parseInt(logsAutoPoll, 10));

    return () => clearInterval(interval);
  }, [isAuthenticated, logsAutoPoll, activeTab, logsSearch, logsSeverity]);

  // --- Handlers & API Operations ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.status === 200) {
        setIsAuthenticated(true);
        refreshOverview();
        loadDbExplorerData();
        loadTelemetryLogs();
      } else {
        const err = await res.json();
        setAuthError(err.error || 'Authentication Failed');
      }
    } catch (e) {
      setAuthError('Connection failed to backend daemon server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setTelemetry({
        docsDrift: { freshnessPercentage: 100, totalStaleFiles: 0, synchronizedRepos: 1, driftGrid: [] },
        testCoverage: { lineCoverage: 0, branchCoverage: 0, dirtyCount: 0, coverageMatrix: [] },
        workspaceTopology: { tree: [], details: {} }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const refreshOverview = async (background = false) => {
    if (!background) setOverviewLoading(true);
    try {
      const res = await fetch('/api/status');
      if (res.status === 200) {
        const data = await res.json();
        setOverviewData(data);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadDbExplorerData = async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.status === 200) {
        const data = await res.json();
        setDbTables(data.tables || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectExplorerTable = (tableName: string) => {
    setSelectedTable(tableName);
    const tbl = dbTables.find(t => t.name === tableName);
    if (tbl) {
      setSelectedTableSchema(tbl.columns || []);
      setQueryText(`SELECT * FROM "${tableName}" LIMIT 20;`);
    }
  };

  const runQuery = async () => {
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryError('');
    setQueryResult(null);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      });
      const data = await res.json();
      if (res.status === 200) {
        setQueryResult(data);
        loadDbExplorerData(); // Reload table counts
      } else {
        setQueryError(data.error || 'SQL Query failed.');
      }
    } catch (e) {
      setQueryError('Server transmission failed.');
    } finally {
      setQueryLoading(false);
    }
  };

  const loadTelemetryLogs = async (background = false) => {
    if (!background) setLogsLoading(true);
    try {
      const url = new URL('/api/logs', window.location.origin);
      if (logsSearch) url.searchParams.append('search', logsSearch);
      if (logsSeverity !== 'ALL') url.searchParams.append('severity', logsSeverity);

      const res = await fetch(url.toString());
      if (res.status === 200) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  // Debounced search for logs
  const timer = useRef<any>(null);
  const handleLogsSearchChange = (val: string) => {
    setLogsSearch(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      loadTelemetryLogs();
    }, 400);
  };

  const triggerTestPipeline = async () => {
    setRunningTests(true);
    setTestConsole('Executing test suites... checking structural coverage profiles...\n\n');
    setTestSummaryPill(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/run-tests', { method: 'POST' });
      const data = await res.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      setTestRunTime(`Completed in ${elapsed}s`);
      setTestConsole(data.rawOutput || 'No output received.');
      setTestSummaryPill({ passed: data.passed, failed: data.failed });
      refreshOverview();
    } catch (e) {
      setTestConsole('Test runner communication error.');
    } finally {
      setRunningTests(false);
    }
  };

  const viewDiff = async (codePath: string, docPath: string) => {
    try {
      const res = await fetch(`/api/diff?codePath=${encodeURIComponent(codePath)}&docPath=${encodeURIComponent(docPath)}`);
      const data = await res.json();
      setActiveDiff({ codePath, docPath, diff: data.diff });
    } catch (e) {
      console.error('Failed to retrieve drift diff details.');
    }
  };

  // Resizing Logic: Sidebar
  const initSidebarDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizerRef.current = true;
    document.addEventListener('mousemove', handleSidebarDrag);
    document.addEventListener('mouseup', stopSidebarDrag);
  };

  const handleSidebarDrag = (e: MouseEvent) => {
    if (!sidebarResizerRef.current) return;
    let newWidth = e.clientX;
    if (newWidth < 160) newWidth = 160;
    if (newWidth > 450) newWidth = 450;
    setSidebarWidth(newWidth);
    localStorage.setItem('sidebarWidth', newWidth.toString());
  };

  const stopSidebarDrag = () => {
    sidebarResizerRef.current = false;
    document.removeEventListener('mousemove', handleSidebarDrag);
    document.removeEventListener('mouseup', stopSidebarDrag);
  };

  // Resizing Logic: DB Sidebar
  const initDbDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dbResizerRef.current = true;
    document.addEventListener('mousemove', handleDbDrag);
    document.addEventListener('mouseup', stopDbDrag);
  };

  const handleDbDrag = (e: MouseEvent) => {
    if (!dbResizerRef.current) return;
    const parentLeft = document.getElementById('dbLayout')?.getBoundingClientRect().left || 0;
    let newWidth = e.clientX - parentLeft;
    if (newWidth < 180) newWidth = 180;
    if (newWidth > 500) newWidth = 500;
    setDbSidebarWidth(newWidth);
    localStorage.setItem('dbSidebarWidth', newWidth.toString());
  };

  const stopDbDrag = () => {
    dbResizerRef.current = false;
    document.removeEventListener('mousemove', handleDbDrag);
    document.removeEventListener('mouseup', stopDbDrag);
  };

  // Formatting helpers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Basic HTML markdown parser
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold text-primary mt-3 mb-1">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="text-base font-bold text-primary mt-4 mb-2 border-b border-borderColor pb-1">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="text-lg font-extrabold text-white mt-6 mb-3">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
      .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="list-disc ml-5 text-xs text-textMuted py-0.5">$1</li>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-bgConsole text-textConsole p-3 rounded-lg border border-borderColor font-mono text-xs my-2 overflow-x-auto">$1</pre>')
      .replace(/`(.*?)`/g, '<code class="bg-bgConsole text-primary-hover px-1.5 py-0.5 rounded font-mono text-xs">$1</code>')
      .replace(/\n$/gim, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-xs text-textMuted leading-relaxed" />;
  };

  // Git Diff Highlighter
  const renderDiffLines = (diffText: string) => {
    if (!diffText) return <div className="text-textMuted text-xs">No difference detected. Code matches exactly.</div>;
    const lines = diffText.split('\n');
    return lines.map((line, idx) => {
      let className = 'text-textMain';
      if (line.startsWith('+')) className = 'text-green-400 bg-green-950/20 px-2 border-l-2 border-green-500 py-0.5';
      else if (line.startsWith('-')) className = 'text-red-400 bg-red-950/20 px-2 border-l-2 border-red-500 py-0.5';
      else if (line.startsWith('@@')) className = 'text-purple-400 font-bold bg-purple-950/10 px-2 py-0.5';
      else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) className = 'text-yellow-500 font-semibold bg-slate-900/40 px-2';
      
      return (
        <div key={idx} className={`font-mono text-xs py-0.5 whitespace-pre-wrap leading-relaxed ${className}`}>
          {line}
        </div>
      );
    });
  };

  // Syntax highlighting for JSON string logs payload
  const formatJSONPayload = (payload: any) => {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    return raw;
  };

  // --- Sub-View Renderers ---

  // VIEW 1: Documentation Drift View
  const renderDocsDriftView = () => {
    const driftData = telemetry.docsDrift;
    const freshness = driftData.freshnessPercentage;

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex items-center justify-between shadow-lg hover:border-borderColorGlow transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Overall Freshness</span>
              <span className="text-3xl font-extrabold text-white">{freshness}%</span>
              <span className="text-xs text-textMuted">Markdown doc synchronizations</span>
            </div>
            
            {/* Animated SVG Radial Gauge */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.03)" strokeWidth="6" fill="transparent"/>
                <circle cx="40" cy="40" r="32" 
                  stroke={freshness === 100 ? "var(--success)" : "var(--warning)"} 
                  strokeWidth="6" 
                  fill="transparent" 
                  strokeDasharray={2 * Math.PI * 32} 
                  strokeDashoffset={2 * Math.PI * 32 * (1 - freshness / 100)} 
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute font-bold text-xs">{freshness}%</div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-lg hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Total Stale Files</span>
            <span className={`text-3xl font-extrabold ${driftData.totalStaleFiles > 0 ? 'text-warning' : 'text-success'}`}>
              {driftData.totalStaleFiles}
            </span>
            <span className="text-xs text-textMuted">Code changes ahead of documentation</span>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-lg hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Synchronized Repos</span>
            <span className="text-3xl font-extrabold text-primary">{driftData.synchronizedRepos}</span>
            <span className="text-xs text-textMuted">Monorepo codebase context</span>
          </div>
        </div>

        {/* Drift Grid Table */}
        <div className="bg-bgCard border border-borderColor rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-borderColor flex justify-between items-center bg-bgTh">
            <h3 className="text-sm font-semibold text-white">Documentation Sync Index</h3>
            <span className="text-xs bg-statusPillBg border border-borderColor text-textMuted px-2 py-1 rounded">Live Watcher Engine</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bgTh/50 text-textMuted font-bold border-b border-borderColor">
                  <th className="px-6 py-3.5">Target File</th>
                  <th className="px-6 py-3.5">Mapped Documentation</th>
                  <th className="px-6 py-3.5">Synchronization Health</th>
                  <th className="px-6 py-3.5">Age Delta</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderColor">
                {driftData.driftGrid && driftData.driftGrid.map((row: any) => (
                  <tr key={row.id} className="hover:bg-tableRowHover transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-primary">{row.fileName}</td>
                    <td className="px-6 py-4 text-textMuted font-mono text-[11px]">{row.docPath}</td>
                    <td className="px-6 py-4">
                      {row.syncHealth.includes('Outdated') ? (
                        <span className="inline-flex items-center gap-1.5 bg-warningGlow border border-warning/30 text-warning px-2.5 py-1 rounded-full font-semibold">
                          <ShieldAlert size={12} />
                          ⚠️ Outdated - Documentation Drifted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-successGlow border border-success/30 text-success px-2.5 py-1 rounded-full font-semibold">
                          <ShieldCheck size={12} />
                          Synchronized
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-textMuted">
                      <span className={row.deltaSeconds > 0 ? "text-warning" : "text-success"}>
                        {row.deltaText}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => viewDiff(row.codePath, row.docPath)}
                        className="bg-primary/20 hover:bg-primary text-primary-hover hover:text-white border border-primary/30 px-3 py-1.5 rounded transition-all font-semibold"
                      >
                        View Code Delta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // VIEW 2: Test Coverage & Regression Analytics
  const renderTestCoverageView = () => {
    const coverage = telemetry.testCoverage;
    
    // Filtering logic
    const filteredMatrix = coverage.coverageMatrix.filter((item: any) => {
      const matchesSearch = item.fileName.toLowerCase().includes(coverageSearch.toLowerCase()) ||
                            item.filePath.toLowerCase().includes(coverageSearch.toLowerCase());
      const matchesLow = coverageFilterLow ? item.lineCoverage < 80 : true;
      return matchesSearch && matchesLow;
    });

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Line Coverage</span>
            <span className="text-3xl font-extrabold text-success">{coverage.lineCoverage}%</span>
            <div className="w-full bg-borderColor h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-success h-full rounded-full" style={{ width: `${coverage.lineCoverage}%` }}></div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Branch Coverage</span>
            <span className="text-3xl font-extrabold text-accent">{coverage.branchCoverage}%</span>
            <div className="w-full bg-borderColor h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-accent h-full rounded-full" style={{ width: `${coverage.branchCoverage}%` }}></div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Untested/Stale Files</span>
            <span className={`text-3xl font-extrabold ${coverage.dirtyCount > 0 ? 'text-error animate-pulse' : 'text-success'}`}>
              {coverage.dirtyCount}
            </span>
            <span className="text-xs text-textMuted">Pulsing triggers waiting verification</span>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md justify-between">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">TestSuite Runner</span>
              {testSummaryPill && (
                <div className="text-[10px] bg-statusPillBg border border-borderColor px-2 py-0.5 rounded">
                  <span className="text-success font-bold">{testSummaryPill.passed}P</span> / <span className="text-error font-bold">{testSummaryPill.failed}F</span>
                </div>
              )}
            </div>
            <button 
              onClick={triggerTestPipeline}
              disabled={runningTests}
              className="bg-primary hover:bg-primaryHover text-white px-3 py-2 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
            >
              <Play size={12} fill="white" />
              {runningTests ? 'Running Pipeline...' : 'Run Integration Pipeline'}
            </button>
          </div>
        </div>

        {/* Console & Coverage Explorer splitting */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Coverage Explorer */}
          <div className="lg:col-span-3 bg-bgCard border border-borderColor rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-borderColor bg-bgTh flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">Live Code Coverage Matrix</h3>
                <span className="text-[10px] bg-statusPillBg border border-borderColor text-textMuted px-2 py-0.5 rounded">FS Watcher Hooks Enabled</span>
              </div>
              
              {/* Search & Filter row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-grow min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 text-textMuted" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search source files..." 
                    value={coverageSearch}
                    onChange={(e) => setCoverageSearch(e.target.value)}
                    className="w-full bg-inputBg border border-borderColor rounded-lg pl-8 pr-3 py-2 text-xs text-textMain outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={() => setCoverageFilterLow(!coverageFilterLow)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${coverageFilterLow ? 'bg-errorGlow border-error text-error' : 'bg-statusPillBg border-borderColor text-textMuted'}`}
                >
                  Show &lt; 80% Coverage Only
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bgTh/30 text-textMuted font-bold border-b border-borderColor">
                    <th className="px-5 py-3">File Name</th>
                    <th className="px-5 py-3">Path</th>
                    <th className="px-5 py-3">Metrics</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderColor">
                  {filteredMatrix.map((row: any) => (
                    <tr key={row.filePath} className="hover:bg-tableRowHover transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-textMain">{row.fileName}</td>
                      <td className="px-5 py-4 font-mono text-[10px] text-textMuted">{row.filePath}</td>
                      <td className="px-5 py-4 flex flex-col gap-1 min-w-[120px]">
                        <div className="flex justify-between text-[10px]">
                          <span>Line: {row.lineCoverage}%</span>
                          <span className="text-textMuted">Branch: {row.branchCoverage}%</span>
                        </div>
                        {/* Dual colored bar */}
                        <div className="w-full bg-error h-2 rounded-full overflow-hidden flex">
                          <div className="bg-success h-full" style={{ width: `${row.lineCoverage}%` }}></div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {row.status === 'Clean' ? (
                          <span className="text-success font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-errorGlow text-error px-2 py-0.5 rounded border border-error/20 font-bold animate-pulse text-[10px]">
                            ⚡ File Modified - Coverage Stale (Run Suite)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredMatrix.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-textMuted">No source files match filter conditions.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Test Runner Console */}
          <div className="lg:col-span-2 bg-bgCard border border-borderColor rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-borderColor bg-bgTh flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-primary" />
                <span className="text-xs font-semibold text-white">TestSuite Execution Console</span>
              </div>
              <div className="text-[10px] text-textMuted font-mono">{testRunTime}</div>
            </div>
            <div className="flex-grow p-4 bg-bgConsole font-mono text-xs text-textConsole overflow-y-auto min-h-[350px] max-h-[500px] whitespace-pre-wrap leading-relaxed">
              {testConsole}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // VIEW 3: Interactive Workspace Topology Explorer
  const renderWorkspaceTopologyView = () => {
    const topology = telemetry.workspaceTopology;
    const activeDetails = topology.details[selectedTopologyNode];

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Visual Architecture Map */}
          <div className="lg:col-span-3 bg-bgCard border border-borderColor rounded-xl shadow-lg p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">SG Forge Core Architecture</h3>
              <p className="text-xs text-textMuted mt-1">Interactive block grid highlighting module dependencies</p>
            </div>

            {/* Block Layout Representation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Core Platform Container */}
              <div className="border border-borderColor rounded-xl p-4 bg-bgTh/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-borderColor pb-2">
                  <Activity size={14} className="text-purple-400" />
                  <span className="text-xs font-bold text-white">Core Platform (/core)</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div 
                    onClick={() => setSelectedTopologyNode('core')}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === 'core' ? 'border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg' : 'border-borderColor bg-bgCard hover:border-primary/50 text-textMuted'}`}
                  >
                    /core (System Gateway)
                  </div>
                  <div 
                    onClick={() => setSelectedTopologyNode('core/src/database')}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === 'core/src/database' ? 'border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg' : 'border-borderColor bg-bgCard hover:border-primary/50 text-textMuted'}`}
                  >
                    /core/src/database (Schema Registry)
                  </div>
                  <div 
                    onClick={() => setSelectedTopologyNode('core/src/backend/dev-dashboard')}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === 'core/src/backend/dev-dashboard' ? 'border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg' : 'border-borderColor bg-bgCard hover:border-primary/50 text-textMuted'}`}
                  >
                    /core/src/backend/dev-dashboard (Control Center)
                  </div>
                </div>
              </div>

              {/* Packages & SDK */}
              <div className="border border-borderColor rounded-xl p-4 bg-bgTh/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-borderColor pb-2">
                  <GitBranch size={14} className="text-accent" />
                  <span className="text-xs font-bold text-white">SDK Packages (/packages)</span>
                </div>
                <div 
                  onClick={() => setSelectedTopologyNode('packages/sdk')}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === 'packages/sdk' ? 'border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg' : 'border-borderColor bg-bgCard hover:border-primary/50 text-textMuted'}`}
                >
                  /packages/sdk (External Integrator Core)
                </div>
              </div>

              {/* Sandbox Applications (Span 2) */}
              <div className="md:col-span-2 border border-borderColor rounded-xl p-4 bg-bgTh/20 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-borderColor pb-2">
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="text-yellow-400" />
                    <span className="text-xs font-bold text-white">Sandbox Applications (/sandbox/apps)</span>
                  </div>
                  <div 
                    onClick={() => setSelectedTopologyNode('sandbox')}
                    className={`px-3 py-1 rounded-lg border text-[10px] cursor-pointer transition-all ${selectedTopologyNode === 'sandbox' ? 'border-primary bg-primary/20 text-primary-hover' : 'border-borderColor bg-bgCard text-textMuted'}`}
                  >
                    Parent Config
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'sandbox/apps/apex-expenses', 'sandbox/apps/billing', 
                    'sandbox/apps/employees', 'sandbox/apps/example-forge-app',
                    'sandbox/apps/manager-operations', 'sandbox/apps/nexus-provisioning',
                    'sandbox/apps/reference-expenses', 'sandbox/apps/reference-go',
                    'sandbox/apps/reference-python'
                  ].map((node) => {
                    const label = node.split('/').pop() || '';
                    return (
                      <div 
                        key={node}
                        onClick={() => setSelectedTopologyNode(node)}
                        className={`p-2.5 rounded-lg border text-[11px] cursor-pointer transition-all truncate text-center ${selectedTopologyNode === node ? 'border-primary bg-primaryGlow text-primary-hover font-bold' : 'border-borderColor bg-bgCard hover:border-primary/40 text-textMuted'}`}
                        title={node}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Context Detail Sheet */}
          <div className="lg:col-span-2 bg-bgCard border border-borderColor rounded-xl shadow-lg p-5 flex flex-col gap-5 overflow-y-auto">
            {activeDetails ? (
              <div className="flex flex-col gap-5 animate-fadeIn">
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Directory Metadata Node</h4>
                  <h3 className="text-xl font-extrabold text-white mt-1">/{selectedTopologyNode}</h3>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="text-xs bg-statusPillBg border border-borderColor px-3 py-1 rounded-full">
                      Files: <span className="font-bold text-white">{activeDetails.fileCount}</span>
                    </div>
                    <div className="text-xs bg-statusPillBg border border-borderColor px-3 py-1 rounded-full">
                      Size: <span className="font-bold text-white">{formatBytes(activeDetails.sizeFootprint)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-borderColor pt-4">
                  <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2">Architectural Responsibility Tag</h4>
                  <div className="p-3 bg-bgTh/30 border border-borderColor rounded-lg text-xs leading-relaxed text-textMain">
                    {activeDetails.architecturalSignificance}
                  </div>
                </div>

                {/* Doughnut Chart of language allocations */}
                {activeDetails.languageAllocations && activeDetails.languageAllocations.length > 0 && (
                  <div className="border-t border-borderColor pt-4">
                    <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3">Language Allocation Matrix</h4>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={activeDetails.languageAllocations}
                              dataKey="percentage"
                              nameKey="language"
                              cx="50%"
                              cy="50%"
                              innerRadius={22}
                              outerRadius={38}
                              stroke="none"
                            >
                              {activeDetails.languageAllocations.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}
                              itemStyle={{ fontSize: '10px', color: '#fff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 flex-grow">
                        {activeDetails.languageAllocations.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                              <span className="text-textMuted font-mono">{item.language}</span>
                            </div>
                            <span className="font-bold text-white">{item.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* README Markdown Section */}
                <div className="border-t border-borderColor pt-4">
                  <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2">Workspace Documentation (README.md)</h4>
                  <div className="bg-bgTh/10 p-4 border border-borderColor rounded-lg max-h-[300px] overflow-y-auto">
                    {renderMarkdown(activeDetails.readmeContent)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-textMuted text-xs">
                Select a directory node on the architecture map to view metadata logs
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // VIEW 4: Database Explorer
  const renderDbExplorerView = () => {
    return (
      <div className="flex-grow flex h-full min-h-0 relative animate-fadeIn" id="dbLayout">
        
        {/* DB Sidebar */}
        {!dbSidebarCollapsed && (
          <div 
            style={{ width: `${dbSidebarWidth}px` }} 
            className="flex-shrink-0 border-r border-borderColor bg-bgDbSidebar flex flex-col p-4 overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-borderColor pb-3 mb-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Public Schemas</span>
              <button 
                onClick={() => setDbSidebarCollapsed(true)}
                className="text-textMuted hover:text-white p-1 hover:bg-borderColor rounded"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-textMuted font-bold uppercase">System Tables</span>
              {dbTables.map((tbl) => (
                <div 
                  key={tbl.name}
                  onClick={() => selectExplorerTable(tbl.name)}
                  className={`flex justify-between items-center p-2.5 rounded-lg text-xs cursor-pointer font-mono truncate transition-all ${selectedTable === tbl.name ? 'border border-primary bg-primaryGlow text-primary-hover font-semibold' : 'border border-transparent hover:bg-sidebarHover text-textMuted'}`}
                >
                  <span className="truncate">{tbl.name}</span>
                  <span className="text-[10px] bg-statusPillBg border border-borderColor px-1.5 py-0.5 rounded text-textMuted font-sans">
                    {tbl.rows}
                  </span>
                </div>
              ))}
            </div>

            {selectedTable && selectedTableSchema.length > 0 && (
              <div className="border-t border-borderColor pt-4 mt-4 flex flex-col gap-2">
                <span className="text-[10px] text-textMuted font-bold uppercase">Columns for {selectedTable}</span>
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
                  {selectedTableSchema.map((col, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] font-mono p-1 bg-bgTh/20 border border-borderColor/40 rounded">
                      <span className="text-white truncate pr-1">{col.name}</span>
                      <span className="text-primary-hover truncate">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resizer bar */}
        {!dbSidebarCollapsed && (
          <div 
            onMouseDown={initDbDrag}
            className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary bg-transparent h-full flex-shrink-0 z-10"
          />
        )}

        {/* DB Main Area */}
        <div className="flex-grow flex flex-col p-5 overflow-y-auto gap-4 min-w-0">
          {/* Query Editor */}
          <div className="bg-bgCard border border-borderColor rounded-xl p-4 flex flex-col gap-4 shadow-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {dbSidebarCollapsed && (
                  <button 
                    onClick={() => setDbSidebarCollapsed(false)}
                    className="p-1 border border-borderColor hover:bg-sidebarHover rounded mr-1 text-xs text-textMuted hover:text-white"
                  >
                    Show Tables
                  </button>
                )}
                <span className="text-xs font-bold text-white uppercase tracking-wider">SQL Query Editor</span>
              </div>

              {/* Template dropdown selector */}
              <div className="relative">
                <button 
                  onClick={() => setQueryTemplateMenuOpen(!queryTemplateMenuOpen)}
                  className="bg-inputBg border border-borderColor text-textMuted text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 hover:border-primary"
                >
                  Choose Query Template...
                  <ChevronDown size={14} />
                </button>
                {queryTemplateMenuOpen && (
                  <div className="absolute right-0 mt-1.5 z-20 bg-bgMain border border-borderColor rounded-lg p-1.5 shadow-2xl min-w-[240px]">
                    {[
                      { query: 'SELECT * FROM users LIMIT 20;', label: 'View Core Users' },
                      { query: 'SELECT * FROM structural_metadata ORDER BY type, sort_order;', label: 'View Organization Structure' },
                      { query: 'SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 50;', label: 'View Recent Telemetry Logs' },
                      { query: 'SELECT * FROM forge_apps LIMIT 20;', label: 'View Registered Apps Matrix' },
                      { query: 'SELECT type, count(*) FROM structural_metadata GROUP BY type;', label: 'Metadata Counts' }
                    ].map((item, index) => (
                      <div 
                        key={index}
                        onClick={() => {
                          setQueryText(item.query);
                          setQueryTemplateMenuOpen(false);
                        }}
                        className="p-2 text-xs text-textMuted hover:text-white hover:bg-primaryGlow rounded-md cursor-pointer font-semibold transition-colors"
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="bg-bgTextarea text-white border border-borderColor rounded-lg p-4 font-mono text-xs w-full min-h-[100px] max-h-[300px] resize-y outline-none focus:border-primary"
              placeholder="SELECT * FROM users LIMIT 10;"
            />

            <div className="flex justify-start">
              <button 
                onClick={runQuery}
                disabled={queryLoading}
                className="bg-primary hover:bg-primaryHover text-white px-5 py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-2"
              >
                {queryLoading ? 'Executing Statement...' : 'Execute SQL Statement'}
              </button>
            </div>
          </div>

          {/* Query Outputs */}
          <div className={`bg-bgCard border border-borderColor rounded-xl shadow-lg flex flex-col overflow-hidden min-h-[250px] ${fullscreenResults ? 'fixed inset-4 z-50 bg-bgMain' : ''}`}>
            <div className="px-5 py-3 border-b border-borderColor bg-bgTh flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Query Output Results</span>
                {queryResult && (
                  <span className="text-[10px] text-textMuted">({queryResult.rowCount} rows fetched)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullscreenResults(!fullscreenResults)}
                  className="px-3 py-1 border border-borderColor text-textMuted hover:text-white rounded text-xs"
                >
                  {fullscreenResults ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </div>
            </div>

            {queryError && (
              <div className="p-4 text-xs font-mono text-error bg-errorGlow/20 border-b border-borderColor flex items-center gap-2">
                <ShieldAlert size={14} />
                {queryError}
              </div>
            )}

            {queryLoading && (
              <div className="p-6 flex flex-col gap-3 animate-pulse">
                <div className="h-8 bg-borderColor rounded w-full"></div>
                <div className="h-5 bg-borderColor rounded w-11/12"></div>
                <div className="h-5 bg-borderColor rounded w-full"></div>
                <div className="h-5 bg-borderColor rounded w-10/12"></div>
              </div>
            )}

            <div className="flex-grow overflow-auto min-h-[150px]">
              {queryResult && queryResult.rows && queryResult.rows.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bgTh/50 text-textMuted font-bold border-b border-borderColor sticky top-0 bg-bgMain">
                      {Object.keys(queryResult.rows[0]).map((h, i) => (
                        <th key={i} className="px-4 py-3 border-r border-borderColor font-mono whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderColor font-mono text-[11px]">
                    {queryResult.rows.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-tableRowHover transition-colors">
                        {Object.values(row).map((val: any, j: number) => (
                          <td key={j} className="px-4 py-2.5 border-r border-borderColor truncate max-w-[240px]" title={String(val)}>
                            {val === null ? (
                              <span className="text-textMuted italic">NULL</span>
                            ) : typeof val === 'object' ? (
                              JSON.stringify(val)
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : queryResult ? (
                <div className="p-8 text-center text-textMuted text-xs">Query successfully executed. Empty output result.</div>
              ) : !queryLoading && (
                <div className="p-12 text-center text-textMuted text-xs">Waiting for database SQL execution statement...</div>
              )}
            </div>
          </div>

        </div>

      </div>
    );
  };

  // VIEW 5: Telemetry Logs
  const renderTelemetryLogsView = () => {
    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bgCard border border-borderColor rounded-xl p-4 shadow-md">
          <div className="relative min-w-[320px] flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
            <input 
              type="text"
              placeholder="Search by action keyword or payload contents..."
              value={logsSearch}
              onChange={(e) => handleLogsSearchChange(e.target.value)}
              className="bg-inputBg border border-borderColor rounded-lg pl-9 pr-3 py-2 text-xs text-textMain outline-none w-full focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Severity selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted font-bold uppercase">Severity:</span>
              <div className="relative">
                <button 
                  onClick={() => setSeverityMenuOpen(!severityMenuOpen)}
                  className="bg-inputBg border border-borderColor text-textMain text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 min-w-[120px] justify-between"
                >
                  {logsSeverity}
                  <ChevronDown size={14} />
                </button>
                {severityMenuOpen && (
                  <div className="absolute right-0 mt-1 z-20 bg-bgMain border border-borderColor rounded-lg p-1.5 shadow-2xl min-w-[120px]">
                    {['ALL', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((sev) => (
                      <div 
                        key={sev}
                        onClick={() => {
                          setLogsSeverity(sev);
                          setSeverityMenuOpen(false);
                          // Auto trigger reloading logs
                          setTimeout(() => loadTelemetryLogs(), 50);
                        }}
                        className={`p-2 text-xs rounded-md cursor-pointer font-semibold transition-colors ${logsSeverity === sev ? 'bg-primaryGlow text-primary-hover' : 'text-textMuted hover:text-white hover:bg-sidebarHover'}`}
                      >
                        {sev}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Auto Poll Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted font-bold uppercase">Auto-Poll:</span>
              <div className="relative">
                <button 
                  onClick={() => setPollMenuOpen(!pollMenuOpen)}
                  className="bg-inputBg border border-borderColor text-textMain text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 min-w-[120px] justify-between"
                >
                  {logsAutoPoll === 'off' ? 'Disabled' : `Every ${parseInt(logsAutoPoll, 10)/1000}s`}
                  <ChevronDown size={14} />
                </button>
                {pollMenuOpen && (
                  <div className="absolute right-0 mt-1 z-20 bg-bgMain border border-borderColor rounded-lg p-1.5 shadow-2xl min-w-[120px]">
                    {[
                      { value: 'off', label: 'Disabled' },
                      { value: '2000', label: 'Every 2s' },
                      { value: '5000', label: 'Every 5s' }
                    ].map((item) => (
                      <div 
                        key={item.value}
                        onClick={() => {
                          setLogsAutoPoll(item.value);
                          setPollMenuOpen(false);
                        }}
                        className={`p-2 text-xs rounded-md cursor-pointer font-semibold transition-colors ${logsAutoPoll === item.value ? 'bg-primaryGlow text-primary-hover' : 'text-textMuted hover:text-white hover:bg-sidebarHover'}`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Logs Explorer Table list */}
        <div className="bg-bgCard border border-borderColor rounded-xl shadow-lg overflow-hidden flex flex-col min-h-[300px]">
          {logsLoading && (
            <div className="p-6 flex flex-col gap-4 animate-pulse">
              <div className="h-10 bg-borderColor rounded w-full"></div>
              <div className="h-10 bg-borderColor rounded w-full"></div>
              <div className="h-10 bg-borderColor rounded w-full"></div>
            </div>
          )}

          {!logsLoading && logs.length === 0 ? (
            <div className="p-12 text-center text-textMuted flex flex-col items-center justify-center gap-2">
              <ShieldAlert size={30} className="text-textMuted" />
              <span className="text-xs">No telemetry logs matching criteria were recorded</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-borderColor overflow-y-auto max-h-[600px]">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const dateText = new Date(log.timestamp).toLocaleDateString() + ' ' + new Date(log.timestamp).toLocaleTimeString();
                let badgeClass = 'bg-statusPillBg border-borderColor text-textMuted';
                if (log.severity === 'WARN') badgeClass = 'bg-warningGlow border-warning/30 text-warning';
                else if (log.severity === 'ERROR') badgeClass = 'bg-errorGlow border-error/30 text-error';
                else if (log.severity === 'CRITICAL') badgeClass = 'bg-errorGlow border-error/50 text-error font-bold';
                else if (log.severity === 'INFO') badgeClass = 'bg-successGlow border-success/20 text-success';

                return (
                  <div key={log.id} className="flex flex-col transition-all">
                    {/* Log Row Header */}
                    <div 
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-tableRowHover transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${badgeClass}`}>
                          {log.severity}
                        </span>
                        <span className="text-[10px] text-textMuted font-mono whitespace-nowrap">{dateText}</span>
                        <span className="text-white font-bold truncate">{log.action}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-textMuted font-mono text-[10px] flex-shrink-0">
                        <span>User: <span className="text-primary-hover font-semibold">{log.user_name || log.userId || 'System'}</span></span>
                        <span>IP: <span>{log.ipAddress || '127.0.0.1'}</span></span>
                        <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>

                    {/* Expand details */}
                    {isExpanded && (
                      <div className="px-5 py-4 bg-bgLogDetails border-t border-borderColor/50 animate-fadeIn">
                        <pre className="font-mono text-[11px] text-textConsole overflow-x-auto bg-bgConsole p-4 rounded-lg border border-borderColor/60 max-h-[300px]">
                          {formatJSONPayload(log.payload)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // VIEW 6: General Overview
  const renderOverviewTab = () => {
    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Database Size & Tables</span>
            <span className="text-3xl font-extrabold text-white">{overviewData.tableCount || 0}</span>
            <p className="text-xs text-textMuted mt-1">Total active tables in schema public.</p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">System Audits Logged</span>
            <span className="text-3xl font-extrabold text-accent">{overviewData.logsCount || 0}</span>
            <p className="text-xs text-textMuted mt-1">Total indexed logs inside rotating audits ring-buffer.</p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Test Results Status</span>
            {overviewData.lastTestRun ? (
              <span className="text-2xl font-extrabold flex items-center gap-1.5 mt-0.5">
                <span className="text-success">{overviewData.lastTestRun.passed} Pass</span>
                <span className="text-textMuted">/</span>
                <span className="text-error">{overviewData.lastTestRun.failed} Fail</span>
              </span>
            ) : (
              <span className="text-3xl font-extrabold text-textMuted">Not Run</span>
            )}
            <p className="text-[10px] text-textMuted mt-1">
              {overviewData.lastTestRun 
                ? `Last executed: ${new Date(overviewData.lastTestRun.timestamp).toLocaleTimeString()}`
                : 'Execute testing pipelines to update metrics.'}
            </p>
          </div>
        </div>

        {/* Database Tables registry */}
        <div className="bg-bgCard border border-borderColor rounded-xl shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-borderColor bg-bgTh flex justify-between items-center">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Database Registry Indices</h3>
            <button 
              onClick={() => refreshOverview()}
              disabled={overviewLoading}
              className="text-textMuted hover:text-white p-1 rounded hover:bg-sidebarHover transition-all"
            >
              <RefreshCw size={12} className={overviewLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bgTh/30 text-textMuted font-bold border-b border-borderColor">
                  <th className="px-5 py-3">Table Name</th>
                  <th className="px-5 py-3">Key Column Index</th>
                  <th className="px-5 py-3">Records Size Estimate</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderColor font-semibold">
                {overviewData.tables && overviewData.tables.map((row: any) => (
                  <tr key={row.name} className="hover:bg-tableRowHover transition-colors">
                    <td className="px-5 py-3.5 font-mono text-primary">{row.name}</td>
                    <td className="px-5 py-3.5 font-mono text-textMuted text-[11px]">{row.keyColumns.join(', ')}</td>
                    <td className="px-5 py-3.5 text-textMain">{row.rows} records</td>
                    <td className="px-5 py-3.5 text-right">
                      <button 
                        onClick={() => {
                          setActiveTab('db');
                          selectExplorerTable(row.name);
                        }}
                        className="bg-primary/20 text-primary-hover px-2.5 py-1 rounded border border-primary/20 text-[10px] hover:bg-primary hover:text-white transition-all font-bold"
                      >
                        Explore Schema
                      </button>
                    </td>
                  </tr>
                ))}
                {(!overviewData.tables || overviewData.tables.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-textMuted">No structural database table schemas detected in registry.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- Auth View Layout ---
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-radial bg-bgMain select-none relative animate-fadeIn p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--bg-glow)_0%,var(--bg-main)_70%)] z-0"></div>
        
        <div className="bg-bgCard border border-borderColor p-8 rounded-2xl w-full max-w-sm flex flex-col gap-6 shadow-2xl relative z-10 backdrop-blur-xl">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">SG Forge DevCenter</h1>
            <p className="text-xs text-textMuted mt-1.5 font-medium">Development Administration Console Console</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Authentication Passkey</label>
              <input 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-inputBg border border-borderColor rounded-lg px-3 py-2 text-sm outline-none text-white focus:border-primary focus:ring-1 focus:ring-primaryGlow"
                required
                autoFocus
              />
            </div>
            
            {authError && (
              <div className="text-error text-[11px] font-semibold flex items-center gap-1">
                <ShieldAlert size={12} />
                {authError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={authLoading}
              className="bg-primary hover:bg-primaryHover text-white py-2 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1"
            >
              {authLoading ? 'Verifying Credentials...' : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Layout ---
  return (
    <div className="flex h-screen w-screen overflow-hidden text-textMain bg-bgMain" id="mainLayout">
      {/* Resizable Sidebar */}
      <aside 
        style={{ width: sidebarCollapsed ? '52px' : `${sidebarWidth}px` }} 
        className="flex-shrink-0 bg-bgSidebar border-r border-borderColor flex flex-col overflow-hidden transition-all duration-200"
      >
        <div className="p-4 flex items-center justify-between border-b border-borderColor gap-2">
          {!sidebarCollapsed ? (
            <div className="flex flex-col truncate">
              <span className="text-sm font-extrabold bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">SG Forge DevCenter</span>
              <span className="text-[9px] bg-primaryGlow border border-primary/40 text-primary-hover px-1.5 py-0.5 rounded w-fit mt-1 font-bold">LOCAL-DEV</span>
            </div>
          ) : (
            <span className="font-bold text-primary text-xs mx-auto">SG</span>
          )}
          
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 hover:bg-sidebarHover rounded text-textMuted hover:text-white"
            title="Toggle Navigation"
          >
            <ChevronRight size={14} className={`transform transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation lists */}
        <nav className="flex-grow p-2 flex flex-col gap-1.5 mt-2">
          {[
            { id: 'overview', icon: <Activity size={16} />, label: 'Overview' },
            { id: 'drift', icon: <FileText size={16} />, label: 'Doc Freshness & Drift' },
            { id: 'coverage', icon: <BarChart2 size={16} />, label: 'Coverage & Analytics' },
            { id: 'topology', icon: <GitBranch size={16} />, label: 'Monorepo Topology' },
            { id: 'db', icon: <Database size={16} />, label: 'Database Explorer' },
            { id: 'logs', icon: <Terminal size={16} />, label: 'System Telemetry Logs' }
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg text-xs cursor-pointer transition-all ${isActive ? 'bg-sidebarActive text-sidebarActiveText border border-borderColorGlow font-semibold shadow-md' : 'text-textMuted hover:bg-sidebarHover hover:text-textMain'}`}
                title={item.label}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-borderColor flex items-center justify-between gap-2">
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-white truncate">Developer Mode</span>
              <span className="text-[9px] text-textMuted">Superuser console</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="p-1.5 hover:bg-errorGlow/20 rounded hover:text-error text-textMuted flex-shrink-0 transition-colors mx-auto"
            title="Lock Console"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Resize divider handle */}
      {!sidebarCollapsed && (
        <div 
          onMouseDown={initSidebarDrag}
          className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary bg-transparent h-full flex-shrink-0 z-30 transition-all duration-100"
        />
      )}

      {/* Main Container Area */}
      <main className="flex-grow flex flex-col overflow-hidden min-w-0">
        
        {/* Header Bar */}
        <header className="h-[60px] border-b border-borderColor bg-bgHeader flex items-center justify-between px-6 z-10 flex-shrink-0">
          <h2 className="text-sm font-bold capitalize text-white flex items-center gap-2">
            {activeTab.replace('-', ' ')} Command Center
          </h2>

          <div className="flex items-center gap-3">
            {/* Compact mode toggle */}
            <button 
              onClick={() => {
                const next = !compactMode;
                setCompactMode(next);
                localStorage.setItem('compactMode', String(next));
              }}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all ${compactMode ? 'bg-primary text-white border-primary' : 'bg-statusPillBg border-borderColor text-textMuted'}`}
            >
              Dense View
            </button>

            {/* Theme Dropdown menu */}
            <div className="relative">
              <button 
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="bg-inputBg border border-borderColor text-textMain text-xs px-3 py-1.5 rounded-lg flex items-center gap-2"
              >
                {themeNames[theme] || 'Theme'}
                <ChevronDown size={12} />
              </button>
              {themeMenuOpen && (
                <div className="absolute right-0 mt-1 z-20 bg-bgMain border border-borderColor rounded-lg p-1 shadow-2xl min-w-[150px]">
                  {Object.entries(themeNames).map(([key, name]) => (
                    <div 
                      key={key}
                      onClick={() => {
                        setTheme(key);
                        localStorage.setItem('devCenterTheme', key);
                        setThemeMenuOpen(false);
                      }}
                      className={`p-2 text-xs rounded-md cursor-pointer font-semibold transition-colors ${theme === key ? 'bg-primaryGlow text-primary-hover' : 'text-textMuted hover:text-white hover:bg-sidebarHover'}`}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-statusPillBg border border-borderColor px-3 py-1.5 rounded-lg text-[10px] text-textMuted font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping"></span>
              Local Daemon Active
            </div>
            <div className="text-[10px] text-textMuted bg-statusPillBg border border-borderColor px-3 py-1.5 rounded-lg font-mono">
              Bun v1.2.0
            </div>
          </div>
        </header>

        {/* Content container body */}
        <div className="flex-grow p-6 overflow-y-auto min-h-0 min-w-0">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'drift' && renderDocsDriftView()}
          {activeTab === 'coverage' && renderTestCoverageView()}
          {activeTab === 'topology' && renderWorkspaceTopologyView()}
          {activeTab === 'db' && renderDbExplorerView()}
          {activeTab === 'logs' && renderTelemetryLogsView()}
        </div>

      </main>

      {/* Code diff overlay modal */}
      {activeDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-bgMain border border-borderColor rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-borderColor flex justify-between items-center bg-bgTh">
              <div>
                <h3 className="text-sm font-bold text-white">Documentation Drift Code Delta</h3>
                <p className="text-[10px] text-textMuted mt-0.5 font-mono">
                  {activeDiff.codePath} &lt;&gt; {activeDiff.docPath}
                </p>
              </div>
              <button 
                onClick={() => setActiveDiff(null)}
                className="text-textMuted hover:text-white p-1 hover:bg-sidebarHover rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-grow p-4 overflow-auto bg-bgConsole">
              {renderDiffLines(activeDiff.diff)}
            </div>

            <div className="px-5 py-3 border-t border-borderColor flex justify-end gap-2 bg-bgTh">
              <button 
                onClick={() => setActiveDiff(null)}
                className="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Render root element
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
