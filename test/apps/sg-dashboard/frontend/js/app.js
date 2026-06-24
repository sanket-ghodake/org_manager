import * as api from './api.js';
import * as ui from './ui.js';

// State management
let apiToken = '';
let userData = null;
let currentDashboardId = null;
let currentDashboardData = null;
let cachedUsers = [];
let parentOrigin = '';

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

export async function viewEmployeeDashboard(empId) {
  try {
    const data = await api.fetchUserDashboard(apiToken, empId);
    ui.showViewerModal(data);
  } catch (err) {
    alert(err.message);
  }
}

export function closeViewerModal() {
  ui.closeViewerModal();
}

// ----------------------------------------------------
// Private Initialization & Loading functions
// ----------------------------------------------------

async function loadMyDashboard() {
  try {
    const data = await api.fetchMyDashboard(apiToken);
    currentDashboardId = data.dashboard.id;
    currentDashboardData = data.dashboard;

    const programInput = document.getElementById('header-program-input');
    if (programInput) {
      programInput.value = data.dashboard.program_line || 'Default Program';
    }
    const subProg = document.getElementById('sub-program-display');
    if (subProg) {
      subProg.textContent = data.dashboard.program_line || 'Default Program';
    }
    
    const objDisplay = document.getElementById('sub-objective-display');
    if (objDisplay) {
      objDisplay.textContent = data.dashboard.objective || 'Click to enter objective';
      if (!data.dashboard.objective) {
        objDisplay.classList.add('italic');
      } else {
        objDisplay.classList.remove('italic');
      }
    }

    document.getElementById('dashboard-notes-textarea').value = data.dashboard.notes || '';
    ui.highlightStatusBtn(data.dashboard.status);
    ui.renderDashboardItems(data.items);
  } catch (err) {
    console.error(err);
  }
}

async function loadSubmissions() {
  try {
    const data = await api.fetchSubmissions(apiToken);
    ui.renderSubmissions(data.submissions);
  } catch (err) {
    console.error(err);
  }
}

async function loadTeamView() {
  try {
    const data = await api.fetchTeam(apiToken);
    ui.renderTeam(data.team, userData.id, userData.role);
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

  if (userData.role === 'Manager' || userData.role === 'Admin') {
    document.getElementById('nav-team-view').classList.remove('hidden');
  }

  document.getElementById('auth-overlay').classList.add('hidden');

  try {
    console.log('Syncing directory with main portal database context...');
    const dirRes = await api.fetchDirectory();
    const contentType = dirRes.headers.get('content-type') || '';
    if (dirRes.ok && contentType.includes('application/json')) {
      const dirData = await dirRes.json();
      cachedUsers = dirData.users || [];
      
      ui.populateManagerDropdown(cachedUsers, userData.managerId);

      await api.syncUserDirectory(apiToken, dirData.users);
      console.log('User directory cached inside local SQLite DB successfully.');
    } else {
      console.log('Main portal directory is not available or returned non-JSON response.');
    }
  } catch (err) {
    console.warn('Failed to sync directory:', err);
  }

  await loadMyDashboard();
  await loadSubmissions();
  
  if (userData.role === 'Manager' || userData.role === 'Admin') {
    await loadTeamView();
  }
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

  if (parentOrigin && parentOrigin !== 'null' && e.origin !== parentOrigin) {
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
window.triggerRequestSubmission = triggerRequestSubmission;
window.closeViewerModal = closeViewerModal;

// Auto boot session
initSession();
