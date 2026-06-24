import * as api from './api.js';
import * as ui from './ui.js';

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
  ui.switchTab(tab);
  if (tab === 'my-dashboard') {
    loadDashboard(currentDashboardUserId);
  } else if (tab === 'submissions') {
    loadSubmissions(currentDashboardUserId);
  } else if (tab === 'team-view') {
    loadTeamView(currentDashboardUserId);
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
    console.log('Manager association updated successfully.');
  } catch (e) {
    console.error('Failed to update manager:', e);
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
  const val = document.getElementById('header-program-input').value.trim();
  const subProg = document.getElementById('sub-program-display');
  if (subProg) subProg.textContent = val || 'Default Program';
  if (val === currentDashboardData.program_line) return;

  currentDashboardData.program_line = val;
  await saveDashboardSettings();
}

export async function updateDashboardStatus(newStatus) {
  if (newStatus === currentDashboardData.status) return;
  currentDashboardData.status = newStatus;
  ui.highlightStatusBtn(newStatus);
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
  const flow = { 'Critical': 'High', 'High': 'Medium', 'Medium': 'Critical' };
  const nextSeverity = flow[item.category] || 'Medium';

  try {
    await api.updateDashboardItem(apiToken, item.id, { category: nextSeverity });
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
  } catch (err) {
    console.error(err);
  }
}

export async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this action item?')) return;
  try {
    await api.deleteDashboardItem(apiToken, id);
    await loadMyDashboard();
  } catch (err) {
    console.error(err);
  }
}

export async function submitDashboard(id) {
  if (!confirm('Are you sure you want to submit your current TRR dashboard to your manager for review?')) return;
  try {
    await api.submitDashboardReq(apiToken, id);
    alert('Dashboard submitted successfully!');
    await loadSubmissions();
    if (userData.role === 'Manager' || userData.role === 'Admin') {
      await loadTeamView();
    }
  } catch (err) {
    console.error(err);
  }
}

export async function triggerRequestSubmission(empId) {
  const deadline = prompt(
    'Enter a target review deadline date (YYYY-MM-DD):', 
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  if (!deadline) return;

  try {
    const res = await api.createSubmissionRequest(apiToken, empId, deadline);
    if (res.ok) {
      alert('Submission request generated successfully!');
      await loadTeamView();
    } else {
      const errData = await res.json();
      alert('Error: ' + errData.error);
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

export async function changeActiveEmployeeContext(userId) {
  try {
    const isSelf = !userId || userId === userData.id;
    currentDashboardUserId = isSelf ? userData.id : userId;

    // Show premium loading state
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      const title = overlay.querySelector('h3');
      const subtitle = overlay.querySelector('p');
      if (title) title.textContent = 'Switching Workspace Context...';
      if (subtitle) subtitle.textContent = 'Synchronizing goal dashboard and reporting structures...';
    }

    // Load all data in parallel to avoid waterfalls
    const dashboardPromise = isSelf ? api.fetchMyDashboard(apiToken) : api.fetchUserDashboard(apiToken, currentDashboardUserId);
    const teamPromise = api.fetchTeam(apiToken, currentDashboardUserId).catch(e => {
      console.warn('Failed to load team data in context switch:', e);
      return { team: [] };
    });
    const submissionsPromise = api.fetchSubmissions(apiToken, currentDashboardUserId).catch(e => {
      console.warn('Failed to load submissions in context switch:', e);
      return { submissions: [] };
    });

    const [dashData, teamData, subData] = await Promise.all([
      dashboardPromise,
      teamPromise,
      submissionsPromise
    ]);

    currentDashboardId = dashData.dashboard.id;
    currentDashboardData = dashData.dashboard;

    // Resolve details of owner
    let ownerName = dashData.dashboard.name || userData.name;
    let ownerRole = dashData.dashboard.role || userData.role;

    if (!isSelf && dashData.dashboard.name) {
      const emp = {
        id: currentDashboardUserId,
        name: dashData.dashboard.name,
        email: dashData.dashboard.email,
        role: dashData.dashboard.role,
        managerId: dashData.dashboard.manager_id || dashData.dashboard.managerId || null
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

    // Toggle Warning Banner & Edit Controls
    const warningBanner = document.getElementById('read-only-warning-banner');
    const isReadOnly = !isSelf;

    if (warningBanner) {
      if (isReadOnly) {
        warningBanner.classList.remove('hidden');
        const textSpan = warningBanner.querySelector('span:nth-child(2)');
        if (textSpan) {
          textSpan.innerHTML = `<strong>Read-Only Mode:</strong> You are viewing <strong>${ownerName}</strong>'s development dashboard workspace. Editing, status updates, and modifications are disabled.`;
        }
      } else {
        warningBanner.classList.add('hidden');
      }
    }

    // Toggle edit controls on main workspace
    toggleWorkspaceEditState(isReadOnly);

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

    ui.highlightStatusBtn(dashData.dashboard.status);
    ui.renderDashboardItems(dashData.items, isReadOnly);

    // Populate submissions
    ui.renderSubmissions(subData.submissions);

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

    // Update Team Navigation Tab Visibility based on reporting lines
    const hasReports = teamData && teamData.team && teamData.team.length > 0;
    const teamNavBtn = document.getElementById('nav-team-view');
    if (teamNavBtn) {
      if (hasReports) {
        teamNavBtn.classList.remove('hidden');
        const navText = teamNavBtn.querySelector('span:last-child');
        if (navText) {
          navText.textContent = isSelf ? 'My Team' : `${ownerName}'s Team`;
        }
      } else {
        teamNavBtn.classList.add('hidden');
        // If we are currently on the team view tab and it is hidden, switch to dashboard
        const teamViewTab = document.getElementById('tab-team-view');
        if (teamViewTab && !teamViewTab.classList.contains('hidden')) {
          ui.switchTab('my-dashboard');
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
    alert(`Failed to load workspace context: ${err.message}`);
  }
}

export async function viewEmployeeDashboard(empId) {
  ui.switchTab('my-dashboard');
  await changeActiveEmployeeContext(empId);
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

  // Status buttons
  const statusBtns = ['ontrack', 'atrisk', 'offtrack'];
  statusBtns.forEach(b => {
    const el = document.getElementById(`status-btn-${b}`);
    if (el) {
      if (isReadOnly) {
        el.removeAttribute('onclick');
        el.classList.add('cursor-not-allowed', 'opacity-70');
      } else {
        const statuses = { ontrack: 'On Track', atrisk: 'At Risk', offtrack: 'Off Track' };
        el.setAttribute('onclick', `updateDashboardStatus('${statuses[b]}')`);
        el.classList.remove('cursor-not-allowed', 'opacity-70');
      }
    }
  });
}

async function loadMyDashboard() {
  await changeActiveEmployeeContext(userData.id);
}

async function loadSubmissions(userId) {
  try {
    const targetUserId = userId || currentDashboardUserId || userData.id;
    const data = await api.fetchSubmissions(apiToken, targetUserId);
    ui.renderSubmissions(data.submissions);
  } catch (err) {
    console.error(err);
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
    ui.showAuthError(err.message);
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

async function initializeApplication() {
  document.getElementById('user-name').textContent = userData.name;
  document.getElementById('user-role').textContent = userData.role.replace('_', ' ');
  document.getElementById('user-avatar').textContent = userData.name.split(' ').map(n => n[0]).join('');

  if (userData && !cachedUsers.some(u => u.id === userData.id)) {
    cachedUsers.push(userData);
  }

  document.getElementById('auth-overlay').classList.add('hidden');

  try {
    console.log('Syncing current user session with main portal database context...');
    await api.syncUserDirectory(apiToken, [userData]);
    console.log('User profile synced inside local SQLite DB successfully.');
  } catch (err) {
    console.warn('Failed to sync current user profile:', err);
  }

  await changeActiveEmployeeContext(userData.id);
}

async function initSession() {
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
window.updateManagerSetting = updateManagerSetting;
window.updateProgramSetting = updateProgramSetting;
window.updateDashboardStatus = updateDashboardStatus;
window.updateDashboardNotes = updateDashboardNotes;
window.startEditingObjective = startEditingObjective;
window.saveObjectiveEdit = saveObjectiveEdit;
window.addQuickItem = addQuickItem;
window.submitDashboard = submitDashboard;
window.viewEmployeeDashboard = viewEmployeeDashboard;
window.changeActiveEmployeeContext = changeActiveEmployeeContext;
window.triggerRequestSubmission = triggerRequestSubmission;
window.closeViewerModal = closeViewerModal;

// Hierarchy and Search Window Exports
window.handleHeaderSearch = handleHeaderSearch;
window.toggleHierarchyNode = toggleHierarchyNode;
window.collapseAllHierarchyNodes = collapseAllHierarchyNodes;
window.toggleTeamViewMode = toggleTeamViewMode;
window.focusOnEmployee = focusOnEmployee;
window.resetOrgChartFocus = resetOrgChartFocus;

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
          <p class="text-[9px] text-[var(--text-secondary)] truncate font-mono">${emp.email} • ${emp.role}</p>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-bold border border-[var(--accent)]/20 shrink-0">View</span>
      `;
      resultsContainer.appendChild(item);
    });

    resultsContainer.classList.remove('hidden');
    searchHighlightIndex = -1;
    return;
  }

  // Show loading indicator
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
      const employees = data.users || [];

      if (employees.length === 0) {
        resultsContainer.innerHTML = `<div class="p-3 text-center text-xs text-[var(--text-secondary)]">No matching employees found.</div>`;
        searchHighlightIndex = -1;
        return;
      }

      // Add to cachedUsers
      employees.forEach(emp => {
        if (!cachedUsers.some(u => u.id === emp.id)) {
          cachedUsers.push(emp);
        }
      });

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
            <p class="text-[9px] text-[var(--text-secondary)] truncate font-mono">${emp.email} • ${emp.role}</p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-bold border border-[var(--accent)]/20 shrink-0">View</span>
        `;
        resultsContainer.appendChild(item);
      });
      searchHighlightIndex = -1;
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
    alert('Failed to load reporting structure: ' + err.message);
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
        cachedUsers = dirData.users || [];
        directoryFetched = true;
      }
    }

    if (userData && !cachedUsers.some(u => u.id === userData.id)) {
      cachedUsers.push(userData);
    }

    // 2. Fetch all team dashboard statuses to build the presence status Map
    const statusMap = {};
    
    // Logged in user status
    if (currentDashboardData) {
      statusMap[userData.id] = currentDashboardData.status;
    }
    
    // Fetch reports dashboard statuses
    try {
      const teamData = await api.fetchTeam(apiToken);
      if (teamData && teamData.team) {
        teamData.team.forEach(emp => {
          statusMap[emp.id] = emp.dashboardStatus;
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
          managerId: dashData.dashboard.manager_id || dashData.dashboard.managerId
        };
        cachedUsers.push(focusedUser);
        statusMap[focusedUserId] = dashData.dashboard.status;
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

// Auto boot session
initSession();
