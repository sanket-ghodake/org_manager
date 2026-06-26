/**
 * Sidebar Resizing & Toggling Logic (VS Code Style)
 */

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
});

function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const resizer = document.getElementById("sidebar-resizer");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");

  if (!sidebar || !resizer || !toggleBtn) {
    console.warn("Sidebar elements not found. Retrying in 50ms...");
    setTimeout(initSidebar, 50);
    return;
  }

  const MIN_WIDTH = 160;
  const MAX_WIDTH = 500;
  const SNAP_THRESHOLD = 110;
  const DEFAULT_WIDTH = 256;

  const headerLeft = document.getElementById("header-left");

  function updateHeaderWidth(width) {
    if (headerLeft) {
      headerLeft.style.width = `${width}px`;
      if (width <= 80) {
        headerLeft.classList.add("collapsed");
      } else {
        headerLeft.classList.remove("collapsed");
      }
    }
  }

  // Retrieve saved state
  let savedWidth = parseInt(localStorage.getItem("sidebar-width"), 10);
  if (isNaN(savedWidth)) savedWidth = DEFAULT_WIDTH;

  let isCollapsed = localStorage.getItem("sidebar-collapsed") === "true";

  // Apply initial state
  if (isCollapsed) {
    collapseSidebar(false); // don't animate on initial load
  } else {
    expandSidebar(savedWidth, false); // don't animate on initial load
  }

  // 1. Dragging functionality
  let startX, startWidth;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;

    document.body.classList.add("sidebar-dragging");
    resizer.classList.add("dragging");

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    const deltaX = e.clientX - startX;
    let newWidth = startWidth + deltaX;

    if (newWidth < SNAP_THRESHOLD) {
      // Snap to minimized
      sidebar.style.width = "64px";
      sidebar.classList.add("collapsed");
      isCollapsed = true;
      updateHeaderWidth(64);
      const chevron = document.getElementById("sidebar-toggle-chevron");
      if (chevron) chevron.style.transform = "rotate(180deg)";
    } else {
      // Enforce bounds
      if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
      if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

      sidebar.style.width = `${newWidth}px`;
      sidebar.classList.remove("collapsed");
      isCollapsed = false;
      savedWidth = newWidth;
      updateHeaderWidth(newWidth);
      const chevron = document.getElementById("sidebar-toggle-chevron");
      if (chevron) chevron.style.transform = "rotate(0deg)";
    }
  }

  function onMouseUp() {
    document.body.classList.remove("sidebar-dragging");
    resizer.classList.remove("dragging");

    // Save states to local storage
    localStorage.setItem("sidebar-collapsed", isCollapsed.toString());
    if (!isCollapsed) {
      localStorage.setItem("sidebar-width", savedWidth.toString());
    }

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  // 2. Toggle functions
  function collapseSidebar(animate = true) {
    if (!animate) {
      sidebar.classList.add("no-transition");
      if (headerLeft) headerLeft.classList.add("no-transition");
    }
    sidebar.classList.add("collapsed");
    sidebar.style.width = "64px";
    isCollapsed = true;
    localStorage.setItem("sidebar-collapsed", "true");
    updateHeaderWidth(64);

    const chevron = document.getElementById("sidebar-toggle-chevron");
    if (chevron) chevron.style.transform = "rotate(180deg)";

    if (!animate) {
      // Force repaint then remove class
      sidebar.offsetHeight;
      sidebar.classList.remove("no-transition");
      if (headerLeft) headerLeft.classList.remove("no-transition");
    }
  }

  function expandSidebar(width, animate = true) {
    if (!animate) {
      sidebar.classList.add("no-transition");
      if (headerLeft) headerLeft.classList.add("no-transition");
    }
    sidebar.classList.remove("collapsed");
    sidebar.style.width = `${width}px`;
    isCollapsed = false;
    localStorage.setItem("sidebar-collapsed", "false");
    updateHeaderWidth(width);

    const chevron = document.getElementById("sidebar-toggle-chevron");
    if (chevron) chevron.style.transform = "rotate(0deg)";

    if (!animate) {
      sidebar.offsetHeight;
      sidebar.classList.remove("no-transition");
      if (headerLeft) headerLeft.classList.remove("no-transition");
    }
  }

  function toggleSidebar() {
    if (isCollapsed) {
      expandSidebar(savedWidth, true);
    } else {
      collapseSidebar(true);
    }
  }

  window.toggleSidebar = toggleSidebar;

  // Bind click event
  toggleBtn.addEventListener("click", toggleSidebar);

  // Prevent drag when clicking toggle button
  toggleBtn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  // 3. Double click resizer to toggle
  resizer.addEventListener("dblclick", toggleSidebar);

  // 4. Ctrl+B keyboard shortcut
  window.addEventListener("keydown", (e) => {
    // Check for Ctrl+B (or Cmd+B for Mac/Meta)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
    }
  });
}
