import {
  cycleGapSeverity,
  cyclePlanBadgeType,
  startEditingItem,
  deleteItem,
  submitDashboard,
  viewEmployeeDashboard,
  triggerRequestSubmission
} from './app.js';

// Apply persisted theme on load
const savedTheme = localStorage.getItem('selected-theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

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
  localStorage.setItem('selected-theme', newTheme);
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
export function renderDashboardItems(items, isReadOnly = false) {
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
      coreList.appendChild(createItemElement(item, isReadOnly));
    });
  }

  if (stratSkills.length === 0) {
    stratList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No strategic skills listed.</li>';
  } else {
    stratSkills.forEach(item => {
      stratList.appendChild(createItemElement(item, isReadOnly));
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
      gapsList.appendChild(createGapElement(item, isReadOnly));
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
      stratPlansList.appendChild(createPlanElement(item, 'Strategic', isReadOnly));
    });
  }

  if (tactPlans.length === 0) {
    tactPlansList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No tactical plans scheduled.</li>';
  } else {
    tactPlans.forEach(item => {
      tactPlansList.appendChild(createPlanElement(item, 'Tactical', isReadOnly));
    });
  }
}

// Helpers to build list elements
function createItemElement(item, isReadOnly = false) {
  const li = document.createElement('li');
  li.className = "group flex items-center justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)] font-medium";
  
  const contentSpan = document.createElement('span');
  contentSpan.className = "select-text truncate flex items-center gap-2" + (isReadOnly ? "" : " cursor-pointer");
  contentSpan.innerHTML = `<span class="text-blue-500 font-bold">•</span> <span class="item-title-text">${item.title}</span>`;
  if (!isReadOnly) {
    contentSpan.onclick = () => startEditingItem(item, contentSpan);
  }

  li.appendChild(contentSpan);

  if (!isReadOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px]";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    };
    li.appendChild(deleteBtn);
  }

  return li;
}

function createGapElement(item, isReadOnly = false) {
  const li = document.createElement('li');
  li.className = "group flex items-center justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)]";

  const leftSide = document.createElement('div');
  leftSide.className = "flex items-center gap-2.5 truncate flex-1";

  const badge = document.createElement('span');
  badge.className = getGapBadgeStyle(item.category);
  badge.textContent = item.category.toUpperCase();
  if (!isReadOnly) {
    badge.title = "Click to cycle severity";
    badge.onclick = (e) => {
      e.stopPropagation();
      cycleGapSeverity(item);
    };
  }

  const titleSpan = document.createElement('span');
  titleSpan.className = "font-medium truncate item-title-text" + (isReadOnly ? "" : " cursor-pointer") + (item.title === 'Click to describe gap' ? ' italic text-gray-500' : '');
  titleSpan.textContent = item.title;
  if (!isReadOnly) {
    titleSpan.onclick = () => startEditingItem(item, titleSpan);
  }

  leftSide.appendChild(badge);
  leftSide.appendChild(titleSpan);
  li.appendChild(leftSide);

  if (!isReadOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px]";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    };
    li.appendChild(deleteBtn);
  }

  return li;
}

function getGapBadgeStyle(severity) {
  const base = "px-2 py-0.5 rounded text-[9px] font-black tracking-wide uppercase select-none cursor-pointer ";
  if (severity === 'Critical') return base + "bg-red-500 text-white shadow-sm shadow-red-500/20";
  if (severity === 'High') return base + "bg-amber-500 text-black";
  return base + "bg-blue-500 text-white";
}

function createPlanElement(item, planType, isReadOnly = false) {
  const li = document.createElement('li');
  li.className = "group flex items-center justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)]";

  const leftSide = document.createElement('div');
  leftSide.className = "flex items-center gap-2.5 truncate flex-1";

  const parts = item.category.split(':');
  const badgeText = parts[1] || 'TRAIN';

  const badge = document.createElement('span');
  badge.className = "px-2 py-0.5 rounded text-[9px] font-black tracking-wide uppercase select-none cursor-pointer bg-emerald-500 text-black";
  badge.textContent = badgeText;
  if (!isReadOnly) {
    badge.title = "Click to cycle type";
    badge.onclick = (e) => {
      e.stopPropagation();
      cyclePlanBadgeType(item, planType, badgeText);
    };
  }

  const titleSpan = document.createElement('span');
  titleSpan.className = "font-medium truncate item-title-text" + (isReadOnly ? "" : " cursor-pointer") + (item.title.startsWith('Click to add') ? ' italic text-gray-500' : '');
  titleSpan.textContent = item.title;
  if (!isReadOnly) {
    titleSpan.onclick = () => startEditingItem(item, titleSpan);
  }

  leftSide.appendChild(badge);
  leftSide.appendChild(titleSpan);
  li.appendChild(leftSide);

  if (!isReadOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px]";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    };
    li.appendChild(deleteBtn);
  }

  return li;
}

// Render Submissions
// Render My Submissions (Employee View)
export function renderMySubmissions(submissions) {
  const body = document.getElementById('my-submissions-body');
  if (!body) return;
  body.innerHTML = '';

  if (submissions.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500 font-medium">No submission requests assigned to you.</td></tr>';
    return;
  }

  submissions.forEach(sub => {
    const isPending = sub.status === 'Pending' || sub.status === 'Needs Revision';
    const actionCell = isPending 
      ? `<button onclick="submitDashboard('${sub.id}')" class="text-emerald-400 hover:text-emerald-300 font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded hover:bg-emerald-500/25 transition-all shadow-sm">Submit Dashboard</button>` 
      : `<span class="text-gray-500 font-semibold text-[10px] flex items-center justify-end gap-1">Verified ✓</span>`;

    let statusColor = 'text-amber-400 font-bold';
    if (sub.status === 'Approved') statusColor = 'text-emerald-400 font-bold';
    if (sub.status === 'Needs Revision') statusColor = 'text-rose-400 font-bold';
    if (sub.status === 'Submitted') statusColor = 'text-blue-400 font-bold';

    const feedbackText = sub.feedback ? `<div class="bg-[var(--bg-input)] text-xs text-[var(--text-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] max-w-xs truncate" title="${sub.feedback}">${sub.feedback}</div>` : `<span class="text-gray-500 italic text-[10px]">No feedback yet</span>`;

    body.innerHTML += `
      <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] font-medium">
        <td class="py-3.5 pl-3 font-mono text-[9px] text-[var(--accent)]">#${sub.id.substring(0,8)}</td>
        <td class="py-3.5 font-bold text-[var(--text-primary)]">${sub.manager_name}</td>
        <td class="py-3.5 font-mono text-[10px] text-[var(--text-secondary)]">${sub.deadline}</td>
        <td class="py-3.5 ${statusColor}">${sub.status}</td>
        <td class="py-3.5">${feedbackText}</td>
        <td class="py-3.5 text-right pr-3">${actionCell}</td>
      </tr>
    `;
  });
}

// Render Team Reviews Queue (Manager View)
export function renderReviewsQueue(reviews) {
  const body = document.getElementById('reviews-queue-body');
  if (!body) return;
  body.innerHTML = '';

  if (reviews.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500 font-medium">No reviews in your queue. Request a submission from your team members.</td></tr>';
    return;
  }

  reviews.forEach(rev => {
    let actionCell = '';
    if (rev.status === 'Submitted') {
      actionCell = `<button onclick="openReviewModal('${rev.id}')" class="text-indigo-400 hover:text-indigo-300 font-bold text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded hover:bg-indigo-500/25 transition-all shadow-sm">Review & Action</button>`;
    } else if (rev.status === 'Approved' || rev.status === 'Needs Revision') {
      actionCell = `<button onclick="openReviewModal('${rev.id}')" class="text-gray-400 hover:text-[var(--text-primary)] font-bold text-[10px] bg-[var(--bg-input)] border border-[var(--border-color)] px-2.5 py-1 rounded transition-all shadow-sm">View Review</button>`;
    } else {
      actionCell = `<span class="text-gray-500 italic text-[10px]">Awaiting Employee</span>`;
    }

    let statusColor = 'text-amber-400 font-bold';
    if (rev.status === 'Approved') statusColor = 'text-emerald-400 font-bold';
    if (rev.status === 'Needs Revision') statusColor = 'text-rose-400 font-bold';
    if (rev.status === 'Submitted') statusColor = 'text-blue-400 font-bold';

    const feedbackText = rev.feedback ? `<div class="bg-[var(--bg-input)] text-xs text-[var(--text-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] max-w-xs truncate" title="${rev.feedback}">${rev.feedback}</div>` : `<span class="text-gray-500 italic text-[10px]">-</span>`;
    const submittedOn = rev.submitted_at ? rev.submitted_at : `<span class="text-gray-500 italic text-[10px]">-</span>`;

    body.innerHTML += `
      <tr class="hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] font-medium">
        <td class="py-3.5 pl-3">
          <div class="font-bold text-[var(--text-primary)]">${rev.employee_name}</div>
          <div class="text-[9px] font-mono text-[var(--text-secondary)]">${rev.employee_designation || rev.employee_role}</div>
        </td>
        <td class="py-3.5 font-mono text-[10px] text-[var(--text-secondary)]">${rev.deadline}</td>
        <td class="py-3.5 ${statusColor}">${rev.status}</td>
        <td class="py-3.5 font-mono text-[10px] text-[var(--text-secondary)]">${submittedOn}</td>
        <td class="py-3.5">${feedbackText}</td>
        <td class="py-3.5 text-right pr-3">${actionCell}</td>
      </tr>
    `;
  });
}

// Populate Manager Review Modal
export function populateReviewModal(review, data) {
  document.getElementById('review-modal-employee-role').textContent = `${review.employee_name} — ${review.employee_designation || review.employee_role}`;
  document.getElementById('review-modal-program-line').textContent = data.dashboard.program_line || 'Not set';
  document.getElementById('review-modal-objective').textContent = data.dashboard.objective || 'No objective logged.';
  document.getElementById('review-modal-status').textContent = data.dashboard.status || 'On Track';
  document.getElementById('review-modal-notes').textContent = data.dashboard.notes || 'No operational notes logged.';

  // Highlight health status
  const statusEl = document.getElementById('review-modal-status');
  if (data.dashboard.status === 'On Track') {
    statusEl.className = 'text-xs font-bold text-emerald-400';
  } else if (data.dashboard.status === 'At Risk') {
    statusEl.className = 'text-xs font-bold text-amber-400';
  } else {
    statusEl.className = 'text-xs font-bold text-rose-400';
  }

  // Populate feedback text if any
  document.getElementById('review-comments-input').value = review.feedback || '';

  const skills = data.items.filter(i => i.section === 'key_skill');
  const gaps = data.items.filter(i => i.section === 'gap');
  const training = data.items.filter(i => i.section === 'training_plan');

  const rSkills = document.getElementById('review-modal-skills');
  const rGaps = document.getElementById('review-modal-gaps');
  const rTraining = document.getElementById('review-modal-training');

  rSkills.innerHTML = '';
  rGaps.innerHTML = '';
  rTraining.innerHTML = '';

  if (skills.length === 0) {
    rSkills.innerHTML = '<div class="text-gray-500 italic py-1 pl-1">None logged.</div>';
  } else {
    skills.forEach(item => {
      rSkills.innerHTML += `
        <div class="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] mb-1">
          <div class="font-bold text-[var(--text-primary)] text-[10px]">${item.title}</div>
          <div class="text-[8px] text-[var(--col-skills-text)] font-mono mt-0.5">${item.category}</div>
        </div>
      `;
    });
  }

  if (gaps.length === 0) {
    rGaps.innerHTML = '<div class="text-gray-500 italic py-1 pl-1">None logged.</div>';
  } else {
    gaps.forEach(item => {
      rGaps.innerHTML += `
        <div class="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] mb-1">
          <div class="font-bold text-[var(--text-primary)] text-[10px]">${item.title}</div>
          <div class="text-[8px] text-[var(--col-gaps-text)] font-mono mt-0.5">${item.category}</div>
        </div>
      `;
    });
  }

  if (training.length === 0) {
    rTraining.innerHTML = '<div class="text-gray-500 italic py-1 pl-1">None logged.</div>';
  } else {
    training.forEach(item => {
      const badgeText = item.category.split(':')[1] || 'PLAN';
      rTraining.innerHTML += `
        <div class="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] mb-1">
          <div class="font-bold text-[var(--text-primary)] text-[10px]">${item.title}</div>
          <div class="text-[8px] text-[var(--col-plans-text)] font-mono mt-0.5">${badgeText}</div>
        </div>
      `;
    });
  }

  // Toggle feedback input read-only depending on whether it's reviewable or resolved
  const isActionable = review.status === 'Submitted';
  const textarea = document.getElementById('review-comments-input');
  textarea.disabled = !isActionable;

  const btnContainer = textarea.parentElement.parentElement.nextElementSibling;
  const buttons = btnContainer.querySelectorAll('button');
  buttons.forEach(btn => {
    if (isActionable) {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
      btn.removeAttribute('disabled');
    } else {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.setAttribute('disabled', 'true');
    }
  });

  document.getElementById('review-modal').classList.remove('hidden');
}

// Close Manager Review Modal
export function closeReviewModal() {
  document.getElementById('review-modal').classList.add('hidden');
}

// Render Team View
export function renderTeam(team, currentUserId, currentUserRole) {
  const statsContainer = document.getElementById('team-stats-banner');
  const gridContainer = document.getElementById('team-grid');

  if (!statsContainer || !gridContainer) return;

  // 1. Calculate stats
  const totalCount = team.length;
  const onTrackCount = team.filter(emp => emp.hasDashboard && emp.dashboardStatus === 'On Track').length;
  const atRiskCount = team.filter(emp => emp.hasDashboard && emp.dashboardStatus === 'At Risk').length;
  const offTrackCount = team.filter(emp => emp.hasDashboard && emp.dashboardStatus === 'Off Track').length;

  statsContainer.innerHTML = `
    <div class="flex flex-col">
      <span class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Team</span>
      <span class="text-3xl font-black text-[var(--text-primary)] mt-1.5">${totalCount}</span>
    </div>
    <div class="flex flex-col border-l border-[var(--border-color)] pl-5">
      <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">On Track</span>
      <span class="text-3xl font-black text-emerald-400 mt-1.5">${onTrackCount}</span>
    </div>
    <div class="flex flex-col border-l border-[var(--border-color)] pl-5">
      <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">At Risk</span>
      <span class="text-3xl font-black text-amber-400 mt-1.5">${atRiskCount}</span>
    </div>
    <div class="flex flex-col border-l border-[var(--border-color)] pl-5">
      <span class="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Off Track</span>
      <span class="text-3xl font-black text-rose-400 mt-1.5">${offTrackCount}</span>
    </div>
  `;

  // 2. Render Cards Grid
  gridContainer.innerHTML = '';

  if (team.length === 0) {
    gridContainer.className = "flex justify-center items-center py-12 text-[var(--text-secondary)] w-full col-span-full";
    gridContainer.innerHTML = `
      <div class="text-center space-y-2">
        <span class="text-3xl">👥</span>
        <h3 class="font-bold text-sm text-[var(--text-primary)]">No Team Members Found</h3>
        <p class="text-xs max-w-sm">No reporting employees found in your hierarchy chain.</p>
      </div>
    `;
    return;
  }

  gridContainer.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  team.forEach(emp => {
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    // Status Badge & Styles
    let statusClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    let statusLabel = 'No Dashboard';
    let borderClass = 'border-[var(--border-color)]';
    let avatarGradient = 'from-slate-600/30 to-slate-500/20';

    if (emp.hasDashboard) {
      if (emp.dashboardStatus === 'On Track') {
        statusClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        statusLabel = 'On Track';
        borderClass = 'hover:border-emerald-500/20';
        avatarGradient = 'from-emerald-500/20 to-teal-500/20';
      } else if (emp.dashboardStatus === 'At Risk') {
        statusClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        statusLabel = 'At Risk';
        borderClass = 'hover:border-amber-500/20';
        avatarGradient = 'from-amber-500/20 to-orange-500/20';
      } else if (emp.dashboardStatus === 'Off Track') {
        statusClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        statusLabel = 'Off Track';
        borderClass = 'hover:border-rose-500/20';
        avatarGradient = 'from-rose-500/20 to-red-500/20';
      }
    }

    // Last submission badge
    let submissionHtml = '';
    if (emp.lastSubmissionStatus) {
      const isPending = emp.lastSubmissionStatus === 'Pending';
      const subColor = isPending ? 'text-amber-400' : 'text-emerald-400';
      submissionHtml = `
        <div class="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[10px]">
          <span class="text-[var(--text-secondary)]">Submission Status</span>
          <span class="font-bold ${subColor}">${emp.lastSubmissionStatus} (By ${emp.lastSubmissionDeadline})</span>
        </div>
      `;
    }

    // Card element
    const card = document.createElement('div');
    card.className = `bg-[var(--bg-card)] border ${borderClass} rounded-2xl p-5 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all flex flex-col justify-between`;

    let actions = '';
    if (emp.hasDashboard) {
      actions += `<button onclick="viewEmployeeDashboard('${emp.id}')" class="flex-1 text-center font-bold text-xs bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-xl transition-all shadow-sm">View Dashboard</button>`;
    }
    
    if (emp.managerId === currentUserId || currentUserRole === 'Admin') {
      const buttonWidth = emp.hasDashboard ? 'w-auto px-3.5' : 'flex-1';
      actions += `<button onclick="triggerRequestSubmission('${emp.id}')" class="${buttonWidth} text-center font-bold text-xs bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] py-2 rounded-xl transition-all border border-[var(--border-color)]">Request Update</button>`;
    }

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr ${avatarGradient} text-[var(--text-primary)] flex items-center justify-center font-extrabold text-sm border border-[var(--border-color)] select-none shrink-0">
              ${initials}
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-bold text-[var(--text-primary)] truncate" title="${emp.name}">${emp.name}</h3>
              <p class="text-xs text-[var(--text-secondary)] truncate font-semibold mt-0.5" title="${emp.designation || emp.role}">${emp.designation || emp.role}</p>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${statusClass}">
            ${statusLabel}
          </span>
        </div>
        <p class="text-[10px] text-[var(--text-secondary)] font-mono truncate mt-3 select-text">${emp.email}</p>
        ${submissionHtml}
      </div>
      <div class="flex gap-2.5 mt-5">
        ${actions}
      </div>
    `;

    gridContainer.appendChild(card);
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

// Render tree nodes in hierarchy page
export function renderTreeNodes(container, list) {
  container.innerHTML = '';
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="text-[var(--text-secondary)] italic py-1 pl-4 text-xs">No direct reports found.</div>';
    return;
  }

  list.forEach(emp => {
    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = "hierarchy-node-wrapper space-y-2 mt-2";
    nodeWrapper.id = `node-${emp.id}`;

    // Determine status badge
    let statusBadge = '<span class="text-[9px] text-[var(--text-secondary)] italic px-2 py-0.5 border border-[var(--border-color)] rounded bg-[var(--bg-input)]">No Dashboard</span>';
    if (emp.hasDashboard) {
      let color = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      if (emp.dashboardStatus === 'At Risk') color = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      if (emp.dashboardStatus === 'Off Track') color = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      statusBadge = `<span class="px-2 py-0.5 rounded text-[9px] font-bold border ${color}">${emp.dashboardStatus}</span>`;
    }

    // Actions
    let actions = '';
    if (emp.hasDashboard) {
      actions += `<button onclick="viewEmployeeDashboard('${emp.id}')" class="text-indigo-400 hover:text-indigo-300 font-bold text-[9px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded hover:bg-indigo-500/25 transition-all">View Profile</button>`;
    }
    
    const currentUserId = JSON.parse(sessionStorage.getItem('dashboard_user_data') || '{}').id;
    const currentUserRole = JSON.parse(sessionStorage.getItem('dashboard_user_data') || '{}').role;
    if (emp.managerId === currentUserId || currentUserRole === 'Admin') {
      actions += `<button onclick="triggerRequestSubmission('${emp.id}')" class="text-amber-400 hover:text-amber-300 font-bold text-[9px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded hover:bg-amber-500/25 transition-all">Request Sub</button>`;
    }

    // Expand button if role is Manager or Admin
    const isManagerOrAdmin = emp.role === 'Manager' || emp.role === 'Admin';
    const toggleBtnHtml = isManagerOrAdmin 
      ? `<button onclick="toggleHierarchyNode('${emp.id}')" class="w-5 h-5 flex items-center justify-center text-[9px] rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-transform duration-200" id="toggle-btn-${emp.id}">▶</button>`
      : `<span class="w-5 h-5 flex items-center justify-center text-[12px] text-gray-600 select-none">•</span>`;

    nodeWrapper.innerHTML = `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-white/10 hover:bg-[var(--bg-hover)] transition-all gap-4">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          ${toggleBtnHtml}
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500/20 to-pink-500/20 text-[var(--text-primary)] flex items-center justify-center font-bold text-xs border border-[var(--border-color)] shrink-0 select-none">
            ${emp.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[var(--text-primary)] truncate">${emp.name}</span>
              <span class="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-color)] shrink-0 select-none">${emp.role}</span>
            </div>
            <div class="text-[9px] text-[var(--text-secondary)] truncate font-mono">${emp.email}</div>
          </div>
        </div>
        
        <div class="flex items-center gap-3 shrink-0">
          ${statusBadge}
          <div class="flex gap-1">
            ${actions}
          </div>
        </div>
      </div>
      <div id="children-container-${emp.id}" class="pl-6 border-l border-[var(--border-color)] ml-2.5 space-y-2 mt-2 hidden"></div>
    `;

    container.appendChild(nodeWrapper);
  });
}

// Collapse all open nodes (legacy stub)
export function collapseAllHierarchyNodes() {}

// Render Microsoft Teams-style Org Explorer Chart
export function renderOrgExplorer({
  container,
  breadcrumbsContainer,
  focusedUser,
  managerChain,
  peers,
  directReports,
  currentUser,
  statusMap,
  isUplineManager
}) {
  if (!container) return;
  container.innerHTML = '';

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getPresence = (userId) => {
    const status = statusMap[userId];
    if (status === 'On Track') {
      return { presenceClass: 'presence-dot-green', presenceStatus: 'Available (On Track)', statusText: 'On Track', colorClass: 'text-emerald-400' };
    } else if (status === 'At Risk') {
      return { presenceClass: 'presence-dot-amber', presenceStatus: 'Away (At Risk)', statusText: 'At Risk', colorClass: 'text-amber-400' };
    } else if (status === 'Off Track') {
      return { presenceClass: 'presence-dot-rose', presenceStatus: 'Do Not Disturb (Off Track)', statusText: 'Off Track', colorClass: 'text-rose-400' };
    } else {
      return { presenceClass: 'presence-dot-gray', presenceStatus: 'Status Restricted / Offline', statusText: status || 'Not Logged', colorClass: 'text-gray-400' };
    }
  };

  // Render Breadcrumbs
  if (breadcrumbsContainer) {
    let breadcrumbHtml = `<span onclick="focusOnEmployee('${currentUser.id}')" class="cursor-pointer hover:text-[var(--text-primary)] transition-colors hover:underline text-[var(--accent)] font-bold shrink-0">My Org</span>`;
    
    managerChain.forEach(u => {
      breadcrumbHtml += ` <span class="text-gray-600 font-bold shrink-0">/</span> <span onclick="focusOnEmployee('${u.id}')" class="cursor-pointer hover:text-[var(--text-primary)] transition-colors hover:underline shrink-0">${u.name}</span>`;
    });
    
    breadcrumbHtml += ` <span class="text-gray-600 font-bold shrink-0">/</span> <span class="text-[var(--text-primary)] font-bold select-text shrink-0">${focusedUser.name}</span>`;
    breadcrumbsContainer.innerHTML = breadcrumbHtml;
  }

  // 1. SUPERIORS CHAIN (Manager Chain)
  let superiorsHtml = '';
  if (managerChain && managerChain.length > 0) {
    superiorsHtml += '<div class="flex flex-col items-center w-full space-y-1">';
    managerChain.forEach((mgr, idx) => {
      const presence = getPresence(mgr.id);
      superiorsHtml += `
        <div class="flex flex-col items-center w-full">
          ${idx === 0 ? `<span class="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-black mb-1.5 select-none">Leadership Chain</span>` : ''}
          <div onclick="focusOnEmployee('${mgr.id}')" class="org-card bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer max-w-sm w-full select-none">
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-[var(--text-primary)] flex items-center justify-center font-bold text-xs border border-[var(--border-color)] shrink-0 relative">
              ${getInitials(mgr.name)}
              <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full ${presence.presenceClass}" title="${presence.presenceStatus}"></span>
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="text-xs font-bold text-[var(--text-primary)] truncate">${mgr.name}</div>
              <div class="text-[9px] text-[var(--text-secondary)] truncate font-semibold uppercase tracking-wider">${mgr.role}</div>
            </div>
            <span class="text-[9px] text-[var(--text-secondary)] font-mono font-bold pr-1">▲ Up</span>
          </div>
          <!-- Connecting Line to next card -->
          <div class="org-connector-line h-6 w-px my-1"></div>
        </div>
      `;
    });
    superiorsHtml += '</div>';
  } else {
    // Show label for CEO / top-level user
    superiorsHtml += `
      <div class="flex flex-col items-center w-full">
        <span class="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-black mb-1.5 select-none">Top-Level Executive</span>
      </div>
    `;
  }

  // 2. PEERS ROW SECTION (Compact horizontal display under manager)
  let peersHtml = '';
  if (peers && peers.length > 0) {
    let peerItems = '';
    peers.forEach(peer => {
      const presence = getPresence(peer.id);
      peerItems += `
        <button onclick="focusOnEmployee('${peer.id}')" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm shrink-0">
          <div class="w-4 h-4 rounded-full bg-gradient-to-tr from-slate-600/30 to-purple-500/20 flex items-center justify-center text-[8px] font-bold relative text-[var(--text-primary)] border border-[var(--border-color)]">
            ${getInitials(peer.name)}
            <span class="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full ${presence.presenceClass}" title="${presence.presenceStatus}"></span>
          </div>
          <span class="text-[10px] font-medium">${peer.name.split(' ')[0]}</span>
        </button>
      `;
    });

    peersHtml = `
      <div class="flex flex-col items-center w-full mb-3">
        <div class="flex items-center justify-center gap-2 max-w-lg w-full overflow-x-auto py-1 custom-scrollbar">
          <span class="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-black shrink-0 select-none mr-1">Peers:</span>
          ${peerItems}
        </div>
        <!-- Connecting Line down -->
        <div class="org-connector-line h-4 w-px my-1"></div>
      </div>
    `;
  }

  // 3. FOCUSED USER CARD
  const isSelf = currentUser.id === focusedUser.id;
  const isAdmin = currentUser.role === 'Admin';
  const hasDashboard = statusMap[focusedUser.id] !== undefined;

  let actionsHtml = '';
  if (hasDashboard) {
    actionsHtml += `<button onclick="viewEmployeeDashboard('${focusedUser.id}')" class="text-indigo-400 hover:text-indigo-300 font-bold text-[9px] bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg hover:bg-indigo-500/25 transition-all text-center">View Profile</button>`;
  }
  if ((focusedUser.managerId === currentUser.id || isAdmin) && !isSelf) {
    actionsHtml += `<button onclick="triggerRequestSubmission('${focusedUser.id}')" class="text-amber-400 hover:text-amber-300 font-bold text-[9px] bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/25 transition-all text-center">Request Sub</button>`;
  }

  const focusedPresence = getPresence(focusedUser.id);

  let focusedCardHtml = `
    <div class="flex flex-col items-center w-full">
      <div class="org-card org-card-focused p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col sm:flex-row items-center gap-4 relative shadow-lg max-w-lg w-full">
        <!-- Target indicator badge -->
        <span class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest font-black bg-[var(--accent)] text-white select-none shadow-sm">Focused Workspace</span>
        
        <!-- Avatar with presence indicator -->
        <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center font-bold text-lg border border-[var(--border-color)] shrink-0 select-none relative">
          ${getInitials(focusedUser.name)}
          <span class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#090d16] ${focusedPresence.presenceClass}" title="${focusedPresence.presenceStatus}"></span>
        </div>
        
        <!-- Info details -->
        <div class="min-w-0 flex-1 text-center sm:text-left">
          <div class="flex flex-wrap items-center gap-1.5 justify-center sm:justify-start">
            <span class="text-sm font-black text-[var(--text-primary)] truncate">${focusedUser.name}</span>
            <span class="px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-widest bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-color)] select-none shrink-0">${focusedUser.role}</span>
          </div>
          <div class="text-[10px] text-[var(--text-secondary)] truncate font-mono mt-0.5 select-text">${focusedUser.email}</div>
          
          <!-- Health Dashboard Status -->
          <div class="mt-2 text-[10px] flex items-center justify-center sm:justify-start gap-1 text-[var(--text-secondary)]">
            <span>Status:</span>
            <span class="font-bold ${focusedPresence.colorClass}">${focusedPresence.statusText}</span>
          </div>
        </div>
        
        <!-- Actions Panel inside Card -->
        <div class="flex sm:flex-col gap-1.5 justify-center shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          ${actionsHtml}
        </div>
      </div>
    </div>
  `;

  // 4. DIRECT REPORTS SECTION (Vertical Linear Stack)
  let reportsHtml = '';
  if (directReports && directReports.length > 0) {
    let reportCards = '';
    directReports.forEach(report => {
      const presence = getPresence(report.id);
      reportCards += `
        <div onclick="focusOnEmployee('${report.id}')" class="org-card bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer select-none text-left max-w-sm w-full">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500/20 to-pink-500/20 text-[var(--text-primary)] flex items-center justify-center font-bold text-xs border border-[var(--border-color)] shrink-0 relative">
            ${getInitials(report.name)}
            <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full ${presence.presenceClass}" title="${presence.presenceStatus}"></span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-[var(--text-primary)] truncate">${report.name}</div>
            <div class="text-[9px] text-[var(--text-secondary)] truncate font-semibold uppercase tracking-wider">${report.role}</div>
          </div>
          <span class="text-[9px] text-[var(--text-secondary)] font-mono font-bold pr-1">▼ Down</span>
        </div>
      `;
    });

    reportsHtml = `
      <div class="flex flex-col items-center w-full">
        <!-- Connecting Line down from focused card -->
        <div class="org-connector-line h-6 w-px my-1"></div>
        
        <span class="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] font-black mb-3 select-none">Direct Reports (${directReports.length})</span>
        
        <div class="flex flex-col items-center gap-3 w-full max-w-md">
          ${reportCards}
        </div>
      </div>
    `;
  } else {
    reportsHtml = `
      <div class="flex flex-col items-center w-full">
        <!-- Connecting Line down from focused card -->
        <div class="org-connector-line h-6 w-px my-1"></div>
        <span class="text-[9px] italic text-[var(--text-secondary)] select-none">No direct reports.</span>
      </div>
    `;
  }

  // Combine All and Append to Container in a linear Microsoft Teams style vertical chart
  container.innerHTML = `
    <div class="flex flex-col items-center w-full max-w-xl">
      ${superiorsHtml}
      ${peersHtml}
      ${focusedCardHtml}
      ${reportsHtml}
    </div>
  `;
}
