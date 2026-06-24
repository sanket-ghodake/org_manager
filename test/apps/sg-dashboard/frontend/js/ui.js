import {
  cycleGapSeverity,
  cyclePlanBadgeType,
  startEditingItem,
  deleteItem,
  submitDashboard,
  viewEmployeeDashboard,
  triggerRequestSubmission
} from './app.js';

// Automatically sync theme toggle button icon with html[data-theme]
const themeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'data-theme') {
      const theme = document.documentElement.getAttribute('data-theme');
      const toggleBtn = document.getElementById('theme-toggle-btn');
      if (toggleBtn) {
        toggleBtn.textContent = (theme === 'light' || theme === 'solarized-light') ? '☀️' : '🌙';
      }
    }
  });
});
themeObserver.observe(document.documentElement, { attributes: true });

// Tab Switcher
export function switchTab(tab) {
  const tabs = ['my-dashboard', 'submissions', 'team-view'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (el) el.classList.add('hidden');
    if (navBtn) {
      navBtn.classList.remove('sidebar-active', 'text-[var(--text-primary)]');
      navBtn.classList.add('text-[var(--text-secondary)]', 'hover:text-[var(--text-primary)]');
    }
  });

  const activeEl = document.getElementById(`tab-${tab}`);
  const activeNavBtn = document.getElementById(`nav-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');
  if (activeNavBtn) {
    activeNavBtn.classList.add('sidebar-active', 'text-[var(--text-primary)]');
  }
}

// Toggle Theme
export function toggleTheme() {
  const themes = ['default', 'light', 'dark', 'solarized-dark', 'solarized-light'];
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
  const currentIndex = themes.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themes.length;
  const newTheme = themes[nextIndex];
  document.documentElement.setAttribute('data-theme', newTheme);
}

// Auth error display
export function showAuthError(message) {
  document.getElementById('auth-overlay').innerHTML = `
    <div class="bg-[var(--bg-card)] p-8 rounded-2xl text-center max-w-sm border border-[var(--border-color)] shadow-2xl">
      <span class="text-3xl block mb-2">⚠️</span>
      <h3 class="font-bold text-red-400 text-sm">Authentication Failed</h3>
      <p class="text-[11px] text-[var(--text-secondary)] mt-2">${message}</p>
      <p class="text-[10px] text-gray-500 mt-4">Please launch this app inside the SG Forge Portal canvas or authenticate via Portal SSO.</p>
    </div>
  `;
}

// Populate Manager Dropdown
export function populateManagerDropdown(users, currentManagerId) {
  const select = document.getElementById('header-manager-select');
  if (!select) return;
  select.innerHTML = '<option value="">Select Manager</option>';
  
  const managers = users.filter(u => 
    u.role === 'admin' || 
    u.role === 'super_admin' || 
    users.some(report => report.managerId === u.id)
  );
  
  managers.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = m.name;
    select.appendChild(option);
  });

  if (currentManagerId) {
    select.value = currentManagerId;
  }
}

// Highlight Status Button
export function highlightStatusBtn(status) {
  const buttons = {
    'On Track': document.getElementById('status-btn-ontrack'),
    'At Risk': document.getElementById('status-btn-atrisk'),
    'Off Track': document.getElementById('status-btn-offtrack')
  };

  Object.keys(buttons).forEach(key => {
    const btn = buttons[key];
    if (!btn) return;
    if (key === status) {
      if (key === 'On Track') {
        btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-emerald-500 bg-emerald-500 text-black";
      } else if (key === 'At Risk') {
        btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-amber-500 bg-amber-500 text-black";
      } else {
        btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-rose-500 bg-rose-500 text-white";
      }
    } else {
      if (key === 'On Track') {
        btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-emerald-500/20 bg-emerald-500/5 text-emerald-400";
      } else if (key === 'At Risk') {
        btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-amber-500/20 bg-amber-500/5 text-amber-400";
      } else {
        btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-rose-500/20 bg-rose-500/5 text-rose-400";
      }
    }
  });
}

// Render Dashboard Items
export function renderDashboardItems(items) {
  // 1. Key Skills
  const coreList = document.getElementById('core-skills-list');
  const stratList = document.getElementById('strategic-skills-list');
  coreList.innerHTML = '';
  stratList.innerHTML = '';

  const skills = items.filter(i => i.section === 'key_skill');
  document.getElementById('skills-count-pill').textContent = `${skills.length} skills`;

  const coreSkills = skills.filter(s => s.category.toLowerCase().includes('core') || !s.category.toLowerCase().includes('strategic'));
  const stratSkills = skills.filter(s => s.category.toLowerCase().includes('strategic') || s.category.toLowerCase().includes('transformation'));

  if (coreSkills.length === 0) {
    coreList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No core skills listed.</li>';
  } else {
    coreSkills.forEach(item => {
      coreList.appendChild(createItemElement(item));
    });
  }

  if (stratSkills.length === 0) {
    stratList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No strategic skills listed.</li>';
  } else {
    stratSkills.forEach(item => {
      stratList.appendChild(createItemElement(item));
    });
  }

  // 2. Gaps
  const gapsList = document.getElementById('gaps-list');
  gapsList.innerHTML = '';
  const gaps = items.filter(i => i.section === 'gap');
  
  const criticalCount = gaps.filter(g => g.category === 'Critical').length;
  const highCount = gaps.filter(g => g.category === 'High').length;
  const mediumCount = gaps.filter(g => g.category === 'Medium').length;
  document.getElementById('gaps-count-pill').textContent = `${criticalCount} critical, ${highCount} high, ${mediumCount} medium`;

  if (gaps.length === 0) {
    gapsList.innerHTML = '<li class="text-gray-500 italic py-1">No skill gaps identified.</li>';
  } else {
    gaps.forEach(item => {
      gapsList.appendChild(createGapElement(item));
    });
  }

  // 3. Training Plans
  const stratPlansList = document.getElementById('strategic-plans-list');
  const tactPlansList = document.getElementById('tactical-plans-list');
  stratPlansList.innerHTML = '';
  tactPlansList.innerHTML = '';

  const plans = items.filter(i => i.section === 'training_plan');
  document.getElementById('plans-count-pill').textContent = `${plans.length} items`;

  const stratPlans = plans.filter(p => p.category.startsWith('Strategic:'));
  const tactPlans = plans.filter(p => p.category.startsWith('Tactical:'));

  if (stratPlans.length === 0) {
    stratPlansList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No strategic plans scheduled.</li>';
  } else {
    stratPlans.forEach(item => {
      stratPlansList.appendChild(createPlanElement(item, 'Strategic'));
    });
  }

  if (tactPlans.length === 0) {
    tactPlansList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No tactical plans scheduled.</li>';
  } else {
    tactPlans.forEach(item => {
      tactPlansList.appendChild(createPlanElement(item, 'Tactical'));
    });
  }
}

// Helpers to build list elements
function createItemElement(item) {
  const li = document.createElement('li');
  li.className = "group flex items-center justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)] font-medium";
  
  const contentSpan = document.createElement('span');
  contentSpan.className = "cursor-pointer select-text truncate flex items-center gap-2";
  contentSpan.innerHTML = `<span class="text-blue-500 font-bold">•</span> <span class="item-title-text">${item.title}</span>`;
  contentSpan.onclick = () => startEditingItem(item, contentSpan);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px]";
  deleteBtn.innerHTML = "✕";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteItem(item.id);
  };

  li.appendChild(contentSpan);
  li.appendChild(deleteBtn);
  return li;
}

function createGapElement(item) {
  const li = document.createElement('li');
  li.className = "group flex items-center justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)]";

  const leftSide = document.createElement('div');
  leftSide.className = "flex items-center gap-2.5 truncate flex-1";

  const badge = document.createElement('span');
  badge.className = getGapBadgeStyle(item.category);
  badge.textContent = item.category.toUpperCase();
  badge.title = "Click to cycle severity";
  badge.onclick = (e) => {
    e.stopPropagation();
    cycleGapSeverity(item);
  };

  const titleSpan = document.createElement('span');
  titleSpan.className = "cursor-pointer font-medium truncate item-title-text" + (item.title === 'Click to describe gap' ? ' italic text-gray-500' : '');
  titleSpan.textContent = item.title;
  titleSpan.onclick = () => startEditingItem(item, titleSpan);

  leftSide.appendChild(badge);
  leftSide.appendChild(titleSpan);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px]";
  deleteBtn.innerHTML = "✕";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteItem(item.id);
  };

  li.appendChild(leftSide);
  li.appendChild(deleteBtn);
  return li;
}

function getGapBadgeStyle(severity) {
  const base = "px-2 py-0.5 rounded text-[9px] font-black tracking-wide uppercase select-none cursor-pointer ";
  if (severity === 'Critical') return base + "bg-red-500 text-white shadow-sm shadow-red-500/20";
  if (severity === 'High') return base + "bg-amber-500 text-black";
  return base + "bg-blue-500 text-white";
}

function createPlanElement(item, planType) {
  const li = document.createElement('li');
  li.className = "group flex items-center justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)]";

  const leftSide = document.createElement('div');
  leftSide.className = "flex items-center gap-2.5 truncate flex-1";

  const parts = item.category.split(':');
  const badgeText = parts[1] || 'TRAIN';

  const badge = document.createElement('span');
  badge.className = "px-2 py-0.5 rounded text-[9px] font-black tracking-wide uppercase select-none cursor-pointer bg-emerald-500 text-black";
  badge.textContent = badgeText;
  badge.title = "Click to cycle type";
  badge.onclick = (e) => {
    e.stopPropagation();
    cyclePlanBadgeType(item, planType, badgeText);
  };

  const titleSpan = document.createElement('span');
  titleSpan.className = "cursor-pointer font-medium truncate item-title-text" + (item.title.startsWith('Click to add') ? ' italic text-gray-500' : '');
  titleSpan.textContent = item.title;
  titleSpan.onclick = () => startEditingItem(item, titleSpan);

  leftSide.appendChild(badge);
  leftSide.appendChild(titleSpan);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px]";
  deleteBtn.innerHTML = "✕";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteItem(item.id);
  };

  li.appendChild(leftSide);
  li.appendChild(deleteBtn);
  return li;
}

// Render Submissions
export function renderSubmissions(submissions) {
  const body = document.getElementById('submissions-body');
  body.innerHTML = '';

  if (submissions.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-500 font-medium">No submission requests assigned to you.</td></tr>';
    return;
  }

  submissions.forEach(sub => {
    const isPending = sub.status === 'Pending';
    const actionCell = isPending 
      ? `<button onclick="submitDashboard('${sub.id}')" class="text-emerald-400 hover:text-emerald-300 font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded hover:bg-emerald-500/25 transition-all">Submit Dashboard</button>` 
      : `<span class="text-gray-500 font-semibold text-[10px]">Verified ✓</span>`;

    const statusColor = isPending ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold';

    body.innerHTML += `
      <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] font-medium">
        <td class="py-3.5 pl-3 font-mono text-[9px] text-[var(--accent)]">#${sub.id.substring(0,8)}</td>
        <td class="py-3.5 font-bold text-[var(--text-primary)]">${sub.manager_name}</td>
        <td class="py-3.5 font-mono text-[10px] text-[var(--text-secondary)]">${sub.deadline}</td>
        <td class="py-3.5 ${statusColor}">${sub.status}</td>
        <td class="py-3.5 text-right pr-3">${actionCell}</td>
      </tr>
    `;
  });
}

// Render Team View
export function renderTeam(team, currentUserId, currentUserRole) {
  const body = document.getElementById('team-body');
  body.innerHTML = '';

  if (team.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500 font-medium">No reporting employees found in your hierarchy chain.</td></tr>';
    return;
  }

  team.forEach(emp => {
    let statusBadge = '<span class="text-gray-500 italic text-[10px]">No Dashboard</span>';
    if (emp.hasDashboard) {
      let color = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      if (emp.dashboardStatus === 'At Risk') color = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      if (emp.dashboardStatus === 'Off Track') color = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      statusBadge = `<span class="px-2 py-0.5 rounded text-[9px] font-bold border ${color}">${emp.dashboardStatus}</span>`;
    }

    let subBadge = '<span class="text-gray-500 italic text-[10px]">None requested</span>';
    if (emp.lastSubmissionStatus) {
      let color = emp.lastSubmissionStatus === 'Pending' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400';
      subBadge = `<span class="px-2 py-0.5 rounded text-[9px] font-bold ${color}">${emp.lastSubmissionStatus} (By ${emp.lastSubmissionDeadline})</span>`;
    }

    let actions = '';
    if (emp.hasDashboard) {
      actions += `<button onclick="viewEmployeeDashboard('${emp.id}')" class="text-indigo-400 hover:text-indigo-300 font-bold text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 rounded mr-2 hover:bg-indigo-500/25 transition-all">View Profile</button>`;
    }
    if (emp.managerId === currentUserId || currentUserRole === 'Admin') {
      actions += `<button onclick="triggerRequestSubmission('${emp.id}')" class="text-amber-400 hover:text-amber-300 font-bold text-[10px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded hover:bg-amber-500/25 transition-all">Request Submission</button>`;
    }

    body.innerHTML += `
      <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] font-medium">
        <td class="py-3.5 pl-3 font-bold text-[var(--text-primary)]">${emp.name} <br> <span class="text-[9px] text-[var(--text-secondary)] font-normal font-mono">${emp.email}</span></td>
        <td class="py-3.5 text-[var(--text-secondary)] font-medium text-[11px]">${emp.role}</td>
        <td class="py-3.5 font-mono text-[10px] text-[var(--accent)]">${emp.hasDashboard ? 'Yes ✓' : 'No'}</td>
        <td class="py-3.5">${statusBadge}</td>
        <td class="py-3.5">${subBadge}</td>
        <td class="py-3.5 text-right pr-3">${actions}</td>
      </tr>
    `;
  });
}

// Show Viewer Modal
export function showViewerModal(data) {
  document.getElementById('viewer-employee-name').textContent = data.dashboard.name || 'Employee Profile';
  document.getElementById('viewer-employee-role').textContent = `DASHBOARD #${data.dashboard.id.substring(0,8)}`;
  document.getElementById('viewer-program-line').textContent = data.dashboard.program_line || 'Not set';
  document.getElementById('viewer-objective').textContent = data.dashboard.objective || 'No objective logged.';
  document.getElementById('viewer-status').textContent = data.dashboard.status || 'On Track';
  document.getElementById('viewer-notes').textContent = data.dashboard.notes || 'No operational notes logged.';

  const skills = data.items.filter(i => i.section === 'key_skill');
  const gaps = data.items.filter(i => i.section === 'gap');
  const training = data.items.filter(i => i.section === 'training_plan');

  const vSkills = document.getElementById('viewer-skills');
  const vGaps = document.getElementById('viewer-gaps');
  const vTraining = document.getElementById('viewer-training');

  vSkills.innerHTML = '';
  vGaps.innerHTML = '';
  vTraining.innerHTML = '';

  if (skills.length === 0) {
    vSkills.innerHTML = '<div class="text-[var(--text-secondary)] italic py-1">None logged.</div>';
  } else {
    skills.forEach(item => {
      vSkills.innerHTML += `
        <div class="p-2 bg-[var(--bg-input)] rounded border border-[var(--border-color)]">
          <div class="font-bold text-[var(--text-primary)] text-[10px]">${item.title}</div>
          <div class="text-[9px] text-[var(--col-skills-text)] font-mono mt-0.5">${item.category}</div>
        </div>
      `;
    });
  }

  if (gaps.length === 0) {
    vGaps.innerHTML = '<div class="text-[var(--text-secondary)] italic py-1">None logged.</div>';
  } else {
    gaps.forEach(item => {
      vGaps.innerHTML += `
        <div class="p-2 bg-[var(--bg-input)] rounded border border-[var(--border-color)]">
          <div class="font-bold text-[var(--text-primary)] text-[10px]">${item.title}</div>
          <div class="text-[9px] text-[var(--col-gaps-text)] font-mono mt-0.5">${item.category}</div>
        </div>
      `;
    });
  }

  if (training.length === 0) {
    vTraining.innerHTML = '<div class="text-[var(--text-secondary)] italic py-1">None logged.</div>';
  } else {
    training.forEach(item => {
      const badgeText = item.category.split(':')[1] || 'PLAN';
      vTraining.innerHTML += `
        <div class="p-2 bg-[var(--bg-input)] rounded border border-[var(--border-color)]">
          <div class="font-bold text-[var(--text-primary)] text-[10px]">${item.title}</div>
          <div class="text-[9px] text-[var(--col-plans-text)] font-mono mt-0.5">${badgeText}</div>
        </div>
      `;
    });
  }

  document.getElementById('viewer-modal').classList.remove('hidden');
}

// Close Viewer Modal
export function closeViewerModal() {
  document.getElementById('viewer-modal').classList.add('hidden');
}
