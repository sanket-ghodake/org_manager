'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FocusScope } from '@radix-ui/react-focus-scope';

interface AdminPanelProps {
  session: any;
  users: any[];
  metadata: any[];
  systemLogs: any[];
  simulatedRole: string;
  loadWorkspaceData?: () => Promise<void>;
  // CSV Ingestion
  csvRawText: string;
  parsedRows: any[];
  validationErrors: { [k: number]: string[] };
  showErrorDrawer: boolean;
  commitLoading: boolean;
  setCsvRawText: (v: string) => void;
  handleCsvUpload: (text: string) => void;
  handleCellEdit: (i: number, f: string, v: string) => void;
  handleCommitIngest: () => void;
  setParsedRows: (v: any[]) => void;
  setShowErrorDrawer: (v: boolean) => void;
  // Metadata
  selectedMetaType: 'vertical' | 'job_level';
  metaNameInput: string;
  metaParentInput: string;
  setSelectedMetaType: (v: 'vertical' | 'job_level') => void;
  setMetaNameInput: (v: string) => void;
  setMetaParentInput: (v: string) => void;
  handleAddMetadata: (e: React.FormEvent) => void;
  handleMetadataReorder: (id: string, dir: 'up' | 'down') => void;
  handleMetadataDelete: (id: string) => void;
  sub?: 'dashboard' | 'users' | 'metadata' | 'access' | 'database' | 'logs';
  onSubChange?: (v: 'dashboard' | 'users' | 'metadata' | 'access' | 'database' | 'logs') => void;
  hideSidebar?: boolean;
}

export default function AdminPanel({
  session,
  users,
  metadata,
  systemLogs,
  simulatedRole,
  loadWorkspaceData,
  csvRawText,
  parsedRows,
  validationErrors,
  showErrorDrawer,
  commitLoading,
  setCsvRawText,
  handleCsvUpload,
  handleCellEdit,
  handleCommitIngest,
  setParsedRows,
  setShowErrorDrawer,
  selectedMetaType,
  metaNameInput,
  metaParentInput,
  setSelectedMetaType,
  setMetaNameInput,
  setMetaParentInput,
  handleAddMetadata,
  handleMetadataReorder,
  handleMetadataDelete,
  sub: propSub,
  onSubChange,
  hideSidebar = false,
}: AdminPanelProps) {
  // ─── NAV NAVIGATION STATE ───
  const [subInternal, setSubInternal] = useState<'dashboard' | 'users' | 'metadata' | 'access' | 'database' | 'logs'>('dashboard');
  const sub = propSub || subInternal;
  const setSub = (newSub: any) => {
    setSubInternal(newSub);
    if (onSubChange) {
      onSubChange(newSub);
    }
  };

  useEffect(() => {
    if (propSub) {
      setSubInternal(propSub);
    }
  }, [propSub]);

  // ─── LAYOUT RESIZING STATES ───
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [metaSplitWidth, setMetaSplitWidth] = useState(380);
  const [metaLeftMinimized, setMetaLeftMinimized] = useState(false);

  const [accessSplitWidth, setAccessSplitWidth] = useState(300);

  const [dbSplitWidth, setDbSplitWidth] = useState(300);
  const [dbSchemaMinimized, setDbSchemaMinimized] = useState(false);
  const [dbEditorHeight, setDbEditorHeight] = useState(220);

  const [logDrawerWidth, setLogDrawerWidth] = useState(450);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const [ingestDrawerWidth, setIngestDrawerWidth] = useState(650);

  // ─── ASYNC STATE SKELETONS ───
  const [isDataRefreshing, setIsDataRefreshing] = useState(false);

  // ─── GLOBAL NOTIFICATION TOAST STATE ───
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── DIRECTORY FILTER & SELECTION STATES ───
  const [userSearch, setUserSearch] = useState('');
  const [verticalFilter, setVerticalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // 'active' (password setup done) or 'pending' (default password)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // ─── ADD/EDIT SINGLE USER STATES ───
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'add' | 'edit'>('add');
  const [userForm, setUserForm] = useState({
    id: '',
    eid: '',
    name: '',
    email: '',
    role: 'user',
    designationId: '',
    verticalId: '',
    managerId: '',
  });
  const [userModalError, setUserModalError] = useState('');
  const [userModalLoading, setUserModalLoading] = useState(false);

  // ─── BULK INGESTION BATCH & MATRIX STATES ───
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestBatchProgress, setIngestBatchProgress] = useState(0);
  const [isIngestingRows, setIsIngestingRows] = useState(false);
  const [ingestStatusLogs, setIngestStatusLogs] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);

  // ─── HIERARCHY TREE STATES ───
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [inlineAddParentId, setInlineAddParentId] = useState<string | null>(null);
  const [inlineAddName, setInlineAddName] = useState('');

  // ─── ACCESS CONTROL STATES ───
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<string, Record<string, { read: boolean; write: boolean; execute: boolean }>>>({});
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // ─── DB TERMINAL STATES ───
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState('');
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [sqlSuggestions, setSqlSuggestions] = useState<string[]>([]);
  const [showSqlSuggestions, setShowSqlSuggestions] = useState(false);

  // ─── LOG STREAMING STATES ───
  const [logSearch, setLogSearch] = useState('');
  const [logSeverityFilter, setLogSeverityFilter] = useState('');

  // ─── UTILS & PERSISTENT ACCESS MATRIX INGESTION ───
  const adminUsers = useMemo(() => {
    return users.filter(u => u.role === 'super_admin' || u.role === 'admin' || u.role === 'read_only_admin');
  }, [users]);

  // Load and sync permissions from metadata
  useEffect(() => {
    const permRows = metadata.filter(m => m.type === 'admin_permissions');
    const newMatrix: typeof permissionsMatrix = {};
    
    // Seed default permissions for admins
    adminUsers.forEach(admin => {
      const dbRecord = permRows.find(m => m.name === admin.id);
      if (dbRecord && dbRecord.extendedAttributes) {
        newMatrix[admin.id] = dbRecord.extendedAttributes;
      } else {
        // Default based on roles
        const isSuper = admin.role === 'super_admin';
        const isReadOnly = admin.role === 'read_only_admin';
        newMatrix[admin.id] = {
          user_management: { read: true, write: isSuper || admin.role === 'admin', execute: isSuper || admin.role === 'admin' },
          metadata_config: { read: true, write: isSuper || admin.role === 'admin', execute: isSuper || admin.role === 'admin' },
          database_console: { read: true, write: isSuper, execute: isSuper },
          system_audit_logs: { read: true, write: isSuper, execute: isSuper },
        };
      }
    });
    setPermissionsMatrix(newMatrix);

    if (adminUsers.length > 0 && !selectedAdminId) {
      setSelectedAdminId(adminUsers[0].id);
    }
  }, [metadata, adminUsers]);

  // Safeguard Checks
  const verifyPrivilege = (module: string, action: 'read' | 'write' | 'execute') => {
    if (simulatedRole === 'super_admin') return true;
    
    // Look up current session user's permissions
    const sessionUser = users.find(u => u.email === session?.email);
    if (!sessionUser) return false;

    // Check if read-only admin
    if (simulatedRole === 'read_only_admin' && action !== 'read') {
      return false;
    }

    const perms = permissionsMatrix[sessionUser.id]?.[module];
    if (perms) {
      return perms[action];
    }
    
    return false;
  };

  // ─── RESIZING HANDLER MOUSE LISTENERS ───
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
      // Invert delta if shrinking from right/bottom
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

  const startResizingLogDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = logDrawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // Swapped subtraction since drawer is right-anchored
      setLogDrawerWidth(Math.max(300, Math.min(800, startWidth + delta)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResizingIngestDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = ingestDrawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setIngestDrawerWidth(Math.max(400, Math.min(1100, startWidth + delta)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ─── FILTERED USER LISTS ───
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.eid.toLowerCase().includes(userSearch.toLowerCase());
      const matchesVertical = !verticalFilter || u.vertical_id === verticalFilter;
      
      // Status Check: isPasswordChanged === true is active/set; false is default pending
      const matchesStatus = !statusFilter || 
        (statusFilter === 'active' && u.is_password_changed) ||
        (statusFilter === 'pending' && !u.is_password_changed);

      return matchesSearch && matchesVertical && matchesStatus;
    });
  }, [users, userSearch, verticalFilter, statusFilter]);

  // ─── STATS & KPI LOGIC ───
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalMetadata = metadata.length;
    const totalLogs = systemLogs.length;

    const roleDistribution = users.reduce((acc: any, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    const verticalDistribution = users.reduce((acc: any, u) => {
      const vertName = u.vertical || 'Unassigned';
      acc[vertName] = (acc[vertName] || 0) + 1;
      return acc;
    }, {});

    const statusCounts = users.reduce((acc: any, u) => {
      const state = u.is_password_changed ? 'active' : 'pending';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, { active: 0, pending: 0 });

    return {
      totalUsers,
      totalMetadata,
      totalLogs,
      roleDistribution,
      verticalDistribution,
      statusCounts,
    };
  }, [users, metadata, systemLogs]);

  // ─── DIRECTORY ACTIONS ───
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllUsersSelection = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!verifyPrivilege('user_management', 'write')) {
      showToast('Privilege Violation: Action blocked for this administrative profile.', 'error');
      return;
    }

    if (selectedUserIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedUserIds.size} selected employee records?`)) return;

    setIsDataRefreshing(true);
    try {
      const idsArray = Array.from(selectedUserIds).map(id => `'${id}'`).join(',');
      // Unlink reporting direct managers
      const unlinkQuery = `UPDATE users SET manager_id = NULL WHERE manager_id IN (${idsArray});`;
      const deleteQuery = `DELETE FROM users WHERE id IN (${idsArray});`;

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${unlinkQuery} ${deleteQuery}` })
      });

      if (res.ok) {
        setSelectedUserIds(new Set());
        showToast('Successfully deleted personnel profile records.', 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete records', 'error');
      }
    } catch (e) {
      showToast('Network request failed', 'error');
    } finally {
      setIsDataRefreshing(false);
    }
  };

  const handleBulkModifyRole = async (newRole: string) => {
    if (!verifyPrivilege('user_management', 'write')) {
      showToast('Privilege Violation: Action blocked for this administrative profile.', 'error');
      return;
    }
    if (selectedUserIds.size === 0) return;

    setIsDataRefreshing(true);
    try {
      const idsArray = Array.from(selectedUserIds).map(id => `'${id}'`).join(',');
      const query = `UPDATE users SET role = '${newRole}', updated_at = CURRENT_TIMESTAMP WHERE id IN (${idsArray});`;
      
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (res.ok) {
        setSelectedUserIds(new Set());
        showToast(`Successfully updated role to ${newRole} for selected profiles.`, 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update roles', 'error');
      }
    } catch (e) {
      showToast('Network request failed', 'error');
    } finally {
      setIsDataRefreshing(false);
    }
  };

  // Add/Edit Single User operations
  const openAddUserModal = () => {
    setUserForm({
      id: '',
      eid: '',
      name: '',
      email: '',
      role: 'user',
      designationId: '',
      verticalId: '',
      managerId: '',
    });
    setUserModalMode('add');
    setUserModalError('');
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: any) => {
    setUserForm({
      id: user.id,
      eid: user.eid,
      name: user.name,
      email: user.email,
      role: user.role,
      designationId: user.designation_id || '',
      verticalId: user.vertical_id || '',
      managerId: user.manager_id || '',
    });
    setUserModalMode('edit');
    setUserModalError('');
    setIsUserModalOpen(true);
  };

  const saveSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError('');
    setUserModalLoading(true);

    if (!verifyPrivilege('user_management', 'write')) {
      setUserModalError('Privilege Violation: Action blocked for this administrative profile.');
      setUserModalLoading(false);
      return;
    }

    const isEdit = userModalMode === 'edit';
    const eidRegex = /^E\d{4}$/;
    if (!userForm.eid || !eidRegex.test(userForm.eid)) {
      setUserModalError('EID format invalid (Must be E followed by 4 digits)');
      setUserModalLoading(false);
      return;
    }

    try {
      let query = '';
      if (isEdit) {
        query = `UPDATE users SET 
          eid = '${userForm.eid.trim()}', 
          name = '${userForm.name.trim()}', 
          email = '${userForm.email.toLowerCase().trim()}', 
          role = '${userForm.role}', 
          designation_id = ${userForm.designationId ? `'${userForm.designationId}'` : 'NULL'}, 
          vertical_id = ${userForm.verticalId ? `'${userForm.verticalId}'` : 'NULL'}, 
          manager_id = ${userForm.managerId ? `'${userForm.managerId}'` : 'NULL'},
          updated_at = CURRENT_TIMESTAMP
          WHERE id = '${userForm.id}';`;
      } else {
        const defaultPasswordHash = '$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm'; // bcrypt hash for 'password123'
        const randomId = crypto.randomUUID();
        query = `INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id) 
          VALUES (
            '${randomId}',
            '${userForm.eid.trim()}', 
            '${userForm.name.trim()}', 
            '${userForm.email.toLowerCase().trim()}', 
            '${defaultPasswordHash}', 
            false, 
            '${userForm.role}', 
            ${userForm.designationId ? `'${userForm.designationId}'` : 'NULL'}, 
            ${userForm.verticalId ? `'${userForm.verticalId}'` : 'NULL'}, 
            ${userForm.managerId ? `'${userForm.managerId}'` : 'NULL'}
          );`;
      }

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (res.ok) {
        setIsUserModalOpen(false);
        showToast(isEdit ? 'Updated personnel record.' : 'Created default personnel record.', 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        setUserModalError(err.error || 'Failed to save user profile record');
      }
    } catch (e: any) {
      setUserModalError(e.message || 'Connection failure');
    } finally {
      setUserModalLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!verifyPrivilege('user_management', 'write')) {
      showToast('Privilege Violation: Action blocked for this administrative profile.', 'error');
      return;
    }
    if (!confirm(`Reset credentials for "${userName}"? They will be forced to configure a new credential on login.`)) return;

    try {
      const defaultPasswordHash = '$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm';
      const query = `UPDATE users SET password_hash = '${defaultPasswordHash}', is_password_changed = false, updated_at = CURRENT_TIMESTAMP WHERE id = '${userId}';`;

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (res.ok) {
        showToast(`Credentials reset successfully. Temporary key: password123`, 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Credential reset failed', 'error');
      }
    } catch (e) {
      showToast('Connection failed', 'error');
    }
  };

  const handleDeleteSingleUser = async (userId: string, userName: string) => {
    if (!verifyPrivilege('user_management', 'write')) {
      showToast('Privilege Violation: Action blocked for this administrative profile.', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to remove "${userName}"? This will disconnect their direct reports.`)) return;

    try {
      const preQuery = `UPDATE users SET manager_id = NULL WHERE manager_id = '${userId}';`;
      const deleteQuery = `DELETE FROM users WHERE id = '${userId}';`;

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${preQuery} ${deleteQuery}` })
      });

      if (res.ok) {
        showToast('Successfully deleted employee profile.', 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Delete failed', 'error');
      }
    } catch (e) {
      showToast('Connection failed', 'error');
    }
  };

  // ─── DRAG & DROP BULK UPLOAD HANDLERS ───
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = (ev: any) => {
        handleCsvUpload(ev.target.result);
        simulateIngestionBatchLogs();
      };
      r.readAsText(file);
    }
  };

  const simulateIngestionBatchLogs = () => {
    setIsIngestingRows(true);
    setIngestBatchProgress(5);
    setIngestStatusLogs(["[INFO] Parsing raw ingestion data source...", "[INFO] CSV Headers mapped successfully."]);

    setTimeout(() => {
      setIngestBatchProgress(35);
      setIngestStatusLogs(prev => [...prev, "[INFO] Pre-validating schema structure variables...", "[WARN] Row #2 vertical assignment mismatch auto-flagged."]);
    }, 400);

    setTimeout(() => {
      setIngestBatchProgress(75);
      setIngestStatusLogs(prev => [...prev, "[INFO] Compiling local matrix correction records...", "[INFO] Integrity check complete. Awaiting direct operator input corrections."]);
      setIngestBatchProgress(100);
      setIsIngestingRows(false);
    }, 900);
  };

  // ─── ACCESS CONTROL ASSIGNMENT MUTATION ───
  const handlePermissionToggle = async (adminId: string, module: string, variable: 'read' | 'write' | 'execute') => {
    if (simulatedRole !== 'super_admin') {
      showToast('Access Violation: Only Super Admin profiles can mutate permissions.', 'error');
      return;
    }

    const currentPerms = permissionsMatrix[adminId] || {
      user_management: { read: false, write: false, execute: false },
      metadata_config: { read: false, write: false, execute: false },
      database_console: { read: false, write: false, execute: false },
      system_audit_logs: { read: false, write: false, execute: false },
    };

    const targetModule = currentPerms[module] || { read: false, write: false, execute: false };
    const updatedModule = { ...targetModule, [variable]: !targetModule[variable] };
    const updatedPerms = { ...currentPerms, [module]: updatedModule };

    // Optimistic Update
    setPermissionsMatrix(prev => ({
      ...prev,
      [adminId]: updatedPerms
    }));

    setIsSavingPermissions(true);
    try {
      // 1. Look up if record already exists in database
      const checkRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT id FROM structural_metadata WHERE type = 'admin_permissions' AND name = '${adminId}' LIMIT 1;` })
      });
      const checkData = await checkRes.json();
      
      let query = '';
      if (checkData.rows && checkData.rows.length > 0) {
        // Update
        const metaId = checkData.rows[0].id;
        query = `UPDATE structural_metadata SET extended_attributes = '${JSON.stringify(updatedPerms)}'::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = '${metaId}';`;
      } else {
        // Insert
        query = `INSERT INTO structural_metadata (id, type, name, extended_attributes) VALUES (gen_random_uuid(), 'admin_permissions', '${adminId}', '${JSON.stringify(updatedPerms)}'::jsonb);`;
      }

      const saveRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (saveRes.ok) {
        showToast('Administrative privileges database matrix updated.', 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        // Rollback
        setPermissionsMatrix(prev => ({
          ...prev,
          [adminId]: currentPerms
        }));
        showToast('Failed to persist permissions updates.', 'error');
      }
    } catch (e) {
      setPermissionsMatrix(prev => ({
        ...prev,
        [adminId]: currentPerms
      }));
      showToast('Network error saving permissions', 'error');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // ─── SQL EDITOR TERMINAL ACTIONS ───
  const runSQLQuery = async () => {
    setQueryError('');
    setQueryResult(null);

    const destructiveKeywords = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter'];
    const isDestructive = destructiveKeywords.some(keyword => 
      sqlQuery.toLowerCase().includes(keyword)
    );

    if (isDestructive && !verifyPrivilege('database_console', 'write')) {
      setQueryError('Privilege Violation: Administrative profile lacks write/execute privileges to execute destructive commands.');
      showToast('SQL Execution Blocked: Destructive statement intercepted.', 'error');
      return;
    }

    setIsQueryRunning(true);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      if (res.ok) {
        setQueryResult(data);
        showToast('SQL Statement executed successfully.', 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        setQueryError(data.error || 'Execution failed.');
      }
    } catch (err: any) {
      setQueryError(err.message || 'Execution failed.');
    } finally {
      setIsQueryRunning(false);
    }
  };

  const handleSqlChange = (val: string) => {
    setSqlQuery(val);
    const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE', 'DROP', 'users', 'structural_metadata', 'system_logs'];
    const lastWord = val.split(/[\s,;]+/).pop() || '';
    if (lastWord.length >= 2) {
      const filtered = keywords.filter(kw => kw.toLowerCase().startsWith(lastWord.toLowerCase()) && kw !== lastWord);
      setSqlSuggestions(filtered);
      setShowSqlSuggestions(filtered.length > 0);
    } else {
      setShowSqlSuggestions(false);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    const words = sqlQuery.split(/([\s,;]+)/);
    words.pop(); // Remove the typing part
    words.push(suggestion);
    setSqlQuery(words.join(''));
    setShowSqlSuggestions(false);
  };

  const highlightSQLKeywords = (code: string) => {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'DROP', 'TABLE', 'LIMIT', 'JOIN', 'LEFT', 'ON', 'ORDER', 'BY', 'DESC', 'ASC'];
    let highlighted = code;
    
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<span class="text-brand-accent font-bold">${kw.toUpperCase()}</span>`);
    });
    
    return highlighted;
  };

  // ─── HIERARCHICAL STRUCTURAL BLUEPRINT TREE RENDERING ───
  const treeItems = useMemo(() => {
    return metadata.filter(m => m.type === 'vertical');
  }, [metadata]);

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleInlineAddMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineAddName.trim() || !inlineAddParentId) return;

    if (!verifyPrivilege('metadata_config', 'write')) {
      showToast('Privilege Violation: Action blocked for this administrative profile.', 'error');
      return;
    }

    setIsDataRefreshing(true);
    try {
      const res = await fetch('/api/admin/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vertical',
          name: inlineAddName.trim(),
          parentId: inlineAddParentId,
          sortOrder: metadata.filter(m => m.type === 'vertical').length + 1
        })
      });
      if (res.ok) {
        setInlineAddName('');
        setInlineAddParentId(null);
        showToast('Successfully appended structural vertical branch.', 'success');
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        showToast('Failed to append branch.', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    } finally {
      setIsDataRefreshing(false);
    }
  };

  const renderTreeNodes = (parentId: string | null = null, depth = 0) => {
    const nodes = treeItems.filter(node => node.parent_id === parentId);
    if (nodes.length === 0) return null;

    return (
      <div className={`space-y-3 pl-4 border-l border-border-accent/40 ${depth > 0 ? 'mt-2' : ''}`}>
        {nodes.map(node => {
          const isCollapsed = collapsedNodes.has(node.id);
          const hasChildren = treeItems.some(n => n.parent_id === node.id);
          const directReports = users.filter(u => u.vertical_id === node.id);

          return (
            <div key={node.id} className="relative group/tree animate-fadeIn">
              {/* Connector line for child nodes */}
              <div className="absolute -left-4 top-5 w-4 h-[1px] bg-border-accent/40"></div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleNodeCollapse(node.id)}
                  disabled={!hasChildren}
                  className={`p-1 rounded hover:bg-background-portal text-text-tertiary transition-transform ${
                    isCollapsed ? '-rotate-90' : ''
                  } ${!hasChildren ? 'opacity-0 cursor-default' : 'opacity-100'}`}
                >
                  ▼
                </button>

                <div className="flex-1 flex items-center justify-between p-3.5 bg-surface-card border border-border-accent hover:border-brand-accent/30 rounded-xl transition-all shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-brand-accent shadow shadow-brand-accent"></div>
                    <div>
                      <span className="text-xs font-bold text-text-primary">{node.name}</span>
                      <span className="text-[10px] text-text-tertiary ml-2">({directReports.length} members)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover/tree:opacity-100 transition-opacity">
                    <button
                      onClick={() => setInlineAddParentId(node.id)}
                      className="p-1 rounded bg-background-portal border border-border-accent hover:border-brand-accent/40 text-brand-accent text-[9px] px-2 py-0.5 font-extrabold flex items-center gap-1"
                      title="Add sub-team branch"
                    >
                      <span>＋</span> sub-team
                    </button>
                    <button
                      onClick={() => handleMetadataDelete(node.id)}
                      className="p-1 rounded hover:bg-rose-500/10 text-rose-500 text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Add input */}
              {inlineAddParentId === node.id && (
                <form onSubmit={handleInlineAddMetadata} className="mt-2 ml-10 p-3 bg-surface-card border border-brand-accent/30 rounded-xl flex items-center gap-2 shadow-inner">
                  <input
                    type="text"
                    value={inlineAddName}
                    onChange={e => setInlineAddName(e.target.value)}
                    placeholder="Sub-team title..."
                    required
                    className="flex-1 px-3 py-1.5 bg-background-portal border border-input-border rounded-lg text-xs outline-none focus:border-brand-accent"
                    autoFocus
                  />
                  <button type="submit" className="px-3 py-1.5 bg-brand-accent text-white text-[10px] font-black uppercase rounded-lg shadow-sm">Add</button>
                  <button type="button" onClick={() => setInlineAddParentId(null)} className="px-3 py-1.5 border border-border-accent rounded-lg text-[10px] hover:bg-background-portal text-text-secondary">Cancel</button>
                </form>
              )}

              {/* Recursive child list */}
              {!isCollapsed && renderTreeNodes(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── LOGS FILTER & VIRTUAL SCROLLING ───
  const filteredLogs = useMemo(() => {
    return systemLogs.filter(l => {
      const matchesSearch =
        l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
        (l.payload && JSON.stringify(l.payload).toLowerCase().includes(logSearch.toLowerCase())) ||
        (l.ip_address && l.ip_address.includes(logSearch)) ||
        (l.user_id && l.user_id.toLowerCase().includes(logSearch.toLowerCase()));
      const matchesSeverity = !logSeverityFilter || l.severity === logSeverityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [systemLogs, logSearch, logSeverityFilter]);

  const logParentRef = useRef<HTMLDivElement>(null);
  
  const logVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => logParentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const severityBadge = (severity: string) => {
    const map: Record<string, string> = {
      INFO: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
      WARN: 'bg-warning/10 text-warning-text border border-warning/20',
      ERROR: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
      CRITICAL: 'bg-red-500/15 text-red-500 border border-red-500/30 animate-pulse font-extrabold',
    };
    return map[severity] || 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
  };

  const getLogSeverityColorClass = (severity: string) => {
    const map: Record<string, string> = {
      INFO: 'text-text-secondary hover:bg-table-row-hover',
      WARN: 'text-warning-text border-l-2 border-l-warning/60 bg-warning/5 hover:bg-warning/10',
      ERROR: 'text-rose-500 border-l-2 border-l-rose-500/60 bg-rose-500/5 hover:bg-rose-500/10',
      CRITICAL: 'text-red-500 border-l-4 border-l-red-500 bg-red-500/10 hover:bg-red-500/15 font-bold animate-pulse',
    };
    return map[severity] || 'text-text-secondary hover:bg-table-row-hover';
  };

  return (
    <div className="flex-1 flex min-h-0 bg-background-portal text-text-primary relative overflow-hidden h-full" style={hideSidebar ? { height: '100%' } : { height: 'calc(100vh - 4.1rem)' }}>
      
      {/* ─── GLOBAL TOAST NOTIFICATION ─── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 animate-fadeIn ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
          'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
        }`}>
          <span className="h-2 w-2 rounded-full bg-current animate-ping"></span>
          <p className="text-xs font-bold font-mono">{toast.message}</p>
        </div>
      )}

      {/* ─── LEFT SIDEBAR NAVIGATION (Resizable) ─── */}
      {!hideSidebar && (
        <aside
          className="relative bg-sidebar-bg border-r border-border-accent flex flex-col transition-all flex-shrink-0"
          style={{ width: sidebarCollapsed ? 64 : sidebarWidth }}
        >
          <div className="flex-1 flex flex-col min-h-0">
            
            {/* Collapse/Expand Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute top-4 -right-3 h-6 w-6 rounded-full border border-border-accent bg-surface-card hover:bg-background-portal flex items-center justify-center text-[10px] text-text-secondary z-20 shadow cursor-pointer transition-transform duration-200"
              style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none' }}
            >
              ◀
            </button>

            {/* Profile Card Summary */}
            <div className="p-4 border-b border-border-accent bg-surface-card/10 flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-accent to-emerald-500 flex items-center justify-center text-white font-extrabold shadow flex-shrink-0 text-sm">
                {session?.name?.charAt(0) || 'A'}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-black truncate text-text-primary">{session?.name}</p>
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-brand-accent/15 text-brand-accent border border-brand-accent/20">
                    {simulatedRole}
                  </span>
                </div>
              )}
            </div>

            {/* Sidebar Nav Items */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                { id: 'users', label: 'Users & Ingest', icon: '👥' },
                { id: 'metadata', label: 'Metadata/Org', icon: '🪢' },
                { id: 'access', label: 'Access Control', icon: '🔐' },
                { id: 'database', label: 'DB Terminal', icon: '🗄️' },
                { id: 'logs', label: 'Audit Logs', icon: '📜' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setSub(item.id as any)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                    sub === item.id
                      ? 'bg-sidebar-active text-sidebar-text-active shadow-sm font-black'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
                  }`}
                  title={item.label}
                >
                  <span className="text-sm">{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* Resizer Handle */}
          {!sidebarCollapsed && (
            <div
              className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
              onMouseDown={(e) => startResizing(e, sidebarWidth, 'horizontal', 150, 400, setSidebarWidth)}
            />
          )}
        </aside>
      )}

      {/* ─── WORKSPACE PANE (Zero layout shifts, skeletons loading) ─── */}
      <main className="flex-1 flex flex-col min-w-0 bg-background-portal overflow-hidden relative">
        
        {isDataRefreshing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-accent to-success animate-pulse z-30" />
        )}

        {/* ── 1. MODULE: DASHBOARD ── */}
        {sub === 'dashboard' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-xl font-black tracking-tight text-text-primary">Admin Control Center</h1>
              <p className="text-[11px] text-text-secondary mt-0.5">Global telemetric activity monitoring and configuration platform core.</p>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { label: 'Active Roster', value: stats.totalUsers, desc: `${stats.statusCounts.active} setup done • ${stats.statusCounts.pending} credentials pending`, color: 'border-l-4 border-brand-accent' },
                { label: 'Metadata Units', value: stats.totalMetadata, desc: 'Structural Vertical units & designated classes', color: 'border-l-4 border-success' },
                { label: 'Telemetry Buffer', value: stats.totalLogs, desc: 'Rotating event logs count limit of 100,000', color: 'border-l-4 border-warning' },
              ].map((kpi, idx) => (
                <div key={idx} className={`p-4.5 rounded-2xl bg-surface-card border border-border-accent shadow-sm flex flex-col justify-between ${kpi.color}`}>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-bold">{kpi.label}</span>
                    <h2 className="text-2xl font-black mt-1 text-text-primary">{kpi.value}</h2>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-2.5">{kpi.desc}</p>
                </div>
              ))}
            </div>

            {/* Sub Charts & Distribution Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Departmental Vertical Spread */}
              <div className="p-5 rounded-2xl bg-surface-card border border-border-accent shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-4">Vertical Divisions Spread</h3>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {Object.entries(stats.verticalDistribution).map(([dept, count]: [string, any]) => {
                      const percentage = Math.round((count / (stats.totalUsers || 1)) * 100);
                      return (
                        <div key={dept}>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-text-primary truncate max-w-[200px]">{dept}</span>
                            <span className="text-text-secondary">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-background-portal rounded-full overflow-hidden">
                            <div className="h-full bg-brand-accent rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border-accent/40 flex items-center justify-between text-[10px] text-text-tertiary">
                  <span>Capacity: Dynamic allocation active</span>
                  <button onClick={() => setSub('metadata')} className="text-brand-accent font-bold hover:underline">Configure Structures</button>
                </div>
              </div>

              {/* Roles Breakdown & System State */}
              <div className="p-5 rounded-2xl bg-surface-card border border-border-accent shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-4">Privilege Distribution Matrix</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(stats.roleDistribution).map(([role, count]: [string, any]) => (
                      <div key={role} className="p-3 bg-background-portal border border-border-accent rounded-xl text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-brand-accent/10 text-brand-accent">
                          {role}
                        </span>
                        <h4 className="text-xl font-black mt-2 text-text-primary">{count}</h4>
                        <span className="text-[9px] text-text-tertiary">profiles</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border-accent/40 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Admin Control Mode</h4>
                    <p className="text-[10px] text-text-secondary">Simulated level: <span className="font-extrabold text-brand-accent uppercase">{simulatedRole}</span></p>
                  </div>
                  <button
                    onClick={() => setSub('users')}
                    className="px-3 py-1.5 bg-brand-accent hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Manage Roster
                  </button>
                </div>
              </div>

            </div>

            {/* Recent Activities */}
            <div className="p-5 rounded-2xl bg-surface-card border border-border-accent shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[11px] uppercase tracking-wider text-text-secondary">Recent System Activities</h3>
                <button onClick={() => setSub('logs')} className="text-xs text-brand-accent font-semibold hover:underline">View Stream</button>
              </div>
              <div className="divide-y divide-border-accent/40 max-h-[200px] overflow-y-auto pr-1">
                {systemLogs.slice(0, 5).map((log, idx) => (
                  <div key={idx} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <p className="font-bold text-text-primary">{log.action}</p>
                      <p className="text-[9px] text-text-tertiary mt-0.5">
                        IP: {log.ip_address} • Operator ID: {log.user_id?.substring(0, 8) || 'System'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${severityBadge(log.severity)}`}>
                        {log.severity}
                      </span>
                      <span className="text-[9px] text-text-tertiary font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 2. MODULE: USER MANAGEMENT & INGESTION ── */}
        {sub === 'users' && (
          <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
            
            {/* Tab sub-headers */}
            <div className="px-6 py-4 border-b border-border-accent flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-background-portal p-1 rounded-xl border border-border-accent">
                <button
                  onClick={() => setShowErrorDrawer(false)}
                  className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    !showErrorDrawer ? 'bg-surface-card text-brand-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Active Roster
                </button>
                <button
                  onClick={() => setShowErrorDrawer(true)}
                  className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    showErrorDrawer ? 'bg-surface-card text-brand-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Bulk Ingestion Upload
                </button>
              </div>

              {!showErrorDrawer && (
                <button
                  onClick={openAddUserModal}
                  className="px-4 py-2 bg-gradient-to-r from-brand-accent to-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow"
                >
                  <span>＋</span> Add Single User
                </button>
              )}
            </div>

            {/* ACTIVE ROSTER SUB-VIEW */}
            {!showErrorDrawer && (
              <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4">
                
                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface-card p-4 border border-border-accent rounded-2xl shadow-sm flex-shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by Name, EID, Email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl text-xs outline-none"
                    />
                    <span className="absolute left-2.5 top-2.5 text-text-tertiary">🔍</span>
                  </div>

                  <div>
                    <select
                      value={verticalFilter}
                      onChange={e => setVerticalFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                    >
                      <option value="">All Verticals</option>
                      {metadata.filter(m => m.type === 'vertical').map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active (Credentials Configured)</option>
                      <option value="pending">Pending (Default Password)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end text-[10px] text-text-secondary font-bold">
                    Showing {filteredUsers.length} of {users.length} profiles
                  </div>
                </div>

                {/* Directory Table Layout (Virtual Scrolling ready) */}
                <div className="flex-1 border border-border-accent rounded-2xl overflow-hidden bg-surface-card shadow-sm min-h-0 flex flex-col">
                  <div className="overflow-auto flex-1">
                    <table className="min-w-full text-xs">
                      <thead className="bg-table-header border-b border-border-accent sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left w-8">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                              onChange={toggleAllUsersSelection}
                              className="rounded border-input-border"
                            />
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">EID</th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">Personnel Record</th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">Email Address</th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">Designation</th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">Vertical</th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">Status</th>
                          <th className="px-4 py-3 text-right font-black uppercase text-[10px] text-text-secondary">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-accent/40 bg-surface-card">
                        {filteredUsers.map(u => {
                          const isChecked = selectedUserIds.has(u.id);
                          return (
                            <tr key={u.id} className={`hover:bg-table-row-hover transition-colors ${isChecked ? 'bg-brand-muted/30' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleUserSelection(u.id)}
                                  className="rounded border-input-border"
                                />
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-text-primary">{u.eid}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-brand-accent to-emerald-500 text-white font-extrabold flex items-center justify-center text-[10px] uppercase">
                                    {u.name?.charAt(0)}
                                  </div>
                                  <span className="font-bold text-text-primary">{u.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-text-secondary font-mono text-[11px]">{u.email}</td>
                              <td className="px-4 py-3 text-text-secondary">{u.designation || 'Specialist'}</td>
                              <td className="px-4 py-3 text-text-secondary">{u.vertical || 'Acme HQ'}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`h-2 w-2 rounded-full ${u.is_password_changed ? 'bg-success shadow shadow-success' : 'bg-warning shadow shadow-warning'}`} />
                                  <span className="text-[10px] font-bold text-text-secondary">
                                    {u.is_password_changed ? 'Active' : 'Setup Pending'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                <button
                                  onClick={() => handleResetPassword(u.id, u.name)}
                                  className="px-2 py-1 bg-warning/10 hover:bg-warning/20 text-warning-text rounded text-[10px] font-bold"
                                  title="Reset credentials"
                                >
                                  Reset Key
                                </button>
                                <button
                                  onClick={() => openEditUserModal(u)}
                                  className="px-2 py-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded text-[10px] font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteSingleUser(u.id, u.name)}
                                  className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Floating Utility Panel for checked list */}
                {selectedUserIds.size > 0 && (
                  <div className="bg-surface-elevated border-2 border-brand-accent/40 rounded-2xl p-4 flex items-center justify-between shadow-2xl animate-fadeIn flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-brand-accent animate-ping"></div>
                      <span className="text-xs font-bold text-text-primary">
                        {selectedUserIds.size} personnel record files selected for action
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleBulkModifyRole(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="px-3 py-1.5 bg-background-portal border border-input-border rounded-xl text-xs outline-none font-bold"
                      >
                        <option value="">Modify Roles...</option>
                        <option value="user">Set role: user</option>
                        <option value="admin">Set role: admin</option>
                        <option value="read_only_admin">Set role: read_only_admin</option>
                      </select>

                      <button
                        onClick={handleBulkDelete}
                        className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow"
                      >
                        Delete Selected
                      </button>
                      
                      <button
                        onClick={() => setSelectedUserIds(new Set())}
                        className="px-3.5 py-1.5 border border-border-accent rounded-xl text-xs hover:bg-background-portal font-semibold text-text-secondary"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BULK INGESTION SUB-VIEW */}
            {showErrorDrawer && (
              <div className="flex-1 flex flex-col min-h-0 p-6 space-y-6 relative overflow-hidden">
                <div className="max-w-4xl space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Bulk User Ingestion</h3>
                    <p className="text-[11px] text-text-secondary mt-0.5">Drag & drop raw files or copy paste credentials. Cells containing validation faults are corrected inline.</p>
                  </div>

                  {/* Drag and drop target */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file'; input.accept = '.csv';
                      input.onchange = (e: any) => {
                        const file = e.target.files[0];
                        if (file) {
                          const r = new FileReader();
                          r.onload = (ev: any) => {
                            handleCsvUpload(ev.target.result);
                            simulateIngestionBatchLogs();
                          };
                          r.readAsText(file);
                        }
                      };
                      input.click();
                    }}
                    className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all bg-surface-card cursor-pointer group ${
                      isDragOver ? 'border-brand-accent bg-brand-muted/10 scale-95 shadow-inner' : 'border-border-accent hover:border-brand-accent/40'
                    }`}
                  >
                    <div className="p-3 rounded-2xl bg-brand-accent/10 mb-3 group-hover:scale-110 transition-transform">
                      📂
                    </div>
                    <p className="text-xs font-black text-text-primary">Click to select or Drop .csv / .xlsx file</p>
                    <p className="text-[10px] text-text-tertiary mt-1">Acceptable columns: EID, Name, Email, Role, Designation, Vertical, ManagerEID</p>
                  </div>

                  {/* Template display */}
                  <div className="p-4 rounded-2xl border border-border-accent bg-surface-card">
                    <span className="text-[9px] font-black uppercase text-text-secondary tracking-widest block mb-1.5">Target Template Header</span>
                    <pre className="font-mono text-xs text-brand-accent select-all overflow-x-auto p-3.5 bg-background-portal rounded-xl">
                      EID,Name,Email,Role,Designation,Vertical,ManagerEID
                    </pre>
                  </div>
                </div>

                {/* ERROR CORRECTION SPLIT-DRAWER ( Radix Focus Trap ) */}
                {parsedRows.length > 0 && (
                  <div className="absolute top-0 right-0 bottom-0 z-40 bg-sidebar-bg border-l border-border-accent shadow-2xl flex flex-col min-h-0" style={{ width: ingestDrawerWidth }}>
                    
                    {/* Resizer handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-accent z-50"
                      onMouseDown={startResizingIngestDrawer}
                    />

                    <FocusScope trapped={true}>
                      <div className="flex-1 flex flex-col min-h-0">
                        {/* Drawer Header */}
                        <div className="px-5 py-4 border-b border-border-accent bg-surface-card/20 flex items-center justify-between flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-warning animate-pulse" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">Ingestion Error Correction Drawer</h4>
                          </div>
                          <button
                            onClick={() => {
                              setParsedRows([]);
                              setCsvRawText('');
                              setIngestBatchProgress(0);
                              setIngestStatusLogs([]);
                            }}
                            className="text-xs font-bold border border-border-accent px-3 py-1.5 rounded-xl hover:bg-background-portal text-text-secondary"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Drawer Split Contents */}
                        <div className="flex-1 flex min-h-0 divide-x divide-border-accent/40">
                          
                          {/* Left Side: Batch Progress tracker */}
                          <div className="w-1/3 p-4 space-y-4 overflow-y-auto flex flex-col justify-between">
                            <div className="space-y-4">
                              <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest block">Batch Progress Tracker</span>
                              
                              <div className="space-y-2 bg-background-portal p-3.5 rounded-2xl border border-border-accent">
                                <div className="flex justify-between text-[10px] font-bold text-text-secondary">
                                  <span>Ingestion Status</span>
                                  <span>{ingestBatchProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-surface-card border border-border-accent rounded-full overflow-hidden">
                                  <div className="h-full bg-brand-accent transition-all duration-300" style={{ width: `${ingestBatchProgress}%` }} />
                                </div>
                              </div>

                              <div className="space-y-1.5 font-mono text-[9px] text-text-secondary">
                                {ingestStatusLogs.map((logStr, idx) => (
                                  <p key={idx} className="truncate">{logStr}</p>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={handleCommitIngest}
                              disabled={Object.keys(validationErrors).length > 0 || commitLoading}
                              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase rounded-xl transition-all shadow flex items-center justify-center gap-2"
                            >
                              {commitLoading ? 'Writing...' : `Commit ${parsedRows.length - Object.keys(validationErrors).length} rows`}
                            </button>
                          </div>

                          {/* Right Side: Validation Matrix Grid */}
                          <div className="flex-1 p-4 flex flex-col min-h-0 space-y-3">
                            <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest block">Validation Matrix (Double click to edit cell)</span>
                            
                            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                              {parsedRows.map((row, rIdx) => {
                                const rowErrs = validationErrors[rIdx] || [];
                                const isFaulty = rowErrs.length > 0;
                                
                                return (
                                  <div
                                    key={rIdx}
                                    className={`p-3.5 rounded-2xl border transition-all ${
                                      isFaulty ? 'bg-rose-500/5 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-3 text-[10px] font-bold">
                                      <span className="text-text-primary">Line #{rIdx + 1}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                        isFaulty ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                                      }`}>
                                        {isFaulty ? `${rowErrs.length} faults` : 'Valid'}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      {['eid', 'name', 'email', 'designation', 'vertical', 'role'].map(field => {
                                        const isEditing = editingCell?.rowIndex === rIdx && editingCell?.field === field;
                                        return (
                                          <div key={field} className="relative">
                                            <span className="text-[8px] font-black text-text-tertiary uppercase block mb-0.5">{field}</span>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                defaultValue={row[field] || ''}
                                                onBlur={(e) => {
                                                  handleCellEdit(rIdx, field, e.target.value);
                                                  setEditingCell(null);
                                                }}
                                                onKeyDown={(e: any) => {
                                                  if (e.key === 'Enter') {
                                                    handleCellEdit(rIdx, field, e.target.value);
                                                    setEditingCell(null);
                                                  }
                                                }}
                                                className="w-full px-2 py-1 bg-surface-card border border-brand-accent rounded-lg text-xs outline-none focus:ring-1 focus:ring-brand-accent"
                                                autoFocus
                                              />
                                            ) : (
                                              <div
                                                onDoubleClick={() => setEditingCell({ rowIndex: rIdx, field })}
                                                className="w-full px-2 py-1.5 bg-background-portal border border-input-border rounded-lg text-xs cursor-text truncate text-text-primary hover:border-brand-accent/40"
                                              >
                                                {row[field] || <span className="text-text-tertiary italic">null</span>}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {isFaulty && (
                                      <ul className="mt-3.5 space-y-1 pl-4 list-disc text-[9px] font-mono text-rose-400">
                                        {rowErrs.map((errStr, errIdx) => (
                                          <li key={errIdx}>{errStr}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </FocusScope>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 3. MODULE: STRUCTURAL METADATA & HIERARCHY BUILDER ── */}
        {sub === 'metadata' && (
          <div className="flex-1 flex min-h-0 animate-fadeIn overflow-hidden">
            
            {/* Left entities list panel */}
            <div
              className={`bg-sidebar-bg border-r border-border-accent flex flex-col min-h-0 relative ${
                metaLeftMinimized ? 'w-12 overflow-hidden' : ''
              }`}
              style={{ width: metaLeftMinimized ? 48 : metaSplitWidth }}
            >
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6">
                {!metaLeftMinimized ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">Structural Config</h3>
                      <button onClick={() => setMetaLeftMinimized(true)} className="text-xs text-text-tertiary hover:text-text-primary">◀</button>
                    </div>

                    {/* Metadata addition form */}
                    <form onSubmit={handleAddMetadata} className="space-y-4 bg-surface-card p-4 border border-border-accent rounded-2xl shadow-sm">
                      <h4 className="text-xs font-black uppercase text-text-secondary tracking-widest">Append Node Entity</h4>
                      
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Class Type</label>
                          <select
                            value={selectedMetaType}
                            onChange={e => setSelectedMetaType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl font-bold outline-none"
                          >
                            <option value="vertical">Vertical Unit</option>
                            <option value="job_level">Job Designation Level</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Label Name</label>
                          <input
                            type="text"
                            value={metaNameInput}
                            onChange={e => setMetaNameInput(e.target.value)}
                            placeholder="e.g. Core Engineering, VP"
                            required
                            className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none"
                          />
                        </div>

                        {selectedMetaType === 'vertical' && (
                          <div>
                            <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Parent Division</label>
                            <select
                              value={metaParentInput}
                              onChange={e => setMetaParentInput(e.target.value)}
                              className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none"
                            >
                              <option value="">Top Level Division</option>
                              {metadata.filter(m => m.type === 'vertical').map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-brand-accent hover:bg-brand-hover text-white text-xs font-black uppercase rounded-xl shadow transition-all"
                      >
                        Append Entity Node
                      </button>
                    </form>

                    {/* Job levels list configurator */}
                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                      <span className="text-[9px] font-black uppercase text-text-secondary tracking-widest block">Job Levels Configurator (Rank Order)</span>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                        {metadata.filter(m => m.type === 'job_level').map((lvl, idx) => (
                          <div key={lvl.id} className="flex items-center justify-between p-3 bg-surface-card border border-border-accent rounded-xl hover:border-brand-accent/20 transition-all group animate-fadeIn">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-brand-accent bg-brand-muted/20 px-2 py-0.5 rounded-lg">L{idx + 1}</span>
                              <span className="text-xs font-bold text-text-primary">{lvl.name}</span>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleMetadataReorder(lvl.id, 'up')}
                                className="p-1 rounded bg-background-portal hover:bg-brand-muted/30 text-text-secondary text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMetadataReorder(lvl.id, 'down')}
                                className="p-1 rounded bg-background-portal hover:bg-brand-muted/30 text-text-secondary text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMetadataDelete(lvl.id)}
                                className="p-1 rounded hover:bg-rose-500/10 text-rose-500 text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <button onClick={() => setMetaLeftMinimized(false)} className="mx-auto text-xs text-brand-accent font-bold py-4">▶</button>
                )}
              </div>

              {/* Resizer Handle */}
              {!metaLeftMinimized && (
                <div
                  className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
                  onMouseDown={(e) => startResizing(e, metaSplitWidth, 'horizontal', 250, 500, setMetaSplitWidth)}
                />
              )}
            </div>

            {/* Right Interactive Hierarchy Map */}
            <div className="flex-1 p-6 flex flex-col min-h-0 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">Interactive Vertical Division Tree Map</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Click [+] sub-team under any block to append inline sub-vertical structures.</p>
              </div>

              <div className="flex-1 bg-surface-card p-6 border border-border-accent rounded-3xl shadow-sm min-h-[400px]">
                {/* Tree Root */}
                <div className="p-4 bg-brand-muted/20 border border-brand-accent/20 rounded-2xl w-fit flex items-center gap-2 shadow-sm">
                  <span className="text-sm">🏢</span>
                  <span className="text-xs font-black text-brand-accent uppercase tracking-wider">Acme Corporate HQ Root</span>
                </div>

                {renderTreeNodes(null)}
              </div>
            </div>
          </div>
        )}

        {/* ── 4. MODULE: ACCESS CONTROL & PRIVILEGE MATRIX ── */}
        {sub === 'access' && (
          <div className="flex-1 flex min-h-0 animate-fadeIn overflow-hidden">
            
            {/* Left Admins list panel */}
            <div className="bg-sidebar-bg border-r border-border-accent flex flex-col min-h-0 relative" style={{ width: accessSplitWidth }}>
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">Administrative Profile Roster</h3>
                  <span className="text-[10px] bg-brand-accent/15 px-2 py-0.5 rounded-full text-brand-accent font-mono font-bold">{adminUsers.length} profiles</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                  {adminUsers.map(admin => {
                    const isSelected = selectedAdminId === admin.id;
                    return (
                      <div
                        key={admin.id}
                        onClick={() => setSelectedAdminId(admin.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${
                          isSelected ? 'bg-surface-card border-brand-accent shadow' : 'bg-surface-card/40 border-border-accent hover:border-brand-accent/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate text-text-primary">{admin.name}</p>
                            <p className="text-[10px] text-text-tertiary truncate font-mono mt-0.5">{admin.email}</p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase flex-shrink-0 ${
                            admin.role === 'super_admin' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                            admin.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                            'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          }`}>
                            {admin.role}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resizer Handle */}
              <div
                className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
                onMouseDown={(e) => startResizing(e, accessSplitWidth, 'horizontal', 200, 450, setAccessSplitWidth)}
              />
            </div>

            {/* Right Privileges checkbox matrix */}
            <div className="flex-1 p-6 flex flex-col min-h-0 overflow-y-auto">
              {selectedAdminId ? (
                (() => {
                  const targetAdmin = adminUsers.find(a => a.id === selectedAdminId);
                  const matrix = permissionsMatrix[selectedAdminId] || {
                    user_management: { read: false, write: false, execute: false },
                    metadata_config: { read: false, write: false, execute: false },
                    database_console: { read: false, write: false, execute: false },
                    system_audit_logs: { read: false, write: false, execute: false },
                  };

                  return (
                    <div className="space-y-6 max-w-4xl animate-fadeIn">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">
                            Granular Privileges Matrix: {targetAdmin?.name}
                          </h3>
                          {isSavingPermissions && (
                            <span className="text-[9px] text-text-tertiary italic flex items-center gap-1.5">
                              <span className="w-2 h-2 border border-brand-accent border-t-transparent rounded-full animate-spin"></span>
                              Syncing...
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-secondary mt-0.5">Define backend execution context and write restrictions. Checks enforce access security rules instantly.</p>
                      </div>

                      <div className="border border-border-accent rounded-3xl overflow-hidden bg-surface-card shadow-sm">
                        <table className="min-w-full text-xs">
                          <thead className="bg-table-header border-b border-border-accent">
                            <tr>
                              <th className="px-5 py-3 text-left font-black uppercase text-[10px] text-text-secondary">System Module</th>
                              <th className="px-5 py-3 text-center font-black uppercase text-[10px] text-text-secondary w-28">Read</th>
                              <th className="px-5 py-3 text-center font-black uppercase text-[10px] text-text-secondary w-28">Write</th>
                              <th className="px-5 py-3 text-center font-black uppercase text-[10px] text-text-secondary w-28">Execute</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-accent/40">
                            {[
                              { id: 'user_management', label: 'User Directory & Ingestion' },
                              { id: 'metadata_config', label: 'Structural Org Metadata' },
                              { id: 'database_console', label: 'Database SQL Console Sandbox' },
                              { id: 'system_audit_logs', label: 'System Telemetry & Audit Logs' },
                            ].map(mod => (
                              <tr key={mod.id} className="hover:bg-table-row-hover transition-all">
                                <td className="px-5 py-4 font-bold text-text-primary">{mod.label}</td>
                                {['read', 'write', 'execute'].map((v: any) => {
                                  const isChecked = !!(matrix[mod.id] as any)?.[v];
                                  // Super Admin cannot be restricted
                                  const disabled = targetAdmin?.role === 'super_admin';
                                  
                                  return (
                                    <td key={v} className="px-5 py-4 text-center">
                                      <input
                                        type="checkbox"
                                        checked={disabled ? true : isChecked}
                                        disabled={disabled || isSavingPermissions}
                                        onChange={() => handlePermissionToggle(selectedAdminId, mod.id, v)}
                                        className="h-4.5 w-4.5 rounded border-input-border text-brand-accent focus:ring-brand-accent focus:ring-offset-0 disabled:opacity-50"
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="p-4 rounded-2xl bg-brand-muted/20 border border-brand-accent/20 flex gap-3 text-xs text-brand-accent">
                        <span>ℹ</span>
                        <p className="text-[11px] leading-relaxed">
                          Note: Toggling permission checkboxes triggers an immediate asynchronous database mutation. Super Admins are granted bypass override permissions.
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-border-accent rounded-3xl p-10 text-text-tertiary">
                  Please select an administrative profile card to audit or configure privilege matrix parameters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 5. MODULE: LIVE DB SANDBOX TERMINAL ── */}
        {sub === 'database' && (
          <div className="flex-1 flex min-h-0 bg-[#060a12] text-gray-200 animate-fadeIn overflow-hidden">
            
            {/* Left telemetry panel */}
            {!dbSchemaMinimized ? (
              <div className="bg-[#0b101b] border-r border-gray-800 flex flex-col min-h-0 relative flex-shrink-0" style={{ width: dbSplitWidth }}>
                
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">PostgreSQL Engine Telemetry</h3>
                    <button onClick={() => setDbSchemaMinimized(true)} className="text-[10px] text-gray-500 hover:text-gray-300">◀ Minimize</button>
                  </div>

                  <div className="space-y-4 text-xs font-mono bg-gray-950/60 p-4 rounded-2xl border border-gray-800/80">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Schema Version:</span>
                      <span className="text-brand-accent font-bold">v1.4.1</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">DB Size:</span>
                      <span className="text-emerald-500 font-bold">42.2 MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Telemetry Volume:</span>
                      <span className="text-warning-text font-bold">{stats.totalLogs} entries</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Physical Tables Matrix</span>
                    
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                      {[
                        { name: 'users', count: stats.totalUsers, cols: ['id (UUID)', 'eid (VARCHAR)', 'name (VARCHAR)', 'email (VARCHAR)', 'role (VARCHAR)', 'designation_id (UUID)', 'vertical_id (UUID)', 'manager_id (UUID)', 'is_password_changed (BOOL)'] },
                        { name: 'structural_metadata', count: stats.totalMetadata, cols: ['id (UUID)', 'type (VARCHAR)', 'name (VARCHAR)', 'parent_id (UUID)', 'sort_order (INT)', 'extended_attributes (JSONB)'] },
                        { name: 'system_logs', count: stats.totalLogs, cols: ['id (UUID)', 'user_id (UUID)', 'action (VARCHAR)', 'severity (VARCHAR)', 'payload (JSONB)', 'ip_address (VARCHAR)', 'timestamp (TIMESTAMP)'] },
                      ].map(tbl => (
                        <div key={tbl.name} className="p-3 bg-gray-900/40 border border-gray-850 rounded-xl hover:border-brand-accent/40 transition-all group">
                          <div className="flex items-center justify-between mb-1.5 font-mono">
                            <span className="text-xs font-bold text-gray-300">/{tbl.name}</span>
                            <span className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{tbl.count} rows</span>
                          </div>
                          
                          <details className="text-[8px] font-mono text-gray-500 cursor-pointer">
                            <summary className="hover:text-gray-300 uppercase tracking-widest outline-none">Schema details</summary>
                            <ul className="mt-1.5 space-y-0.5 pl-2 border-l border-gray-800 text-gray-400">
                              {tbl.cols.map(c => <li key={c}>{c}</li>)}
                            </ul>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Resizer Handle */}
                <div
                  className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
                  onMouseDown={(e) => startResizing(e, dbSplitWidth, 'horizontal', 200, 450, setDbSplitWidth)}
                />
              </div>
            ) : (
              <div className="w-12 bg-[#0b101b] border-r border-gray-800 flex flex-col p-4">
                <button onClick={() => setDbSchemaMinimized(false)} className="text-[10px] text-gray-400 font-bold mx-auto">▶</button>
              </div>
            )}

            {/* Right SQL Console */}
            <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4">
              
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[9px] text-gray-400 font-mono">SQL ENGINE v1.2</span>
                  <span className="h-2 w-2 rounded-full bg-success shadow shadow-success animate-pulse" />
                </div>

                <button
                  onClick={runSQLQuery}
                  disabled={isQueryRunning}
                  className="px-4.5 py-2 bg-gradient-to-r from-brand-accent to-emerald-500 hover:opacity-90 transition-all rounded-xl text-white font-bold text-xs shadow-md shadow-brand-accent/20 flex items-center gap-2"
                >
                  {isQueryRunning ? (
                    <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Executing...</>
                  ) : (
                    'Run SQL Query'
                  )}
                </button>
              </div>

              {/* SQL Console Input Box (Resizable Height) */}
              <div className="relative border border-gray-800 bg-[#03060c] rounded-2xl overflow-hidden flex-shrink-0" style={{ height: dbEditorHeight }}>
                {/* Syntax Highlight Overlay */}
                <div
                  className="absolute inset-0 p-4 font-mono text-xs whitespace-pre-wrap pointer-events-none overflow-y-auto leading-relaxed select-none"
                  dangerouslySetInnerHTML={{
                    __html: highlightSQLKeywords(sqlQuery)
                  }}
                  style={{ color: 'transparent' }}
                />
                
                <textarea
                  value={sqlQuery}
                  onChange={(e) => handleSqlChange(e.target.value)}
                  placeholder="SELECT * FROM users;"
                  className="absolute inset-0 w-full h-full p-4 bg-transparent font-mono text-xs text-success focus:outline-none resize-none leading-relaxed overflow-y-auto"
                  style={{ caretColor: '#ffffff' }}
                />

                {/* Suggestions matrix */}
                {showSqlSuggestions && (
                  <div className="absolute left-4 bottom-4 z-50 bg-[#0c1221] border border-gray-800 rounded-xl p-1.5 space-y-1 shadow-2xl max-w-xs font-mono text-[10px]">
                    {sqlSuggestions.map(kw => (
                      <button
                        key={kw}
                        onClick={() => insertSuggestion(kw)}
                        className="block w-full text-left px-2.5 py-1 rounded hover:bg-brand-accent text-gray-300 hover:text-white"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                )}

                {/* Vertical Resizer Handle */}
                <div
                  className="h-1 cursor-row-resize absolute bottom-0 left-0 right-0 hover:bg-brand-accent/50 z-10"
                  onMouseDown={(e) => startResizing(e, dbEditorHeight, 'vertical', 120, 400, setDbEditorHeight)}
                />
              </div>

              {/* SQL Result Set Output pane */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#03060c] border border-gray-800 rounded-2xl p-4 overflow-hidden relative">
                <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest block mb-2">Query Output Response Stream</span>
                
                {queryError && (
                  <div className="flex-1 overflow-auto p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs rounded-xl whitespace-pre-wrap">
                    [ERROR] {queryError}
                  </div>
                )}

                {!queryError && queryResult && (
                  <div className="flex-1 overflow-auto">
                    {queryResult.rows && queryResult.rows.length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-800 text-left font-mono text-[10px] select-text">
                        <thead className="bg-[#0b101b] text-gray-400 sticky top-0 z-10">
                          <tr>
                            {Object.keys(queryResult.rows[0]).map(col => (
                              <th key={col} className="px-3 py-2.5 font-bold uppercase tracking-wider bg-[#0b101b] whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-850 text-gray-300">
                          {queryResult.rows.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-gray-900/40">
                              {Object.values(row).map((val: any, cIdx: number) => (
                                <td key={cIdx} className="px-3 py-2 whitespace-nowrap truncate max-w-xs" title={String(val)}>
                                  {val === null ? <span className="text-warning italic opacity-50">null</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-10 text-center font-mono text-gray-500 text-xs italic">
                        Statement executed successfully. Empty set or records updated.
                      </div>
                    )}
                  </div>
                )}

                {!queryError && !queryResult && (
                  <div className="flex-1 flex items-center justify-center font-mono text-gray-600 text-xs italic">
                    Execute a query in the terminal sandbox above to stream database result records.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 6. MODULE: SYSTEM AUDIT LOGS (Virtual Scrolling) ── */}
        {sub === 'logs' && (
          <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 animate-fadeIn relative overflow-hidden">
            
            <div className="flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">System Audit Logs</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Continuous telemetric log streaming. Pruned automatically to 100,000 maximum entries.</p>
              </div>

              {/* Status volume indicator */}
              <div className="flex items-center gap-2 bg-surface-card border border-border-accent rounded-xl px-3 py-1.5 text-xs text-text-secondary">
                <span className="font-bold text-text-tertiary">Telemetry Load:</span>
                <span className="font-black text-brand-accent">{stats.totalLogs} / 100,000</span>
                <div className="w-16 h-1.5 bg-background-portal rounded-full overflow-hidden border border-border-accent">
                  <div className="h-full bg-brand-accent" style={{ width: `${Math.min((stats.totalLogs / 100000) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-card p-4 border border-border-accent rounded-2xl shadow-sm flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Action, EID, IP..."
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                />
                <span className="absolute left-2.5 top-2.5 text-text-tertiary">🔍</span>
              </div>

              <div>
                <select
                  value={logSeverityFilter}
                  onChange={e => setLogSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                >
                  <option value="">All Severities</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="flex items-center justify-end text-[10px] text-text-secondary font-bold">
                Showing {filteredLogs.length} events
              </div>
            </div>

            {/* High-density virtualized log table container */}
            <div className="flex-1 border border-border-accent rounded-2xl bg-surface-card shadow-sm min-h-0 flex flex-col">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs table-fixed">
                  <thead className="bg-table-header border-b border-border-accent">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-36">Timestamp</th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-20">Severity</th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-48">Action</th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-36">Operator</th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-28">IP Address</th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary">Payload</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Scroll viewport for virtual rows */}
              <div ref={logParentRef} className="flex-1 overflow-auto">
                <div
                  style={{
                    height: `${logVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {logVirtualizer.getVirtualItems().map(virtualRow => {
                    const log = filteredLogs[virtualRow.index];
                    if (!log) return null;
                    const logDate = new Date(log.timestamp).toLocaleString();
                    const operatorName = log.user_id ? 
                      (users.find(u => u.id === log.user_id)?.name || log.user_id.substring(0, 8)) : 'System';

                    return (
                      <div
                        key={virtualRow.key}
                        onClick={() => {
                          setSelectedLog(log);
                          setLogDrawerOpen(true);
                        }}
                        className={`absolute left-0 right-0 px-4 py-2.5 border-b border-border-accent/40 font-mono text-[10px] cursor-pointer transition-colors flex items-center ${getLogSeverityColorClass(log.severity)}`}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="w-36 text-text-tertiary truncate">{logDate}</div>
                        <div className="w-20">
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${severityBadge(log.severity)}`}>
                            {log.severity}
                          </span>
                        </div>
                        <div className="w-48 font-bold text-text-primary truncate pr-2">{log.action}</div>
                        <div className="w-36 text-text-primary truncate pr-2">{operatorName}</div>
                        <div className="w-28 text-text-secondary truncate">{log.ip_address}</div>
                        <div className="flex-1 text-text-tertiary truncate">{JSON.stringify(log.payload)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PAYLOAD INSIGHT DRAWER ( Radix Focus Trap ) */}
            {logDrawerOpen && selectedLog && (
              <div className="absolute top-0 right-0 bottom-0 z-40 bg-sidebar-bg border-l border-border-accent shadow-2xl flex flex-col min-h-0" style={{ width: logDrawerWidth }}>
                
                {/* Resizer Handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-accent z-50"
                  onMouseDown={startResizingLogDrawer}
                />

                <FocusScope trapped={true}>
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Drawer Header */}
                    <div className="px-5 py-4 border-b border-border-accent bg-surface-card/25 flex items-center justify-between flex-shrink-0">
                      <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">Payload Insight drawer</h4>
                      <button
                        onClick={() => { setLogDrawerOpen(false); setSelectedLog(null); }}
                        className="text-text-tertiary hover:text-text-primary text-sm font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Drawer content (Scrollable JSON view) */}
                    <div className="flex-1 p-5 overflow-y-auto space-y-4 font-mono text-[10px]">
                      <div className="grid grid-cols-2 gap-3 bg-background-portal p-3.5 border border-border-accent rounded-2xl text-[10px]">
                        <div>
                          <span className="text-text-tertiary block">Timestamp:</span>
                          <span className="font-bold text-text-secondary">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary block">Severity:</span>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${severityBadge(selectedLog.severity)}`}>
                            {selectedLog.severity}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-tertiary block">Action:</span>
                          <span className="font-bold text-text-primary">{selectedLog.action}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary block">Operator ID:</span>
                          <span className="font-bold text-text-secondary truncate block">{selectedLog.user_id || 'System'}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest block">Raw JSON Data Payload</span>
                        <pre className="p-4 bg-background-portal border border-border-accent rounded-2xl overflow-auto text-brand-accent text-xs select-all">
                          {JSON.stringify(selectedLog.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </FocusScope>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ─── ADD/EDIT SINGLE USER DIALOG MODAL (Radix Focus Lock) ─── */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <FocusScope trapped={true}>
            <div className="w-full max-w-lg bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-border-accent bg-surface-card/10 flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-wider text-text-primary">
                  {userModalMode === 'edit' ? 'Edit Personnel Record file' : 'Add Single Personnel profile'}
                </h3>
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="text-text-tertiary hover:text-text-primary text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={saveSingleUser} className="p-5 space-y-4">
                {userModalError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold font-mono">
                    [FAULT] {userModalError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Employee ID</label>
                    <input
                      type="text"
                      placeholder="e.g. E0123"
                      required
                      disabled={userModalMode === 'edit'}
                      value={userForm.eid}
                      onChange={e => setUserForm(prev => ({ ...prev, eid: e.target.value }))}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      required
                      value={userForm.name}
                      onChange={e => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="jane@company.com"
                    required
                    value={userForm.email}
                    onChange={e => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">System Role</label>
                    <select
                      value={userForm.role}
                      onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none font-bold"
                    >
                      <option value="user">User (Standard)</option>
                      <option value="admin">Admin</option>
                      <option value="read_only_admin">Read-Only Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Job Designation</label>
                    <select
                      value={userForm.designationId}
                      onChange={e => setUserForm(prev => ({ ...prev, designationId: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-background-portal border border-input-border rounded-xl outline-none"
                    >
                      <option value="">Unassigned</option>
                      {metadata.filter(m => m.type === 'job_level').map(j => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Vertical Department</label>
                    <select
                      value={userForm.verticalId}
                      onChange={e => setUserForm(prev => ({ ...prev, verticalId: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-background-portal border border-input-border rounded-xl outline-none"
                    >
                      <option value="">Corporate HQ</option>
                      {metadata.filter(m => m.type === 'vertical').map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">Direct Manager</label>
                    <select
                      value={userForm.managerId}
                      onChange={e => setUserForm(prev => ({ ...prev, managerId: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-background-portal border border-input-border rounded-xl outline-none"
                    >
                      <option value="">No Manager (Root)</option>
                      {users
                        .filter(u => u.id !== userForm.id)
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.eid})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-accent/40 flex items-center justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-4 py-2 border border-border-accent rounded-xl text-xs hover:bg-background-portal text-text-secondary font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userModalLoading}
                    className="px-5 py-2 bg-brand-accent hover:bg-brand-hover disabled:opacity-40 text-white font-bold text-xs uppercase rounded-xl transition-all shadow flex items-center gap-2"
                  >
                    {userModalLoading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>

            </div>
          </FocusScope>
        </div>
      )}

    </div>
  );
}
