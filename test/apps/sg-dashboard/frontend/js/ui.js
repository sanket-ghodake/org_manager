import {
  cycleGapSeverity,
  cyclePlanBadgeType,
  startEditingItem,
  deleteItem,
  submitDashboard,
  viewEmployeeDashboard,
  triggerRequestSubmission,
  updateItemLinks,
  updatePlanStatus,
  updatePlanTargetQuarter,
  updatePlanCompletedQuarter
} from './app.js?v=1.0.1';

// Apply persisted theme on load
const savedTheme = localStorage.getItem('selected-theme') || 'default';
document.documentElement.setAttribute('data-theme', savedTheme);

// Helper to update the single theme toggle button icon
function updateThemeActiveIcon(theme) {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    const icons = {
      'default': '🌌',
      'light': '☀️',
      'dark': '🌙',
      'solarized-dark': '🪐',
      'solarized-light': '🌻'
    };
    toggleBtn.textContent = icons[theme] || '🌌';
  }
}

// Automatically sync theme toggle button icon with html[data-theme]
const themeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'data-theme') {
      const theme = document.documentElement.getAttribute('data-theme') || 'default';
      updateThemeActiveIcon(theme);
    }
  });
});
themeObserver.observe(document.documentElement, { attributes: true });

// Initialize theme button icon on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updateThemeActiveIcon(savedTheme));
} else {
  updateThemeActiveIcon(savedTheme);
}

// Tab Switcher
export function switchTab(tab) {
  const tabs = ['my-dashboard', 'submissions', 'team-view', 'history-versions'];
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

// Set Theme
export function setTheme(newTheme) {
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('selected-theme', newTheme);

  const themeIcons = {
    'default': '🌌',
    'light': '☀️',
    'dark': '🌙',
    'solarized-dark': '🪐',
    'solarized-light': '🌅'
  };
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.textContent = themeIcons[newTheme] || '🌌';
  }
}

// Toggle Theme
export function toggleTheme() {
  const themes = ['default', 'light', 'dark', 'solarized-dark', 'solarized-light'];
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
  const currentIndex = themes.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themes.length;
  const newTheme = themes[nextIndex];
  setTheme(newTheme);
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



// Render Dashboard Items
export function renderDashboardItems(items, isReadOnly = false, links = []) {
  // 1. Key Skills
  const coreList = document.getElementById('core-skills-list');
  const stratList = document.getElementById('strategic-skills-list');
  if (coreList && stratList) {
    coreList.innerHTML = '';
    stratList.innerHTML = '';
    const skills = items.filter(i => i.section === 'key_skill');

    const coreSkills = skills.filter(s => {
      const cat = (s.category || '').toLowerCase();
      return cat.startsWith('core:') || (!cat.startsWith('strategic:') && !cat.includes('strategic') && !cat.includes('transformation'));
    });
    const stratSkills = skills.filter(s => {
      const cat = (s.category || '').toLowerCase();
      return cat.startsWith('strategic:') || cat.includes('strategic') || cat.includes('transformation');
    });

    document.getElementById('skills-count-pill').textContent = `${coreSkills.length} Core • ${stratSkills.length} Strategic`;

    if (coreSkills.length === 0) {
      coreList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No core skills listed.</li>';
    } else {
      coreSkills.forEach(item => {
        coreList.appendChild(createGenericElement(item, isReadOnly, []));
      });
    }

    if (stratSkills.length === 0) {
      stratList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No strategic skills listed.</li>';
    } else {
      stratSkills.forEach(item => {
        stratList.appendChild(createGenericElement(item, isReadOnly, []));
      });
    }
  }

  // 2. Gaps
  const gapsList = document.getElementById('gaps-list');
  const gaps = items.filter(i => i.section === 'gap');
  if (gapsList) {
    gapsList.innerHTML = '';
    
    const criticalCount = gaps.filter(g => {
      let p = g.category || 'Low';
      if (p.includes(':')) p = p.split(':')[1];
      return p === 'Critical';
    }).length;
    const mediumCount = gaps.filter(g => {
      let p = g.category || 'Low';
      if (p.includes(':')) p = p.split(':')[1];
      return p === 'Medium';
    }).length;
    const lowCount = gaps.filter(g => {
      let p = g.category || 'Low';
      if (p.includes(':')) p = p.split(':')[1];
      return p === 'Low';
    }).length;
    
    document.getElementById('gaps-count-pill').textContent = `${criticalCount} Critical • ${mediumCount} Medium • ${lowCount} Low`;

    if (gaps.length === 0) {
      gapsList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No skill gaps identified.</li>';
    } else {
      gaps.forEach(item => {
        // Find plans linked to this gap
        const linkedPlanIds = links.filter(l => l.target_id === item.id).map(l => l.source_id);
        gapsList.appendChild(createGenericElement(item, isReadOnly, linkedPlanIds));
      });
    }
  }

  // 3. Training Plans
  const stratPlansList = document.getElementById('strategic-plans-list');
  const tactPlansList = document.getElementById('tactical-plans-list');
  if (stratPlansList && tactPlansList) {
    stratPlansList.innerHTML = '';
    tactPlansList.innerHTML = '';
    const plans = items.filter(i => i.section === 'training_plan');
    
    const completedCount = plans.filter(p => p.status === 'completed').length;
    const overdueCount = plans.filter(p => p.status !== 'completed' && isQuarterPassed(p.target_quarter)).length;

    let plansText = `${completedCount}/${plans.length} Done`;
    if (overdueCount > 0) {
      plansText += ` • ⚠️ ${overdueCount} Overdue`;
    }
    document.getElementById('plans-count-pill').textContent = plansText;

    const stratPlans = plans.filter(p => {
      const cat = (p.category || '').toLowerCase();
      return cat.startsWith('strategic:');
    });
    const tactPlans = plans.filter(p => {
      const cat = (p.category || '').toLowerCase();
      return cat.startsWith('tactical:');
    });

    if (stratPlans.length === 0) {
      stratPlansList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No strategic plans scheduled.</li>';
    } else {
      stratPlans.forEach(item => {
        // Find gaps linked to this plan
        const linkedGapIds = links.filter(l => l.source_id === item.id).map(l => l.target_id);
        const linkedGapsList = gaps.filter(g => linkedGapIds.includes(g.id));
        stratPlansList.appendChild(createTrainingPlanElement(item, gaps, linkedGapsList, isReadOnly));
      });
    }

    if (tactPlans.length === 0) {
      tactPlansList.innerHTML = '<li class="text-gray-500 italic py-1 pl-2">No tactical plans scheduled.</li>';
    } else {
      tactPlans.forEach(item => {
        // Find gaps linked to this plan
        const linkedGapIds = links.filter(l => l.source_id === item.id).map(l => l.target_id);
        const linkedGapsList = gaps.filter(g => linkedGapIds.includes(g.id));
        tactPlansList.appendChild(createTrainingPlanElement(item, gaps, linkedGapsList, isReadOnly));
      });
    }
  }
}

// Helpers to build list elements
export function getGenericBadgeStyle(category) {
  const base = "px-2 py-0.5 rounded text-[9px] font-black tracking-wide uppercase select-none cursor-pointer ";
  let val = category || 'Low';
  if (val.includes(':')) {
    val = val.split(':')[1];
  }
  if (val === 'Critical') return base + "bg-red-500 text-white shadow-sm shadow-red-500/20";
  if (val === 'Medium') return base + "bg-amber-500 text-black";
  return base + "bg-blue-500 text-white shadow-sm shadow-blue-500/10";
}

function createGenericElement(item, isReadOnly = false, linkedIds = []) {
  const li = document.createElement('li');
  li.id = `item-row-${item.id}`;
  li.className = "group flex items-start justify-between py-1 px-2 rounded hover:bg-[var(--bg-hover)] transition-all text-[var(--text-primary)] font-medium border border-transparent";
  li.dataset.linkedIds = JSON.stringify(linkedIds);

  // Hover highlights
  li.addEventListener('mouseenter', () => {
    try {
      const ids = JSON.parse(li.dataset.linkedIds || '[]');
      ids.forEach(id => {
        const el = document.getElementById(`item-row-${id}`);
        if (el) el.classList.add('relational-highlight');
      });
    } catch(e) {}
  });

  li.addEventListener('mouseleave', () => {
    try {
      const ids = JSON.parse(li.dataset.linkedIds || '[]');
      ids.forEach(id => {
        const el = document.getElementById(`item-row-${id}`);
        if (el) el.classList.remove('relational-highlight');
      });
    } catch(e) {}
  });

  const leftSide = document.createElement('div');
  leftSide.className = "flex items-start gap-2.5 flex-1 min-w-0";

  // Parse priority
  let priority = item.category || 'Low';
  if (priority.includes(':')) {
    priority = priority.split(':')[1];
  }

  const badge = document.createElement('span');
  badge.className = getGenericBadgeStyle(item.category);
  badge.textContent = priority.toUpperCase();
  if (!isReadOnly && item.section === 'gap') {
    badge.title = "Click to cycle priority";
    badge.onclick = (e) => {
      e.stopPropagation();
      cycleGapSeverity(item);
    };
  }

  const titleSpan = document.createElement('span');
  titleSpan.className = "font-medium break-words whitespace-normal item-title-text flex-1 min-w-0" + (isReadOnly ? "" : " cursor-pointer");
  titleSpan.textContent = item.title;
  if (!isReadOnly) {
    titleSpan.onclick = () => startEditingItem(item, titleSpan);
  }

  leftSide.appendChild(badge);
  leftSide.appendChild(titleSpan);

  if (item.section === 'gap') {
    const countPill = document.createElement('span');
    countPill.className = 'count-badge' + (linkedIds.length > 0 ? ' active-count' : '');
    countPill.textContent = `${linkedIds.length} plans`;
    leftSide.appendChild(countPill);

    if (linkedIds.length === 0) {
      li.classList.add('unlinked-alert');
    }
  }

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

function isQuarterPassed(targetQuarterStr) {
  if (!targetQuarterStr) return false;
  const parts = targetQuarterStr.split(' ');
  if (parts.length !== 2) return false;
  
  const qStr = parts[0]; // "Q3"
  const yStr = parts[1]; // "2026"
  const quarter = parseInt(qStr.substring(1));
  const year = parseInt(yStr);

  const quarterEndMonths = {
    1: 2,  // March
    2: 5,  // June
    3: 8,  // September
    4: 11  // December
  };

  const current = new Date();
  const targetDate = new Date(year, quarterEndMonths[quarter], 31, 23, 59, 59);

  return current > targetDate;
}

function getQuarterOptions() {
  const currentYear = new Date().getFullYear();
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const options = [];
  for (let y = currentYear; y <= currentYear + 5; y++) {
    for (const q of quarters) {
      options.push(`${q} ${y}`);
    }
  }
  return options;
}

function createTrainingPlanElement(item, allGaps, linkedGaps, isReadOnly = false) {
  const li = document.createElement('li');
  li.id = `item-row-${item.id}`;
  li.className = "group flex flex-col gap-2 p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)] transition-all text-[var(--text-primary)] font-medium relative w-full";

  const linkedGapIds = linkedGaps.map(g => g.id);
  li.dataset.linkedIds = JSON.stringify(linkedGapIds);

  if (linkedGaps.length === 0) {
    li.classList.add('unlinked-alert');
  }

  const isOverdue = item.status !== 'completed' && isQuarterPassed(item.target_quarter);
  if (isOverdue) {
    li.classList.add('overdue-highlight');
  }

  // Hover highlights
  li.addEventListener('mouseenter', () => {
    try {
      const ids = JSON.parse(li.dataset.linkedIds || '[]');
      ids.forEach(id => {
        const el = document.getElementById(`item-row-${id}`);
        if (el) el.classList.add('relational-highlight');
      });
    } catch(e) {}
  });

  li.addEventListener('mouseleave', () => {
    try {
      const ids = JSON.parse(li.dataset.linkedIds || '[]');
      ids.forEach(id => {
        const el = document.getElementById(`item-row-${id}`);
        if (el) el.classList.remove('relational-highlight');
      });
    } catch(e) {}
  });

  // --- FIRST ROW: Status, Badge, Title, Overdue Label, Delete button ---
  const mainRow = document.createElement('div');
  mainRow.className = "flex items-start justify-between w-full gap-2.5 min-w-0";

  const leftSide = document.createElement('div');
  leftSide.className = "flex items-start gap-2 flex-1 min-w-0";

  // 1. Fully Clickable Status Indicator
  const statusContainer = document.createElement('div');
  statusContainer.className = 'flex items-center shrink-0 select-none';
  if (!isReadOnly) {
    statusContainer.className += ' cursor-pointer hover:opacity-80 transition-opacity';
  }

  const statusSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  statusSvg.setAttribute('width', '16');
  statusSvg.setAttribute('height', '16');
  statusSvg.setAttribute('viewBox', '0 0 16 16');
  statusSvg.setAttribute('class', 'shrink-0 transition-all');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '8');
  circle.setAttribute('cy', '8');
  circle.setAttribute('r', '6');
  circle.setAttribute('stroke-width', '2');
  statusSvg.appendChild(circle);

  const status = item.status || 'not_started';

  if (status === 'completed') {
    circle.setAttribute('stroke', '#10b981');
    circle.setAttribute('fill', '#10b981');
    const check = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    check.setAttribute('d', 'M5 8 l2 2 l4 -4');
    check.setAttribute('stroke', '#ffffff');
    check.setAttribute('stroke-width', '2');
    check.setAttribute('fill', 'none');
    statusSvg.appendChild(check);
  } else if (status === 'in_progress') {
    circle.setAttribute('stroke', '#fbbf24');
    circle.setAttribute('fill', 'none');
    const half = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    half.setAttribute('d', 'M 8 8 M 8 2 A 6 6 0 0 1 8 14 Z');
    half.setAttribute('fill', '#fbbf24');
    statusSvg.appendChild(half);
  } else {
    circle.setAttribute('stroke', '#94a3b8');
    circle.setAttribute('fill', 'none');
  }

  statusContainer.appendChild(statusSvg);

  if (!isReadOnly) {
    statusContainer.title = "Click to cycle status (New -> Active -> Done)";
    statusContainer.onclick = async (e) => {
      e.stopPropagation();
      const statusFlow = {
        'not_started': 'in_progress',
        'in_progress': 'completed',
        'completed': 'not_started'
      };
      const nextStatus = statusFlow[status] || 'not_started';
      await updatePlanStatus(item.id, nextStatus);
    };
  }

  // Parse category/badge type
  let planCategory = item.category || 'Strategic:TIME';
  let planType = 'Strategic';
  let badgeText = 'PLAN';
  if (planCategory.includes(':')) {
    const parts = planCategory.split(':');
    planType = parts[0];
    badgeText = parts[1];
  }

  const badge = document.createElement('span');
  badge.className = "px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide uppercase select-none cursor-pointer bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0";
  badge.textContent = badgeText.toUpperCase();
  if (!isReadOnly) {
    badge.title = "Click to cycle badge type";
    badge.onclick = (e) => {
      e.stopPropagation();
      cyclePlanBadgeType(item, planType, badgeText);
    };
  }

  const titleSpan = document.createElement('span');
  titleSpan.className = "font-semibold break-words whitespace-normal text-xs item-title-text flex-1 min-w-0" + (isReadOnly ? "" : " cursor-pointer");
  titleSpan.textContent = item.title;
  if (!isReadOnly) {
    titleSpan.onclick = () => startEditingItem(item, titleSpan);
  }

  leftSide.appendChild(statusContainer);
  leftSide.appendChild(badge);
  leftSide.appendChild(titleSpan);

  mainRow.appendChild(leftSide);

  // Right side actions (Delete)
  const rightSideActions = document.createElement('div');
  rightSideActions.className = "flex items-center shrink-0 ml-auto";

  if (!isReadOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold px-1.5 py-0.5 rounded text-[10px] cursor-pointer";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    };
    rightSideActions.appendChild(deleteBtn);
  }
  mainRow.appendChild(rightSideActions);
  li.appendChild(mainRow);

  // --- SECOND ROW: Separator + Target Quarter + Completed Quarter + Linked Gaps + Link button ---
  const metaRow = document.createElement('div');
  metaRow.className = "flex items-center justify-between gap-2.5 mt-1.5 pt-1.5 border-t border-[var(--border-color)] text-[10px] w-full min-w-0 select-none";

  // Left part of Metadata Row: Select elements
  const selectorsContainer = document.createElement('div');
  selectorsContainer.className = "flex items-center gap-3 flex-wrap min-w-0";

  // 2. Target Quarter Dropdown
  const targetGroup = document.createElement('div');
  targetGroup.className = 'flex items-center gap-1 shrink-0';

  const targetSelect = document.createElement('select');
  targetSelect.className = 'bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[9px] rounded-md px-1.5 py-0.5 font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer transition-all';
  if (isReadOnly) {
    targetSelect.disabled = true;
    targetSelect.className += ' cursor-default opacity-80';
  }

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = 'Target Qtr';
  targetSelect.appendChild(placeholderOpt);

  const quarterOptions = getQuarterOptions();
  quarterOptions.forEach(optVal => {
    const opt = document.createElement('option');
    opt.value = optVal;
    opt.textContent = optVal;
    if (item.target_quarter === optVal) {
      opt.selected = true;
    }
    targetSelect.appendChild(opt);
  });

  if (!isReadOnly) {
    targetSelect.onchange = async () => {
      await updatePlanTargetQuarter(item.id, targetSelect.value);
    };
  }
  targetGroup.appendChild(targetSelect);

  if (isOverdue) {
    const overdueLabel = document.createElement('span');
    overdueLabel.className = 'text-[8px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse ml-1.5';
    overdueLabel.textContent = '⚠️ Overdue';
    targetGroup.appendChild(overdueLabel);
  }

  selectorsContainer.appendChild(targetGroup);

  // 3. Completed Quarter Dropdown (only visible when status is completed)
  if (status === 'completed') {
    const completedGroup = document.createElement('div');
    completedGroup.className = 'flex items-center gap-1 shrink-0';

    const completedSelect = document.createElement('select');
    completedSelect.className = 'bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[9px] rounded-md px-1.5 py-0.5 font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer transition-all';
    if (isReadOnly) {
      completedSelect.disabled = true;
      completedSelect.className += ' cursor-default opacity-80';
    }

    const compPlaceholderOpt = document.createElement('option');
    compPlaceholderOpt.value = '';
    compPlaceholderOpt.textContent = 'Completed Qtr';
    completedSelect.appendChild(compPlaceholderOpt);

    quarterOptions.forEach(optVal => {
      const opt = document.createElement('option');
      opt.value = optVal;
      opt.textContent = optVal;
      if (item.completed_quarter === optVal) {
        opt.selected = true;
      }
      completedSelect.appendChild(opt);
    });

    if (!isReadOnly) {
      completedSelect.onchange = async () => {
        await updatePlanCompletedQuarter(item.id, completedSelect.value);
      };
    }
    completedGroup.appendChild(completedSelect);
    selectorsContainer.appendChild(completedGroup);
  }

  metaRow.appendChild(selectorsContainer);

  // Right part of Metadata Row: Bubbles & Links
  const linksContainer = document.createElement('div');
  linksContainer.className = "flex items-center gap-2 shrink-0 ml-auto";

  // Stack of linked gaps
  if (linkedGaps.length > 0) {
    const stack = document.createElement('div');
    stack.className = "bubble-stack";

    const maxVisible = 2;
    const visibleGaps = linkedGaps.slice(0, maxVisible);
    const remainingCount = linkedGaps.length - maxVisible;

    if (remainingCount > 0) {
      const moreBubble = document.createElement('div');
      moreBubble.className = "bubble-item bubble-more custom-tooltip";
      moreBubble.textContent = `+${remainingCount}`;
      const remainingNames = linkedGaps.slice(maxVisible).map(g => g.title).join(', ');
      moreBubble.setAttribute('data-tooltip', remainingNames);
      stack.appendChild(moreBubble);
    }

    // reverse for flex row-reverse
    visibleGaps.reverse().forEach(gap => {
      const bubble = document.createElement('div');
      bubble.className = "bubble-item custom-tooltip";
      const initials = gap.title.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      bubble.textContent = initials;
      bubble.setAttribute('data-tooltip', gap.title);

      const colors = [
        'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
        'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
        'linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)'
      ];
      const charSum = gap.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      bubble.style.background = colors[charSum % colors.length];

      stack.appendChild(bubble);
    });

    linksContainer.appendChild(stack);
  }

  // Link button
  if (!isReadOnly) {
    const linkBtn = document.createElement('button');
    linkBtn.className = "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold px-1 py-0.5 rounded text-xs select-none hover:bg-[var(--bg-hover)] transition-all cursor-pointer";
    linkBtn.innerHTML = "+🔗";
    linkBtn.title = "Link Skill Gaps";
    linkBtn.onclick = (e) => {
      e.stopPropagation();
      showLinkPopover(e.currentTarget, item, allGaps, linkedGapIds);
    };
    linksContainer.appendChild(linkBtn);
  }

  metaRow.appendChild(linksContainer);
  li.appendChild(metaRow);
  return li;
}

function showLinkPopover(buttonEl, item, allGaps, linkedGapIds) {
  const oldPopover = document.getElementById('active-links-popover');
  if (oldPopover) oldPopover.remove();

  if (allGaps.length === 0) {
    const alertOverlay = document.createElement('div');
    alertOverlay.className = "fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm";
    alertOverlay.innerHTML = `
      <div class="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 rounded-2xl max-w-sm text-center shadow-2xl animate-fade-in">
        <h3 class="font-bold text-sm text-[var(--text-primary)]">No Skill Gaps Found</h3>
        <p class="text-xs text-[var(--text-secondary)] mt-2">Please define at least one skill gap in the "Skill Gaps" column before linking it to training plans.</p>
        <button id="close-link-alert" class="mt-4 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all">OK</button>
      </div>
    `;
    document.body.appendChild(alertOverlay);
    document.getElementById('close-link-alert').onclick = () => alertOverlay.remove();
    return;
  }

  const popover = document.createElement('div');
  popover.id = 'active-links-popover';
  popover.className = 'absolute links-popover';

  const header = document.createElement('div');
  header.className = 'text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] px-2 pb-1.5 mb-1.5 border-b border-[var(--border-color)]';
  header.textContent = 'Link Skill Gaps';
  popover.appendChild(header);

  allGaps.forEach(gap => {
    const label = document.createElement('label');
    label.className = 'links-popover-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = gap.id;
    checkbox.checked = linkedGapIds.includes(gap.id);
    checkbox.className = 'accent-[var(--accent)]';

    checkbox.onchange = async () => {
      let nextIds = [...linkedGapIds];
      if (checkbox.checked) {
        if (!nextIds.includes(gap.id)) nextIds.push(gap.id);
      } else {
        nextIds = nextIds.filter(id => id !== gap.id);
      }
      await updateItemLinks(item.id, nextIds);
    };

    const span = document.createElement('span');
    span.className = 'text-xs text-[var(--text-primary)] truncate font-semibold';
    span.textContent = gap.title;

    label.appendChild(checkbox);
    label.appendChild(span);
    popover.appendChild(label);
  });

  document.body.appendChild(popover);

  const rect = buttonEl.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
  popover.style.left = `${Math.min(rect.left + window.scrollX - 100, window.innerWidth - 240)}px`;

  const clickOutside = (event) => {
    if (!popover.contains(event.target) && !buttonEl.contains(event.target)) {
      popover.remove();
      document.removeEventListener('click', clickOutside);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', clickOutside);
  }, 50);
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
  document.getElementById('review-modal-notes').textContent = data.dashboard.notes || 'No operational notes logged.';

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
        <div class="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] mb-1 flex items-center justify-between">
          <div class="font-bold text-[var(--text-primary)] text-[10px] truncate max-w-[70%]">${item.title}</div>
          <span class="${getGenericBadgeStyle(item.category)} text-[8px] font-black uppercase tracking-wider scale-90 origin-right">${(item.category || 'Medium').toUpperCase()}</span>
        </div>
      `;
    });
  }

  if (gaps.length === 0) {
    rGaps.innerHTML = '<div class="text-gray-500 italic py-1 pl-1">None logged.</div>';
  } else {
    gaps.forEach(item => {
      rGaps.innerHTML += `
        <div class="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] mb-1 flex items-center justify-between">
          <div class="font-bold text-[var(--text-primary)] text-[10px] truncate max-w-[70%]">${item.title}</div>
          <span class="${getGenericBadgeStyle(item.category)} text-[8px] font-black uppercase tracking-wider scale-90 origin-right">${(item.category || 'Medium').toUpperCase()}</span>
        </div>
      `;
    });
  }

  if (training.length === 0) {
    rTraining.innerHTML = '<div class="text-gray-500 italic py-1 pl-1">None logged.</div>';
  } else {
    training.forEach(item => {
      const isOverdue = item.status !== 'completed' && isQuarterPassed(item.target_quarter);
      const overdueBadge = isOverdue ? `<span class="text-[8px] font-black text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 ml-1.5">⚠️ OVERDUE</span>` : '';
      const statusText = (item.status || 'not_started').replace('_', ' ').toUpperCase();
      const targetText = item.target_quarter ? `Target: ${item.target_quarter}` : 'No Target Qtr';
      const completedText = item.status === 'completed' && item.completed_quarter ? ` | Completed: ${item.completed_quarter}` : '';
      const borderStyle = isOverdue ? 'border-l-4 border-rose-500 bg-rose-500/5' : '';

      rTraining.innerHTML += `
        <div class="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] mb-1 flex items-center justify-between ${borderStyle}">
          <div class="truncate max-w-[70%]">
            <div class="font-bold text-[var(--text-primary)] text-[10px] truncate">${item.title}</div>
            <div class="text-[8px] text-[var(--text-secondary)] mt-0.5 font-bold uppercase tracking-wider">
              [${statusText}] ${targetText}${completedText}${overdueBadge}
            </div>
          </div>
          <span class="${getGenericBadgeStyle(item.category)} text-[8px] font-black uppercase tracking-wider scale-90 origin-right">${(item.category || 'Medium').toUpperCase()}</span>
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

  statsContainer.innerHTML = `
    <div class="flex flex-col">
      <span class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Team</span>
      <span class="text-3xl font-black text-[var(--text-primary)] mt-1.5">${totalCount}</span>
    </div>
  `;

  // 2. Render Cards Grid
  gridContainer.innerHTML = '';

  if (team.length === 0) {
    gridContainer.className = "flex justify-center items-center py-12 text-[var(--text-secondary)] w-full col-span-full";
    gridContainer.innerHTML = `
      <div class="text-center space-y-3 flex flex-col items-center">
        <span class="text-3xl">👥</span>
        <h3 class="font-bold text-sm text-[var(--text-primary)]">No Team Members Found</h3>
        <p class="text-xs max-w-sm text-center">No reporting employees found in this team list.</p>
        <p class="text-[10px] text-[var(--accent)] text-center">Try switching to the <strong>Org Chart Explorer</strong> to view their leadership chain, peers, and department context.</p>
        <button onclick="resetToMyWorkspace()" class="mt-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-xs shadow-sm transition-all select-none">Reset to My Workspace</button>
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
      statusClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      statusLabel = 'Active';
      borderClass = 'hover:border-emerald-500/20';
      avatarGradient = 'from-emerald-500/20 to-teal-500/20';
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
      const isOverdue = item.status !== 'completed' && isQuarterPassed(item.target_quarter);
      const overdueBadge = isOverdue ? `<span class="text-[8px] font-black text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 ml-1.5">⚠️ OVERDUE</span>` : '';
      const statusText = (item.status || 'not_started').replace('_', ' ').toUpperCase();
      const targetText = item.target_quarter ? `Target: ${item.target_quarter}` : 'No Target Qtr';
      const completedText = item.status === 'completed' && item.completed_quarter ? ` | Completed: ${item.completed_quarter}` : '';
      const borderStyle = isOverdue ? 'border-l-4 border-rose-500 bg-rose-500/5' : '';
      const badgeText = item.category.split(':')[1] || 'PLAN';

      vTraining.innerHTML += `
        <div class="p-2 bg-[var(--bg-input)] rounded border border-[var(--border-color)] flex items-center justify-between ${borderStyle}">
          <div class="truncate max-w-[75%]">
            <div class="font-bold text-[var(--text-primary)] text-[10px] truncate">${item.title}</div>
            <div class="text-[8px] text-[var(--text-secondary)] mt-0.5 font-bold uppercase tracking-wider">
              [${statusText}] ${targetText}${completedText}${overdueBadge}
            </div>
          </div>
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
      statusBadge = `<span class="px-2 py-0.5 rounded text-[9px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</span>`;
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
              <span class="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-color)] shrink-0 select-none">${emp.designation || emp.role}</span>
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
    if (status === 'Active') {
      return { presenceClass: 'presence-dot-green', presenceStatus: 'Active Dashboard', statusText: 'Active', colorClass: 'text-emerald-400' };
    } else {
      return { presenceClass: 'presence-dot-gray', presenceStatus: 'No active dashboard', statusText: 'No Dashboard', colorClass: 'text-gray-400' };
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
              <div class="text-[9px] text-[var(--text-secondary)] truncate font-semibold uppercase tracking-wider">${mgr.designation || mgr.role}</div>
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
            <span class="px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-widest bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-color)] select-none shrink-0">${focusedUser.designation || focusedUser.role}</span>
          </div>
          <div class="text-xs text-[var(--text-secondary)] font-semibold mt-0.5 truncate">${focusedUser.designation ? focusedUser.role : ''}</div>
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
            <div class="text-[9px] text-[var(--text-secondary)] truncate font-semibold uppercase tracking-wider">${report.designation || report.role}</div>
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

// New-age Custom Dialog Popups
export function showCustomAlert(message, title = 'Notification') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] opacity-0 transition-opacity duration-300';
    overlay.style.pointerEvents = 'auto';
    
    overlay.innerHTML = `
      <div class="bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl scale-90 opacity-0 transition-all duration-300 select-none">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[var(--accent)] text-lg">💡</span>
          <h3 class="text-xs font-black uppercase tracking-wider">${title}</h3>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">${message}</p>
        <div class="flex justify-end">
          <button id="custom-alert-ok" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white shadow-lg active:scale-95 transition-all select-none hover:opacity-90">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      overlay.classList.add('opacity-100');
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-90', 'opacity-0');
      dialog.classList.add('scale-100', 'opacity-100');
    });
    
    overlay.querySelector('#custom-alert-ok').onclick = () => {
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-100', 'opacity-100');
      dialog.classList.add('scale-90', 'opacity-0');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 300);
    };
  });
}

export function showCustomConfirm(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] opacity-0 transition-opacity duration-300';
    overlay.style.pointerEvents = 'auto';
    
    overlay.innerHTML = `
      <div class="bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl scale-90 opacity-0 transition-all duration-300 select-none">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[var(--accent)] text-lg">❓</span>
          <h3 class="text-xs font-black uppercase tracking-wider">${title}</h3>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">${message}</p>
        <div class="flex justify-end gap-3">
          <button id="custom-confirm-cancel" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-color)] active:scale-95 hover:bg-[var(--bg-input)] transition-all select-none">Cancel</button>
          <button id="custom-confirm-ok" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white shadow-lg active:scale-95 transition-all select-none hover:opacity-90">Confirm</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      overlay.classList.add('opacity-100');
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-90', 'opacity-0');
      dialog.classList.add('scale-100', 'opacity-100');
    });
    
    overlay.querySelector('#custom-confirm-cancel').onclick = () => {
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-100', 'opacity-100');
      dialog.classList.add('scale-90', 'opacity-0');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.remove();
        resolve(false);
      }, 300);
    };
    
    overlay.querySelector('#custom-confirm-ok').onclick = () => {
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-100', 'opacity-100');
      dialog.classList.add('scale-90', 'opacity-0');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.remove();
        resolve(true);
      }, 300);
    };
  });
}

export function showCustomPrompt(message, defaultValue = '', title = 'Required Input') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] opacity-0 transition-opacity duration-300';
    overlay.style.pointerEvents = 'auto';
    
    overlay.innerHTML = `
      <div class="bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl scale-90 opacity-0 transition-all duration-300">
        <div class="flex items-center gap-2 mb-3 select-none">
          <span class="text-[var(--accent)] text-lg">✏️</span>
          <h3 class="text-xs font-black uppercase tracking-wider select-none">${title}</h3>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed select-none">${message}</p>
        <input type="text" id="custom-prompt-input" value="${defaultValue}" class="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] mb-6 transition-colors font-medium">
        <div class="flex justify-end gap-3 select-none">
          <button id="custom-prompt-cancel" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-color)] active:scale-95 hover:bg-[var(--bg-input)] transition-all select-none">Cancel</button>
          <button id="custom-prompt-ok" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white shadow-lg active:scale-95 transition-all select-none hover:opacity-90">Submit</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#custom-prompt-input');
    input.focus();
    input.select();
    
    requestAnimationFrame(() => {
      overlay.classList.add('opacity-100');
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-90', 'opacity-0');
      dialog.classList.add('scale-100', 'opacity-100');
    });
    
    overlay.querySelector('#custom-prompt-cancel').onclick = () => {
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-100', 'opacity-100');
      dialog.classList.add('scale-90', 'opacity-0');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.remove();
        resolve(null);
      }, 300);
    };
    
    overlay.querySelector('#custom-prompt-ok').onclick = () => {
      const val = input.value;
      const dialog = overlay.querySelector('div');
      dialog.classList.remove('scale-100', 'opacity-100');
      dialog.classList.add('scale-90', 'opacity-0');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.remove();
        resolve(val);
      }, 300);
    };
 
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        overlay.querySelector('#custom-prompt-ok').click();
      }
      if (e.key === 'Escape') {
        overlay.querySelector('#custom-prompt-cancel').click();
      }
    };
  });
}

const suggestionCache = {
  key_skill: [],
  gap: [],
  training_plan: []
};

export function setSuggestions(section, list) {
  suggestionCache[section] = list || [];
}

export function setupCustomAutocompletes() {
  const inputs = document.querySelectorAll('input[list^="suggestions-"], input[id^="add-"]');
  inputs.forEach(input => {
    const listAttr = input.getAttribute('list');
    let section = '';
    if (listAttr) {
      section = listAttr.replace('suggestions-', '');
    } else {
      const id = input.id;
      if (id.includes('skill')) section = 'key_skill';
      else if (id.includes('gap')) section = 'gap';
      else if (id.includes('plan')) section = 'training_plan';
    }
    if (!section) return;
    
    // Remove native datalist association to prevent traditional browser dropdown
    input.removeAttribute('list');
    
    // Create suggestion box and append to body to prevent hidden/overflow trimming
    const boxId = `suggest-box-${input.id}`;
    let box = document.getElementById(boxId);
    if (!box) {
      box = document.createElement('div');
      box.id = boxId;
      box.className = 'custom-suggest-box fixed bg-[var(--bg-sidebar)] backdrop-blur-md border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-2xl overflow-hidden hidden z-[99999] transition-all duration-200 opacity-0 scale-95 max-h-48 overflow-y-auto custom-scrollbar select-none';
      document.body.appendChild(box);
    }
    
    const showSuggestions = () => {
      const query = input.value.trim().toLowerCase();
      const items = suggestionCache[section] || [];
      const filtered = items.filter(item => item.toLowerCase().includes(query));
      
      if (filtered.length === 0) {
        box.classList.add('hidden', 'opacity-0', 'scale-95');
        return;
      }
      
      box.innerHTML = filtered.map(item => `
        <div class="px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors font-medium text-left truncate">
          ${item}
        </div>
      `).join('');
      
      // Bind clicks to items
      const options = box.querySelectorAll('div');
      options.forEach((opt, idx) => {
        opt.onmousedown = (e) => {
          // Prevent input blur before click is registered
          e.preventDefault();
        };
        opt.onclick = () => {
          input.value = filtered[idx];
          box.classList.add('hidden', 'opacity-0', 'scale-95');
          // Trigger any change event
          input.dispatchEvent(new Event('input'));
        };
      });
      
      box.classList.remove('hidden');
      
      // Fixed position calculations relative to viewport
      const rect = input.getBoundingClientRect();
      const boxHeight = Math.min(filtered.length * 32, 192);
      const spaceBelow = window.innerHeight - rect.bottom;
      
      box.style.left = `${rect.left}px`;
      box.style.width = `${rect.width}px`;
      
      if (spaceBelow < boxHeight + 10 && rect.top > boxHeight) {
        box.style.top = `${rect.top - boxHeight - 4}px`;
        box.style.bottom = 'auto';
        box.style.transformOrigin = 'bottom';
      } else {
        box.style.top = `${rect.bottom + 4}px`;
        box.style.bottom = 'auto';
        box.style.transformOrigin = 'top';
      }
      
      requestAnimationFrame(() => {
        box.classList.remove('opacity-0', 'scale-95');
        box.classList.add('opacity-100', 'scale-100');
      });
    };
    
    input.onfocus = showSuggestions;
    input.oninput = showSuggestions;
    
    // Hide suggestions box on blur
    input.onblur = () => {
      box.classList.add('opacity-0', 'scale-95');
      setTimeout(() => {
        box.classList.add('hidden');
      }, 200);
    };
  });
}

export function convertNativeSelectsToCustom() {
  const selects = document.querySelectorAll('select');
  selects.forEach((select, selectIdx) => {
    const menuId = `custom-select-menu-${selectIdx}`;
    let menu = document.getElementById(menuId);
    
    // Check if we already wrapped this select
    if (select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-wrapper')) {
      const wrapper = select.nextElementSibling;
      const trigger = wrapper.querySelector('.custom-select-trigger');
      
      if (!menu) {
        menu = document.createElement('div');
        menu.id = menuId;
        menu.className = 'custom-select-menu fixed bg-[var(--bg-sidebar)] backdrop-blur-md border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-2xl overflow-hidden hidden z-[99999] transition-all duration-200 opacity-0 scale-95 max-h-56 overflow-y-auto custom-scrollbar select-none';
        document.body.appendChild(menu);
      }
      
      const currentSelectedText = select.options[select.selectedIndex]?.text || '';
      const textSpan = trigger.querySelector('span:first-child');
      if (textSpan) textSpan.textContent = currentSelectedText;
      
      menu.innerHTML = Array.from(select.options).map((opt, idx) => `
        <div class="px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors font-semibold truncate ${idx === select.selectedIndex ? 'text-[var(--accent)] bg-[var(--bg-hover)]' : ''}">
          ${opt.text}
        </div>
      `).join('');
      
      menu.querySelectorAll('div').forEach((item, idx) => {
        item.onclick = () => {
          select.selectedIndex = idx;
          select.dispatchEvent(new Event('change'));
          if (textSpan) textSpan.textContent = select.options[idx].text;
          menu.classList.add('hidden', 'opacity-0', 'scale-95');
          const arrowEl = trigger.querySelector('span:last-child');
          if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
        };
      });
      return;
    }
    
    // Hide native select
    select.style.display = 'none';
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper relative inline-block w-full';
    
    // Create trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer flex items-center justify-between gap-2 select-none transition-all';
    
    const labelSpan = document.createElement('span');
    labelSpan.textContent = select.options[select.selectedIndex]?.text || '';
    trigger.appendChild(labelSpan);
    
    const arrow = document.createElement('span');
    arrow.className = 'text-[9px] text-[var(--text-secondary)] transition-transform duration-200';
    arrow.innerHTML = '▼';
    trigger.appendChild(arrow);
    
    wrapper.appendChild(trigger);
    
    // Create menu (appended to document.body)
    menu = document.createElement('div');
    menu.id = menuId;
    menu.className = 'custom-select-menu fixed bg-[var(--bg-sidebar)] backdrop-blur-md border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-2xl overflow-hidden hidden z-[99999] transition-all duration-200 opacity-0 scale-95 max-h-56 overflow-y-auto custom-scrollbar select-none';
    document.body.appendChild(menu);
    
    // Insert wrapper next to native select
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    
    // Populate options
    const populateMenu = () => {
      menu.innerHTML = Array.from(select.options).map((opt, idx) => `
        <div class="px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors font-semibold truncate ${idx === select.selectedIndex ? 'text-[var(--accent)] bg-[var(--bg-hover)]' : ''}">
          ${opt.text}
        </div>
      `).join('');
      
      menu.querySelectorAll('div').forEach((item, idx) => {
        item.onclick = () => {
          select.selectedIndex = idx;
          select.dispatchEvent(new Event('change'));
          labelSpan.textContent = select.options[idx].text;
          menu.classList.add('hidden', 'opacity-0', 'scale-95');
          arrow.style.transform = 'rotate(0deg)';
        };
      });
    };
    
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isHidden = menu.classList.contains('hidden');
      
      // Close all other dropdowns
      document.querySelectorAll('.custom-select-menu, .custom-suggest-box').forEach(m => {
        if (m.id !== menuId) {
          m.classList.add('hidden', 'opacity-0', 'scale-95');
        }
      });
      document.querySelectorAll('.custom-select-trigger span:last-child').forEach(arrowEl => {
        if (arrowEl !== arrow) arrowEl.style.transform = 'rotate(0deg)';
      });
      
      if (isHidden) {
        populateMenu();
        menu.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
        
        // Position menu to prevent cut off (using client bounding rect)
        const rect = trigger.getBoundingClientRect();
        const menuHeight = Math.min(select.options.length * 36, 224);
        const spaceBelow = window.innerHeight - rect.bottom;
        
        menu.style.left = `${rect.left}px`;
        menu.style.width = `${rect.width}px`;
        
        if (spaceBelow < menuHeight + 10 && rect.top > menuHeight) {
          menu.style.top = `${rect.top - menuHeight - 4}px`;
          menu.style.bottom = 'auto';
          menu.style.transformOrigin = 'bottom';
        } else {
          menu.style.top = `${rect.bottom + 4}px`;
          menu.style.bottom = 'auto';
          menu.style.transformOrigin = 'top';
        }
        
        requestAnimationFrame(() => {
          menu.classList.remove('opacity-0', 'scale-95');
          menu.classList.add('opacity-100', 'scale-100');
        });
      } else {
        menu.classList.add('opacity-0', 'scale-95');
        arrow.style.transform = 'rotate(0deg)';
        setTimeout(() => menu.classList.add('hidden'), 200);
      }
    };
    
    document.addEventListener('click', () => {
      menu.classList.add('opacity-0', 'scale-95');
      arrow.style.transform = 'rotate(0deg)';
      setTimeout(() => menu.classList.add('hidden'), 200);
    });
  });
}

// Add a global scroll event listener to close any open suggest box or select menus on scroll
window.addEventListener('scroll', () => {
  document.querySelectorAll('.custom-select-menu, .custom-suggest-box').forEach(m => {
    m.classList.add('hidden', 'opacity-0', 'scale-95');
  });
  document.querySelectorAll('.custom-select-trigger span:last-child').forEach(arrow => {
    arrow.style.transform = 'rotate(0deg)';
  });
}, { passive: true });

export function renderHistory(deletedDashboards) {
  const container = document.getElementById('history-list');
  if (!container) return;
  container.innerHTML = '';

  if (!deletedDashboards || deletedDashboards.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)] text-center text-[var(--text-secondary)]">
        <span class="text-2xl mb-2">🗑️</span>
        <p class="text-xs font-semibold">Your trash history is empty.</p>
        <p class="text-[10px] text-gray-500 mt-1">Deleted dashboards will appear here so you can restore them.</p>
      </div>
    `;
    return;
  }

  deletedDashboards.forEach(d => {
    const deletedDate = d.deleted_at ? new Date(d.deleted_at).toLocaleString() : new Date(d.updated_at).toLocaleString();
    const item = document.createElement('div');
    item.className = "p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] space-y-3 hover:border-red-500/20 hover:shadow-md transition-all";
    
    // Header row
    const header = document.createElement('div');
    header.className = "flex items-center justify-between gap-4";
    header.innerHTML = `
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-bold text-[var(--text-primary)] truncate">${d.program_line || 'Untitled Program'}</span>
        <span class="text-[10px] text-gray-500 mt-1">Deleted: ${deletedDate}</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="restore-dash-btn-${d.id}" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer">
          Restore Program
        </button>
        <button id="delete-perm-dash-btn-${d.id}" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
          Destroy Forever
        </button>
      </div>
    `;
    item.appendChild(header);

    // Collapsible Snapshots section
    const versions = d.versions || [];
    if (versions.length > 0) {
      const toggleWrapper = document.createElement('div');
      toggleWrapper.className = "pt-2 border-t border-[var(--border-color)]/50";
      
      const versionsToggleBtn = document.createElement('button');
      versionsToggleBtn.className = "text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 focus:outline-none transition-all cursor-pointer";
      versionsToggleBtn.innerHTML = `<span>📁</span> View Saved Snapshots (${versions.length})`;
      
      const versionsContainer = document.createElement('div');
      versionsContainer.className = "hidden pl-4 border-l-2 border-indigo-500/20 mt-2 space-y-2 transition-all";
      
      versionsToggleBtn.onclick = () => {
        const isHidden = versionsContainer.classList.contains('hidden');
        if (isHidden) {
          versionsContainer.classList.remove('hidden');
          versionsToggleBtn.innerHTML = `<span>📂</span> Hide Saved Snapshots (${versions.length})`;
        } else {
          versionsContainer.classList.add('hidden');
          versionsToggleBtn.innerHTML = `<span>📁</span> View Saved Snapshots (${versions.length})`;
        }
      };

      versions.forEach(v => {
        const verRow = document.createElement('div');
        verRow.className = "flex items-center justify-between p-2 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[10px]";
        verRow.innerHTML = `
          <div class="flex flex-col min-w-0 pr-2">
            <span class="font-semibold text-[var(--text-primary)] truncate">${v.version_name || 'Snapshot'}</span>
            <span class="text-[9px] text-gray-500 mt-0.5">${new Date(v.created_at).toLocaleString()}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button id="restore-ver-btn-${v.id}" class="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 font-bold transition-all cursor-pointer text-[9px]">
              Restore State
            </button>
            <button id="delete-ver-btn-${v.id}" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold transition-all cursor-pointer text-[9px]">
              Delete
            </button>
          </div>
        `;
        versionsContainer.appendChild(verRow);

        const restoreVerBtn = verRow.querySelector(`#restore-ver-btn-${v.id}`);
        if (restoreVerBtn) {
          restoreVerBtn.onclick = () => {
            if (typeof window.restoreDeletedDashboardToVersion === 'function') {
              window.restoreDeletedDashboardToVersion(d.id, v.id, v.version_name);
            }
          };
        }

        const deleteVerBtn = verRow.querySelector(`#delete-ver-btn-${v.id}`);
        if (deleteVerBtn) {
          deleteVerBtn.onclick = () => {
            if (typeof window.deleteDeletedDashboardVersion === 'function') {
              window.deleteDeletedDashboardVersion(d.id, v.id);
            }
          };
        }
      });

      toggleWrapper.appendChild(versionsToggleBtn);
      toggleWrapper.appendChild(versionsContainer);
      item.appendChild(toggleWrapper);
    } else {
      const noVer = document.createElement('div');
      noVer.className = "text-[9px] text-gray-500 italic pl-1";
      noVer.textContent = "No saved version snapshots.";
      item.appendChild(noVer);
    }

    container.appendChild(item);

    // Bind parent actions
    item.querySelector(`#restore-dash-btn-${d.id}`).onclick = () => {
      if (typeof window.restoreDashboardAction === 'function') {
        window.restoreDashboardAction(d.id);
      }
    };
    item.querySelector(`#delete-perm-dash-btn-${d.id}`).onclick = () => {
      if (typeof window.deleteDashboardPermanentAction === 'function') {
        window.deleteDashboardPermanentAction(d.id);
      }
    };
  });
}

export function renderVersions(versions) {
  const container = document.getElementById('versions-list');
  if (!container) return;
  container.innerHTML = '';

  if (!versions || versions.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)] text-center text-[var(--text-secondary)]">
        <span class="text-2xl mb-2">🔖</span>
        <p class="text-xs font-semibold">No version snapshots saved.</p>
        <p class="text-[10px] text-gray-500 mt-1">Save a snapshot of the current dashboard using the bookmark icon or the button above.</p>
      </div>
    `;
    return;
  }

  versions.forEach(v => {
    const createdDate = new Date(v.created_at).toLocaleString();
    const item = document.createElement('div');
    item.className = "flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] hover:border-indigo-500/30 hover:bg-[var(--bg-hover)] transition-all";
    item.innerHTML = `
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-bold text-[var(--text-primary)] truncate">${v.version_name || 'Saved Snapshot'}</span>
        <span class="text-[10px] text-gray-500 mt-1">Saved: ${createdDate}</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="restore-ver-btn-${v.id}" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer">
          Jump Back
        </button>
        <button id="delete-ver-btn-${v.id}" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
          Delete
        </button>
      </div>
    `;

    container.appendChild(item);

    // Wire up events dynamically
    item.querySelector(`#restore-ver-btn-${v.id}`).onclick = () => {
      if (typeof window.restoreVersionAction === 'function') {
        window.restoreVersionAction(v.id, v.version_name);
      }
    };
    item.querySelector(`#delete-ver-btn-${v.id}`).onclick = () => {
      if (typeof window.deleteVersionAction === 'function') {
        window.deleteVersionAction(v.id);
      }
    };
  });
}
