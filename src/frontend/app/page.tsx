'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null);
  const [theme, setTheme] = useState('dark');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState('super_admin');
  
  // Stats
  const [stats, setStats] = useState({
    usersCount: 1,
    logsCount: 0,
    metadataCount: 1,
  });

  const router = useRouter();

  useEffect(() => {
    // Sync theme on load
    document.documentElement.setAttribute('data-theme', theme);

    // Read session
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('session_token='));
    if (sessionCookie) {
      try {
        const val = sessionCookie.split('=')[1];
        const parsed = JSON.parse(atob(val));
        setSession(parsed);
        setSimulatedRole(parsed.role);
      } catch (err) {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router, theme]);

  // Fetch count stats via SQL query queries
  const refreshStats = async () => {
    try {
      const uRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT count(*)::integer FROM users;' })
      });
      const uData = await uRes.json();

      const lRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT count(*)::integer FROM system_logs;' })
      });
      const lData = await lRes.json();

      const mRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT count(*)::integer FROM structural_metadata;' })
      });
      const mData = await mRes.json();

      setStats({
        usersCount: uData.rows?.[0]?.count ?? 1,
        logsCount: lData.rows?.[0]?.count ?? 0,
        metadataCount: mData.rows?.[0]?.count ?? 1,
      });
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    if (session) {
      refreshStats();
    }
  }, [session]);

  const handleRunQuery = async (queryStr = sqlQuery) => {
    setIsRunning(true);
    setQueryError('');
    setQueryResult(null);

    try {
      // Simulate changing role temporarily for sandbox testing
      const tempCookies = document.cookie.split(';');
      const sessionCookie = tempCookies.find(c => c.trim().startsWith('session_token='));
      if (sessionCookie) {
        const val = sessionCookie.split('=')[1];
        const currentSession = JSON.parse(atob(val));
        currentSession.role = simulatedRole;
        const updated = btoa(JSON.stringify(currentSession));
        document.cookie = `session_token=${updated}; path=/; max-age=3600; SameSite=Strict`;
      }

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr })
      });
      const data = await res.json();
      
      if (res.ok) {
        setQueryResult(data);
        refreshStats();
      } else {
        setQueryError(data.error || 'Execution failed.');
      }
    } catch (err: any) {
      setQueryError(err.message || 'Error occurred.');
    } finally {
      setIsRunning(false);
    }
  };

  const generateMockLog = async (severity: string, action: string) => {
    if (!session) return;
    const payload = JSON.stringify({ detail: `Triggered ${action} mock event` });
    const insertQuery = `
      INSERT INTO system_logs (user_id, action, severity, payload, ip_address)
      VALUES ('${session.id}', '${action}', '${severity}', '${payload}'::jsonb, '127.0.0.1');
    `;
    await handleRunQuery(insertQuery);
    setSqlQuery('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 5;');
  };

  const handleLogout = () => {
    document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-[#f9fafb]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00ffcc] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-portal text-text-primary transition-colors duration-200 font-sans pb-12">
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-surface-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-gradient-to-tr from-[#ff007f] to-[#2563eb] text-white font-extrabold text-lg tracking-wider">
              AC
            </span>
            <span className="font-bold text-lg tracking-tight">Acme Corp Portal</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Selector */}
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 text-xs">
              {['light', 'dark', 'cyberpunk'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 rounded-md capitalize font-medium transition-all ${
                    theme === t ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold">{session.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{simulatedRole}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-white/5 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                title="Log Out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Banner Alert if password reset simulated */}
        {session.isPasswordChanged && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Successfully bypassed auth guard middleware using default password update flag!</span>
            </div>
            <span className="text-xs px-2.5 py-1 bg-green-500/20 text-green-300 rounded-full font-semibold">SECURE</span>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User Directory</p>
              <h3 className="text-3xl font-bold mt-2">{stats.usersCount}</h3>
            </div>
            <span className="p-3 bg-blue-500/10 rounded-xl text-[#2563eb]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Structural Layers</p>
              <h3 className="text-3xl font-bold mt-2">{stats.metadataCount}</h3>
            </div>
            <span className="p-3 bg-teal-500/10 rounded-xl text-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">System Log Buffer</p>
              <h3 className="text-3xl font-bold mt-2">{stats.logsCount}</h3>
            </div>
            <span className="p-3 bg-fuchsia-500/10 rounded-xl text-fuchsia-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
          </div>
        </section>

        {/* Database Work Bench */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SQL terminal panel */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Administrative SQL Query Console</h3>
              
              {/* Role Simulation Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Test Role:</span>
                <select
                  value={simulatedRole}
                  onChange={(e) => setSimulatedRole(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                >
                  <option value="super_admin">super_admin (Full Access)</option>
                  <option value="read_only_admin">read_only_admin (Read Safeguard)</option>
                </select>
              </div>
            </div>

            <div className="relative mb-4">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="w-full h-36 p-4 rounded-xl bg-black/30 border border-white/10 font-mono text-xs text-[#00ffcc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent resize-none"
                placeholder="Write database queries here..."
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-between">
              {/* Quick queries templates */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setSqlQuery('SELECT * FROM users;'); handleRunQuery('SELECT * FROM users;'); }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium border border-white/5 transition-colors"
                >
                  View Users
                </button>
                <button
                  onClick={() => { setSqlQuery('SELECT * FROM structural_metadata;'); handleRunQuery('SELECT * FROM structural_metadata;'); }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium border border-white/5 transition-colors"
                >
                  View Metadata
                </button>
                <button
                  onClick={() => { setSqlQuery('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 5;'); handleRunQuery('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 5;'); }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium border border-white/5 transition-colors"
                >
                  View Logs
                </button>
              </div>

              <button
                onClick={() => handleRunQuery()}
                disabled={isRunning}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#00ffcc] text-white text-xs font-bold shadow-md hover:from-blue-600 hover:to-teal-400 active:scale-[0.98] transition-all flex items-center gap-2"
              >
                {isRunning ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Run Query'
                )}
              </button>
            </div>

            {/* Error panel */}
            {queryError && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold font-mono">
                {queryError}
              </div>
            )}

            {/* Results Table */}
            {queryResult && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">
                    Query completed successfully ({queryResult.rowCount} rows affected)
                  </span>
                </div>
                
                <div className="overflow-x-auto border border-white/5 rounded-xl max-h-72">
                  {queryResult.rows && queryResult.rows.length > 0 ? (
                    <table className="min-w-full divide-y divide-white/5 text-left text-xs font-mono">
                      <thead className="bg-white/5 text-gray-300">
                        <tr>
                          {Object.keys(queryResult.rows[0]).map((key) => (
                            <th key={key} className="px-4 py-3 font-semibold uppercase tracking-wider">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-400 bg-black/10">
                        {queryResult.rows.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            {Object.values(row).map((val: any, j: number) => (
                              <td key={j} className="px-4 py-3 whitespace-nowrap">
                                {val === null ? (
                                  <span className="text-red-500/50 italic">null</span>
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
                  ) : (
                    <div className="p-6 text-center text-gray-500 text-xs italic">
                      Empty set returned (no records or schema modification query completed)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sandbox controls panel */}
          <div className="space-y-6">
            {/* Log Buffer Simulation */}
            <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md">
              <h3 className="font-bold text-base mb-2">Log Buffer Sandbox</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Test the 100,000 rolling log limit trigger in PostgreSQL. Insert logs to watch the count refresh dynamically.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => generateMockLog('INFO', 'User Login')}
                  className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-[#2563eb] text-xs font-semibold rounded-lg border border-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Generate INFO Log
                </button>
                
                <button
                  onClick={() => generateMockLog('WARN', 'Unauthorized Attempt')}
                  className="w-full py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-xs font-semibold rounded-lg border border-yellow-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  Generate WARN Log
                </button>

                <button
                  onClick={() => generateMockLog('CRITICAL', 'Database Schema Altered')}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-lg border border-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Generate CRITICAL Log
                </button>
              </div>
            </div>

            {/* Read-Only Safeguard Test */}
            <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md border-amber-500/20">
              <h3 className="font-bold text-base mb-2 text-amber-500">Read-Only Guard Test</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Select <code className="text-amber-400">read_only_admin</code> above and run a destructive command to verify execution guards.
              </p>
              
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-500/80 font-mono">
                DROP TABLE system_logs;
              </div>

              <button
                onClick={() => {
                  setSimulatedRole('read_only_admin');
                  setSqlQuery('DROP TABLE system_logs;');
                  handleRunQuery('DROP TABLE system_logs;');
                }}
                className="w-full mt-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold rounded-lg transition-all"
              >
                Simulate Destructive Guard Trigger
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
