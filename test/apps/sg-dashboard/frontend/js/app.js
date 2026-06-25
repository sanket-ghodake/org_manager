import * as api from './api.js?v=1.0.1';
import * as ui from './ui.js?v=1.0.1';

// State management
let apiToken = '';
let userData = null;
let currentDashboardId = null;
let currentDashboardData = null;
let currentDashboardUserId = null;
let cachedUsers = [];
let parentOrigin = '';
let portalOrigin = '';
let directoryFetched = false;

// Smart Sync State Management
let syncTimeoutId = null;
let lastActivityTime = Date.now();
let lastDashboardUpdatedAt = '';
let lastSubmissionsJson = '';
let lastReviewsJson = '';
let lastTeamJson = '';

function recordUserActivity() {
  lastActivityTime = Date.now();
}
window.addEventListener('mousemove', recordUserActivity);
window.addEventListener('keydown', recordUserActivity);
window.addEventListener('click', recordUserActivity);
window.addEventListener('scroll', recordUserActivity);

function setDirectoryCache(rawUsers) {
  const uuidToEid = {};
  rawUsers.forEach(u => {
    if (u.id && u.eid) {
      uuidToEid[u.id] = u.eid;
    }
  });

  cachedUsers = rawUsers.map(u => {
    let mId = u.manager_id || u.managerId || null;
    if (mId && uuidToEid[mId]) {
      mId = uuidToEid[mId];
    }
    return {
      id: u.eid || u.id,
      name: u.name,
      email: u.email,
      role: u.role === 'super_admin' || u.role === 'admin' ? 'Admin' : (u.role === 'manager' ? 'Manager' : 'Employee'),
      managerId: mId,
      designation: u.designation || ''
    };
  });
  directoryFetched = true;

  // Update logged-in user's designation if found in directory cache
  if (userData) {
    const matchedSelf = cachedUsers.find(u => u.id === userData.id);
    if (matchedSelf && matchedSelf.designation) {
      userData.designation = matchedSelf.designation;
      sessionStorage.setItem('dashboard_user_data', JSON.stringify(userData));
      
      // Update sidebar role display
      const userRoleEl = document.getElementById('user-role');
      if (userRoleEl) {
        userRoleEl.textContent = userData.designation;
      }
    }
  }
}

async function getPortalOrigin() {
  if (parentOrigin && parentOrigin !== 'null') return parentOrigin;
  if (portalOrigin) return portalOrigin;
  try {
    const config = await api.fetchConfig();
    portalOrigin = new URL(config.portalSsoUrl).origin;
    return portalOrigin;
  } catch (e) {
    console.error('Failed to get portal origin:', e);
    return window.location.origin;
  }
}

// Resolve parent origin securely
if (document.referrer) {
  try {
    parentOrigin = new URL(document.referrer).origin;
  } catch (e) {}
}
if ((parentOrigin === 'null' || !parentOrigin) && window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
  parentOrigin = window.location.ancestorOrigins[0];
}

// ----------------------------------------------------
// Public APIs exposed to Window (for inline HTML events)
// ----------------------------------------------------

export function switchTab(tab) {
  const activeEl = document.getElementById(`tab-${tab}`);
  if (activeEl && !activeEl.classList.contains('hidden')) {
    // Tab is already active, toggle the sidebar (minimize/maximize) like VSCode
    if (typeof window.toggleSidebar === 'function') {
      window.toggleSidebar();
    }
    return;
  }
  ui.switchTab(tab);
  if (tab === 'my-dashboard') {
    loadDashboard(currentDashboardUserId);
  } else if (tab === 'submissions') {
    loadSubmissions(currentDashboardUserId);
  } else if (tab === 'team-view') {
    loadTeamView(currentDashboardUserId);
  } else if (tab === 'history-versions') {
    loadHistoryAndVersions();
    loadTrashHistory();
  }
}

export function toggleTeamViewMode(mode) {
  const listContainer = document.getElementById('team-list-mode-container');
  const treeContainer = document.getElementById('team-tree-mode-container');
  const btnList = document.getElementById('btn-team-list-mode');
  const btnTree = document.getElementById('btn-team-tree-mode');

  if (!listContainer || !treeContainer || !btnList || !btnTree) return;

  if (mode === 'list') {
    listContainer.classList.remove('hidden');
    treeContainer.classList.add('hidden');

    btnList.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm";
    btnTree.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
  } else if (mode === 'tree') {
    treeContainer.classList.remove('hidden');
    listContainer.classList.add('hidden');

    btnTree.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm";
    btnList.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

    loadHierarchyRoot();
  }
}

export function toggleTheme() {
  ui.toggleTheme();
}

export function setTheme(theme) {
  ui.setTheme(theme);
}

export async function updateManagerSetting() {
  const select = document.getElementById('header-manager-select');
  const managerId = select.value;
  if (!managerId) return;

  try {
    const updatedUsers = cachedUsers.map(u => {
      if (u.id === userData.id) {
        return { ...u, managerId: managerId };
      }
      return u;
    });

    await api.syncUserDirectory(apiToken, updatedUsers);
    
    userData.managerId = managerId;
    sessionStorage.setItem('dashboard_user_data', JSON.stringify(userData));
    
    await ui.showCustomAlert('Reporting line updated successfully.', 'Success');
  } catch (err) {
    console.error(err);
    await ui.showCustomAlert('Failed to update reporting line.', 'Error');
  }
}

export async function saveDashboardSettings() {
  try {
    await api.saveDashboard(apiToken, currentDashboardId, currentDashboardData);
    await loadMyDashboard();
  } catch (err) {
    console.error('Failed to update dashboard settings:', err);
  }
}

export async function updateProgramSetting() {
  const inputEl = document.getElementById('header-program-input');
  if (!inputEl) return;
  const val = inputEl.value.trim();
  const subProg = document.getElementById('sub-program-display');
  if (subProg) subProg.textContent = val || 'Default Program';
  if (val === currentDashboardData.program_line) return;

  currentDashboardData.program_line = val;
  await saveDashboardSettings();
}



export async function updateDashboardNotes() {
  const notes = document.getElementById('dashboard-notes-textarea').value.trim();
  if (notes === currentDashboardData.notes) return;
  currentDashboardData.notes = notes;
  await saveDashboardSettings();
}

export function startEditingObjective() {
  const display = document.getElementById('sub-objective-display');
  const input = document.getElementById('sub-objective-input');
  
  if (display) display.classList.add('hidden');
  if (input) {
    input.classList.remove('hidden');
    input.value = currentDashboardData.objective || '';
    input.focus();
  }
}

export async function saveObjectiveEdit() {
  const display = document.getElementById('sub-objective-display');
  const input = document.getElementById('sub-objective-input');
  if (!input) return;
  const newValue = input.value.trim();

  if (display) display.classList.remove('hidden');
  input.classList.add('hidden');

  if (newValue === currentDashboardData.objective) return;

  currentDashboardData.objective = newValue;
  await saveDashboardSettings();
}

export async function cycleGapSeverity(item) {
  let prefix = '';
  let priority = item.category || 'Low';
  if (priority.includes(':')) {
    const parts = priority.split(':');
    prefix = parts[0] + ':';
    priority = parts[1];
  }
  const flow = { 'Critical': 'Medium', 'Medium': 'Low', 'Low': 'Critical' };
  const nextSeverity = flow[priority] || 'Low';
  const newCategory = prefix + nextSeverity;

  try {
    await api.updateDashboardItem(apiToken, item.id, { category: newCategory });
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export async function cyclePlanBadgeType(item, planType, currentBadge) {
  const strategicFlow = { 'TRAIN': 'TIME', 'TIME': 'ACTION', 'ACTION': 'DEADLINE', 'DEADLINE': 'TRAIN' };
  const tacticalFlow = { 'ACTION': 'DEADLINE', 'DEADLINE': 'TRAIN', 'TRAIN': 'TIME', 'TIME': 'ACTION' };
  
  const nextBadge = planType === 'Strategic' ? strategicFlow[currentBadge] : tacticalFlow[currentBadge];
  const newCategory = `${planType}:${nextBadge || 'ACTION'}`;

  try {
    await api.updateDashboardItem(apiToken, item.id, { category: newCategory });
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export function startEditingItem(item, containerSpan) {
  if (containerSpan.querySelector('input')) return;

  const titleTextSpan = containerSpan.querySelector('.item-title-text') || containerSpan;
  const originalText = titleTextSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = "bg-[var(--bg-input)] border border-[var(--accent)] text-[var(--text-primary)] rounded text-xs px-2 py-0.5 font-medium w-full focus:outline-none";
  input.value = originalText;
  
  titleTextSpan.innerHTML = '';
  titleTextSpan.appendChild(input);
  input.focus();

  const finishEdit = async () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== originalText) {
      try {
        await api.updateDashboardItem(apiToken, item.id, { title: newValue });
      } catch (e) {
        console.error(e);
      }
    }
    await loadMyDashboard();
  };

  input.onblur = finishEdit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.onblur = null; // skip save
      loadMyDashboard();
    }
  };
}

export async function updateAllSuggestions() {
  if (!apiToken) return;
  const sections = ['key_skill', 'gap', 'training_plan'];
  for (const section of sections) {
    try {
      const data = await api.fetchSuggestions(apiToken, section);
      if (data.suggestions) {
        ui.setSuggestions(section, data.suggestions);
      }
    } catch (e) {
      console.warn('Failed to update suggestions for %s:', section, e);
    }
  }
  ui.setupCustomAutocompletes();
}

export async function addQuickItem(section, defaultCategory, inputEl) {
  const val = inputEl.value.trim();
  if (!val) return;

  try {
    await api.addDashboardItem(apiToken, currentDashboardId, {
      section,
      category: defaultCategory,
      title: val,
      description: '',
      deadline: ''
    });
    inputEl.value = '';
    await loadMyDashboard();
    await updateAllSuggestions();
  } catch (err) {
    console.error(err);
  }
}

export async function deleteItem(id) {
  const confirmed = await ui.showCustomConfirm('Are you sure you want to delete this action item?', 'Delete Item');
  if (!confirmed) return;
  try {
    await api.deleteDashboardItem(apiToken, id);
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export async function updatePlanStatus(itemId, newStatus) {
  try {
    await api.updateDashboardItem(apiToken, itemId, { status: newStatus });
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export async function updatePlanTargetQuarter(itemId, newTargetQuarter) {
  try {
    await api.updateDashboardItem(apiToken, itemId, { target_quarter: newTargetQuarter });
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export async function updatePlanCompletedQuarter(itemId, newCompletedQuarter) {
  try {
    await api.updateDashboardItem(apiToken, itemId, { completed_quarter: newCompletedQuarter });
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export async function updateItemLinks(sourceId, targetIds) {
  try {
    await api.syncDashboardItemLinks(apiToken, currentDashboardId, sourceId, targetIds);
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
    await ui.showCustomAlert('Failed to update linked skill gaps: ' + err.message, 'Error');
  }
}

export async function submitDashboard(id) {
  const confirmed = await ui.showCustomConfirm('Are you sure you want to submit your current SG Dashboard to your manager for review?', 'Submit Dashboard');
  if (!confirmed) return;
  try {
    await api.submitDashboardReq(apiToken, id);
    await ui.showCustomAlert('Dashboard submitted successfully!', 'Success');
    await loadSubmissions();
    if (userData.role === 'Manager' || userData.role === 'Admin') {
      await loadTeamView();
    }
  } catch (err) {
    console.error(err);
  }
}

export async function triggerRequestSubmission(empId) {
  const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const deadline = await ui.showCustomPrompt(
    'Enter a target review deadline date (YYYY-MM-DD):', 
    defaultDate,
    'Request Submission'
  );
  if (!deadline) return;

  try {
    const res = await api.createSubmissionRequest(apiToken, empId, deadline);
    if (res.ok) {
      await ui.showCustomAlert('Submission request generated successfully!', 'Success');
      await loadTeamView();
    } else {
      const errData = await res.json();
      await ui.showCustomAlert('Error: ' + errData.error, 'Request Failed');
    }
  } catch (err) {
    console.error(err);
  }
}

function getSearchHistory() {
  try {
    const raw = localStorage.getItem('past_searched_employees');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function addToSearchHistory(emp) {
  try {
    let history = getSearchHistory();
    history = history.filter(item => item.id !== emp.id);
    history.unshift({
      id: emp.id,
      name: emp.name,
      email: emp.email || '',
      role: emp.role || ''
    });
    if (history.length > 5) {
      history = history.slice(0, 5);
    }
    localStorage.setItem('past_searched_employees', JSON.stringify(history));
  } catch (e) {
    console.error('Failed to update search history:', e);
  }
}

export async function changeActiveEmployeeContext(userId, selectedDashboardId = '') {
  try {
    const isSelf = !userId || userId === userData.id;
    const isInitialLoad = !currentDashboardUserId;
    currentDashboardUserId = isSelf ? userData.id : userId;

    // Reset sync caches on context switch to force clean fetches
    lastDashboardUpdatedAt = '';
    lastSubmissionsJson = '';
    lastReviewsJson = '';
    lastTeamJson = '';

    // Show premium loading state
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      const title = overlay.querySelector('h3');
      const subtitle = overlay.querySelector('p');
      if (title) {
        title.textContent = isInitialLoad ? 'Loading Your Workspace...' : 'Switching Workspace Context...';
      }
      if (subtitle) {
        subtitle.textContent = isInitialLoad ? 'Initializing and syncing goal dashboard from database...' : 'Synchronizing goal dashboard and reporting structures...';
      }
    }

    // Load all data in parallel to avoid waterfalls
    const includeDeleted = false;

    const dashboardPromise = isSelf
      ? api.fetchMyDashboard(apiToken, selectedDashboardId)
      : api.fetchUserDashboard(apiToken, currentDashboardUserId, selectedDashboardId);
    
    const teamPromise = api.fetchTeam(apiToken, currentDashboardUserId).catch(e => {
      console.warn('Failed to load team data in context switch:', e);
      return { team: [] };
    });
    
    const submissionsPromise = api.fetchSubmissions(apiToken, currentDashboardUserId).catch(e => {
      console.warn('Failed to load submissions in context switch:', e);
      return { submissions: [] };
    });

    const dashboardsListPromise = api.fetchDashboards(apiToken, currentDashboardUserId, includeDeleted).catch(e => {
      console.warn('Failed to load programs list:', e);
      return { dashboards: [] };
    });

    const [dashData, teamData, subData, dashboardsData] = await Promise.all([
      dashboardPromise,
      teamPromise,
      submissionsPromise,
      dashboardsListPromise
    ]);

    currentDashboardId = dashData.dashboard.id;
    currentDashboardData = dashData.dashboard;
    const isDeleted = !!currentDashboardData.is_deleted;

    // Resolve details of owner
    let ownerName = dashData.dashboard.name || userData.name;
    let ownerRole = dashData.dashboard.role || userData.role;

    if (!isSelf && dashData.dashboard.name) {
      const emp = {
        id: currentDashboardUserId,
        name: dashData.dashboard.name,
        email: dashData.dashboard.email,
        role: dashData.dashboard.role,
        managerId: dashData.dashboard.manager_id || dashData.dashboard.managerId || null,
        designation: dashData.dashboard.designation || ''
      };
      if (!cachedUsers.some(u => u.id === emp.id)) {
        cachedUsers.push(emp);
      }
      addToSearchHistory(emp);
    }

    // Set name in header active container
    const headerActiveName = document.getElementById('header-active-user-name');
    if (headerActiveName) {
      headerActiveName.textContent = ownerName;
    }

    // Toggle nav link visibility (only visible to workspace author)
    const navHistoryVersions = document.getElementById('nav-history-versions');
    if (navHistoryVersions) {
      if (isSelf) {
        navHistoryVersions.classList.remove('hidden');
      } else {
        navHistoryVersions.classList.add('hidden');
        // If they are currently on the history-versions tab and they are not self, force switch back to my-dashboard
        const activeTab = document.getElementById('tab-history-versions');
        if (activeTab && !activeTab.classList.contains('hidden')) {
          ui.switchTab('my-dashboard');
        }
      }
    }

    // Toggle versions toggle button visibility (only visible to workspace author)
    const versionsBtn = document.getElementById('program-versions-btn');
    if (versionsBtn) {
      if (isSelf) {
        versionsBtn.classList.remove('hidden');
      } else {
        versionsBtn.classList.add('hidden');
      }
    }

    // Toggle Warning Banner & Edit Controls
    const warningBanner = document.getElementById('read-only-warning-banner');
    const isReadOnly = !isSelf || isDeleted;

    if (warningBanner) {
      if (isReadOnly && !isDeleted) {
        warningBanner.classList.remove('hidden');
        warningBanner.className = "bg-amber-500/10 border-b border-amber-500/20 text-amber-500 px-6 py-2 text-xs font-medium flex items-center justify-between gap-2 select-none";
        warningBanner.innerHTML = `
          <div class="flex items-center gap-2">
            <span>⚠️</span>
            <span><strong>Read-Only Mode:</strong> You are viewing <strong>${ownerName}</strong>'s development dashboard workspace. Editing, status updates, and modifications are disabled.</span>
          </div>
          <button onclick="resetToMyWorkspace()" class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 font-bold border border-amber-500/30 transition-all text-[10px] shrink-0">Reset to My Workspace</button>
        `;
      } else {
        warningBanner.classList.add('hidden');
      }
    }

    // Handle deleted alert banner
    const deletedBanner = document.getElementById('deleted-program-banner');
    if (deletedBanner) {
      if (isDeleted) {
        deletedBanner.classList.remove('hidden');
        const restoreBtn = document.getElementById('banner-restore-btn');
        const destroyBtn = document.getElementById('banner-destroy-btn');
        if (restoreBtn) {
          restoreBtn.onclick = async () => {
            await restoreDashboardAction(currentDashboardId);
          };
        }
        if (destroyBtn) {
          destroyBtn.onclick = async () => {
            await deleteDashboardPermanentAction(currentDashboardId);
          };
        }
      } else {
        deletedBanner.classList.add('hidden');
      }
    }

    // Toggle edit controls on main workspace
    toggleWorkspaceEditState(isReadOnly);

    // Populate Active Program Dropdown & buttons next to it
    const programSelect = document.getElementById('program-select');
    if (programSelect) {
      programSelect.innerHTML = '';
      const list = dashboardsData.dashboards || [];
      const activeDashboards = list.filter(d => !d.is_deleted);
      const deletedDashboards = list.filter(d => d.is_deleted);

      if (activeDashboards.length > 0) {
        const activeGroup = document.createElement('optgroup');
        activeGroup.label = 'Active Programs';
        activeDashboards.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = d.program_line || 'Default Program';
          if (d.id === currentDashboardId) {
            opt.selected = true;
          }
          activeGroup.appendChild(opt);
        });
        programSelect.appendChild(activeGroup);
      }

      if (deletedDashboards.length > 0) {
        const deletedGroup = document.createElement('optgroup');
        deletedGroup.label = 'Trash / Deleted Programs';
        deletedDashboards.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = `🗑️ [Deleted] ${d.program_line || 'Default Program'}`;
          if (d.id === currentDashboardId) {
            opt.selected = true;
          }
          deletedGroup.appendChild(opt);
        });
        programSelect.appendChild(deletedGroup);
      }

      programSelect.onchange = async () => {
        const selectedId = programSelect.value;
        await changeActiveEmployeeContext(currentDashboardUserId, selectedId);
      };
      ui.convertNativeSelectsToCustom();
    }

    // Program controls binding
    const addBtn = document.getElementById('program-add-btn');
    const renameBtn = document.getElementById('program-rename-btn');
    const duplicateBtn = document.getElementById('program-duplicate-btn');
    const deleteBtn = document.getElementById('program-delete-btn');
    const exportBtn = document.getElementById('program-export-btn');

    if (addBtn) {
      if (isReadOnly && !isDeleted) addBtn.classList.add('hidden');
      else {
        addBtn.classList.remove('hidden');
        addBtn.onclick = async () => {
          const newName = await ui.showCustomPrompt('Enter a name for the new program:', 'New Program', 'Add Program');
          if (newName === null) return;
          const programName = newName.trim() || 'New Program';
          try {
            const res = await api.createDashboard(apiToken, programName);
            await changeActiveEmployeeContext(currentDashboardUserId, res.newDashboardId);
          } catch (e) {
            await ui.showCustomAlert('Failed to add program: ' + e.message, 'Error');
          }
        };
      }
    }

    if (renameBtn) {
      if (isReadOnly) renameBtn.classList.add('hidden');
      else {
        renameBtn.classList.remove('hidden');
        renameBtn.onclick = async () => {
          const newName = await ui.showCustomPrompt('Enter a new name for this program:', currentDashboardData.program_line || '', 'Rename Program');
          if (newName && newName.trim() && newName.trim() !== currentDashboardData.program_line) {
            currentDashboardData.program_line = newName.trim();
            try {
              await api.saveDashboard(apiToken, currentDashboardId, currentDashboardData);
              await changeActiveEmployeeContext(currentDashboardUserId, currentDashboardId);
            } catch (e) {
              await ui.showCustomAlert('Failed to rename program: ' + e.message, 'Error');
            }
          }
        };
      }
    }

    if (duplicateBtn) {
      if (isReadOnly) duplicateBtn.classList.add('hidden');
      else {
        duplicateBtn.classList.remove('hidden');
        duplicateBtn.onclick = async () => {
          const confirmed = await ui.showCustomConfirm('Are you sure you want to duplicate the active program?', 'Duplicate Program');
          if (!confirmed) return;
          try {
            const res = await api.duplicateDashboard(apiToken, currentDashboardId);
            await ui.showCustomAlert(`Program duplicated as: ${res.newProgramName}`, 'Success');
            await changeActiveEmployeeContext(currentDashboardUserId, res.newDashboardId);
          } catch (e) {
            await ui.showCustomAlert('Failed to duplicate program: ' + e.message, 'Error');
          }
        };
      }
    }

    if (deleteBtn) {
      if (isReadOnly) deleteBtn.classList.add('hidden');
      else {
        deleteBtn.classList.remove('hidden');
        deleteBtn.onclick = async () => {
          const activeList = dashboardsData.dashboards.filter(d => !d.is_deleted) || [];
          if (activeList.length <= 1) {
            await ui.showCustomAlert('Cannot delete the only active dashboard program. You must maintain at least one active program.', 'Action Restricted');
            return;
          }
          const confirmed = await ui.showCustomConfirm('Are you sure you want to archive/delete the active program? You can restore it using the Show Trash filter next to the selector.', 'Archive Program');
          if (!confirmed) return;
          try {
            await api.deleteDashboard(apiToken, currentDashboardId);
            await ui.showCustomAlert('Program archived successfully.', 'Success');
            await changeActiveEmployeeContext(currentDashboardUserId);
          } catch (e) {
            await ui.showCustomAlert('Failed to delete program: ' + e.message, 'Error');
          }
        };
      }
    }

    if (exportBtn) {
      exportBtn.onclick = async () => {
        try {
          const items = dashData.items || [];
          const exportData = {
            program: currentDashboardData.program_line || 'Default Program',
            objective: currentDashboardData.objective || '',
            notes: currentDashboardData.notes || '',
            owner: {
              name: ownerName,
              role: ownerRole
            },
            skills: items.filter(i => i.section === 'key_skill').map(i => ({ title: i.title, priority: i.category })),
            gaps: items.filter(i => i.section === 'gap').map(i => ({ title: i.title, priority: i.category })),
            training_plans: items.filter(i => i.section === 'training_plan').map(i => ({ title: i.title, priority: i.category }))
          };

          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", `${ownerName.replace(/\s+/g, '_')}_${exportData.program.replace(/\s+/g, '_')}.json`);
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        } catch (e) {
          await ui.showCustomAlert('Failed to export program: ' + e.message, 'Error');
        }
      };
    }

    // Populate dashboard settings values
    const programInput = document.getElementById('header-program-input');
    if (programInput) {
      programInput.value = dashData.dashboard.program_line || 'Default Program';
    }
    const subProg = document.getElementById('sub-program-display');
    if (subProg) {
      subProg.textContent = dashData.dashboard.program_line || 'Default Program';
    }
    
    const objDisplay = document.getElementById('sub-objective-display');
    if (objDisplay) {
      objDisplay.textContent = dashData.dashboard.objective || (isReadOnly ? 'No objective stated.' : 'Click to enter objective');
      if (!dashData.dashboard.objective) {
        objDisplay.classList.add('italic');
      } else {
        objDisplay.classList.remove('italic');
      }
    }

    const notesTextarea = document.getElementById('dashboard-notes-textarea');
    if (notesTextarea) {
      notesTextarea.value = dashData.dashboard.notes || '';
      notesTextarea.disabled = isReadOnly;
    }

    ui.renderDashboardItems(dashData.items, isReadOnly, dashData.links || []);

    // Update autocomplete suggestions list
    updateAllSuggestions().catch(err => console.warn('Failed to update suggestions:', err));

    // Populate submissions
    await loadSubmissions(currentDashboardUserId);

    // Populate Team View list headers & list
    const teamViewTitle = document.getElementById('team-view-title');
    const teamViewSubtitle = document.getElementById('team-view-subtitle');
    if (teamViewTitle) {
      teamViewTitle.textContent = isSelf ? '👥 My Team Management' : `👥 Team Management for ${ownerName}`;
    }
    if (teamViewSubtitle) {
      teamViewSubtitle.textContent = isSelf
        ? 'Monitor development plans, audit health states, and trigger submission request workflows for your reporting chain.'
        : `Monitor development plans, audit health states, and trigger submission request workflows for ${ownerName}'s reporting chain.`;
    }
    ui.renderTeam(teamData.team, currentDashboardUserId, ownerRole);

    // Update Team Navigation Tab Visibility (always visible to allow org chart exploration / directory lookup)
    const hasReports = teamData && teamData.team && teamData.team.length > 0;
    const teamNavBtn = document.getElementById('nav-team-view');
    if (teamNavBtn) {
      teamNavBtn.classList.remove('hidden');
      const navText = teamNavBtn.querySelector('span:last-child');
      if (navText) {
        if (hasReports) {
          navText.textContent = isSelf ? 'My Team' : `${ownerName}'s Team`;
        } else {
          navText.textContent = 'Org Chart';
        }
      }
    }

    // Load hierarchy view if tree mode is open
    const treeContainer = document.getElementById('team-tree-mode-container');
    if (treeContainer && !treeContainer.classList.contains('hidden')) {
      await loadOrgExplorer(currentDashboardUserId);
    }

    if (overlay) {
      overlay.classList.add('hidden');
    }

  } catch (err) {
    console.error('Failed to change active employee context:', err);
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    await ui.showCustomAlert(`Failed to load workspace context: ${err.message}`, 'Error');
  }
}

export async function viewEmployeeDashboard(empId) {
  ui.switchTab('my-dashboard');
  await changeActiveEmployeeContext(empId);
}

export async function resetToMyWorkspace() {
  ui.switchTab('my-dashboard');
  await changeActiveEmployeeContext(userData.id);
}

export function closeViewerModal() {
  ui.closeViewerModal();
}

// ----------------------------------------------------
// Private Initialization & Loading functions
// ----------------------------------------------------

export async function loadDashboard(userId) {
  await changeActiveEmployeeContext(userId);
}

function toggleWorkspaceEditState(isReadOnly) {
  const editProgBtn = document.getElementById('program-edit-btn-container');
  if (editProgBtn) {
    if (isReadOnly) editProgBtn.classList.add('hidden');
    else editProgBtn.classList.remove('hidden');
  }

  const subObjDisp = document.getElementById('sub-objective-display');
  if (subObjDisp) {
    if (isReadOnly) {
      subObjDisp.classList.remove('cursor-pointer', 'hover:text-[var(--text-primary)]');
      subObjDisp.removeAttribute('onclick');
    } else {
      subObjDisp.classList.add('cursor-pointer', 'hover:text-[var(--text-primary)]');
      subObjDisp.setAttribute('onclick', 'startEditingObjective()');
    }
  }

  // Add inputs containers
  const addInputs = [
    'add-core-skill-input',
    'add-strategic-skill-input',
    'add-gap-input',
    'add-strategic-plan-input',
    'add-tactical-plan-input'
  ];
  addInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const parent = el.parentElement;
      if (parent) {
        if (isReadOnly) parent.classList.add('hidden');
        else parent.classList.remove('hidden');
      }
    }
  });


}

function updateSyncStatusUI(status) {
  const syncEl = document.getElementById('sync-status');
  if (!syncEl) return;
  
  if (status === 'syncing') {
    syncEl.className = "flex items-center gap-1.5 ml-2 text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full select-none";
    syncEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
      Syncing
    `;
  } else if (status === 'idle') {
    syncEl.className = "flex items-center gap-1.5 ml-2 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full select-none";
    syncEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
      Idle Sync
    `;
  } else if (status === 'error') {
    syncEl.className = "flex items-center gap-1.5 ml-2 text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full select-none";
    syncEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
      Offline
    `;
  } else {
    // live
    syncEl.className = "flex items-center gap-1.5 ml-2 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full select-none";
    syncEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      Live Sync
    `;
  }
}

export async function refreshActiveDashboardSilently() {
  if (!apiToken || !currentDashboardUserId || !currentDashboardId) return;

  updateSyncStatusUI('syncing');
  try {
    const isSelf = currentDashboardUserId === userData.id;
    const isReadOnly = !isSelf;

    const dashData = isSelf
      ? await api.fetchMyDashboard(apiToken, currentDashboardId)
      : await api.fetchUserDashboard(apiToken, currentDashboardUserId, currentDashboardId);

    if (!dashData || !dashData.dashboard) {
      const isIdle = (Date.now() - lastActivityTime) > 60000;
      updateSyncStatusUI(isIdle ? 'idle' : 'live');
      return;
    }

    currentDashboardData = dashData.dashboard;
    lastDashboardUpdatedAt = dashData.dashboard.updated_at;

    // 1. Update program line names if they changed
    const subProg = document.getElementById('sub-program-display');
    if (subProg) {
      subProg.textContent = dashData.dashboard.program_line || 'Default Program';
    }

    // 2. Update objective
    const objDisplay = document.getElementById('sub-objective-display');
    const objInput = document.getElementById('sub-objective-input');
    if (objDisplay && (!objInput || objInput.classList.contains('hidden'))) {
      objDisplay.textContent = dashData.dashboard.objective || (isReadOnly ? 'No objective stated.' : 'Click to enter objective');
      if (!dashData.dashboard.objective) {
        objDisplay.classList.add('italic');
      } else {
        objDisplay.classList.remove('italic');
      }
    }

    // 3. Update notes
    const notesTextarea = document.getElementById('dashboard-notes-textarea');
    if (notesTextarea && document.activeElement !== notesTextarea) {
      notesTextarea.value = dashData.dashboard.notes || '';
    }

    // 4. Update items list (Key skills, Gaps, Plans) without full screen refresh
    ui.renderDashboardItems(dashData.items, isReadOnly, dashData.links || []);

    // 5. Update autocomplete suggestions list in background
    updateAllSuggestions().catch(err => console.warn('Failed to update suggestions:', err));

    const isIdle = (Date.now() - lastActivityTime) > 60000;
    updateSyncStatusUI(isIdle ? 'idle' : 'live');
  } catch (err) {
    console.error('[Silent Refresh] Failed to refresh active dashboard:', err);
    updateSyncStatusUI('error');
  }
}

async function loadMyDashboard() {
  await refreshActiveDashboardSilently();
}

async function loadSubmissions(userId) {
  try {
    const targetUserId = userId || currentDashboardUserId || userData.id;
    const isSelf = targetUserId === userData.id;
    
    // Fetch submissions requests for the target employee
    const subData = await api.fetchSubmissions(apiToken, targetUserId);
    ui.renderMySubmissions(subData.submissions);

    // Show or hide submissions hub sub-tabs switcher based on roles
    const isManagerOrAdmin = userData.role === 'Manager' || userData.role === 'Admin';
    const switcher = document.getElementById('submissions-switcher-container');
    if (switcher) {
      if (isManagerOrAdmin) {
        switcher.classList.remove('hidden');
      } else {
        switcher.classList.add('hidden');
        switchSubmissionsTab('my-submissions');
      }
    }

    if (isManagerOrAdmin) {
      // Fetch reviews queue for the manager
      const reviewsData = await api.fetchSubmissionsReviews(apiToken);
      window.cachedReviews = reviewsData.reviews || [];
      ui.renderReviewsQueue(window.cachedReviews);
    }
  } catch (err) {
    console.error(err);
  }
}

export function switchSubmissionsTab(subTab) {
  const panelMy = document.getElementById('panel-my-submissions');
  const panelReviews = document.getElementById('panel-reviews-queue');
  const btnMy = document.getElementById('btn-sub-my-submissions');
  const btnReviews = document.getElementById('btn-sub-reviews-queue');

  if (!panelMy || !panelReviews || !btnMy || !btnReviews) return;

  if (subTab === 'my-submissions') {
    panelMy.classList.remove('hidden');
    panelReviews.classList.add('hidden');
    btnMy.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm";
    btnReviews.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
  } else if (subTab === 'reviews-queue') {
    panelReviews.classList.remove('hidden');
    panelMy.classList.add('hidden');
    btnReviews.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm";
    btnMy.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
  }
}

export function filterReviewsQueue() {
  const q = document.getElementById('review-search-input')?.value.toLowerCase() || '';
  const status = document.getElementById('review-status-filter')?.value || 'All';
  if (!window.cachedReviews) return;

  const filtered = window.cachedReviews.filter(rev => {
    const matchName = rev.employee_name.toLowerCase().includes(q) || rev.employee_email.toLowerCase().includes(q);
    const matchStatus = status === 'All' || rev.status === status;
    return matchName && matchStatus;
  });

  ui.renderReviewsQueue(filtered);
}

let activeReviewId = null;

export async function openReviewModal(requestId) {
  if (!window.cachedReviews) return;
  const review = window.cachedReviews.find(r => r.id === requestId);
  if (!review) return;

  activeReviewId = requestId;

  // Show premium loading state
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    const title = overlay.querySelector('h3');
    if (title) title.textContent = 'Loading Submission Assets...';
  }

  try {
    const data = await api.fetchUserDashboard(apiToken, review.employee_id);
    ui.populateReviewModal(review, data);
  } catch (err) {
    console.error(err);
    await ui.showCustomAlert('Failed to load dashboard data for review.', 'Error');
  } finally {
    if (overlay) overlay.classList.add('hidden');
  }
}

export function closeReviewModal() {
  ui.closeReviewModal();
  activeReviewId = null;
}

export async function submitReviewAction(status) {
  if (!activeReviewId) return;
  const feedback = document.getElementById('review-comments-input')?.value.trim() || '';

  const confirmed = await ui.showCustomConfirm(`Are you sure you want to set this submission status to "${status}"?`, 'Submit Review');
  if (!confirmed) return;

  try {
    await api.reviewSubmission(apiToken, activeReviewId, status, feedback);
    closeReviewModal();
    await ui.showCustomAlert(`Submission successfully updated to: ${status}`, 'Success');
    await loadSubmissions();
  } catch (err) {
    console.error(err);
    await ui.showCustomAlert('Failed to submit review decision: ' + err.message, 'Error');
  }
}

async function loadTeamView(userId) {
  const targetUserId = userId || currentDashboardUserId || userData.id;
  const isSelf = targetUserId === userData.id;

  let targetUser = cachedUsers.find(u => u.id === targetUserId);
  if (!targetUser && isSelf) {
    targetUser = userData;
  }
  const targetUserName = targetUser ? targetUser.name : 'Employee';
  const targetUserRole = targetUser ? targetUser.role : 'Employee';

  // Update headers on Team View panel
  const teamViewTitle = document.getElementById('team-view-title');
  const teamViewSubtitle = document.getElementById('team-view-subtitle');
  if (teamViewTitle) {
    teamViewTitle.textContent = isSelf ? '👥 My Team Management' : `👥 Team Management for ${targetUserName}`;
  }
  if (teamViewSubtitle) {
    teamViewSubtitle.textContent = isSelf
      ? 'Monitor development plans, audit health states, and trigger submission request workflows for your reporting chain.'
      : `Monitor development plans, audit health states, and trigger submission request workflows for ${targetUserName}'s reporting chain.`;
  }

  try {
    // Sync direct reports of targetUserId in background without blocking
    if (targetUser && targetUserRole !== 'Admin') {
      api.fetchDirectory(apiToken, '', targetUserId).catch(err => {
        console.warn('Failed directory fetch in background for reports:', err);
      });
    }

    const data = await api.fetchTeam(apiToken, targetUserId);
    ui.renderTeam(data.team, targetUserId, targetUserRole);
  } catch (err) {
    console.error(err);
  }
}

async function exchangeCodeForToken(code) {
  try {
    const data = await api.exchangeCode(code);
    apiToken = data.token;
    userData = data.user;

    try {
      const cleanUrl = window.location.origin + window.location.pathname.replace('/callback', '');
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}

    sessionStorage.setItem('dashboard_api_token', apiToken);
    sessionStorage.setItem('dashboard_user_data', JSON.stringify(userData));

    await initializeApplication();
  } catch (err) {
    console.error('Handshake failed:', err);

    // Clear code parameter from URL to prevent infinite loops on reload
    try {
      const cleanUrl = window.location.origin + window.location.pathname.replace('/callback', '');
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}

    // Clear any invalid session credentials
    sessionStorage.removeItem('dashboard_api_token');
    sessionStorage.removeItem('dashboard_user_data');

    ui.showAuthError('Federated session expired or invalid. Redirecting to Single Sign-On...');
    setTimeout(() => {
      redirectToSSO();
    }, 2000);
  }
}

async function redirectToSSO() {
  try {
    const config = await api.fetchConfig();
    const state = 'sso_state_' + Math.random().toString(36).substring(2, 15);
    const redirectUri = window.location.origin + '/callback';

    const authorizeUrl = new URL(config.portalSsoUrl);
    authorizeUrl.searchParams.set('client_id', config.clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('response_type', 'code');

    window.location.href = authorizeUrl.toString();
  } catch (err) {
    console.error('SSO Redirect failed:', err);
    ui.showAuthError('Federated Sign-On failed to initialize: ' + err.message);
  }
}

async function performBackgroundSync() {
  if (!apiToken) return;

  try {
    // 1. Dashboard Tab is active
    const dashboardTab = document.getElementById('tab-my-dashboard');
    if (dashboardTab && !dashboardTab.classList.contains('hidden')) {
      if (currentDashboardUserId && currentDashboardId) {
        const isSelf = currentDashboardUserId === userData.id;
        const isReadOnly = !isSelf;

        const dashData = isSelf
          ? await api.fetchMyDashboard(apiToken, currentDashboardId)
          : await api.fetchUserDashboard(apiToken, currentDashboardUserId, currentDashboardId);

        if (dashData && dashData.dashboard) {
          // Check if updated_at is different, meaning there are updates
          if (dashData.dashboard.updated_at !== lastDashboardUpdatedAt) {
            console.log(`[Smart Sync] Detected dashboard updates (last updated: ${dashData.dashboard.updated_at}). Updating UI...`);

            lastDashboardUpdatedAt = dashData.dashboard.updated_at;
            currentDashboardData = dashData.dashboard;

            // 1. Update program line names if they changed
            const subProg = document.getElementById('sub-program-display');
            if (subProg) {
              subProg.textContent = dashData.dashboard.program_line || 'Default Program';
            }

            // 2. Update objective
            const objDisplay = document.getElementById('sub-objective-display');
            const objInput = document.getElementById('sub-objective-input');
            // Only update if user is not currently editing objective
            if (objDisplay && (!objInput || objInput.classList.contains('hidden'))) {
              objDisplay.textContent = dashData.dashboard.objective || (isReadOnly ? 'No objective stated.' : 'Click to enter objective');
              if (!dashData.dashboard.objective) {
                objDisplay.classList.add('italic');
              } else {
                objDisplay.classList.remove('italic');
              }
            }

            // 3. Update notes (only if not active/focused)
            const notesTextarea = document.getElementById('dashboard-notes-textarea');
            if (notesTextarea && document.activeElement !== notesTextarea) {
              notesTextarea.value = dashData.dashboard.notes || '';
            }

            // 4. Update items list (Key skills, Gaps, Plans) without full screen refresh
            ui.renderDashboardItems(dashData.items, isReadOnly, dashData.links || []);

            // 5. Update autocomplete suggestions list in background
            updateAllSuggestions().catch(err => console.warn('Failed to update suggestions:', err));
          }
        }
      }
    }

    // 2. Submissions Tab is active
    const submissionsTab = document.getElementById('tab-submissions');
    if (submissionsTab && !submissionsTab.classList.contains('hidden')) {
      const panelMy = document.getElementById('panel-my-submissions');
      const panelReviews = document.getElementById('panel-reviews-queue');

      // Sync my submissions
      if (panelMy && !panelMy.classList.contains('hidden')) {
        const targetUserId = currentDashboardUserId || userData.id;
        const subData = await api.fetchSubmissions(apiToken, targetUserId);
        const subJson = JSON.stringify(subData.submissions);
        if (subJson !== lastSubmissionsJson) {
          lastSubmissionsJson = subJson;
          ui.renderMySubmissions(subData.submissions);
        }
      }

      // Sync reviews queue
      if (panelReviews && !panelReviews.classList.contains('hidden')) {
        const isManagerOrAdmin = userData.role === 'Manager' || userData.role === 'Admin';
        if (isManagerOrAdmin) {
          const reviewsData = await api.fetchSubmissionsReviews(apiToken);
          const reviewsJson = JSON.stringify(reviewsData.reviews);
          if (reviewsJson !== lastReviewsJson) {
            lastReviewsJson = reviewsJson;
            window.cachedReviews = reviewsData.reviews || [];
            ui.renderReviewsQueue(window.cachedReviews);
          }
        }
      }
    }

    // 3. Team View Tab is active
    const teamTab = document.getElementById('tab-team-view');
    if (teamTab && !teamTab.classList.contains('hidden')) {
      const targetUserId = currentDashboardUserId || userData.id;
      const targetUser = cachedUsers.find(u => u.id === targetUserId) || userData;
      const targetUserRole = targetUser ? targetUser.role : 'Employee';

      const teamData = await api.fetchTeam(apiToken, targetUserId);
      const teamJson = JSON.stringify(teamData.team);
      if (teamJson !== lastTeamJson) {
        lastTeamJson = teamJson;
        ui.renderTeam(teamData.team, targetUserId, targetUserRole);
      }
    }
  } catch (err) {
    console.warn('[Smart Sync] Sync cycle error:', err);
    throw err;
  }
}

function startBackgroundSync() {
  if (syncTimeoutId) return;

  async function syncLoop() {
    // Check dynamic interval based on state
    let delay = 10000; // default 10s

    if (document.visibilityState !== 'visible') {
      delay = 30000; // slow down significantly if hidden
    } else {
      const isSelf = !currentDashboardUserId || currentDashboardUserId === userData.id;
      const isIdle = (Date.now() - lastActivityTime) > 60000; // 1 min idle

      if (isSelf) {
        delay = isIdle ? 20000 : 10000; // self: 10s active, 20s idle
      } else {
        // Viewing someone else's dashboard: 3s active (near real-time), 10s idle
        delay = isIdle ? 10000 : 3000;
      }
    }

    syncTimeoutId = setTimeout(async () => {
      updateSyncStatusUI('syncing');
      try {
        await performBackgroundSync();
        const isIdle = (Date.now() - lastActivityTime) > 60000;
        updateSyncStatusUI(isIdle ? 'idle' : 'live');
      } catch (e) {
        updateSyncStatusUI('error');
      }
      syncLoop();
    }, delay);
  }

  syncLoop();
}

async function initializeApplication() {
  document.getElementById('user-name').textContent = userData.name;
  document.getElementById('user-role').textContent = userData.designation || userData.role.replace('_', ' ');
  document.getElementById('user-avatar').textContent = userData.name.split(' ').map(n => n[0]).join('');

  if (userData && !cachedUsers.some(u => u.id === userData.id)) {
    cachedUsers.push(userData);
  }

  try {
    console.log('Syncing current user session with main portal database context...');
    await api.syncUserDirectory(apiToken, [userData]);
    console.log('User profile synced inside local SQLite DB successfully.');
  } catch (err) {
    console.warn('Failed to sync current user profile:', err);
  }

  // Pre-fetch directory in background for instant local search & dropdowns
  Promise.resolve().then(async () => {
    try {
      const dirRes = await api.fetchDirectory(apiToken, '', '');
      if (dirRes.ok) {
        const dirData = await dirRes.json();
        setDirectoryCache(dirData.users || []);
        ui.populateManagerDropdown(cachedUsers, userData.managerId);
      }
    } catch (err) {
      console.warn('Failed to pre-fetch directory:', err);
    }
  });

  await changeActiveEmployeeContext(userData.id);
  ui.convertNativeSelectsToCustom();
  startBackgroundSync();
}

function adjustFontScaling() {
  let baselineDPR = parseFloat(sessionStorage.getItem('baseline_dpr'));
  if (!baselineDPR) {
    baselineDPR = window.devicePixelRatio || 1;
    sessionStorage.setItem('baseline_dpr', baselineDPR.toString());
  }

  const currentDPR = window.devicePixelRatio || 1;
  const zoomLevel = currentDPR / baselineDPR;

  const htmlEl = document.documentElement;
  if (zoomLevel <= 0.9) {
    htmlEl.classList.add('zoom-compensation');
  } else {
    htmlEl.classList.remove('zoom-compensation');
  }
}

window.addEventListener('resize', adjustFontScaling);

async function initSession() {
  adjustFontScaling();
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear();
  const dateDisplay = document.getElementById('header-date-display');
  if (dateDisplay) {
    dateDisplay.textContent = `${mm}/${dd}/${yyyy}`;
  }

  if (window.self !== window.top) {
    console.log('App running inside iframe, waiting for postMessage auth handshake from parent...');
    setTimeout(() => {
      if (!apiToken) {
        ui.showAuthError('Handshake timeout: Did not receive secure credentials from parent portal.');
      }
    }, 5000);
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code');
  if (codeFromUrl) {
    await exchangeCodeForToken(codeFromUrl);
    return;
  }

  const storedToken = sessionStorage.getItem('dashboard_api_token');
  const storedUser = sessionStorage.getItem('dashboard_user_data');
  if (storedToken && storedUser) {
    apiToken = storedToken;
    userData = JSON.parse(storedUser);
    await initializeApplication();
    return;
  }

  console.log('No active session. Redirecting to Portal SSO...');
  await redirectToSSO();
}

// ----------------------------------------------------
// Event Listeners & postMessage listeners
// ----------------------------------------------------

window.addEventListener('message', async (e) => {
  if (!e.data) return;

  const allowedOrigin = await getPortalOrigin();
  if (e.origin !== allowedOrigin) {
    console.warn('Blocked message event from unauthorized origin:', e.origin);
    return;
  }

  if (e.data.type === 'THEME_CHANGE') {
    document.documentElement.setAttribute('data-theme', e.data.theme);
  }

  if (e.data.type === 'FORGE_AUTH_TOKEN') {
    const { code, token } = e.data;
    const targetCode = code || token;
    if (targetCode) {
      await exchangeCodeForToken(targetCode);
    } else {
      ui.showAuthError('Invalid authentication credentials.');
    }
  }
});

// Expose public APIs on window object so HTML element attributes can resolve them
window.switchTab = switchTab;
window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.updateManagerSetting = updateManagerSetting;
window.updateProgramSetting = updateProgramSetting;
window.updateDashboardNotes = updateDashboardNotes;
window.startEditingObjective = startEditingObjective;
window.saveObjectiveEdit = saveObjectiveEdit;
window.addQuickItem = addQuickItem;
window.submitDashboard = submitDashboard;
window.viewEmployeeDashboard = viewEmployeeDashboard;
window.changeActiveEmployeeContext = changeActiveEmployeeContext;
window.resetToMyWorkspace = resetToMyWorkspace;
window.triggerRequestSubmission = triggerRequestSubmission;
window.closeViewerModal = closeViewerModal;
window.switchSubmissionsTab = switchSubmissionsTab;
window.filterReviewsQueue = filterReviewsQueue;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReviewAction = submitReviewAction;
window.showProfilePopup = showProfilePopup;
window.handleLogout = handleLogout;

// Hierarchy and Search Window Exports
window.handleHeaderSearch = handleHeaderSearch;
window.toggleHierarchyNode = toggleHierarchyNode;
window.collapseAllHierarchyNodes = collapseAllHierarchyNodes;
window.toggleTeamViewMode = toggleTeamViewMode;
window.focusOnEmployee = focusOnEmployee;
window.saveCurrentVersion = saveCurrentVersion;
window.restoreVersionAction = restoreVersionAction;
window.deleteVersionAction = deleteVersionAction;
window.restoreDashboardAction = restoreDashboardAction;
window.deleteDashboardPermanentAction = deleteDashboardPermanentAction;
window.loadHistoryAndVersions = loadHistoryAndVersions;

let searchTimeout = null;
let searchHighlightIndex = -1;

function highlightSearchResultItem(index) {
  const resultsContainer = document.getElementById('header-search-results');
  if (!resultsContainer) return;
  const items = resultsContainer.querySelectorAll('.search-result-item');
  if (items.length === 0) return;

  items.forEach(item => item.classList.remove('bg-[var(--bg-hover)]', 'border-l-4', 'border-[var(--accent)]'));
  
  if (index < 0) {
    searchHighlightIndex = -1;
    return;
  }
  if (index >= items.length) {
    index = 0;
  }
  if (index < 0) {
    index = items.length - 1;
  }
  
  searchHighlightIndex = index;
  const item = items[index];
  item.classList.add('bg-[var(--bg-hover)]', 'border-l-4', 'border-[var(--accent)]');
  item.scrollIntoView({ block: 'nearest' });
}

// Add DOM keydown listener for keyboard navigation
document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('header-search-input');
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      const resultsContainer = document.getElementById('header-search-results');
      if (!resultsContainer || resultsContainer.classList.contains('hidden')) return;

      const items = resultsContainer.querySelectorAll('.search-result-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightSearchResultItem(searchHighlightIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightSearchResultItem(searchHighlightIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchHighlightIndex >= 0 && searchHighlightIndex < items.length) {
          items[searchHighlightIndex].click();
        }
      } else if (e.key === 'Escape') {
        resultsContainer.classList.add('hidden');
        inputEl.blur();
      }
    });
  }
});

export function renderSearchResults(employees, resultsContainer, inputEl) {
  if (employees.length === 0) {
    resultsContainer.innerHTML = `<div class="p-3 text-center text-xs text-[var(--text-secondary)]">No matching employees found.</div>`;
    searchHighlightIndex = -1;
    return;
  }

  resultsContainer.innerHTML = '';
  employees.forEach(emp => {
    const item = document.createElement('div');
    item.className = "search-result-item flex items-center justify-between p-2.5 hover:bg-[var(--bg-hover)] cursor-pointer border-b border-[var(--border-color)] last:border-b-0 transition-colors";
    item.onclick = () => {
      resultsContainer.classList.add('hidden');
      inputEl.value = '';
      viewEmployeeDashboard(emp.id);
    };

    item.innerHTML = `
      <div class="overflow-hidden pr-2">
        <p class="text-xs font-bold text-[var(--text-primary)] truncate">${emp.name}</p>
        <p class="text-[9px] text-[var(--text-secondary)] truncate font-mono">${emp.email} • ${emp.designation || emp.role}</p>
      </div>
      <span class="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-bold border border-[var(--accent)]/20 shrink-0">View</span>
    `;
    resultsContainer.appendChild(item);
  });
  searchHighlightIndex = -1;
}

export async function handleHeaderSearch(inputEl) {
  const query = inputEl.value.trim();
  const resultsContainer = document.getElementById('header-search-results');

  if (searchTimeout) clearTimeout(searchTimeout);

  if (query.length === 0) {
    const history = getSearchHistory();
    if (history.length === 0) {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.add('hidden');
      return;
    }

    resultsContainer.innerHTML = `
      <div class="p-2 border-b border-[var(--border-color)] bg-[var(--bg-input)]/50 select-none">
        <span class="text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)] pl-1">Recent Views</span>
      </div>
    `;
    history.forEach(emp => {
      const item = document.createElement('div');
      item.className = "search-result-item flex items-center justify-between p-2.5 hover:bg-[var(--bg-hover)] cursor-pointer border-b border-[var(--border-color)] last:border-b-0 transition-colors";
      item.onclick = () => {
        resultsContainer.classList.add('hidden');
        inputEl.value = '';
        viewEmployeeDashboard(emp.id);
      };

      item.innerHTML = `
        <div class="overflow-hidden pr-2">
          <p class="text-xs font-bold text-[var(--text-primary)] truncate">${emp.name}</p>
          <p class="text-[9px] text-[var(--text-secondary)] truncate font-mono">${emp.email} • ${emp.designation || emp.role}</p>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-bold border border-[var(--accent)]/20 shrink-0">View</span>
      `;
      resultsContainer.appendChild(item);
    });

    resultsContainer.classList.remove('hidden');
    searchHighlightIndex = -1;
    return;
  }

  // 1. FAST PATH: Local Cache Search
  if (directoryFetched && cachedUsers.length > 0) {
    const lower = query.toLowerCase();
    const employees = cachedUsers.filter(u => 
      u.name.toLowerCase().includes(lower) || 
      (u.designation && u.designation.toLowerCase().includes(lower)) || 
      u.email.toLowerCase().includes(lower)
    );
    renderSearchResults(employees.slice(0, 50), resultsContainer, inputEl);
    return;
  }

  // 2. SLOW PATH: Show loading indicator & fetch from network
  resultsContainer.innerHTML = `
    <div class="p-3 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
      <div class="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      Searching...
    </div>
  `;
  resultsContainer.classList.remove('hidden');

  searchTimeout = setTimeout(async () => {
    try {
      const res = await api.fetchDirectory(apiToken, query, '');
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const rawEmployees = data.users || [];

      const uuidToEid = {};
      rawEmployees.forEach(u => {
        if (u.id && u.eid) uuidToEid[u.id] = u.eid;
      });

      const mappedEmployees = rawEmployees.map(emp => {
        let mId = emp.manager_id || emp.managerId || null;
        if (mId && uuidToEid[mId]) {
          mId = uuidToEid[mId];
        }
        return {
          id: emp.eid || emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role === 'super_admin' || emp.role === 'admin' ? 'Admin' : (emp.role === 'manager' ? 'Manager' : 'Employee'),
          managerId: mId,
          designation: emp.designation || ''
        };
      });

      mappedEmployees.forEach(emp => {
        if (!cachedUsers.some(u => u.id === emp.id)) {
          cachedUsers.push(emp);
        }
      });

      renderSearchResults(mappedEmployees, resultsContainer, inputEl);
    } catch (err) {
      console.error(err);
      resultsContainer.innerHTML = `<div class="p-3 text-center text-xs text-red-400">Search error.</div>`;
      searchHighlightIndex = -1;
    }
  }, 150);
}

// Close search dropdown on clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('header-search-results');
  const input = document.getElementById('header-search-input');
  if (container && e.target !== container && e.target !== input) {
    container.classList.add('hidden');
  }
});

export async function toggleHierarchyNode(userId) {
  const container = document.getElementById(`children-container-${userId}`);
  const toggleBtn = document.getElementById(`toggle-btn-${userId}`);
  
  if (!container || !toggleBtn) return;

  const isExpanded = !container.classList.contains('hidden');
  
  if (isExpanded) {
    container.classList.add('hidden');
    toggleBtn.textContent = '▶';
    toggleBtn.style.transform = 'rotate(0deg)';
    return;
  }

  toggleBtn.textContent = '⌛';
  
  try {
    const res = await api.fetchDirectory(apiToken, '', userId);
    if (!res.ok) throw new Error('Failed to fetch reports');
    const data = await res.json();
    const reports = data.users || [];

    if (reports.length === 0) {
      container.innerHTML = '<div class="text-[var(--text-secondary)] italic py-1 pl-4 text-xs">No direct reports.</div>';
      container.classList.remove('hidden');
      toggleBtn.textContent = '•';
      return;
    }

    // Sync reports to local SQLite
    await api.syncUserDirectory(apiToken, reports);

    // Fetch dashboard status details for synced users
    const teamRes = await fetch(`${api.apiPrefix}/team?managerId=${userId}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    if (!teamRes.ok) throw new Error('Failed to load team dashboards');
    const teamData = await teamRes.json();
    
    ui.renderTreeNodes(container, teamData.team);
    container.classList.remove('hidden');
    toggleBtn.textContent = '▼';
  } catch (err) {
    console.error(err);
    toggleBtn.textContent = '▶';
    await ui.showCustomAlert('Failed to load reporting structure: ' + err.message, 'Error');
  }
}

export async function loadOrgExplorer(focusedUserId) {
  const container = document.getElementById('org-chart-display');
  const breadcrumbsContainer = document.getElementById('org-breadcrumbs');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-12 text-[var(--text-secondary)] text-xs">
      <div class="w-8 h-8 rounded-full border-4 border-t-[var(--accent)] border-white/10 animate-spin mx-auto mb-3"></div>
      Loading organizational chart...
    </div>
  `;

  try {
    // 1. Fetch complete directory to cache all users in memory if not already done
    if (!directoryFetched) {
      const dirRes = await api.fetchDirectory(apiToken, '', '');
      if (dirRes.ok) {
        const dirData = await dirRes.json();
        setDirectoryCache(dirData.users || []);
      }
    }

    if (userData && !cachedUsers.some(u => u.id === userData.id)) {
      cachedUsers.push(userData);
    }

    // 2. Fetch all team dashboard statuses to build the presence status Map
    const statusMap = {};
    
    // Logged in user status
    if (currentDashboardData) {
      statusMap[userData.id] = 'Active';
    }
    
    // Fetch reports dashboard statuses
    try {
      const teamData = await api.fetchTeam(apiToken);
      if (teamData && teamData.team) {
        teamData.team.forEach(emp => {
          if (emp.hasDashboard) {
            statusMap[emp.id] = 'Active';
          }
        });
      }
    } catch (e) {
      console.warn("Could not load team statuses for org-chart:", e);
    }

    // Find the focused user in cached users
    let focusedUser = cachedUsers.find(u => u.id === focusedUserId);
    if (!focusedUser) {
      // Fallback: If not in cache, try to fetch their dashboard which contains user details
      try {
        const dashData = await api.fetchUserDashboard(apiToken, focusedUserId);
        focusedUser = {
          id: focusedUserId,
          name: dashData.dashboard.name,
          email: dashData.dashboard.email,
          role: dashData.dashboard.role,
          managerId: dashData.dashboard.manager_id || dashData.dashboard.managerId,
          designation: dashData.dashboard.designation || ''
        };
        cachedUsers.push(focusedUser);
        statusMap[focusedUserId] = 'Active';
      } catch (err) {
        console.error("Focused user not found and failed to fetch details:", err);
      }
    }

    if (!focusedUser) {
      throw new Error("Target user could not be resolved in the directory.");
    }

    // 3. Build Manager Chain (upwards)
    const managerChain = [];
    let current = focusedUser;
    let guard = 0; // prevent infinite loops
    while (current && current.managerId && guard < 20) {
      const mgr = cachedUsers.find(u => u.id === current.managerId);
      if (mgr) {
        managerChain.unshift(mgr);
        current = mgr;
      } else {
        break;
      }
      guard++;
    }

    // 4. Build Peers (sharing same manager, excluding focused user)
    const peers = focusedUser.managerId
      ? cachedUsers.filter(u => u.managerId === focusedUser.managerId && u.id !== focusedUser.id)
      : [];

    // 5. Build Direct Reports (reporting to focused user)
    const directReports = cachedUsers.filter(u => u.managerId === focusedUser.id);

    // 6. Helper: Check if managerId reports to employeeId client-side
    const clientIsUplineManager = (managerId, employeeId) => {
      if (!managerId || !employeeId) return false;
      let curr = cachedUsers.find(u => u.id === employeeId);
      let g = 0;
      while (curr && curr.managerId && g < 20) {
        if (curr.managerId === managerId) return true;
        curr = cachedUsers.find(u => u.id === curr.managerId);
        g++;
      }
      return false;
    };

    // 7. Render Org Explorer
    ui.renderOrgExplorer({
      container,
      breadcrumbsContainer,
      focusedUser,
      managerChain,
      peers,
      directReports,
      currentUser: userData,
      statusMap,
      isUplineManager: clientIsUplineManager
    });

  } catch (err) {
    console.error("Org chart render error:", err);
    container.innerHTML = `
      <div class="text-center py-12 text-red-400 text-xs">
        Failed to load organizational chart: ${err.message}
      </div>
    `;
  }
}

export async function loadHierarchyRoot() {
  await loadOrgExplorer(currentDashboardUserId || userData.id);
}

export function focusOnEmployee(userId) {
  changeActiveEmployeeContext(userId);
}

export function resetOrgChartFocus() {
  changeActiveEmployeeContext(userData.id);
}

export function collapseAllHierarchyNodes() {}

export function handleLogout() {
  sessionStorage.removeItem('dashboard_api_token');
  sessionStorage.removeItem('dashboard_user_data');
  window.location.reload();
}

export function showProfilePopup(event) {
  event.stopPropagation();
  
  // If this click is part of a double-click, ignore it to prevent flickering
  if (event.detail > 1) {
    return;
  }

  if (!userData) return;

  // Remove existing popup/modal overlay if any
  const existingOverlay = document.getElementById('user-profile-modal-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create backdrop overlay
  const overlay = document.createElement('div');
  overlay.id = 'user-profile-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998] transition-opacity duration-200 opacity-0';

  // Create modal content
  const modal = document.createElement('div');
  modal.id = 'user-profile-popup';
  modal.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-3xl shadow-2xl p-6 w-80 max-w-[90%] z-[99999] transition-all duration-200 opacity-0 scale-95 select-none';

  const initials = userData.name.split(' ').map(n => n[0]).join('');
  const email = userData.email || '';
  const roleText = userData.role ? userData.role.replace('_', ' ') : '';
  const designationText = userData.designation || roleText;

  modal.innerHTML = `
    <div class="flex flex-col items-center text-center gap-4 relative">
      <!-- Close Button (X) at Top Right -->
      <button id="user-profile-close-x" class="absolute -top-2 -right-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-sm font-black p-1.5 hover:bg-[var(--bg-hover)] rounded-lg">
        ✕
      </button>

      <!-- Avatar -->
      <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl border border-[var(--border-color)] shadow-lg mt-2">
        ${initials}
      </div>

      <!-- User Details -->
      <div class="w-full">
        <h4 class="text-sm font-black text-[var(--text-primary)] truncate">${userData.name}</h4>
        <p class="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mt-1 truncate">${designationText}</p>
        <p class="text-[11px] text-[var(--text-secondary)] font-mono mt-3 truncate border-t border-[var(--border-color)] pt-3 select-text">${email}</p>
      </div>

      <!-- Buttons Section -->
      <div class="w-full flex flex-col gap-2 mt-2">
        <!-- Logout Button -->
        <button onclick="handleLogout()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all select-none active:scale-[0.98]">
          Sign Out / Log Out
        </button>
        <!-- Cancel Button -->
        <button id="user-profile-close-btn" class="w-full py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all bg-[var(--bg-input)] border border-[var(--border-color)] active:scale-[0.98]">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // Transition animations
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    modal.classList.remove('opacity-0', 'scale-95');
    modal.classList.add('opacity-100', 'scale-100');
  });

  // Close function
  const closeModal = () => {
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    modal.classList.remove('opacity-100', 'scale-100');
    modal.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
      overlay.remove();
      modal.remove();
    }, 200);
  };

  // Close event listeners
  overlay.addEventListener('click', closeModal);
  
  const closeX = modal.querySelector('#user-profile-close-x');
  if (closeX) closeX.addEventListener('click', closeModal);

  const closeBtn = modal.querySelector('#user-profile-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
}

export async function saveCurrentVersion() {
  if (!apiToken) return;
  if (!currentDashboardId) {
    await ui.showCustomAlert('No active dashboard program loaded to save a version of.', 'Action Restricted');
    return;
  }
  const isSelf = currentDashboardUserId === userData.id;
  const isDeleted = !!currentDashboardData.is_deleted;
  if (!isSelf || isDeleted) {
    await ui.showCustomAlert('You cannot save version snapshots of a read-only or deleted workspace.', 'Action Restricted');
    return;
  }

  const name = await ui.showCustomPrompt(
    'Enter a description name for this version snapshot:', 
    `Snapshot - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
    'Save Version Snapshot'
  );
  if (name === null) return;
  const versionName = name.trim() || `Snapshot ${new Date().toLocaleString()}`;
  try {
    await api.saveVersion(apiToken, currentDashboardId, versionName);
    await ui.showCustomAlert('Dashboard version saved successfully!', 'Success');
    await loadHistoryAndVersions();
  } catch (err) {
    await ui.showCustomAlert('Failed to save version: ' + err.message, 'Error');
  }
}

export async function restoreVersionAction(versionId, versionName) {
  const confirmed = await ui.showCustomConfirm(`Are you sure you want to restore the dashboard version "${versionName}"? Current active goals and links will be overwritten with the snapshot.`, 'Restore Version');
  if (!confirmed) return;
  try {
    await api.restoreVersion(apiToken, currentDashboardId, versionId);
    await ui.showCustomAlert(`Dashboard restored to version "${versionName}" successfully.`, 'Success');
    await changeActiveEmployeeContext(currentDashboardUserId, currentDashboardId);
  } catch (err) {
    await ui.showCustomAlert('Failed to restore version: ' + err.message, 'Error');
  }
}

export async function deleteVersionAction(versionId) {
  const confirmed = await ui.showCustomConfirm('Are you sure you want to delete this version snapshot permanently?', 'Delete Version');
  if (!confirmed) return;
  try {
    await api.deleteVersion(apiToken, currentDashboardId, versionId);
    await loadHistoryAndVersions();
  } catch (err) {
    await ui.showCustomAlert('Failed to delete version: ' + err.message, 'Error');
  }
}

export async function restoreDashboardAction(dashboardId) {
  try {
    await api.restoreDashboard(apiToken, dashboardId);
    await ui.showCustomAlert('Dashboard program restored successfully.', 'Success');
    
    // Refresh trash history tab if open
    const activeEl = document.getElementById('tab-history-versions');
    if (activeEl && !activeEl.classList.contains('hidden')) {
      await loadTrashHistory();
    }
    
    // Refresh programs dropdown / active context list
    await changeActiveEmployeeContext(currentDashboardUserId, dashboardId);
  } catch (err) {
    await ui.showCustomAlert('Failed to restore dashboard: ' + err.message, 'Error');
  }
}

export async function deleteDashboardPermanentAction(dashboardId) {
  const confirmed = await ui.showCustomConfirm('Are you sure you want to permanently destroy this dashboard program? All items, links, and history for it will be lost forever.', 'Destroy Program Permanently');
  if (!confirmed) return;
  try {
    await api.deleteDashboardPermanent(apiToken, dashboardId);
    await ui.showCustomAlert('Dashboard program permanently deleted.', 'Success');
    
    // Refresh trash history tab if open
    const activeEl = document.getElementById('tab-history-versions');
    if (activeEl && !activeEl.classList.contains('hidden')) {
      await loadTrashHistory();
    }
    
    if (dashboardId === currentDashboardId) {
      await changeActiveEmployeeContext(currentDashboardUserId);
    } else {
      await changeActiveEmployeeContext(currentDashboardUserId, currentDashboardId);
    }
  } catch (err) {
    await ui.showCustomAlert('Failed to delete program permanently: ' + err.message, 'Error');
  }
}

export async function loadHistoryAndVersions() {
  if (!apiToken) return;

  const versionsContainer = document.getElementById('versions-list');
  if (versionsContainer) {
    versionsContainer.innerHTML = `
      <div class="flex items-center justify-center p-8 text-[var(--text-secondary)] text-xs">
        <span class="animate-spin mr-2">⏳</span> Loading versions...
      </div>
    `;
  }

  // Manage save button visibility inside History & Versions page
  const pageSaveVerBtn = document.getElementById('page-save-ver-btn');
  if (pageSaveVerBtn) {
    const isSelf = currentDashboardUserId === userData.id;
    const isDeleted = currentDashboardData ? !!currentDashboardData.is_deleted : false;
    if (!isSelf || isDeleted) {
      pageSaveVerBtn.classList.add('hidden');
    } else {
      pageSaveVerBtn.classList.remove('hidden');
    }
  }

  if (!currentDashboardId) {
    if (versionsContainer) {
      versionsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)] text-center text-[var(--text-secondary)]">
          <span class="text-2xl mb-2">📁</span>
          <p class="text-xs font-semibold">No active dashboard program loaded.</p>
          <p class="text-[10px] text-gray-500 mt-1">Please select or create a dashboard program first.</p>
        </div>
      `;
    }
    return;
  }

  try {
    const versionsData = await api.fetchVersions(apiToken, currentDashboardId);
    ui.renderVersions(versionsData.versions);
  } catch (err) {
    console.error('Failed to load versions:', err);
    if (versionsContainer) {
      versionsContainer.innerHTML = `
        <div class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
          ⚠️ Failed to load versions: ${err.message}
        </div>
      `;
    }
  }
}

export async function loadTrashHistory() {
  if (!apiToken) return;

  const historyContainer = document.getElementById('history-list');
  if (historyContainer) {
    historyContainer.innerHTML = `
      <div class="flex items-center justify-center p-8 text-[var(--text-secondary)] text-xs">
        <span class="animate-spin mr-2">⏳</span> Loading trash history and version snapshots...
      </div>
    `;
  }

  // Fetch deleted dashboards (History) and their versions in parallel
  try {
    const historyData = await api.fetchDashboardHistory(apiToken);
    const dashboards = historyData.dashboards || [];

    const dashboardsWithVersions = await Promise.all(
      dashboards.map(async (d) => {
        try {
          const versionsData = await api.fetchVersions(apiToken, d.id);
          return { ...d, versions: versionsData.versions || [] };
        } catch (e) {
          console.warn('Failed to fetch versions for deleted dashboard:', d.id, e);
          return { ...d, versions: [] };
        }
      })
    );

    ui.renderHistory(dashboardsWithVersions);
  } catch (err) {
    console.error('Failed to load history:', err);
    if (historyContainer) {
      historyContainer.innerHTML = `
        <div class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
          ⚠️ Failed to load trash history: ${err.message}
        </div>
      `;
    }
  }
}

export async function restoreDeletedDashboardToVersion(dashboardId, versionId, versionName) {
  const confirmed = await ui.showCustomConfirm(`Restore dashboard program to snapshot "${versionName}"? This will also reactivate the program.`, 'Restore Version');
  if (!confirmed) return;
  try {
    // 1. Restore dashboard
    await api.restoreDashboard(apiToken, dashboardId);
    // 2. Restore version state
    await api.restoreVersion(apiToken, dashboardId, versionId);
    await ui.showCustomAlert(`Dashboard program restored and reset to version "${versionName}"!`, 'Success');
    
    // Switch to my-dashboard and reload context
    ui.switchTab('my-dashboard');
    await changeActiveEmployeeContext(currentDashboardUserId, dashboardId);
  } catch (err) {
    await ui.showCustomAlert('Failed to restore snapshot: ' + err.message, 'Error');
  }
}

export async function deleteDeletedDashboardVersion(dashboardId, versionId) {
  const confirmed = await ui.showCustomConfirm('Are you sure you want to delete this version snapshot permanently?', 'Delete Version');
  if (!confirmed) return;
  try {
    await api.deleteVersion(apiToken, dashboardId, versionId);
    await loadTrashHistory();
  } catch (err) {
    await ui.showCustomAlert('Failed to delete version: ' + err.message, 'Error');
  }
}

// Bind globals for inline/HTML action triggers
window.saveCurrentVersion = saveCurrentVersion;
window.restoreVersionAction = restoreVersionAction;
window.deleteVersionAction = deleteVersionAction;
window.restoreDashboardAction = restoreDashboardAction;
window.deleteDashboardPermanentAction = deleteDashboardPermanentAction;
window.loadHistoryAndVersions = loadHistoryAndVersions;
window.loadTrashHistory = loadTrashHistory;
window.restoreDeletedDashboardToVersion = restoreDeletedDashboardToVersion;
window.deleteDeletedDashboardVersion = deleteDeletedDashboardVersion;

// Auto boot session
initSession();
