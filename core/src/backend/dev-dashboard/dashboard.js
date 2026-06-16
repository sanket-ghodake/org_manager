/**
 * SG Forge DevCenter - Client Application Module
 * Structured modular client-side scripting.
 */

// --- Global State & Configuration ---
let activeTabId = 'overview';
let pollInterval = null;
let tablesData = [];
let searchTimeout = null;

// --- Helper Utilities ---

/**
 * Highlights JSON strings with HTML syntax classes for premium terminal-like output
 */
function syntaxHighlightJson(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

/**
 * Debounce filter helper for telemetry search logs
 */
function debounceLogsFilter() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchLogs();
  }, 300);
}

// --- Custom UI Dropdown Controls ---

function toggleDropdown(dropdownId, event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  
  const isOpen = dropdown.classList.contains('open');
  
  // Close all other dropdowns
  document.querySelectorAll('.custom-dropdown').forEach(d => {
    if (d.id !== dropdownId) d.classList.remove('open');
  });
  
  if (isOpen) {
    dropdown.classList.remove('open');
  } else {
    dropdown.classList.add('open');
  }
}

function selectDropdownOption(dropdownId, value, text) {
  setDropdownValue(dropdownId, value, text);
  
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) dropdown.classList.remove('open');
  
  // Fire callback based on dropdown selection
  if (dropdownId === 'themeDropdown') {
    changeTheme(value);
  } else if (dropdownId === 'queryTemplatesDropdown') {
    applyQueryTemplate(value);
  } else if (dropdownId === 'severityDropdown') {
    fetchLogs();
  } else if (dropdownId === 'autoPollDropdown') {
    toggleAutoPoll(value);
  }
}

function setDropdownValue(dropdownId, value, text) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  
  dropdown.setAttribute('data-value', value);
  const selectedSpan = dropdown.querySelector('.dropdown-selected-value');
  if (selectedSpan) selectedSpan.textContent = text;
  
  dropdown.querySelectorAll('.dropdown-item').forEach(item => {
    if (item.getAttribute('data-value') === value) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Close dropdowns on outside click
document.addEventListener('click', (event) => {
  document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove('open');
    }
  });
});

// --- Table Resizing Engine ---

/**
 * Enables resizable columns inside data grid tables
 */
function makeTableResizable(table) {
  if (!table) return;
  const headers = table.querySelectorAll('th');
  headers.forEach((col, index) => {
    // Prevent duplicate resizers
    if (col.querySelector('.col-resizer')) return;

    // Don't add resizer to the last column to prevent breaking layout
    if (index === headers.length - 1) return;

    const resizer = document.createElement('div');
    resizer.classList.add('col-resizer');
    col.appendChild(resizer);
    col.classList.add('resizable-th');

    resizer.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = col.offsetWidth;
      
      // Set explicit pixel widths for all columns to enable precise resizing
      const allCols = table.querySelectorAll('th');
      const currentWidths = Array.from(allCols).map(c => c.offsetWidth);
      
      table.style.tableLayout = 'fixed';
      allCols.forEach((c, i) => {
        c.style.width = currentWidths[i] + 'px';
        c.style.minWidth = currentWidths[i] + 'px';
      });

      resizer.classList.add('dragging');
      
      function onMouseMove(ev) {
        const width = startWidth + (ev.clientX - startX);
        if (width > 50) {
          col.style.width = width + 'px';
          col.style.minWidth = width + 'px';
        }
      }

      function onMouseUp() {
        resizer.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

// --- Layout Panels Resizing Logic ---

function setupResizers() {
  // 1. Main Sidebar Resizer
  const mainApp = document.getElementById('dashboardApp');
  const mainResizer = document.getElementById('mainResizer');
  
  // Load saved main sidebar width
  const savedMainWidth = localStorage.getItem('mainSidebarWidth') || '260px';
  if (mainApp) {
    mainApp.style.setProperty('--sidebar-width', savedMainWidth);
    if (!mainApp.classList.contains('sidebar-collapsed')) {
      mainApp.style.gridTemplateColumns = 'var(--sidebar-width, 260px) 4px 1fr';
    }
  }

  if (mainResizer && mainApp) {
    mainResizer.addEventListener('mousedown', initDrag);
    mainResizer.addEventListener('touchstart', initDrag);
    
    function initDrag(e) {
      e.preventDefault();
      const startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const startWidth = parseInt(getComputedStyle(mainApp).getPropertyValue('--sidebar-width')) || 260;
      
      mainResizer.classList.add('dragging');
      mainApp.classList.add('dragging');
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('touchend', stopDrag);
      
      function drag(ev) {
        const currentX = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX;
        let newWidth = startWidth + (currentX - startX);
        
        if (newWidth < 160) newWidth = 160;
        if (newWidth > 500) newWidth = 500;
        
        mainApp.style.setProperty('--sidebar-width', newWidth + 'px');
        if (!mainApp.classList.contains('sidebar-collapsed')) {
          mainApp.style.gridTemplateColumns = 'var(--sidebar-width, 260px) 4px 1fr';
        }
      }
      
      function stopDrag() {
        mainResizer.classList.remove('dragging');
        mainApp.classList.remove('dragging');
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);
        
        const finalWidth = mainApp.style.getPropertyValue('--sidebar-width');
        localStorage.setItem('mainSidebarWidth', finalWidth);
      }
    }
  }

  // 2. DB Explorer Sidebar Resizer
  const dbLayout = document.getElementById('dbLayout');
  const dbSidebar = document.getElementById('dbSidebar');
  const dbResizer = document.getElementById('dbSidebarResizer');
  
  // Load saved db sidebar width
  const savedDbWidth = localStorage.getItem('dbSidebarWidth') || '280px';
  if (dbLayout) {
    dbLayout.style.setProperty('--db-sidebar-width', savedDbWidth);
    const isHidden = dbSidebar && dbSidebar.style.display === 'none';
    if (!isHidden) {
      dbLayout.style.gridTemplateColumns = 'var(--db-sidebar-width, 280px) 4px 1fr';
    }
  }

  if (dbResizer && dbLayout) {
    dbResizer.addEventListener('mousedown', initDbDrag);
    dbResizer.addEventListener('touchstart', initDbDrag);
    
    function initDbDrag(e) {
      e.preventDefault();
      const startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const startWidth = parseInt(getComputedStyle(dbLayout).getPropertyValue('--db-sidebar-width')) || 280;
      
      dbResizer.classList.add('dragging');
      dbLayout.classList.add('dragging');
      
      document.addEventListener('mousemove', dbDrag);
      document.addEventListener('mouseup', stopDbDrag);
      document.addEventListener('touchmove', dbDrag);
      document.addEventListener('touchend', stopDbDrag);
      
      function dbDrag(ev) {
        const currentX = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX;
        let newWidth = startWidth + (currentX - startX);
        
        if (newWidth < 180) newWidth = 180;
        if (newWidth > 600) newWidth = 600;
        
        dbLayout.style.setProperty('--db-sidebar-width', newWidth + 'px');
        const isHidden = dbSidebar && dbSidebar.style.display === 'none';
        if (!isHidden) {
          dbLayout.style.gridTemplateColumns = 'var(--db-sidebar-width, 280px) 4px 1fr';
        }
      }
      
      function stopDbDrag() {
        dbResizer.classList.remove('dragging');
        dbLayout.classList.remove('dragging');
        
        document.removeEventListener('mousemove', dbDrag);
        document.removeEventListener('mouseup', stopDbDrag);
        document.removeEventListener('touchmove', dbDrag);
        document.removeEventListener('touchend', stopDbDrag);
        
        const finalWidth = dbLayout.style.getPropertyValue('--db-sidebar-width');
        localStorage.setItem('dbSidebarWidth', finalWidth);
      }
    }
  }
}

// --- Session & Authentication Services ---

async function checkAuth() {
  try {
    const res = await fetch('/api/status');
    const loadingScreen = document.getElementById('loadingScreen');
    const authScreen = document.getElementById('authScreen');
    const dashboardApp = document.getElementById('dashboardApp');
    
    if (res.status === 200) {
      const data = await res.json();
      
      authScreen.style.display = 'none';
      dashboardApp.style.display = 'grid';
      initializeSettings();
      setupResizers();
      
      // Load startup data
      loadOverviewData();
      fetchTablesList();
      fetchLogs();
      
      if (loadingScreen && loadingScreen.style.display !== 'none') {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 400);
      }
    } else {
      dashboardApp.style.display = 'none';
      authScreen.style.display = 'flex';
      authScreen.style.opacity = '1';
      
      if (loadingScreen && loadingScreen.style.display !== 'none') {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 400);
      }
    }
  } catch (e) {
    console.error('Failed to verify connection to dev dashboard server:', e);
    const loadingStatus = document.querySelector('.loading-status');
    if (loadingStatus) {
      loadingStatus.textContent = 'Server unreachable. Reconnecting...';
      loadingStatus.style.color = 'var(--error)';
    }
    setTimeout(checkAuth, 2000);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span style="animation: spin 1s linear infinite; display: inline-block; margin-right: 8px;">⏳</span>Authenticating...`;
  
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    if (res.status === 200) {
      document.getElementById('password').value = '';
      const loadingScreen = document.getElementById('loadingScreen');
      if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
        const loadingStatus = loadingScreen.querySelector('.loading-status');
        if (loadingStatus) loadingStatus.textContent = 'Setting up secure session...';
      }
      checkAuth();
    } else {
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.textContent = 'Server communications failed. Is dashboard server running?';
    errorDiv.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    toggleAutoPoll('off');
    setDropdownValue('autoPollDropdown', 'off', 'Disabled');
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('authScreen').style.opacity = '1';
    document.getElementById('dashboardApp').style.display = 'none';
  } catch (e) {
    console.error(e);
  }
}

// --- Tab Router Engine ---

function switchTab(tabId, el) {
  activeTabId = tabId;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  el.classList.add('active');

  document.querySelectorAll('.view-container').forEach(view => view.classList.remove('active'));
  document.getElementById('view-' + tabId).classList.add('active');

  // Update Header Title
  const titleMap = {
    overview: 'Overview',
    tests: 'Test Suite Runner',
    db: 'DB Explorer & Query Console',
    logs: 'System Logs Telemetry'
  };
  document.getElementById('pageTitle').textContent = titleMap[tabId] || 'DevCenter';
  
  if (tabId === 'overview') {
    loadOverviewData();
  }
}

// --- View 1: Overview Module ---

async function loadOverviewData() {
  const val1 = document.getElementById('stats-tables-count');
  const val2 = document.getElementById('stats-logs-count');
  const val3 = document.getElementById('stats-test-results');
  if (val1) val1.classList.add('loading-pulse');
  if (val2) val2.classList.add('loading-pulse');
  if (val3) val3.classList.add('loading-pulse');

  try {
    const res = await fetch('/api/status');
    if (res.status === 401) {
      checkAuth();
      return;
    }
    const data = await res.json();
    
    // Populate stats
    if (val1) val1.textContent = data.tableCount || 0;
    if (val2) val2.textContent = data.logsCount || 0;
    
    if (data.lastTestRun) {
      const passes = data.lastTestRun.passed;
      const fails = data.lastTestRun.failed;
      if (val3) val3.innerHTML = `<span style="color: var(--success);">${passes} Passed</span> / <span style="color: var(--error);">${fails} Failed</span>`;
      document.getElementById('stats-test-desc').textContent = `Last run at ${new Date(data.lastTestRun.timestamp).toLocaleTimeString()}`;
    } else {
      if (val3) val3.textContent = 'Not Run';
      document.getElementById('stats-test-desc').textContent = 'Run integration/unit test pipeline to update metrics.';
    }

    // Render Database Registry Table
    const tbody = document.getElementById('overview-tables-body');
    tbody.innerHTML = '';
    
    if (data.tables && data.tables.length > 0) {
      data.tables.forEach(table => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 600; font-family: 'JetBrains Mono', monospace; color: #a78bfa;">${table.name}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">${table.keyColumns.join(', ')}</td>
          <td style="font-weight: 500;">${table.rows} rows</td>
          <td>
            <button class="btn" style="padding: 6px 12px; font-size: 0.75rem;" onclick="exploreTable('${table.name}')">Explore Schema</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      makeTableResizable(tbody.closest('table'));
    } else {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No database tables indexed</td></tr>`;
    }

  } catch (err) {
    console.error('Failed to load overview statistics', err);
  } finally {
    if (val1) val1.classList.remove('loading-pulse');
    if (val2) val2.classList.remove('loading-pulse');
    if (val3) val3.classList.remove('loading-pulse');
  }
}

// --- View 2: Test Runner Module ---

async function runTests() {
  const btn = document.getElementById('runTestsBtn');
  const consoleEl = document.getElementById('consoleOutput');
  const timeEl = document.getElementById('test-run-time');
  const pill = document.getElementById('tests-summary-pill');
  
  btn.disabled = true;
  btn.innerHTML = `<span style="animation: spin 1s linear infinite; display: inline-block; margin-right: 8px;">⏳</span>Running pipeline...`;
  consoleEl.textContent = 'Triggering local Bun testing suite run. Please stand by...\n\n';
  pill.style.display = 'none';

  const startTime = Date.now();
  
  try {
    const res = await fetch('/api/run-tests', { method: 'POST' });
    const data = await res.json();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    timeEl.textContent = `Completed in ${duration}s`;
    
    consoleEl.textContent = data.rawOutput || 'No output returned.';
    
    document.getElementById('tests-passed-count').textContent = `${data.passed} Passed`;
    document.getElementById('tests-failed-count').textContent = `${data.failed} Failed`;
    pill.style.display = 'flex';
    
    // Refresh overview metrics in background
    loadOverviewData();
  } catch (err) {
    consoleEl.textContent += `Fatal Communication Loop Interrupted: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg style="width: 16px; height: 16px; fill: white; margin-right: 8px;" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Execute Test Pipeline`;
  }
}

// --- View 3: Database Explorer Module ---

async function fetchTablesList() {
  try {
    const res = await fetch('/api/tables');
    const data = await res.json();
    tablesData = data.tables || [];
    
    const listEl = document.getElementById('db-table-list');
    listEl.innerHTML = '';
    
    tablesData.forEach(tbl => {
      const li = document.createElement('li');
      li.className = 'table-item';
      li.onclick = () => selectExplorerTable(tbl.name);
      li.id = 'table-item-' + tbl.name;
      li.innerHTML = `
        <span>${tbl.name}</span>
        <span class="table-item-count">${tbl.rows}</span>
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to fetch tables list', err);
  }
}

async function selectExplorerTable(tableName) {
  document.querySelectorAll('.table-item').forEach(item => item.classList.remove('active'));
  const activeEl = document.getElementById('table-item-' + tableName);
  if (activeEl) activeEl.classList.add('active');

  const tbl = tablesData.find(t => t.name === tableName);
  if (!tbl) return;

  document.getElementById('db-table-details').style.display = 'flex';
  document.getElementById('detail-table-name').textContent = tbl.name;
  
  const colList = document.getElementById('db-column-list');
  colList.innerHTML = '';
  tbl.columns.forEach(col => {
    const item = document.createElement('div');
    item.className = 'column-item';
    item.innerHTML = `
      <span>${col.name}</span>
      <span class="column-type">${col.type}</span>
    `;
    colList.appendChild(item);
  });

  // Inject boilerplate SQL template into query box
  document.getElementById('queryText').value = `SELECT * FROM "${tableName}" LIMIT 20;`;
}

function exploreTable(tableName) {
  switchTab('db', document.querySelectorAll('.nav-item')[2]);
  selectExplorerTable(tableName);
}

function applyQueryTemplate(sql) {
  if (sql) {
    document.getElementById('queryText').value = sql;
  }
}

async function runQuery() {
  const queryText = document.getElementById('queryText').value;
  const btn = document.getElementById('runQueryBtn');
  const errBox = document.getElementById('queryError');
  const resContainer = document.getElementById('queryResultContainer');
  const resStats = document.getElementById('query-result-stats');
  const head = document.getElementById('queryResultHead');
  const body = document.getElementById('queryResultBody');
  const fsBtn = document.getElementById('fullscreenResultsBtn');
  const skeleton = document.getElementById('queryLoadingSkeleton');
  
  if (!queryText.trim()) return;

  btn.disabled = true;
  btn.textContent = 'Executing...';
  errBox.style.display = 'none';
  resContainer.style.display = 'none';
  resStats.textContent = '';
  if (fsBtn) fsBtn.style.display = 'none';
  if (skeleton) skeleton.style.display = 'flex';
  
  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText })
    });
    
    const data = await res.json();
    
    if (res.status !== 200) {
      errBox.textContent = data.error || 'Unknown query execution error';
      errBox.style.display = 'block';
      if (skeleton) skeleton.style.display = 'none';
      return;
    }

    resStats.textContent = `(${data.rowCount} rows fetched)`;
    
    if (data.rowCount === 0 || !data.rows || data.rows.length === 0) {
      head.innerHTML = '';
      body.innerHTML = `<tr><td style="color: var(--text-muted); text-align: center;">Query successfully executed. Empty output result.</td></tr>`;
      if (skeleton) skeleton.style.display = 'none';
      resContainer.style.display = 'block';
      return;
    }

    // Render Query output fields
    const sampleRow = data.rows[0];
    const fields = Object.keys(sampleRow);
    
    head.innerHTML = '<tr>' + fields.map(f => `<th>${f}</th>`).join('') + '</tr>';
    
    body.innerHTML = '';
    data.rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = fields.map(field => {
        const val = row[field];
        if (val === null) return `<td style="color: var(--text-muted);">NULL</td>`;
        if (typeof val === 'object') return `<td style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">${JSON.stringify(val)}</td>`;
        return `<td>${val}</td>`;
      }).join('');
      body.appendChild(tr);
    });
    makeTableResizable(document.getElementById('queryResultTable'));

    if (skeleton) skeleton.style.display = 'none';
    resContainer.style.display = 'block';
    if (fsBtn) fsBtn.style.display = 'inline-flex';
    
    // Refresh table list & counts in case writes changed row counts
    fetchTablesList();
  } catch (err) {
    errBox.textContent = `Server connection lost: ${err.message}`;
    errBox.style.display = 'block';
    if (skeleton) skeleton.style.display = 'none';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg style="width: 16px; height: 16px; fill: white; margin-right: 8px;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>Execute SQL Statement`;
  }
}

// --- View 4: Telemetry Logs Module ---

async function fetchLogs() {
  const search = document.getElementById('logsSearch').value;
  const severityDropdown = document.getElementById('severityDropdown');
  const severity = severityDropdown ? severityDropdown.getAttribute('data-value') : 'ALL';
  const logsContainer = document.getElementById('logsContainer');
  
  try {
    const url = new URL('/api/logs', window.location.origin);
    if (search) url.searchParams.append('search', search);
    if (severity && severity !== 'ALL') url.searchParams.append('severity', severity);

    const res = await fetch(url.toString());
    if (res.status === 401) {
      checkAuth();
      return;
    }
    const data = await res.json();
    
    logsContainer.innerHTML = '';
    const logs = data.logs || [];
    
    if (logs.length === 0) {
      logsContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M13 13h-2V7h2v6zm0 4h-2v-2h2v2zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
          <span>No telemetry logs matching criteria were recorded</span>
        </div>
      `;
      return;
    }

    logs.forEach(log => {
      const row = document.createElement('div');
      row.className = 'log-row-container';
      
      const formattedTime = new Date(log.timestamp).toLocaleTimeString();
      const formattedDate = new Date(log.timestamp).toLocaleDateString();
      
      row.innerHTML = `
        <div class="log-header" onclick="this.parentElement.classList.toggle('expanded')">
          <div class="log-meta-left">
            <span class="log-badge ${log.severity.toLowerCase()}">${log.severity}</span>
            <span class="log-timestamp" title="${log.timestamp}">${formattedDate} ${formattedTime}</span>
            <span class="log-action">${log.action}</span>
          </div>
          <div class="log-meta-right">
            <span>User: <span class="log-user">${log.user_name || log.userId || 'System'}</span></span>
            <span>IP: <span>${log.ipAddress || '127.0.0.1'}</span></span>
            <svg class="log-chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </div>
        </div>
        <div class="log-details">
          <pre>${syntaxHighlightJson(log.payload)}</pre>
        </div>
      `;
      
      logsContainer.appendChild(row);
    });

  } catch (err) {
    console.error('Failed to load logs', err);
  }
}

function toggleAutoPoll(val) {
  clearInterval(pollInterval);
  if (val !== 'off') {
    const ms = parseInt(val, 10);
    pollInterval = setInterval(() => {
      if (activeTabId === 'logs') {
        fetchLogs();
      } else if (activeTabId === 'overview') {
        loadOverviewData();
      }
    }, ms);
  }
}

// --- Layout Toggles & Configurations ---

function toggleSidebar() {
  const app = document.getElementById('dashboardApp');
  if (!app) return;
  if (window.innerWidth <= 768) {
    document.body.classList.toggle('mobile-sidebar-open');
  } else {
    const isCollapsed = app.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
  }
}

function toggleCompactMode() {
  const isCompact = document.body.classList.toggle('compact-mode');
  localStorage.setItem('compactMode', isCompact ? 'true' : 'false');
  const btn = document.getElementById('compactToggle');
  if (btn) {
    const textSpan = btn.querySelector('.toggle-text');
    if (isCompact) {
      btn.classList.add('active');
      if (textSpan) textSpan.textContent = 'Dense View';
    } else {
      btn.classList.remove('active');
      if (textSpan) textSpan.textContent = 'Compact View';
    }
  }
}

function changeTheme(theme) {
  if (!theme) return;
  
  if (document.documentElement.getAttribute('data-theme') === theme) return;
  
  document.documentElement.setAttribute('data-theme', theme);
  
  const themeNames = {
    'default': 'Midnight Theme',
    'light': 'Light Theme',
    'dark': 'Dark Theme',
    'solarized-dark': 'Solarized Dark',
    'solarized-light': 'Solarized Light'
  };
  
  setDropdownValue('themeDropdown', theme, themeNames[theme] || 'Midnight Theme');
  localStorage.setItem('devCenterTheme', theme);
  
  // Broadcast theme change to parent window if inside an iframe
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'THEME_CHANGE', theme: theme }, '*');
    } catch (e) {}
  }
}

function toggleDbSidebar() {
  const dbSidebar = document.getElementById('dbSidebar');
  const dbLayout = document.getElementById('dbLayout');
  const showTablesBtn = document.getElementById('showTablesBtn');
  const resizer = document.getElementById('dbSidebarResizer');
  if (!dbSidebar || !dbLayout) return;

  const isHidden = dbSidebar.style.display === 'none';
  if (isHidden) {
    dbSidebar.style.display = 'flex';
    if (resizer) resizer.style.display = 'block';
    dbLayout.style.gridTemplateColumns = 'var(--db-sidebar-width, 280px) 4px 1fr';
    if (showTablesBtn) showTablesBtn.style.display = 'none';
    localStorage.setItem('dbSidebarCollapsed', 'false');
  } else {
    dbSidebar.style.display = 'none';
    if (resizer) resizer.style.display = 'none';
    dbLayout.style.gridTemplateColumns = '1fr';
    if (showTablesBtn) showTablesBtn.style.display = 'inline-flex';
    localStorage.setItem('dbSidebarCollapsed', 'true');
  }
}

function toggleFullscreenResults() {
  const wrapper = document.getElementById('queryResultsWrapper');
  const btn = document.getElementById('fullscreenResultsBtn');
  if (!wrapper) return;

  const isFullscreen = wrapper.classList.toggle('fullscreen-results');
  if (isFullscreen) {
    if (btn) {
      btn.innerHTML = `<svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg> Exit Fullscreen`;
    }
  } else {
    if (btn) {
      btn.innerHTML = `<svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg> Fullscreen`;
    }
  }
}

// --- Settings Initializer ---

function initializeSettings() {
  // Restore Theme
  const theme = localStorage.getItem('devCenterTheme') || 'default';
  changeTheme(theme);

  // Restore Compact Mode
  const compact = localStorage.getItem('compactMode');
  if (compact === 'true') {
    document.body.classList.add('compact-mode');
    const btn = document.getElementById('compactToggle');
    if (btn) {
      btn.classList.add('active');
      const textSpan = btn.querySelector('.toggle-text');
      if (textSpan) textSpan.textContent = 'Dense View';
    }
  }

  // Restore Sidebar Collapse state (desktop only)
  const sidebar = localStorage.getItem('sidebarCollapsed');
  const app = document.getElementById('dashboardApp');
  if (sidebar === 'true' && app && window.innerWidth > 768) {
    app.classList.add('sidebar-collapsed');
  }

  // Restore DB Sidebar Collapse state
  const dbSidebarCollapsed = localStorage.getItem('dbSidebarCollapsed');
  const dbResizer = document.getElementById('dbSidebarResizer');
  if (dbSidebarCollapsed === 'true') {
    const dbSidebar = document.getElementById('dbSidebar');
    const dbLayout = document.getElementById('dbLayout');
    const showTablesBtn = document.getElementById('showTablesBtn');
    if (dbSidebar && dbLayout) {
      dbSidebar.style.display = 'none';
      if (dbResizer) dbResizer.style.display = 'none';
      dbLayout.style.gridTemplateColumns = '1fr';
      if (showTablesBtn) showTablesBtn.style.display = 'inline-flex';
    }
  } else {
    const dbLayout = document.getElementById('dbLayout');
    const savedDbWidth = localStorage.getItem('dbSidebarWidth') || '280px';
    if (dbLayout) {
      dbLayout.style.gridTemplateColumns = `var(--db-sidebar-width, ${savedDbWidth}) 4px 1fr`;
    }
  }
}

// --- Global Event Listeners ---

// Listen for theme broadcasts from parent portals
window.addEventListener('message', (event) => {
  if (event.source === window) return;
  if (event.data && event.data.type === 'THEME_CHANGE' && event.data.theme) {
    changeTheme(event.data.theme);
  }
});

// Escape key listener to exit query results fullscreen view
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const wrapper = document.getElementById('queryResultsWrapper');
    if (wrapper && wrapper.classList.contains('fullscreen-results')) {
      toggleFullscreenResults();
    }
  }
});

// Inject spinner animation style rule dynamically
const spinStyle = document.createElement('style');
spinStyle.innerHTML = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinStyle);

// --- Initialization Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
