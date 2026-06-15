'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';

interface AppConfig {
  id: string;
  slug?: string;
  name: string;
  description: string;
  icon: string;
  roles?: string[];
  entryPoint: string;
  entryUrl?: string;
  directoryName: string;
  routingMode?: string;
  database?: {
    requiresIsolatedSchema?: boolean;
    schemaName?: string;
  };
  targetRules?: {
    verticals?: string[];
    designations?: string[];
    minJobLevel?: number;
  };
}

interface UserSessionPayload {
  user: {
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    hierarchyLevel: number;
    managerId: string | null;
  };
  manager: {
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
  } | null;
  peers: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
    verticalName: string;
  }>;
  directReports: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
    verticalName: string;
  }>;
  allUsers: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    managerId: string | null;
  }>;
  allMetadata: Array<{
    id: string;
    type: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }>;
  apps: AppConfig[];
}

interface UserLaunchpadProps {
  initialData: UserSessionPayload;
  isAdmin: boolean;
}

export default function UserLaunchpad({ initialData, isAdmin }: UserLaunchpadProps) {
  const router = useRouter();

  const companyMeta = initialData.allMetadata.find(m => m.type === 'company_name') as any;
  const brandingTitle = companyMeta?.name || 'SG Forge';
  const brandingLogo = companyMeta?.extendedAttributes?.logo || '';

  // Theme & Font state synced with documentElement
  const [theme, setTheme] = useState('default');
  const [font, setFont] = useState('default');

  useEffect(() => {
    // Read from localStorage or default
    const savedTheme = localStorage.getItem('theme') || 'default';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedFont = localStorage.getItem('font') || 'default';
    setFont(savedFont);
    document.documentElement.setAttribute('data-font', savedFont);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Sidebar collapsible state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Active Workspace View
  // 'profile' | 'team' | 'directory' | 'apps'
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'directory' | 'apps'>('profile');

  // Profile Pivoting History Stack (allows walking the hierarchy tree and returning)
  const [profileHistory, setProfileHistory] = useState<string[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>(initialData.user.id);

  // State to simulate network speed
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);

  // Modal states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showVerticalScopeModal, setShowVerticalScopeModal] = useState(false);
  
  // Omni Search (Cmd+K)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Fast tab switching simulation (<50ms)
  const handleTabChange = (tab: typeof activeTab) => {
    // Execute immediately without delay
    setActiveTab(tab);
  };

  // Helper to map icon string to emoji
  const getAppIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'users':
        return '👥';
      case 'creditcard':
        return '💳';
      case 'briefcase':
        return '💼';
      case 'activity':
        return '📈';
      case 'settings':
        return '⚙️';
      default:
        return '📦';
    }
  };

  // Resolve current active profile user
  const activeUser = initialData.allUsers.find(u => u.id === currentProfileId) || initialData.user;
  
  // Resolve active profile's manager
  const activeManager = activeUser.managerId 
    ? initialData.allUsers.find(u => u.id === activeUser.managerId) || null 
    : null;

  // Resolve active profile's peers (same manager)
  const activePeers = activeUser.managerId
    ? initialData.allUsers.filter(u => u.managerId === activeUser.managerId && u.id !== activeUser.id)
    : [];

  // Resolve active profile's direct reports
  const activeReports = initialData.allUsers.filter(u => u.managerId === activeUser.id);

  // Calculate dynamic hierarchy depth for active profile
  const getProfileHierarchyLevel = (userId: string) => {
    let level = 0;
    let currId = userId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const parent = initialData.allUsers.find(u => u.id === currId)?.managerId;
      if (parent) {
        level++;
        currId = parent;
      } else {
        break;
      }
    }
    return level;
  };

  const activeHierarchyLevel = getProfileHierarchyLevel(currentProfileId);

  // Pivot view helper
  const handlePivotProfile = (targetId: string) => {
    if (targetId === currentProfileId) return;
    setProfileHistory(prev => [...prev, currentProfileId]);
    setCurrentProfileId(targetId);
    setActiveTab('profile');
  };

  // Rollback pivot helper
  const handlePivotBack = () => {
    if (profileHistory.length === 0) return;
    const previousId = profileHistory[profileHistory.length - 1];
    setProfileHistory(prev => prev.slice(0, -1));
    setCurrentProfileId(previousId);
  };

  const handlePivotReset = () => {
    setProfileHistory([]);
    setCurrentProfileId(initialData.user.id);
  };

  // Filter application list by role permissions
  const filteredApps = initialData.apps.filter(app => {
    if (!app.roles || app.roles.length === 0) return true;
    return app.roles.includes(initialData.user.role);
  });

  // Filter all users for omni-search
  const filteredSearchUsers = searchQuery.trim() === ''
    ? []
    : initialData.allUsers.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.eid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.designation.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {}
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background-portal text-text-primary flex overflow-hidden font-sans">
      
      {/* ─── ZONE A: PERSISTENT APP DOCK (Left Sidebar) ─── */}
      <Collapsible.Root
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className={`bg-sidebar-bg border-r border-border-accent flex flex-col h-screen transition-all duration-300 relative select-none flex-shrink-0 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Brand identity header */}
        <div className="p-5 border-b border-border-accent flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3">
            {brandingLogo ? (
              <div 
                className="h-9 w-9 rounded-xl bg-surface-card p-1.5 border border-border-accent overflow-hidden flex-shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-brand-accent"
                dangerouslySetInnerHTML={{ __html: brandingLogo }} 
              />
            ) : (
              <span className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-black text-sm tracking-wider shadow-lg shadow-brand-accent/25 flex-shrink-0">
                {brandingTitle.substring(0, 2).toUpperCase()}
              </span>
            )}
            {sidebarOpen && (
              <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-text-primary via-text-primary to-brand-accent bg-clip-text text-transparent whitespace-nowrap">
                {brandingTitle} Launchpad
              </span>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-text-primary text-[10px] transition-colors"
            >
              ◀
            </button>
          )}
        </div>

        {/* Sidebar Trigger Icon (only when collapsed) */}
        {!sidebarOpen && (
          <div className="py-4 border-b border-border-accent flex justify-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary text-[10px] transition-all"
            >
              ▶
            </button>
          </div>
        )}

        {/* Core Navigation Options */}
        <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
          <div className="space-y-1">
            {sidebarOpen && (
              <span className="px-3 text-[9px] text-text-tertiary font-black uppercase tracking-wider block mb-2">
                Workspace Dock
              </span>
            )}
            
            <button
              onClick={() => handleTabChange('profile')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3.5 transition-all ${
                activeTab === 'profile'
                  ? 'bg-sidebar-active text-sidebar-text-active shadow-sm'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
              }`}
            >
              <span className="text-base">🏠</span>
              {sidebarOpen && <span className="truncate">Home / Profile</span>}
            </button>

            <button
              onClick={() => handleTabChange('team')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3.5 transition-all ${
                activeTab === 'team'
                  ? 'bg-sidebar-active text-sidebar-text-active shadow-sm'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
              }`}
            >
              <span className="text-base">👥</span>
              {sidebarOpen && <span className="truncate">My Team Focus</span>}
            </button>

            <button
              onClick={() => handleTabChange('directory')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3.5 transition-all ${
                activeTab === 'directory'
                  ? 'bg-sidebar-active text-sidebar-text-active shadow-sm'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
              }`}
            >
              <span className="text-base">🌐</span>
              {sidebarOpen && <span className="truncate">Org Directory</span>}
            </button>
          </div>

          {/* Extensibility Block: Applications */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider">
                {sidebarOpen ? 'Applications' : 'Apps'}
              </span>
              {sidebarOpen && (
                <span className="text-[8px] bg-brand-muted text-brand-accent px-1.5 py-0.5 rounded border border-brand-accent/20 font-bold uppercase tracking-tight">
                  Modular
                </span>
              )}
            </div>

            {filteredApps.map(app => (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className="w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3.5 text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary transition-all group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">
                  {getAppIcon(app.icon)}
                </span>
                {sidebarOpen && (
                  <div className="min-w-0 text-left">
                    <p className="truncate leading-none font-bold">{app.name}</p>
                    <span className="text-[9px] text-text-tertiary font-normal truncate block mt-0.5">Launch app</span>
                  </div>
                )}
              </Link>
            ))}

            {filteredApps.length === 0 && sidebarOpen && (
              <p className="px-3 text-[10px] text-text-tertiary italic">
                No apps authorized.
              </p>
            )}

            {/* Marketplace Button */}
            <button
              onClick={() => handleTabChange('apps')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3.5 transition-all ${
                activeTab === 'apps'
                  ? 'bg-sidebar-active text-sidebar-text-active shadow-sm'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
              }`}
            >
              <span className="text-base">🛒</span>
              {sidebarOpen && <span className="truncate">App Marketplace</span>}
            </button>
          </div>
        </div>

        {/* Sidebar Footer (Identity Card & Switch Role/Admin) */}
        <div className="p-3 border-t border-border-accent bg-surface-card/10 space-y-2.5">
          {/* Admin switcher (Visible to admin roles) */}
          {isAdmin && sidebarOpen && (
            <button
              onClick={() => router.push('/')}
              className="w-full py-2 bg-brand-muted hover:bg-brand-accent/20 border border-brand-accent/30 rounded-xl text-[10px] font-black text-brand-accent uppercase tracking-widest transition-all"
            >
              ⚙️ Admin Portal
            </button>
          )}

          {/* Quick theme cycle icon for collapsed view */}
          {!sidebarOpen && (
            <button
              onClick={() => {
                const themes = ['default', 'light', 'dark', 'solarized-dark', 'solarized-light'];
                const nextT = themes[themes.indexOf(theme) !== -1 ? (themes.indexOf(theme) + 1) % themes.length : 0];
                changeTheme(nextT);
              }}
              className="w-12 h-12 rounded-xl border border-border-accent/40 text-text-secondary hover:text-text-primary transition-all flex items-center justify-center mx-auto"
              title="Cycle Theme"
            >
              <span>{
                theme === 'light' ? '☀️' :
                theme === 'solarized-dark' ? '🕶️' :
                theme === 'solarized-light' ? '📄' :
                theme === 'dark' ? '🌙' : '✨'
              }</span>
            </button>
          )}

          {/* Profile Card */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-background-portal/50 border border-border-accent/40">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs flex-shrink-0">
                {initialData.user.name.substring(0, 2).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <p className="text-[10px] font-black truncate text-text-primary leading-tight">{initialData.user.name}</p>
                  <p className="text-[8px] text-text-secondary uppercase tracking-widest font-semibold mt-0.5 truncate">{initialData.user.designation}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="p-1.5 hover:bg-surface-elevated rounded-lg text-danger hover:scale-105 transition-all flex-shrink-0"
                title="Log Out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </Collapsible.Root>

      {/* RIGHT BODY WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* ─── ZONE B: THE OMNI-NAV HEADER (Top Bar) ─── */}
        <header className="h-16 border-b border-border-accent bg-surface-card/65 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
          
          {/* Omni search trigger block */}
          <div className="flex-1 max-w-md">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between bg-background-portal/80 border border-border-accent hover:border-brand-accent/50 rounded-xl px-4 py-2 text-xs text-text-secondary hover:text-text-primary transition-all shadow-inner cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span>🔍</span>
                <span className="font-semibold text-text-secondary">Search peers by name, EID, or role...</span>
              </div>
              <kbd className="bg-surface-elevated px-2 py-0.5 rounded-lg border border-border-accent text-[9px] font-sans font-extrabold tracking-widest text-text-primary">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-4">
            
            {/* Theme Customizer Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-accent text-xs font-bold hover:bg-surface-elevated transition-colors flex items-center gap-2 cursor-pointer shadow-sm">
                  <span>{
                    theme === 'light' ? '☀️' :
                    theme === 'solarized-dark' ? '🕶️' :
                    theme === 'solarized-light' ? '📄' :
                    theme === 'dark' ? '🌙' : '✨'
                  }</span>
                  <span className="capitalize text-text-secondary">{theme === 'default' ? 'Default' : theme}</span>
                  <span className="text-[10px] text-text-tertiary">▼</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="bg-surface-elevated border border-border-accent p-2.5 rounded-2xl shadow-2xl min-w-[170px] space-y-1 animate-fadeIn"
                  sideOffset={5}
                  align="end"
                >
                  <DropdownMenu.Label className="px-2.5 py-1.5 text-[9px] font-black uppercase text-text-tertiary tracking-wider">
                    Select Layout Theme
                  </DropdownMenu.Label>
                  {[
                    { id: 'default', label: 'Default Theme', icon: '✨' },
                    { id: 'light', label: 'Light Mode', icon: '☀️' },
                    { id: 'dark', label: 'Obsidian Dark', icon: '🌙' },
                    { id: 'solarized-dark', label: 'Solarized Dark', icon: '🕶️' },
                    { id: 'solarized-light', label: 'Solarized Light', icon: '📄' },
                  ].map(item => (
                    <DropdownMenu.Item
                      key={item.id}
                      onClick={() => changeTheme(item.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer outline-none transition-colors ${
                        theme === item.id 
                          ? 'bg-brand-accent text-white' 
                          : 'text-text-primary hover:bg-surface-card'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {theme === item.id && <span className="text-[10px]">✓</span>}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Network connectivity Ring + Identity Badge */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block leading-none">
                <p className="text-xs font-extrabold text-text-primary">{initialData.user.name}</p>
                <span className="text-[9px] text-text-secondary uppercase tracking-widest font-semibold">{initialData.user.designation}</span>
              </div>
              
              {/* Identity status ring */}
              <div className="relative">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                  {initialData.user.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-success rounded-full border-2 border-surface-card flex items-center justify-center shadow" title="Active Connection: Online">
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-ping"></span>
                </div>
              </div>
            </div>

          </div>
        </header>

        {/* ─── ZONE C: THE DYNAMIC WORKSPACE (Main Viewport) ─── */}
        <main className="flex-1 p-6 overflow-y-auto bg-background-portal relative">
          
          {/* Tab Content 1: The Identity Hub (Bento Grid) */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
              
              {/* Pivoting Navigation Breadcrumb */}
              {profileHistory.length > 0 && (
                <div className="flex items-center justify-between bg-surface-card/50 border border-border-accent/40 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-text-secondary">Pivoted Profile Path:</span>
                    <button 
                      onClick={handlePivotReset}
                      className="text-brand-accent hover:underline"
                    >
                      Me ({initialData.user.name})
                    </button>
                    {profileHistory.map((histId, idx) => {
                      const histUser = initialData.allUsers.find(u => u.id === histId);
                      if (!histUser) return null;
                      return (
                        <React.Fragment key={histId}>
                          <span className="text-text-tertiary">/</span>
                          <button 
                            onClick={() => {
                              const newHistory = profileHistory.slice(0, idx + 1);
                              setProfileHistory(newHistory);
                              setCurrentProfileId(histId);
                            }}
                            className="text-brand-accent hover:underline truncate max-w-[120px]"
                          >
                            {histUser.name}
                          </button>
                        </React.Fragment>
                      );
                    })}
                    <span className="text-text-tertiary">/</span>
                    <span className="text-text-primary truncate max-w-[150px]">{activeUser.name}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handlePivotBack}
                      className="px-3 py-1 bg-surface-card hover:bg-surface-elevated border border-border-accent text-xs font-bold rounded-lg transition-all"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handlePivotReset}
                      className="px-3 py-1 bg-brand-accent text-white hover:bg-brand-hover text-xs font-bold rounded-lg transition-all"
                    >
                      Reset to Me
                    </button>
                  </div>
                </div>
              )}

              {/* Bento Grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Primary Identity Bento Block */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/30 transition-all flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                        Primary Identity
                      </span>
                      <span className="px-2 py-0.5 bg-success/10 border border-success/20 rounded-full text-[9px] font-black text-success uppercase tracking-wider flex items-center gap-1 animate-pulse">
                        <span className="h-1 w-1 bg-success rounded-full"></span>
                        Active
                      </span>
                    </div>

                    <div className="flex items-center gap-4.5 my-6">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xl shadow-lg shadow-brand-accent/15">
                        {activeUser.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-black text-text-primary leading-tight truncate">{activeUser.name}</h2>
                        <p className="text-xs text-text-secondary font-mono mt-0.5">{activeUser.email}</p>
                      </div>
                    </div>

                    <div className="border-t border-border-accent/40 pt-4.5 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-secondary font-medium">Corporate EID</span>
                        <span className="text-text-primary font-black font-mono">{activeUser.eid}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary font-medium">User Role Scope</span>
                        <span className="text-text-primary font-bold uppercase tracking-widest text-[10px]">{activeUser.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => setShowVerificationModal(true)}
                      className="w-full py-2.5 bg-surface-elevated hover:bg-brand-accent hover:text-white border border-border-accent hover:border-brand-accent text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      View Digital Verification Token
                    </button>
                  </div>
                </div>

                {/* 2. Corporate Alignment Bento Block */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/30 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                        Corporate Alignment
                      </span>
                      <span className="text-xs text-brand-accent font-extrabold">
                        Tier {activeHierarchyLevel + 1}
                      </span>
                    </div>

                    <div className="my-6 space-y-4">
                      <div>
                        <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider block">Assigned Designation</span>
                        <p className="text-base font-black text-text-primary truncate mt-0.5">{activeUser.designation}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider block">Department Vertical</span>
                        <p className="text-base font-black text-text-primary truncate mt-0.5">{activeUser.verticalName}</p>
                      </div>
                    </div>

                    <div className="border-t border-border-accent/40 pt-4.5 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-secondary font-medium">Structural Lineage</span>
                        <span className="text-text-primary font-bold">Level {activeHierarchyLevel} Node</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary font-medium">Reporting Path</span>
                        <span className="text-text-primary font-bold">
                          {activeUser.managerId ? 'Standard Chain' : 'Root C-Suite'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => setShowVerticalScopeModal(true)}
                      className="w-full py-2.5 bg-surface-elevated hover:bg-brand-accent hover:text-white border border-border-accent hover:border-brand-accent text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      View Department Scope
                    </button>
                  </div>
                </div>

                {/* 3. Reporting Line Bento Block */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/30 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                        Reporting Line
                      </span>
                      <span className="text-[9px] text-text-tertiary font-bold uppercase">Upline Coordinates</span>
                    </div>

                    {activeManager ? (
                      <div className="my-6">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-surface-elevated border border-border-accent text-brand-accent flex items-center justify-center font-bold text-sm">
                            👤
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-text-primary leading-tight truncate">{activeManager.name}</h4>
                            <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5 truncate">{activeManager.designation}</p>
                          </div>
                        </div>

                        <div className="border-t border-border-accent/40 mt-6 pt-4.5 space-y-2.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-secondary font-medium">Manager EID</span>
                            <span className="text-text-primary font-black font-mono">{activeManager.eid}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary font-medium">Contact email</span>
                            <span className="text-text-primary font-bold font-mono text-[10px] truncate max-w-[160px]">
                              {activeManager.email}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="my-10 text-center">
                        <span className="text-2xl block mb-2">👑</span>
                        <p className="text-xs font-black text-text-primary">Top of Organization Tree</p>
                        <p className="text-[10px] text-text-secondary mt-1">This profile represents a primary root node.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6">
                    {activeManager ? (
                      <button
                        onClick={() => handlePivotProfile(activeManager.id)}
                        className="w-full py-2.5 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        Pivot to Manager View ➔
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2.5 bg-surface-card border border-border-accent text-text-tertiary text-xs font-black rounded-xl cursor-not-allowed opacity-50"
                      >
                        Pivot Restrained
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Bento Row 2: Substructures (if pivoted or manager) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Peer List Preview */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-wide border-b border-border-accent/40 pb-3 mb-4 flex justify-between items-center">
                    <span>Peers Sharing Coordinates ({activePeers.length})</span>
                    <button 
                      onClick={() => handleTabChange('team')}
                      className="text-[10px] text-brand-accent font-bold hover:underline"
                    >
                      View Full Team Circle
                    </button>
                  </h3>
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {activePeers.slice(0, 5).map(peer => (
                      <div 
                        key={peer.id}
                        onClick={() => handlePivotProfile(peer.id)}
                        className="p-3 bg-background-portal/60 hover:bg-surface-elevated border border-border-accent/40 hover:border-brand-accent/30 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-lg bg-surface-elevated text-text-secondary flex items-center justify-center text-xs font-bold">
                            {peer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-black text-text-primary leading-tight">{peer.name}</p>
                            <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5">{peer.designation}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-text-secondary font-bold">{peer.eid}</span>
                      </div>
                    ))}
                    {activePeers.length === 0 && (
                      <p className="text-xs text-text-secondary italic py-4 text-center">No peers located at this reporting coordinate</p>
                    )}
                  </div>
                </div>

                {/* Direct Reports List Preview */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-wide border-b border-border-accent/40 pb-3 mb-4 flex justify-between items-center">
                    <span>Direct Downline Node Reports ({activeReports.length})</span>
                    {activeReports.length > 0 && (
                      <span className="text-[9px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded font-black uppercase">
                        Manager Mode
                      </span>
                    )}
                  </h3>
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {activeReports.slice(0, 5).map(report => (
                      <div 
                        key={report.id}
                        onClick={() => handlePivotProfile(report.id)}
                        className="p-3 bg-background-portal/60 hover:bg-surface-elevated border border-border-accent/40 hover:border-brand-accent/30 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-lg bg-surface-elevated text-text-secondary flex items-center justify-center text-xs font-bold">
                            {report.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-black text-text-primary leading-tight">{report.name}</p>
                            <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5">{report.designation}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-text-secondary font-bold">{report.eid}</span>
                      </div>
                    ))}
                    {activeReports.length === 0 && (
                      <p className="text-xs text-text-secondary italic py-4 text-center">No direct reporting assignments discovered for this profile</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: My Team Focus Circle */}
          {activeTab === 'team' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
              
              {/* Upstream Manager Card Block */}
              <div className="space-y-3">
                <span className="text-[10px] text-text-tertiary font-black uppercase tracking-widest block text-center">
                  Upstream Node Coordinates
                </span>
                
                {activeManager ? (
                  <div className="bg-surface-card border-2 border-brand-accent/25 rounded-3xl p-6 max-w-xl mx-auto shadow-md hover:border-brand-accent transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-brand-muted border border-brand-accent/20 text-brand-accent flex items-center justify-center font-bold text-lg shadow-sm">
                        💼
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-text-primary truncate">{activeManager.name}</h4>
                        <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5 tracking-wide">{activeManager.designation}</p>
                        <span className="text-[9px] text-text-secondary font-mono">{activeManager.eid} · {activeManager.email}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handlePivotProfile(activeManager.id)}
                      className="px-3.5 py-2 bg-surface-elevated hover:bg-brand-accent hover:text-white border border-border-accent hover:border-brand-accent text-[11px] font-black rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                    >
                      View Profile Circle
                    </button>
                  </div>
                ) : (
                  <div className="bg-surface-card border border-border-accent/40 rounded-3xl p-6 max-w-xl mx-auto text-center">
                    <p className="text-xs font-black text-text-primary uppercase tracking-wider">Top level node structural status</p>
                    <p className="text-[10px] text-text-secondary mt-1">This node reports directly to the Board of Directors.</p>
                  </div>
                )}
              </div>

              {/* Connected Active Circle Peer Matrix */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border-accent/40 pb-3.5">
                  <div>
                    <h3 className="text-base font-black text-text-primary">Connected Peer Coordinates</h3>
                    <p className="text-[10px] text-text-secondary mt-0.5">All employees reporting to the same upline node</p>
                  </div>
                  <span className="px-3 py-1 bg-brand-muted border border-brand-accent/20 rounded-full text-xs font-black text-brand-accent">
                    {activePeers.length + 1} Total Members
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Highlight Self card in peers matrix */}
                  <div className="bg-gradient-to-br from-surface-card to-brand-muted/10 border-2 border-brand-accent rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-2.5">
                      <span className="px-2 py-0.5 bg-brand-accent text-white text-[8px] font-black uppercase rounded tracking-widest shadow-sm">
                        You
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-sm shadow">
                        {activeUser.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-text-primary leading-tight truncate">{activeUser.name} (You)</h4>
                        <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5 truncate tracking-wide">{activeUser.designation}</p>
                      </div>
                    </div>

                    <div className="border-t border-border-accent/60 pt-3 flex justify-between items-center text-[10px]">
                      <span className="text-text-secondary font-mono font-bold">{activeUser.eid}</span>
                      <span className="text-text-primary font-bold">{activeUser.verticalName}</span>
                    </div>
                  </div>

                  {/* Other Peers */}
                  {activePeers.map(peer => (
                    <div 
                      key={peer.id}
                      onClick={() => handlePivotProfile(peer.id)}
                      className="bg-surface-card border border-border-accent hover:border-brand-accent/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-surface-elevated group-hover:bg-brand-muted text-text-secondary group-hover:text-brand-accent border border-border-accent/40 group-hover:border-brand-accent/20 flex items-center justify-center font-bold text-sm transition-all">
                          {peer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-text-primary leading-tight truncate group-hover:text-brand-accent transition-colors">{peer.name}</h4>
                          <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5 truncate tracking-wide">{peer.designation}</p>
                        </div>
                      </div>

                      <div className="border-t border-border-accent/40 pt-3 flex justify-between items-center text-[10px]">
                        <span className="text-text-secondary font-mono font-semibold">{peer.eid}</span>
                        <span className="text-text-primary font-bold">{peer.verticalName}</span>
                      </div>
                    </div>
                  ))}

                  {activePeers.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-surface-card/40 border border-dashed border-border-accent rounded-3xl">
                      <span className="text-3xl block mb-2">🔭</span>
                      <p className="text-xs font-black text-text-secondary uppercase">No matching peers located</p>
                      <p className="text-[10px] text-text-tertiary mt-1">This employee appears to be the sole node coordinate reporting to their manager.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Org Directory */}
          {activeTab === 'directory' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
              
              <div className="border-b border-border-accent/40 pb-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-black text-text-primary">Corporate Employee Directory</h3>
                  <p className="text-[10px] text-text-secondary mt-0.5">Explore active structural assignments and coordinates</p>
                </div>
                
                {/* Search input in directory view */}
                <div className="w-full sm:max-w-xs relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by name, EID, vertical..."
                    className="w-full bg-surface-card border border-border-accent rounded-xl px-3.5 py-1.5 text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-brand-accent transition-all"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary hover:text-text-primary font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Directory Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
                {(searchQuery.trim() === '' ? initialData.allUsers : filteredSearchUsers).map(u => (
                  <div
                    key={u.id}
                    onClick={() => handlePivotProfile(u.id)}
                    className={`bg-surface-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-3.5 items-center group ${
                      u.id === currentProfileId ? 'border-brand-accent ring-2 ring-brand-accent/10' : 'border-border-accent hover:border-brand-accent/30'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs shadow-inner flex-shrink-0 group-hover:scale-105 transition-transform">
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-text-primary truncate leading-tight group-hover:text-brand-accent transition-colors">{u.name}</h4>
                      <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5 tracking-wide truncate">{u.designation}</p>
                      <div className="flex justify-between items-center mt-2 text-[9px] text-text-secondary font-medium font-mono">
                        <span>{u.eid}</span>
                        <span className="font-sans font-bold text-text-tertiary">{u.verticalName}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {(searchQuery.trim() !== '' && filteredSearchUsers.length === 0) && (
                  <div className="col-span-full py-16 text-center bg-surface-card/40 border border-dashed border-border-accent rounded-3xl">
                    <span className="text-3xl block mb-2">🔍</span>
                    <p className="text-xs font-black text-text-secondary uppercase">No directory records matched</p>
                    <p className="text-[10px] text-text-tertiary mt-1">No employee records match your query "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content 4: Modular App Marketplace */}
          {activeTab === 'apps' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
              
              <div className="border-b border-border-accent/40 pb-3.5">
                <h3 className="text-base font-black text-text-primary font-sans">Enterprise Applications Hub</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Explore active extensions and download modular coordinates</p>
              </div>

              {/* Configured app listing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Apps Grid */}
                {filteredApps.map(app => (
                  <div 
                    key={app.id} 
                    className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="h-10 w-10 rounded-2xl bg-brand-muted border border-brand-accent/20 text-brand-accent flex items-center justify-center font-bold text-lg shadow-sm">
                          {getAppIcon(app.icon)}
                        </span>
                        <span className="px-2.5 py-1 bg-success/15 border border-success/20 text-[9px] font-black text-success uppercase tracking-wider rounded-md">
                          Installed
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-text-primary">{app.name}</h4>
                      <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">{app.description}</p>
                      
                      <div className="flex items-center gap-1.5 mt-4">
                        <span className="text-[8px] text-text-tertiary font-bold uppercase">Authorized Access:</span>
                        <div className="flex flex-wrap gap-1">
                          {(app.roles || []).map(r => (
                            <span key={r} className="text-[8px] bg-surface-elevated border border-border-accent px-1.5 py-0.5 rounded font-mono font-bold text-text-secondary">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <Link 
                        href={`/apps/${app.id}`}
                        className="w-full py-2 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                      >
                        Launch Application 🡥
                      </Link>
                    </div>
                  </div>
                ))}

                {/* Ecosystem Marketplace placeholders */}
                {[1, 2].map(num => (
                  <div
                    key={num}
                    className="bg-surface-card/40 border border-dashed border-border-accent/80 rounded-3xl p-6 shadow-sm hover:bg-surface-card/65 transition-all flex flex-col justify-between items-center text-center group cursor-pointer"
                  >
                    <div className="my-auto py-6 space-y-3">
                      <div className="h-11 w-11 rounded-2xl border border-dashed border-border-accent text-text-tertiary group-hover:text-brand-accent group-hover:border-brand-accent/40 flex items-center justify-center font-bold text-lg mx-auto transition-all">
                        ＋
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-text-secondary group-hover:text-text-primary transition-colors">Add New Application</h4>
                        <p className="text-[10px] text-text-tertiary mt-1 leading-relaxed max-w-[220px] mx-auto">Register new modular micro-frontends directly into the launchpad registry</p>
                      </div>
                    </div>
                    
                    <button
                      disabled
                      className="px-4 py-1.5 bg-surface-elevated/40 border border-border-accent text-text-tertiary text-[10px] font-black rounded-lg cursor-not-allowed group-hover:border-brand-accent/20 group-hover:text-brand-accent transition-colors"
                    >
                      Ecosystem Integration Blocked
                    </button>
                  </div>
                ))}

              </div>

              {/* Developer Link Section */}
              <div className="bg-surface-card border border-border-accent/40 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Internal Developer Framework</h4>
                  <p className="text-[10px] text-text-secondary leading-relaxed">Want to plug a custom tool or application? Create a new module folder under <code className="bg-surface-elevated px-1.5 py-0.5 rounded border border-border-accent text-[9px] font-mono text-brand-accent">/src/apps/</code> and register config.</p>
                </div>
                
                <Link 
                  href="https://github.com/google"
                  target="_blank"
                  className="px-4 py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent hover:border-brand-accent/30 text-xs font-black rounded-xl transition-all shadow-sm flex-shrink-0 cursor-pointer text-center"
                >
                  View Developer Boilerplate Docs
                </Link>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ─── DIGITAL VERIFICATION MODAL ─── */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            <div className="p-6 border-b border-border-accent/40 flex justify-between items-center">
              <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                Cryptographic Badge
              </span>
              <button 
                onClick={() => setShowVerificationModal(false)}
                className="text-xs hover:text-brand-accent font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 text-center space-y-5">
              <div className="h-16 w-16 bg-gradient-to-tr from-brand-accent to-success rounded-full flex items-center justify-center mx-auto text-xl shadow-lg animate-pulse">
                🛡️
              </div>
              <div>
                <h4 className="text-sm font-black text-text-primary">{activeUser.name}</h4>
                <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5">{activeUser.designation}</p>
                <p className="text-[9px] text-text-secondary font-mono mt-1">EID ID: {activeUser.eid}</p>
              </div>

              {/* Mock verification JWT */}
              <div className="bg-background-portal border border-border-accent/60 rounded-xl p-3.5 text-left space-y-2">
                <span className="text-[8px] text-text-tertiary font-black uppercase tracking-wider block">Decoded Token Payload</span>
                <pre className="text-[9px] font-mono text-text-secondary overflow-x-auto p-1.5 bg-surface-elevated/50 rounded border border-border-accent/30 leading-tight">
{`{
  "iss": "acme-corp-auth",
  "sub": "${activeUser.id}",
  "eid": "${activeUser.eid}",
  "name": "${activeUser.name}",
  "role": "${activeUser.role}",
  "dept": "${activeUser.verticalName}",
  "iat": ${Math.floor(Date.now() / 1000)},
  "verified": true
}`}
                </pre>
              </div>
              
              <span className="text-[8px] text-text-tertiary italic block">Verified securely using SHA-256 digital signature structure</span>
            </div>

            <div className="p-5 border-t border-border-accent/40 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify({
                    iss: "acme-corp-auth",
                    sub: activeUser.id,
                    eid: activeUser.eid,
                    name: activeUser.name,
                    role: activeUser.role,
                    dept: activeUser.verticalName,
                    iat: Math.floor(Date.now() / 1000),
                    verified: true
                  }, null, 2));
                  alert('Token copied to clipboard!');
                }}
                className="flex-1 py-2 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-colors shadow"
              >
                Copy Claims JSON
              </button>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent text-xs font-bold rounded-xl transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DEPARTMENT SCOPE MODAL ─── */}
      {showVerticalScopeModal && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            <div className="p-6 border-b border-border-accent/40 flex justify-between items-center">
              <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                Department Vertical scope
              </span>
              <button 
                onClick={() => setShowVerticalScopeModal(false)}
                className="text-xs hover:text-brand-accent font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center py-2">
                <span className="text-3xl block mb-2">🏢</span>
                <h4 className="text-base font-black text-text-primary">{activeUser.verticalName} Vertical</h4>
                <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5">Corporate organizational unit</p>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between border-b border-border-accent/30 pb-2">
                  <span className="text-text-secondary font-medium">Assigned Members</span>
                  <span className="text-text-primary font-black">
                    {initialData.allUsers.filter(u => u.verticalName === activeUser.verticalName).length} active employees
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-accent/30 pb-2">
                  <span className="text-text-secondary font-medium">Designation Levels</span>
                  <span className="text-text-primary font-bold">
                    {Array.from(new Set(initialData.allUsers.filter(u => u.verticalName === activeUser.verticalName).map(u => u.designation))).length} Roles
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-accent/30 pb-2">
                  <span className="text-text-secondary font-medium">Hierarchy Structure</span>
                  <span className="text-text-primary font-bold">Autonomous reporting coordinates</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider block">Department Overview</span>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    The {activeUser.verticalName} Vertical is a core unit designed to coordinate and scale specific mission-critical corporate operations. The department is structured hierarchically to maintain zero communications lag.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border-accent/40 flex justify-end">
              <button
                onClick={() => setShowVerticalScopeModal(false)}
                className="px-6 py-2 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-colors shadow"
              >
                Close Scope Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── GLOBAL OMNI-SEARCH BACKDROP MODAL (Cmd+K) ─── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            
            {/* Search input box */}
            <div className="p-5 border-b border-border-accent/40 flex items-center gap-3">
              <span className="text-base">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find peers by name, EID, or designation..."
                className="flex-1 bg-transparent text-text-primary placeholder-text-secondary focus:outline-none font-bold text-sm"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="px-2 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent text-[9px] text-text-secondary font-bold uppercase rounded-lg"
              >
                Esc
              </button>
            </div>

            {/* Search Results list */}
            <div className="p-5 max-h-[300px] overflow-y-auto space-y-4">
              
              {!searchQuery && (
                <div className="text-center py-6 text-text-secondary space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider text-text-tertiary">Quick Search Tips</p>
                  <p className="text-[10px] text-text-tertiary">Type to match names (e.g. "Smith"), EID codes (e.g. "E0005"), or designations (e.g. "Engineer").</p>
                </div>
              )}

              {searchQuery && filteredSearchUsers.map(u => (
                <div
                  key={u.id}
                  onClick={() => {
                    handlePivotProfile(u.id);
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="p-3 bg-background-portal hover:bg-brand-muted border border-border-accent/40 hover:border-brand-accent/20 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs">
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-text-primary leading-tight group-hover:text-brand-accent transition-colors">{u.name}</p>
                      <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5 tracking-wide">{u.designation} · <span className="text-text-tertiary font-bold">{u.verticalName}</span></p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-text-secondary">{u.eid}</span>
                </div>
              ))}

              {searchQuery && filteredSearchUsers.length === 0 && (
                <p className="text-xs text-text-secondary italic text-center py-6">No organizational peers match "{searchQuery}"</p>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
