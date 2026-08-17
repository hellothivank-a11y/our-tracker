// ============================================================================
// 0. FIREBASE REALTIME CLOUD BACKEND INTEGRATION
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCi8Pg2cBKRZJSxmguH6DAqEEFkzTElLs4",
  authDomain: "couple-tracker-app-8b186.firebaseapp.com",
  projectId: "couple-tracker-app-8b186",
  storageBucket: "couple-tracker-app-8b186.firebasestorage.app",
  messagingSenderId: "1020823544500",
  appId: "1:1020823544500:web:c47e4ffb42095108bb6de1"
};

let db = null;
let isFirebaseInitialized = false;
let isApplyingRemoteSnapshot = false;
let cloudSaveTimer = null;

function updateCloudSyncBadge(status) {
  const badge = document.getElementById("cloudSyncStatus");
  if (!badge) return;
  if (status === "synced") {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shrink-0"></span><span class="text-emerald-500 dark:text-emerald-400 font-medium">Synced</span>`;
  } else if (status === "syncing") {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping shrink-0"></span><span class="text-sky-400 font-medium">Syncing...</span>`;
  } else if (status === "offline") {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0"></span><span class="text-zinc-500">Local Only</span>`;
  } else if (status === "error") {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span><span class="text-rose-400 font-medium">Sync Error</span>`;
  }
}

function initFirebase() {
  try {
    if (typeof firebase !== "undefined") {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      isFirebaseInitialized = true;
      updateCloudSyncBadge("synced");
      subscribeToCloudData();
    } else {
      updateCloudSyncBadge("offline");
    }
  } catch (err) {
    console.warn("Firebase Init Notice:", err);
    updateCloudSyncBadge("offline");
  }
}

function syncDomainToCloud() {
  if (!isFirebaseInitialized || !db || isApplyingRemoteSnapshot) return;
  updateCloudSyncBadge("syncing");
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      await db.collection("nexus_study_workspace").doc("main_study_data").set({
        categories: AppState.studies.categories,
        items: AppState.studies.items,
        rootColumns: AppState.studies.rootTableColumns || [],
        todos: AppState.studies.todos || [],
        scratchpad: localStorage.getItem("nexus_study_scratchpad") || "",
        homeWidget: localStorage.getItem("nexus_home_widget") || "dayschools",
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      updateCloudSyncBadge("synced");
    } catch (e) {
      console.warn("Cloud save error:", e);
      updateCloudSyncBadge("error");
    }
  }, 450);
}

function subscribeToCloudData() {
  if (!isFirebaseInitialized || !db) return;
  db.collection("nexus_study_workspace").doc("main_study_data")
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        isApplyingRemoteSnapshot = true;
        let hasUpdates = false;

        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          AppState.studies.categories = data.categories;
          localStorage.setItem(STORAGE_KEYS.STUDIES_CATEGORIES, JSON.stringify(AppState.studies.categories));
          hasUpdates = true;
        }
        if (data.items && Array.isArray(data.items)) {
          AppState.studies.items = data.items;
          localStorage.setItem(STORAGE_KEYS.STUDIES_ITEMS, JSON.stringify(AppState.studies.items));
          hasUpdates = true;
        }
        if (data.rootColumns && Array.isArray(data.rootColumns)) {
          AppState.studies.rootTableColumns = data.rootColumns;
          localStorage.setItem(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, JSON.stringify(AppState.studies.rootTableColumns));
          hasUpdates = true;
        }
        if (data.todos && Array.isArray(data.todos)) {
          AppState.studies.todos = data.todos;
          localStorage.setItem(STORAGE_KEYS.STUDIES_TODOS, JSON.stringify(AppState.studies.todos));
          hasUpdates = true;
        }
        if (data.scratchpad !== undefined) {
          localStorage.setItem("nexus_study_scratchpad", data.scratchpad);
        }
        if (data.homeWidget) {
          localStorage.setItem("nexus_home_widget", data.homeWidget);
        }

        if (hasUpdates) {
          renderHierarchicalSidebar();
          syncAllWorkspaceViews();
        }
        updateCloudSyncBadge("synced");
        isApplyingRemoteSnapshot = false;
      } else {
        syncDomainToCloud();
      }
    }, (err) => {
      console.warn("Firestore snapshot listener:", err);
      updateCloudSyncBadge("offline");
    });
}

/**
 * ============================================================================
 * Nexus Workspace Engine — Domain Separation & Modular State Architecture
 * Studies Master Overview, Priority Engine, Customizable Data Table & Multi-Views
 * ============================================================================
 */

// ============================================================================
// 1. DATE NORMALIZATION & UTILITIES
// ============================================================================

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof val === 'string') {
    return val.split('T')[0].trim();
  }
  return String(val);
}

function formatPrettyDate(dateStr) {
  if (!dateStr) return 'Selected Date';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
}

// ============================================================================
// 2. MODULAR DOMAIN STATE ARCHITECTURE (AppState)
// ============================================================================
const NOTION_COLORS = [
  { key: "gray", label: "Gray", tagClass: "notion-tag-gray", swatchClass: "gray" },
  { key: "brown", label: "Brown", tagClass: "notion-tag-brown", swatchClass: "brown" },
  { key: "orange", label: "Orange", tagClass: "notion-tag-orange", swatchClass: "orange" },
  { key: "yellow", label: "Yellow", tagClass: "notion-tag-yellow", swatchClass: "yellow" },
  { key: "green", label: "Green", tagClass: "notion-tag-green", swatchClass: "green" },
  { key: "blue", label: "Blue", tagClass: "notion-tag-blue", swatchClass: "blue" },
  { key: "purple", label: "Purple", tagClass: "notion-tag-purple", swatchClass: "purple" },
  { key: "pink", label: "Pink", tagClass: "notion-tag-pink", swatchClass: "pink" },
  { key: "red", label: "Red", tagClass: "notion-tag-red", swatchClass: "red" }
];

const PRIORITY_LEVELS = [
  { key: "Urgent", label: "Urgent / High", color: "red", badgeClass: "notion-priority-urgent" },
  { key: "Medium", label: "Medium", color: "yellow", badgeClass: "notion-priority-medium" },
  { key: "Low", label: "Low", color: "blue", badgeClass: "notion-priority-low" },
  { key: "None", label: "None", color: "gray", badgeClass: "notion-priority-none" }
];

const DEFAULT_TABLE_COLUMNS = [
  { id: "col_title", key: "title", name: "Task / Item Name", type: "title", width: "30%" },
  { id: "col_status", key: "status", name: "Status", type: "status", width: "14%" },
  { id: "col_priority", key: "priority", name: "Priority", type: "priority", width: "13%" },
  { id: "col_date", key: "date", name: "Date Schedule", type: "date", width: "18%" },
  { id: "col_category", key: "categoryId", name: "Scope / Module", type: "category", width: "13%" },
  { id: "col_url", key: "url", name: "Attachment / URL", type: "url", width: "12%" }
];

const STUDY_QUOTES = [
  "\"Deep work is the superpower of the 21st century.\"",
  "\"Focus is a muscle. Train it every session.\"",
  "\"Small daily disciplines compound into mastery.\"",
  "\"Simplicity is the prerequisite for reliability.\"",
  "\"Done is better than perfect. Keep momentum.\"",
  "\"Protect your peak hours with relentless focus.\""
];

// Top-Level Domain Segregated State Container
const AppState = {
  // 1. Studies Domain (Active Implementation Focus)
  studies: {
    rootViews: ["calendar", "table", "board", "todo", "timeline"],
    rootTableColumns: [...DEFAULT_TABLE_COLUMNS],
    categories: [
      { id: "sub_dayschool", title: "Day Schools", view: "media", icon: "video", activeViews: ["media", "calendar", "table"], tableColumns: [...DEFAULT_TABLE_COLUMNS] },
      { id: "sub_viva", title: "Viva", view: "calendar", icon: "calendar", activeViews: ["calendar", "table", "board"], tableColumns: [...DEFAULT_TABLE_COLUMNS] },
      { id: "sub_exams", title: "Exams", view: "calendar", icon: "file-text", activeViews: ["calendar", "table"], tableColumns: [...DEFAULT_TABLE_COLUMNS] },
      { id: "sub_assignments", title: "Assignments", view: "table", icon: "clipboard-check", activeViews: ["table", "board", "calendar", "todo"], tableColumns: [...DEFAULT_TABLE_COLUMNS] }
    ],
    items: [], // Scoped Day School recordings, Viva dates, Exam schedules, Assignment tasks
    todos: []  // Studies-specific Quick Focus / Scratchpad items
  },

  // 2. Office Domain (Independent Namespace)
  office: {
    events: [],
    otLogs: [],
    leaves: [],
    todos: [],
    otConfig: {
      normalHours: 8,
      otHours: 18,
      hourlyRate: 25
    }
  },

  // 3. Financial Domain (Independent Namespace)
  financial: {
    transactions: [],
    budgets: [],
    groceryList: []
  },

  // 4. Global UI & Runtime State
  ui: {
    theme: "dark",
    currentView: "view-today",
    activeDomain: "studies",        // 'studies' | 'office' | 'financial'
    activeSubPageId: "studies_root", // 'studies_root' or specific sub-category id
    activeScopedLayout: "calendar",  // 'table' | 'board' | 'calendar' | 'media' | 'timeline' | 'todo'
    scopedStatusFilter: "all",
    calendar: {
      currentDate: new Date(),
      selectedDateStr: getTodayISO()
    },
    scopedCalendarDate: new Date(),
    inspectorSelectedDateStr: getTodayISO(),
    pomo: {
      totalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      running: false,
      interval: null
    },
    activePageItem: null,
    activePropertyContextMenu: null,
    activeSelectPropertyContext: null,
    activeStatusPropertyContext: null,
    activePriorityPropertyContext: null,
    activeTagEditOption: null,
    activeStatusEditOption: null,
    activeEditingPropertyIndex: null,
    activeColumnContext: null
  },

  // 5. Shared Metadata / Select Options Cache
  selectOptionsCache: [
    { id: "opt_cs", name: "Computer Science", color: "pink" },
    { id: "opt_ds", name: "Distributed Systems", color: "purple" },
    { id: "opt_ml", name: "Machine Learning", color: "orange" },
    { id: "opt_res", name: "Research Vault", color: "blue" },
    { id: "opt_math", name: "Mathematics", color: "green" },
    { id: "opt_high", name: "High Priority", color: "red" },
    { id: "opt_mid", name: "Medium Priority", color: "yellow" }
  ],

  // 6. Shared Status Options Cache
  statusOptionsCache: [
    { id: "st_not_started", name: "Not Started", color: "gray" },
    { id: "st_in_progress", name: "In Progress", color: "yellow" },
    { id: "st_review", name: "Review", color: "purple" },
    { id: "st_paused", name: "Paused", color: "blue" },
    { id: "st_done", name: "Done", color: "green" }
  ]
};

// Domain Storage Keys
const STORAGE_KEYS = {
  STUDIES_ITEMS: "nexus_studies_items_v4",
  STUDIES_CATEGORIES: "nexus_studies_categories_v4",
  STUDIES_TODOS: "nexus_studies_todos_v4",
  STUDIES_ROOT_VIEWS: "nexus_studies_root_views_v4",
  STUDIES_ROOT_COLUMNS: "nexus_studies_root_columns_v4",
  SELECT_OPTIONS: "nexus_select_options_v4",
  STATUS_OPTIONS: "nexus_status_options_v4"
};

function saveDomain(key, data, syncCloud = true) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (syncCloud) {
      syncDomainToCloud();
    }
  } catch (e) {
    console.error("Local storage error:", e);
  }
}

function getDomain(key, defaultVal) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

// ============================================================================
// 3. PRIORITY HELPER & FAST CYCLING ENGINE
// ============================================================================

function getPriorityInfo(priorityKey) {
  const normalized = (priorityKey || "None").trim();
  const match = PRIORITY_LEVELS.find(p => p.key.toLowerCase() === normalized.toLowerCase()) || PRIORITY_LEVELS[3];
  return match;
}

function cyclePriority(item) {
  const current = (item.priority || "None").trim();
  let nextPriority = "Urgent";

  if (current.toLowerCase() === "urgent" || current.toLowerCase() === "high") {
    nextPriority = "Medium";
  } else if (current.toLowerCase() === "medium") {
    nextPriority = "Low";
  } else if (current.toLowerCase() === "low") {
    nextPriority = "None";
  } else {
    nextPriority = "Urgent";
  }

  item.priority = nextPriority;
  
  // Sync to property array if exists
  if (item.properties) {
    const pProp = item.properties.find(p => p.type === "priority");
    if (pProp) {
      pProp.value = nextPriority;
      pProp.color = getPriorityInfo(nextPriority).color;
    }
  }

  saveStudyItem(item, { showNotification: false });
  showToast(`Priority: ${nextPriority}`, "info");
}

function cycleStatus(item) {
  const current = (item.status || "not-started").toLowerCase();
  let nextStatus = "in-progress";

  if (current === "not-started") {
    nextStatus = "in-progress";
  } else if (current === "in-progress") {
    nextStatus = "review";
  } else if (current === "review") {
    nextStatus = "done";
  } else {
    nextStatus = "not-started";
  }

  item.status = nextStatus;
  item.completed = nextStatus === "done";

  // Sync to status property if exists
  if (item.properties) {
    const sProp = item.properties.find(p => p.type === "status");
    if (sProp) {
      const statusObj = AppState.statusOptionsCache.find(s => s.name.toLowerCase().replace(/\s+/g, '-') === nextStatus) || { name: capitalize(nextStatus), color: "gray" };
      sProp.value = statusObj.name;
      sProp.color = statusObj.color;
    }
  }

  saveStudyItem(item, { showNotification: false });
  showToast(`Status: ${capitalize(nextStatus)}`, "info");
}

// ============================================================================
// 4. STUDIES DOMAIN DATA ENGINE & TWO-WAY SYNC
// ============================================================================

function saveStudyItem(itemObj, options = { showNotification: true }) {
  if (!itemObj || !itemObj.id) return;

  itemObj.date = normalizeDateStr(itemObj.date);
  if (itemObj.endDate) {
    itemObj.endDate = normalizeDateStr(itemObj.endDate);
  }

  if (!itemObj.priority) {
    itemObj.priority = "None";
  }

  // If adding from root, default to first category (Day Schools)
  if (!itemObj.categoryId || itemObj.categoryId === "studies_root") {
    itemObj.categoryId = AppState.studies.categories[0]?.id || "sub_dayschool";
  }

  const existingIndex = AppState.studies.items.findIndex(e => e.id === itemObj.id);
  const isNew = existingIndex < 0;
  if (existingIndex >= 0) {
    AppState.studies.items[existingIndex] = { ...AppState.studies.items[existingIndex], ...itemObj };
  } else {
    AppState.studies.items.push(itemObj);
  }

  saveDomain(STORAGE_KEYS.STUDIES_ITEMS, AppState.studies.items);
  syncAllWorkspaceViews();

  if (options.showNotification) {
    if (isNew) {
      showToast("Record added successfully", "success");
    } else {
      showToast("Changes saved", "info");
    }
  }
}

function deleteStudyItem(itemId, options = { showNotification: true }) {
  if (!itemId) return;

  const target = AppState.studies.items.find(e => e.id === itemId);
  const targetTitle = target ? target.title : "Record";

  AppState.studies.items = AppState.studies.items.filter(e => e.id !== itemId);
  saveDomain(STORAGE_KEYS.STUDIES_ITEMS, AppState.studies.items);
  syncAllWorkspaceViews();

  if (options.showNotification) {
    showToast(`Record deleted`, "error");
  }
}

function getAllWorkspaceEvents() {
  return [...AppState.studies.items];
}

function syncAllWorkspaceViews() {
  renderTodayChecklist();
  renderDashboardCalendar();
  renderUpcomingDeadlines();
  renderHomeBottomWidget();
  renderSmartCalendar();

  if (AppState.ui.currentView === "view-project-scoped") {
    renderScopedProjectView(AppState.ui.activeSubPageId);
  }
}

// ============================================================================
// 5. THEME ENGINE (DARK / LIGHT / SYSTEM SYNC)
// ============================================================================
function initThemeEngine() {
  const savedTheme = localStorage.getItem("nexus_theme") || "dark";
  AppState.ui.theme = savedTheme;
  applyTheme(savedTheme);

  const themeButtons = document.querySelectorAll(".theme-btn");
  themeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-theme");
      if (selected) {
        AppState.ui.theme = selected;
        localStorage.setItem("nexus_theme", selected);
        applyTheme(selected);
        showToast(`Theme set to ${selected}`, "info");
      }
    });
  });

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    if (AppState.ui.theme === "system") {
      applyTheme("system");
    }
  });
}

function applyTheme(themeMode) {
  const root = document.documentElement;
  const isDark = themeMode === "dark" || (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const themeButtons = document.querySelectorAll(".theme-btn");
  themeButtons.forEach(btn => {
    const btnTheme = btn.getAttribute("data-theme");
    if (btnTheme === themeMode) {
      btn.classList.add("bg-[var(--bg-canvas)]", "text-[var(--text-primary)]", "shadow-sm");
      btn.classList.remove("text-zinc-500");
    } else {
      btn.classList.remove("bg-[var(--bg-canvas)]", "text-[var(--text-primary)]", "shadow-sm");
      btn.classList.add("text-zinc-500");
    }
  });

  const themeLabel = document.getElementById("themeModeLabel");
  if (themeLabel) {
    themeLabel.textContent = themeMode;
  }
}

// ============================================================================
// 6. CENTRALIZED CONFIRMATION MODAL CONTROLLER
// ============================================================================
let pendingDeleteCallback = null;
const deleteConfirmModal = document.getElementById("confirmationModal") || document.getElementById("deleteConfirmModal");
const deleteModalTitle = document.getElementById("deleteModalTitle");
const deleteModalDesc = document.getElementById("deleteModalDesc");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");

function confirmDeletion({ title = "Delete Item?", desc = "Are you sure you want to delete this item? This action cannot be undone.", onConfirm }) {
  if (!deleteConfirmModal) {
    if (onConfirm) onConfirm();
    return;
  }

  if (deleteModalTitle) {
    deleteModalTitle.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-rose-500 shrink-0"></i><span>${escapeHtml(title)}</span>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  if (deleteModalDesc) {
    deleteModalDesc.textContent = desc;
  }

  pendingDeleteCallback = onConfirm;
  deleteConfirmModal.classList.remove("hidden");

  setTimeout(() => {
    if (cancelDeleteBtn) cancelDeleteBtn.focus();
  }, 50);
}

function closeDeleteModal() {
  if (!deleteConfirmModal) return;
  deleteConfirmModal.classList.add("hidden");
  pendingDeleteCallback = null;
}

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", () => {
    if (pendingDeleteCallback) {
      pendingDeleteCallback();
    }
    closeDeleteModal();
  });
}

[cancelDeleteBtn, closeDeleteModalBtn].forEach(btn => {
  if (btn) btn.addEventListener("click", closeDeleteModal);
});

if (deleteConfirmModal) {
  deleteConfirmModal.addEventListener("click", (e) => {
    if (e.target === deleteConfirmModal) {
      closeDeleteModal();
    }
  });
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (deleteConfirmModal && !deleteConfirmModal.classList.contains("hidden")) {
      closeDeleteModal();
      return;
    }
    closeCalendarDayInspector();
    closePrioritySelectPopover();
    closeAddColumnPopover();
    closeColumnContextMenu();
    closePropertyEditPopover();
    closeStatusPopovers();
    closeTagPopovers();
    closePropertyContextMenu();
    closePageModal();
    closeUniversalAddModal();
    const openModals = document.querySelectorAll(".fixed.z-50:not(.hidden)");
    openModals.forEach(m => m.classList.add("hidden"));
  }
});

// ============================================================================
// 7. SEED & LOAD DOMAIN DATA
// ============================================================================
function seedInitialDomainData() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const fmtDate = (offsetDays) => {
    const d = new Date(year, month, today.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Seed Studies Items
  if (!getDomain(STORAGE_KEYS.STUDIES_ITEMS, null)) {
    const initialStudiesItems = [
      {
        id: "evt_ds_1",
        categoryId: "sub_dayschool",
        module: "dayschool",
        title: "Day School 03 — Concurrency & Raft Protocol",
        priority: "Urgent",
        date: fmtDate(0),
        endDate: "",
        isRange: false,
        includeTime: true,
        startTime: "10:00",
        endTime: "12:00",
        color: "blue",
        status: "not-started",
        completed: false,
        notes: "Live recorded session on Raft leader election and log replication benchmarks.",
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
          { id: "p2", name: "Priority", type: "priority", value: "Urgent", color: "red" },
          { id: "p3", name: "Subject", type: "select", value: "Distributed Systems", color: "purple" }
        ],
        meta: {
          subject: "Distributed Systems (CS502)",
          videoUrl: "https://zoom.us",
          watched: false
        }
      },
      {
        id: "evt_ds_2",
        categoryId: "sub_dayschool",
        module: "dayschool",
        title: "Day School 04 — Memory Paging & TLB Hit Ratios",
        priority: "Medium",
        date: fmtDate(0),
        endDate: "",
        isRange: false,
        includeTime: true,
        startTime: "14:30",
        endTime: "16:30",
        color: "pink",
        status: "not-started",
        completed: false,
        notes: "Virtual memory multi-level page table architecture and cache benchmarks.",
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
          { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" },
          { id: "p3", name: "Subject", type: "select", value: "Computer Science", color: "pink" }
        ],
        meta: {
          subject: "Computer Science (CS401)",
          videoUrl: "https://zoom.us",
          watched: false
        }
      },
      {
        id: "evt_viva_1",
        categoryId: "sub_viva",
        module: "viva",
        title: "Distributed Systems Final Viva Defense",
        priority: "Urgent",
        date: fmtDate(1),
        endDate: "",
        isRange: false,
        includeTime: true,
        startTime: "10:00",
        endTime: "11:30",
        color: "purple",
        status: "review",
        completed: false,
        notes: "Prepare presentation slides on Paxos vs Raft consensus algorithms.",
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Review", color: "purple" },
          { id: "p2", name: "Priority", type: "priority", value: "Urgent", color: "red" },
          { id: "p3", name: "Subject", type: "select", value: "Distributed Systems", color: "purple" }
        ],
        meta: { subject: "CS502" }
      },
      {
        id: "evt_exam_1",
        categoryId: "sub_exams",
        module: "exam",
        title: "Operating Systems & Concurrency Final Examination",
        priority: "Urgent",
        date: fmtDate(5),
        endDate: "",
        isRange: false,
        includeTime: true,
        startTime: "09:00",
        endTime: "12:00",
        color: "red",
        status: "not-started",
        completed: false,
        notes: "Exam covering processes, threads, semaphores, memory management, and file systems.",
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
          { id: "p2", name: "Priority", type: "priority", value: "Urgent", color: "red" },
          { id: "p3", name: "Subject", type: "select", value: "Computer Science", color: "pink" }
        ],
        meta: { subject: "CS401" }
      },
      {
        id: "evt_assign_1",
        categoryId: "sub_assignments",
        module: "assignment",
        title: "Machine Learning Assignment 3 Kaggle Submission",
        priority: "Medium",
        date: fmtDate(2),
        endDate: "",
        isRange: false,
        includeTime: false,
        color: "orange",
        status: "done",
        completed: true,
        notes: "Submit CNN Jupyter notebook and benchmark accuracy score.",
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Done", color: "green" },
          { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" },
          { id: "p3", name: "Subject", type: "select", value: "Machine Learning", color: "orange" }
        ],
        meta: { subject: "Machine Learning (CS404)" }
      },
      {
        id: "evt_assign_2",
        categoryId: "sub_assignments",
        module: "task",
        title: "Complete Chapter 5 Exercise: Deadlock Detection Algorithm",
        priority: "Low",
        date: fmtDate(0),
        endDate: "",
        isRange: false,
        includeTime: false,
        color: "yellow",
        status: "not-started",
        completed: false,
        notes: "Implement Banker's Algorithm in Python.",
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
          { id: "p2", name: "Priority", type: "priority", value: "Low", color: "blue" }
        ],
        meta: {}
      }
    ];
    saveDomain(STORAGE_KEYS.STUDIES_ITEMS, initialStudiesItems);
  }

  // Seed Studies Todos
  if (!getDomain(STORAGE_KEYS.STUDIES_TODOS, null)) {
    const initialStudiesTodos = [
      { id: "st1", text: "Review Chapter 4: Memory Management & Paging", completed: true, subject: "Computer Science" },
      { id: "st2", text: "Solve practice quiz 4B on Virtual Memory", completed: false, subject: "Computer Science" }
    ];
    saveDomain(STORAGE_KEYS.STUDIES_TODOS, initialStudiesTodos);
  }

  if (!getDomain(STORAGE_KEYS.OFFICE, null)) {
    saveDomain(STORAGE_KEYS.OFFICE, AppState.office);
  }

  if (!getDomain(STORAGE_KEYS.FINANCIAL, null)) {
    saveDomain(STORAGE_KEYS.FINANCIAL, AppState.financial);
  }
}

function loadStateFromStorage() {
  seedInitialDomainData();
  
  AppState.studies.items = getDomain(STORAGE_KEYS.STUDIES_ITEMS, []);
  AppState.studies.categories = getDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
  AppState.studies.rootViews = getDomain(STORAGE_KEYS.STUDIES_ROOT_VIEWS, AppState.studies.rootViews);
  AppState.studies.rootTableColumns = getDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns || DEFAULT_TABLE_COLUMNS);
  AppState.studies.todos = getDomain(STORAGE_KEYS.STUDIES_TODOS, []);
  
  AppState.office = getDomain(STORAGE_KEYS.OFFICE, AppState.office);
  AppState.financial = getDomain(STORAGE_KEYS.FINANCIAL, AppState.financial);

  AppState.selectOptionsCache = getDomain(STORAGE_KEYS.SELECT_OPTIONS, AppState.selectOptionsCache);
  AppState.statusOptionsCache = getDomain(STORAGE_KEYS.STATUS_OPTIONS, AppState.statusOptionsCache);
}

// ============================================================================
// 8. SIDEBAR RENDERING (Studies Root Default to Master Overview Calendar)
// ============================================================================
const sidebarCategoriesContainer = document.getElementById("sidebarCategoriesContainer");
const addCustomCategoryBtn = document.getElementById("addCustomCategoryBtn");
const categoryModal = document.getElementById("categoryModal");
const closeCategoryModalBtn = document.getElementById("closeCategoryModalBtn");
const cancelCategoryModalBtn = document.getElementById("cancelCategoryModalBtn");
const categoryForm = document.getElementById("categoryForm");

const subItemModal = document.getElementById("subItemModal");
const closeSubItemModalBtn = document.getElementById("closeSubItemModalBtn");
const cancelSubItemModalBtn = document.getElementById("cancelSubItemModalBtn");
const subItemForm = document.getElementById("subItemForm");

let subSortableInstances = [];

function renderHierarchicalSidebar() {
  if (!sidebarCategoriesContainer) return;
  sidebarCategoriesContainer.innerHTML = "";

  subSortableInstances.forEach(inst => inst.destroy && inst.destroy());
  subSortableInstances = [];

  // Studies Root Workspace Accordion
  const studiesBlock = document.createElement("div");
  studiesBlock.className = "category-block mb-2";

  const isStudiesRootActive = AppState.ui.currentView === "view-project-scoped" && AppState.ui.activeSubPageId === "studies_root";

  const studiesHeaderEl = document.createElement("div");
  studiesHeaderEl.className = `sidebar-item-row category-header-row group ${isStudiesRootActive ? 'active' : ''}`;
  
  studiesHeaderEl.innerHTML = `
    <div class="drag-gutter category-drag-handle" title="Reorder">
      <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
    </div>

    <div class="row-label-group flex items-center gap-2" id="studiesRootNav">
      <button class="accordion-toggle-btn w-4 h-4 flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]" id="studiesAccordionToggle">
        <i data-lucide="chevron-right" class="accordion-chevron expanded"></i>
      </button>
      <i data-lucide="book-open" class="sidebar-icon text-indigo-500"></i>
      <span class="category-title-text truncate">Studies</span>
    </div>

    <div class="row-actions">
      <button class="action-btn add-subitem-btn" id="addStudySubModuleBtn" title="Add Study Sub-module">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `;

  const studiesSubContainer = document.createElement("div");
  studiesSubContainer.className = "sub-items-container space-y-0.5 accordion-content";
  studiesSubContainer.id = "studiesSubItemsContainer";

  AppState.studies.categories.forEach(sub => {
    const itemEl = document.createElement("div");
    const isSubActive = AppState.ui.currentView === "view-project-scoped" && AppState.ui.activeSubPageId === sub.id;
    itemEl.className = `sidebar-item-row subitem-row group ${isSubActive ? 'active' : ''}`;
    itemEl.dataset.subId = sub.id;

    itemEl.innerHTML = `
      <div class="drag-gutter item-drag-handle" title="Drag to reorder">
        <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
      </div>

      <div class="row-label-group flex items-center gap-2">
        <i data-lucide="${sub.icon || 'file-text'}" class="sidebar-icon"></i>
        <span class="subitem-title-text truncate">${escapeHtml(sub.title)}</span>
      </div>

      <div class="row-actions">
        <button class="action-btn delete-btn delete-study-sub-btn" data-sub-id="${sub.id}" title="Delete ${escapeHtml(sub.title)}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    itemEl.querySelector(".row-label-group").addEventListener("click", () => {
      navigateToStudySubPage(sub.id, sub.view || "table");
    });

    const deleteBtn = itemEl.querySelector(".delete-study-sub-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDeletion({
          title: `Delete ${sub.title}?`,
          desc: "This will permanently remove this module and all its associated records. This action cannot be undone.",
          onConfirm: () => {
            AppState.studies.categories = AppState.studies.categories.filter(s => s.id !== sub.id);
            AppState.studies.items = AppState.studies.items.filter(item => item.categoryId !== sub.id);
            saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
            saveDomain(STORAGE_KEYS.STUDIES_ITEMS, AppState.studies.items);
            renderHierarchicalSidebar();
            if (AppState.ui.activeSubPageId === sub.id) {
              navigateToStudiesRoot();
            } else if (AppState.ui.currentView === "view-today") {
              renderHomeBottomWidget();
            }
            showToast(`Deleted ${sub.title}`, "error");
          }
        });
      });
    }

    studiesSubContainer.appendChild(itemEl);
  });

  // Clicking the main "Studies" root navigates to Studies Master Overview & Calendar
  studiesHeaderEl.querySelector("#studiesRootNav").addEventListener("click", () => {
    navigateToStudiesRoot();
  });

  const toggleBtn = studiesHeaderEl.querySelector("#studiesAccordionToggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      studiesSubContainer.classList.toggle("collapsed");
      toggleBtn.querySelector("i").classList.toggle("expanded");
    });
  }

  const addSubBtn = studiesHeaderEl.querySelector("#addStudySubModuleBtn");
  if (addSubBtn) {
    addSubBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      subItemModal.classList.remove("hidden");
    });
  }

  studiesBlock.appendChild(studiesHeaderEl);
  studiesBlock.appendChild(studiesSubContainer);
  sidebarCategoriesContainer.appendChild(studiesBlock);

  // Future Isolated Namespaces
  const officeBlock = createDomainSidebarSection("Office Work", "briefcase", "office", [
    { title: "Sprint Tasks", icon: "kanban", action: () => showToast("Office module namespace ready", "info") },
    { title: "OT & Time Logs", icon: "calculator", action: () => navigateToView("view-work") }
  ]);
  sidebarCategoriesContainer.appendChild(officeBlock);

  const financialBlock = createDomainSidebarSection("Financial", "wallet", "financial", [
    { title: "Expenses & Budgets", icon: "receipt", action: () => showToast("Financial module namespace ready", "info") }
  ]);
  sidebarCategoriesContainer.appendChild(financialBlock);

  const sortableSub = new Sortable(studiesSubContainer, {
    animation: 150,
    handle: '.item-drag-handle',
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      const newCats = [];
      studiesSubContainer.querySelectorAll(".subitem-row").forEach(row => {
        const id = row.dataset.subId;
        const match = AppState.studies.categories.find(s => s.id === id);
        if (match) newCats.push(match);
      });
      AppState.studies.categories = newCats;
      saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
    }
  });
  subSortableInstances.push(sortableSub);

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function createDomainSidebarSection(title, icon, domainKey, items) {
  const block = document.createElement("div");
  block.className = "category-block mb-2";

  const headerEl = document.createElement("div");
  headerEl.className = "sidebar-item-row category-header-row group";
  headerEl.innerHTML = `
    <div class="drag-gutter"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></div>
    <div class="row-label-group flex items-center gap-2">
      <button class="accordion-toggle-btn w-4 h-4 flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <i data-lucide="chevron-right" class="accordion-chevron expanded"></i>
      </button>
      <i data-lucide="${icon}" class="sidebar-icon"></i>
      <span class="category-title-text truncate">${escapeHtml(title)}</span>
    </div>
  `;

  const subContainer = document.createElement("div");
  subContainer.className = "sub-items-container space-y-0.5 accordion-content";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "sidebar-item-row subitem-row group";
    row.innerHTML = `
      <div class="drag-gutter"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></div>
      <div class="row-label-group flex items-center gap-2">
        <i data-lucide="${item.icon}" class="sidebar-icon"></i>
        <span class="subitem-title-text truncate">${escapeHtml(item.title)}</span>
      </div>
    `;
    row.addEventListener("click", item.action);
    subContainer.appendChild(row);
  });

  headerEl.querySelector(".accordion-toggle-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    subContainer.classList.toggle("collapsed");
    headerEl.querySelector("i.accordion-chevron").classList.toggle("expanded");
  });

  block.appendChild(headerEl);
  block.appendChild(subContainer);
  return block;
}

if (addCustomCategoryBtn) {
  addCustomCategoryBtn.addEventListener("click", () => {
    categoryModal.classList.remove("hidden");
  });
}
[closeCategoryModalBtn, cancelCategoryModalBtn].forEach(btn => {
  if (btn) btn.addEventListener("click", () => categoryModal.classList.add("hidden"));
});

if (categoryForm) {
  categoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("catTitleInput").value.trim();
    const icon = document.getElementById("catIconInput").value || "book-open";
    const templateInput = document.querySelector('input[name="catTemplate"]:checked');
    const primaryView = templateInput ? templateInput.value : "table";
    if (!title) return;

    const newSub = {
      id: "sub_study_" + Date.now(),
      title: title,
      icon: icon,
      view: primaryView,
      activeViews: [primaryView],
      tableColumns: [...DEFAULT_TABLE_COLUMNS]
    };

    AppState.studies.categories.push(newSub);
    saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
    renderHierarchicalSidebar();
    categoryModal.classList.add("hidden");
    categoryForm.reset();

    navigateToStudySubPage(newSub.id, primaryView);
    showToast(`Study module "${title}" created`, "info");
  });
}

[closeSubItemModalBtn, cancelSubItemModalBtn].forEach(btn => {
  if (btn) btn.addEventListener("click", () => subItemModal.classList.add("hidden"));
});

if (subItemForm) {
  subItemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("subItemNameInput").value.trim();
    const targetView = document.getElementById("subItemTargetView").value;
    if (!name) return;

    const newSub = {
      id: "sub_study_" + Date.now(),
      title: name,
      view: targetView,
      icon: targetView === "board" ? "kanban" : (targetView === "media" ? "video" : (targetView === "calendar" ? "calendar" : (targetView === "todo" ? "check-square" : "table"))),
      activeViews: [targetView],
      tableColumns: [...DEFAULT_TABLE_COLUMNS]
    };

    AppState.studies.categories.push(newSub);
    saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
    renderHierarchicalSidebar();
    navigateToStudySubPage(newSub.id, targetView);
    showToast(`Added "${name}" to Studies`, "info");

    subItemModal.classList.add("hidden");
    subItemForm.reset();
  });
}

// ============================================================================
// 9. REAL-TIME CLOCK & NAVIGATION ROUTING
// ============================================================================
function initRealTimeClock() {
  const clockEl = document.getElementById("liveClockDisplay");
  const dateEl = document.getElementById("liveDateDisplay");

  function update() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    if (clockEl) clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    if (dateEl) {
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
  }

  update();
  setInterval(update, 1000);
}

const VIEW_HEADINGS = {
  "view-today": "Today's Focus",
  "view-calendar": "Master Calendar",
  "view-work": "Work & OT Calculator",
  "view-project-scoped": "Studies Workspace"
};

function closeMobileSidebar() {
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) {
    sidebar.classList.add("-translate-x-full");
    sidebar.classList.remove("translate-x-0");
  }
  if (backdrop) {
    backdrop.classList.add("hidden");
  }
}

function openMobileSidebar() {
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) {
    sidebar.classList.remove("-translate-x-full");
    sidebar.classList.add("translate-x-0");
  }
  if (backdrop) {
    backdrop.classList.remove("hidden");
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("appSidebar");
  if (!sidebar) return;
  if (sidebar.classList.contains("-translate-x-full")) {
    openMobileSidebar();
  } else {
    closeMobileSidebar();
  }
}

function initMobileSidebar() {
  const toggleBtn = document.getElementById("mobileSidebarToggleBtn");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMobileSidebar();
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeMobileSidebar();
    });
  }
}

function navigateToView(viewId) {
  AppState.ui.currentView = viewId;

  // Auto-close sidebar on mobile navigation
  closeMobileSidebar();

  const fixedNavButtons = document.querySelectorAll("#appSidebar > div:first-child .sidebar-nav-btn");
  const viewContents = document.querySelectorAll(".view-content");
  const headingEl = document.getElementById("currentViewHeading");

  fixedNavButtons.forEach(btn => {
    if (btn.getAttribute("data-view") === viewId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  viewContents.forEach(view => {
    if (view.id === viewId) {
      view.classList.remove("hidden");
    } else {
      view.classList.add("hidden");
    }
  });

  if (headingEl) {
    headingEl.textContent = VIEW_HEADINGS[viewId] || "Workspace";
  }

  renderHierarchicalSidebar();

  if (viewId === "view-today") {
    initDashboardHeader();
    renderTodayChecklist();
    renderUpcomingDeadlines();
    renderDashboardCalendar();
    renderHomeBottomWidget();
  } else if (viewId === "view-calendar") {
    renderSmartCalendar();
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function initFixedNavButtons() {
  const fixedNavButtons = document.querySelectorAll(".sidebar-nav-btn");
  fixedNavButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetViewId = btn.getAttribute("data-view");
      if (targetViewId) {
        navigateToView(targetViewId);
      }
    });
  });
}

// ============================================================================
// 10. STUDIES MASTER OVERVIEW & SCOPED SUB-MODULE ENGINE
// ============================================================================
const scopedProjectTitle = document.getElementById("scopedProjectTitle");
const scopedProjectDesc = document.getElementById("scopedProjectDesc");
const scopedProjectIcon = document.getElementById("scopedProjectIcon");
const projectTabsList = document.getElementById("projectTabsList");
const openAddViewMenuBtn = document.getElementById("openAddViewMenuBtn");
const addViewMenuPopover = document.getElementById("addViewMenuPopover");
const scopedStatusFilter = document.getElementById("scopedStatusFilter");
const scopedNewItemBtn = document.getElementById("scopedNewItemBtn");
const addNewSubjectGroupBtn = document.getElementById("addNewSubjectGroupBtn");

const VIEW_METADATA = {
  table: { label: "Table", icon: "table" },
  board: { label: "Board", icon: "kanban" },
  calendar: { label: "Calendar", icon: "calendar" },
  media: { label: "Media Hub", icon: "video" },
  timeline: { label: "Timeline", icon: "chart-gantt" },
  todo: { label: "To-Do List", icon: "check-square" }
};

// Navigate to the combined Studies Master Overview (Root)
function navigateToStudiesRoot(initialView = "calendar") {
  AppState.ui.activeDomain = "studies";
  AppState.ui.activeSubPageId = "studies_root";
  
  if (AppState.studies.rootViews.includes(initialView)) {
    AppState.ui.activeScopedLayout = initialView;
  } else {
    AppState.ui.activeScopedLayout = AppState.studies.rootViews[0] || "calendar";
  }

  navigateToView("view-project-scoped");
  renderScopedProjectView("studies_root");
}

function navigateToStudySubPage(subPageId, initialView = null) {
  AppState.ui.activeDomain = "studies";
  AppState.ui.activeSubPageId = subPageId;

  const targetSub = AppState.studies.categories.find(s => s.id === subPageId) || AppState.studies.categories[0];
  if (!targetSub) return;

  if (!targetSub.activeViews || targetSub.activeViews.length === 0) {
    targetSub.activeViews = [targetSub.view || "table"];
  }

  if (initialView && targetSub.activeViews.includes(initialView)) {
    AppState.ui.activeScopedLayout = initialView;
  } else if (!targetSub.activeViews.includes(AppState.ui.activeScopedLayout)) {
    AppState.ui.activeScopedLayout = targetSub.activeViews[0];
  }

  navigateToView("view-project-scoped");
  renderScopedProjectView(targetSub.id);
}

function renderScopedProjectView(subPageId) {
  const isRoot = subPageId === "studies_root";
  const targetSub = isRoot ? null : (AppState.studies.categories.find(s => s.id === subPageId) || AppState.studies.categories[0]);

  if (isRoot) {
    if (scopedProjectTitle) scopedProjectTitle.textContent = "Studies Overview";
    if (scopedProjectDesc) scopedProjectDesc.textContent = "Combined academic schedule, deadlines, and study tracker across all modules";
    if (scopedProjectIcon) {
      scopedProjectIcon.innerHTML = `<i data-lucide="book-open" class="w-4 h-4 text-indigo-500"></i>`;
    }
    const headingEl = document.getElementById("currentViewHeading");
    if (headingEl) headingEl.textContent = "Studies / Master Overview";
  } else if (targetSub) {
    if (scopedProjectTitle) scopedProjectTitle.textContent = targetSub.title;
    if (scopedProjectDesc) scopedProjectDesc.textContent = `Studies > ${targetSub.title} • Scoped View`;
    if (scopedProjectIcon) {
      scopedProjectIcon.innerHTML = `<i data-lucide="${targetSub.icon || 'book-open'}" class="w-4 h-4 text-[var(--text-primary)]"></i>`;
    }
    const headingEl = document.getElementById("currentViewHeading");
    if (headingEl) headingEl.textContent = `Studies / ${targetSub.title}`;
  }

  renderProjectTabs(targetSub, isRoot);
  renderScopedLayoutContent(targetSub, isRoot);

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Render dynamic tabs with Hover Close Button (Tab Management)
function renderProjectTabs(targetSub, isRoot) {
  if (!projectTabsList) return;
  projectTabsList.innerHTML = "";

  const activeViewsList = isRoot ? AppState.studies.rootViews : (targetSub?.activeViews || ["table"]);

  // 1. Desktop Tab Bar
  activeViewsList.forEach(viewKey => {
    const meta = VIEW_METADATA[viewKey] || { label: viewKey, icon: "file-text" };
    const isActive = AppState.ui.activeScopedLayout === viewKey;

    const tabBtn = document.createElement("div");
    tabBtn.className = `project-tab-btn ${isActive ? 'active' : ''}`;
    
    // Tab Label & Icon
    const labelGroup = document.createElement("div");
    labelGroup.className = "flex items-center gap-1.5";
    labelGroup.innerHTML = `
      <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
      <span>${meta.label}</span>
    `;
    tabBtn.appendChild(labelGroup);

    // Close button (only shown if more than 1 tab exists)
    if (activeViewsList.length > 1) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "tab-close-btn";
      closeBtn.title = `Remove ${meta.label} view`;
      closeBtn.innerHTML = `<i data-lucide="x" class="w-3 h-3"></i>`;
      
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isRoot) {
          AppState.studies.rootViews = AppState.studies.rootViews.filter(v => v !== viewKey);
          saveDomain(STORAGE_KEYS.STUDIES_ROOT_VIEWS, AppState.studies.rootViews);
        } else if (targetSub) {
          targetSub.activeViews = targetSub.activeViews.filter(v => v !== viewKey);
          saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
        }

        if (AppState.ui.activeScopedLayout === viewKey) {
          const remaining = isRoot ? AppState.studies.rootViews : targetSub.activeViews;
          AppState.ui.activeScopedLayout = remaining[0] || "table";
        }

        renderScopedProjectView(isRoot ? "studies_root" : targetSub.id);
        showToast(`Removed "${meta.label}" view`, "info");
      });

      tabBtn.appendChild(closeBtn);
    }

    tabBtn.addEventListener("click", () => {
      AppState.ui.activeScopedLayout = viewKey;
      renderProjectTabs(targetSub, isRoot);
      renderScopedLayoutContent(targetSub, isRoot);
    });

    projectTabsList.appendChild(tabBtn);
  });

  // 2. Mobile Clean View Dropdown Selector
  const mobileSelect = document.getElementById("mobileProjectViewSelect");
  if (mobileSelect) {
    mobileSelect.innerHTML = "";
    activeViewsList.forEach(viewKey => {
      const meta = VIEW_METADATA[viewKey] || { label: viewKey, icon: "file-text" };
      const opt = document.createElement("option");
      opt.value = viewKey;
      opt.textContent = meta.label;
      if (AppState.ui.activeScopedLayout === viewKey) {
        opt.selected = true;
      }
      mobileSelect.appendChild(opt);
    });

    mobileSelect.onchange = () => {
      AppState.ui.activeScopedLayout = mobileSelect.value;
      renderProjectTabs(targetSub, isRoot);
      renderScopedLayoutContent(targetSub, isRoot);
    };
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function getScopedStudyEvents(subPageId, isRoot) {
  if (isRoot) {
    let items = [...AppState.studies.items];
    if (AppState.ui.scopedStatusFilter !== "all") {
      items = items.filter(evt => evt.status === AppState.ui.scopedStatusFilter || (AppState.ui.scopedStatusFilter === "done" && evt.completed));
    }
    return items;
  }

  return AppState.studies.items.filter(evt => {
    const isMatch = evt.categoryId === subPageId || (subPageId === 'sub_dayschool' && evt.module === 'dayschool') || (subPageId === 'sub_viva' && evt.module === 'viva') || (subPageId === 'sub_exams' && evt.module === 'exam') || (subPageId === 'sub_assignments' && evt.module === 'assignment');
    if (!isMatch) return false;

    if (AppState.ui.scopedStatusFilter !== "all") {
      const isStatusMatch = evt.status === AppState.ui.scopedStatusFilter || (AppState.ui.scopedStatusFilter === "done" && evt.completed);
      if (!isStatusMatch) return false;
    }
    return true;
  });
}

function renderScopedLayoutContent(targetSub, isRoot) {
  const layoutViews = document.querySelectorAll(".scoped-layout-view");
  layoutViews.forEach(view => view.classList.add("hidden"));

  const activeLayoutId = `scoped${capitalize(AppState.ui.activeScopedLayout)}Layout`;
  const targetLayout = document.getElementById(activeLayoutId);
  if (targetLayout) {
    targetLayout.classList.remove("hidden");
  }

  const events = getScopedStudyEvents(isRoot ? "studies_root" : targetSub.id, isRoot);

  if (AppState.ui.activeScopedLayout === "table") {
    renderScopedTable(events, targetSub, isRoot);
  } else if (AppState.ui.activeScopedLayout === "board") {
    renderScopedBoard(events, targetSub, isRoot);
  } else if (AppState.ui.activeScopedLayout === "calendar") {
    renderScopedCalendar(events, targetSub, isRoot);
  } else if (AppState.ui.activeScopedLayout === "media") {
    renderScopedMedia(events, targetSub, isRoot);
  } else if (AppState.ui.activeScopedLayout === "timeline") {
    renderScopedTimeline(events, targetSub, isRoot);
  } else if (AppState.ui.activeScopedLayout === "todo") {
    renderScopedTodo(events, targetSub, isRoot);
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// ============================================================================
// 11. CUSTOMIZABLE DATA TABLE ENGINE (`view-table`)
// ============================================================================

function getActiveTableColumns(targetSub, isRoot) {
  if (isRoot) {
    if (!AppState.studies.rootTableColumns || AppState.studies.rootTableColumns.length === 0) {
      AppState.studies.rootTableColumns = [...DEFAULT_TABLE_COLUMNS];
    }
    return AppState.studies.rootTableColumns;
  }

  if (!targetSub.tableColumns || targetSub.tableColumns.length === 0) {
    targetSub.tableColumns = [...DEFAULT_TABLE_COLUMNS];
  }
  return targetSub.tableColumns;
}

function renderScopedTable(events, targetSub, isRoot) {
  const theadRow = document.getElementById("scopedTableHeadRow");
  const tbody = document.getElementById("scopedTableBody");
  if (!theadRow || !tbody) return;

  const columns = getActiveTableColumns(targetSub, isRoot);

  // 1. Render Dynamic Thead Columns with Drag & Drop Reordering
  theadRow.innerHTML = "";
  let draggedColIndex = null;

  columns.forEach((col, colIdx) => {
    const th = document.createElement("th");
    th.className = "table-th-header";
    th.draggable = true;
    th.dataset.colIndex = colIdx;
    if (col.width) th.style.width = col.width;

    const iconMap = {
      title: "file-text",
      status: "check-circle-2",
      priority: "flag",
      date: "calendar",
      category: "tag",
      url: "link",
      file: "folder-symlink",
      drive: "folder-symlink",
      phone: "phone",
      email: "mail",
      percentage: "percent",
      checkbox: "check-square",
      text: "align-left"
    };

    th.innerHTML = `
      <div class="table-header-content ${col.type !== 'title' ? 'cursor-pointer select-none' : 'select-none'}" title="${col.type !== 'title' ? 'Drag to reorder or click to customize' : 'Drag to reorder'}">
        <div class="table-header-label">
          <i data-lucide="${iconMap[col.type] || 'tag'}" class="w-3.5 h-3.5 opacity-70"></i>
          <span>${escapeHtml(col.name)}</span>
        </div>
        ${col.type !== 'title' ? `
          <button type="button" class="table-th-menu-trigger" title="Column options">
            <i data-lucide="more-horizontal" class="w-3 h-3"></i>
          </button>
        ` : ''}
      </div>
    `;

    // HTML5 Drag & Drop Listeners
    th.addEventListener("dragstart", (e) => {
      draggedColIndex = colIdx;
      th.classList.add("col-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(colIdx));
    });

    th.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = th.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (e.clientX < midpoint) {
        th.classList.add("col-drag-over-left");
        th.classList.remove("col-drag-over-right");
      } else {
        th.classList.add("col-drag-over-right");
        th.classList.remove("col-drag-over-left");
      }
    });

    th.addEventListener("dragleave", () => {
      th.classList.remove("col-drag-over-left", "col-drag-over-right");
    });

    th.addEventListener("dragend", () => {
      th.classList.remove("col-dragging", "col-drag-over-left", "col-drag-over-right");
      theadRow.querySelectorAll(".table-th-header").forEach(h => {
        h.classList.remove("col-dragging", "col-drag-over-left", "col-drag-over-right");
      });
    });

    th.addEventListener("drop", (e) => {
      e.preventDefault();
      th.classList.remove("col-dragging", "col-drag-over-left", "col-drag-over-right");
      const fromIdx = draggedColIndex !== null ? draggedColIndex : parseInt(e.dataTransfer.getData("text/plain"));
      const toIdx = colIdx;

      if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== toIdx) {
        const movedCol = columns.splice(fromIdx, 1)[0];
        columns.splice(toIdx, 0, movedCol);

        if (isRoot) {
          AppState.studies.rootTableColumns = columns;
          saveDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns);
        } else if (targetSub) {
          targetSub.tableColumns = columns;
          saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
        }

        renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
        showToast("Column order updated", "info");
      }
    });

    if (col.type !== 'title') {
      const headerContent = th.querySelector(".table-header-content");
      if (headerContent) {
        headerContent.addEventListener("click", (e) => {
          e.stopPropagation();
          openColumnContextMenu(headerContent, col, colIdx, targetSub, isRoot);
        });
      }
    }

    theadRow.appendChild(th);
  });

  // Rightmost Add Column Header Button (+)
  const addColTh = document.createElement("th");
  addColTh.className = "table-th-add-col";
  addColTh.innerHTML = `
    <button type="button" id="addTableColumnBtn" class="add-col-btn" title="Add a column / property">
      <i data-lucide="plus" class="w-3.5 h-3.5"></i>
    </button>
  `;
  addColTh.querySelector("#addTableColumnBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    openAddColumnPopover(addColTh, targetSub, isRoot);
  });
  theadRow.appendChild(addColTh);

  // 2. Render Tbody Rows with Dynamic Column Sync
  tbody.innerHTML = "";

  if (events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${columns.length + 1}" class="text-center py-6 text-xs text-[var(--text-muted)]">No records found. Type below to quickly add a row.</td>
      </tr>
    `;
    return;
  }

  events.forEach(evt => {
    const tr = document.createElement("tr");
    tr.className = "group transition-colors";

    columns.forEach(col => {
      const td = document.createElement("td");

      if (col.type === "title") {
        td.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <i data-lucide="${evt.module === 'dayschool' ? 'video' : 'file-text'}" class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"></i>
              <input type="text" value="${escapeHtml(evt.title || '')}" placeholder="Untitled" class="table-cell-input font-medium" />
            </div>
            <button type="button" class="row-open-trigger text-[10px] uppercase font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]" title="Open record">
              Open
            </button>
          </div>
        `;

        const titleInput = td.querySelector(".table-cell-input");
        titleInput.addEventListener("change", (e) => {
          evt.title = e.target.value.trim() || "Untitled";
          saveStudyItem(evt, { showNotification: false });
        });

        td.querySelector(".row-open-trigger").addEventListener("click", (e) => {
          e.stopPropagation();
          openPageModal(evt);
        });
      } else if (col.type === "status") {
        const statusText = evt.status === "done" ? "Done" : (evt.status === "in-progress" ? "In Progress" : (evt.status === "review" ? "Review" : "Not Started"));
        const statusColor = evt.status === "done" ? "green" : (evt.status === "in-progress" ? "yellow" : (evt.status === "review" ? "purple" : "gray"));

        td.innerHTML = `
          <span class="px-2 py-0.5 rounded text-[11px] font-medium notion-tag-${statusColor} cursor-pointer select-none" title="Click to cycle status">${statusText}</span>
        `;

        td.querySelector("span").addEventListener("click", (e) => {
          e.stopPropagation();
          cycleStatus(evt);
        });
      } else if (col.type === "priority") {
        const prio = getPriorityInfo(evt.priority);
        td.innerHTML = `
          <span class="notion-priority-badge ${prio.badgeClass}" title="Click to select priority (Shift+Click to cycle)">
            <i data-lucide="flag" class="w-3 h-3"></i>
            <span>${prio.key}</span>
          </span>
        `;

        const badge = td.querySelector(".notion-priority-badge");
        badge.addEventListener("click", (e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            cyclePriority(evt);
            renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
            return;
          }
          openPrioritySelectPopover(badge, (selectedPrio) => {
            evt.priority = selectedPrio;
            if (evt.properties) {
              const pProp = evt.properties.find(p => p.type === "priority");
              if (pProp) {
                pProp.value = selectedPrio;
                pProp.color = getPriorityInfo(selectedPrio).color;
              }
            }
            saveStudyItem(evt, { showNotification: false });
            renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
            showToast(`Priority: ${selectedPrio}`, "info");
          });
        });
      } else if (col.type === "date") {
        const dateVal = evt.date || "";
        td.innerHTML = `
          <input type="date" value="${dateVal}" class="bg-transparent border-none text-[11px] font-mono text-[var(--text-secondary)] outline-none cursor-pointer" />
        `;

        td.querySelector("input").addEventListener("change", (e) => {
          evt.date = normalizeDateStr(e.target.value);
          saveStudyItem(evt, { showNotification: false });
        });
      } else if (col.type === "category") {
        const sub = AppState.studies.categories.find(s => s.id === evt.categoryId);
        const scopeLabel = sub ? sub.title : (isRoot ? "Studies" : targetSub?.title);
        const colorKey = evt.color || "purple";

        td.innerHTML = `
          <span class="px-2 py-0.5 rounded text-[10px] font-medium notion-tag-${colorKey}">${escapeHtml(scopeLabel)}</span>
        `;
      } else if (col.type === "url") {
        const linkUrl = (evt.meta && (evt.meta.videoUrl || evt.meta.link)) || "";
        td.innerHTML = `
          <div class="flex items-center gap-1">
            <input type="url" value="${escapeHtml(linkUrl)}" placeholder="Add URL..." class="table-cell-input text-[11px] font-mono text-sky-500" />
            ${linkUrl ? `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="p-1 text-[var(--text-muted)] hover:text-sky-400"><i data-lucide="external-link" class="w-3 h-3"></i></a>` : ''}
          </div>
        `;

        td.querySelector("input").addEventListener("change", (e) => {
          if (!evt.meta) evt.meta = {};
          evt.meta.videoUrl = e.target.value.trim();
          saveStudyItem(evt, { showNotification: false });
        });
      } else if (col.type === "file" || col.type === "drive") {
        const driveUrl = (evt.meta && (evt.meta.driveUrl || evt.meta.fileUrl || evt.meta.videoUrl || evt.meta.link)) || (evt.properties && evt.properties.find(p => p.type === "file")?.value) || "";
        const isDrive = driveUrl.includes("drive.google.com") || driveUrl.includes("docs.google.com");

        if (driveUrl) {
          td.innerHTML = `
            <div class="flex items-center gap-1.5 group/cell">
              <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="drive-attachment-badge ${isDrive ? 'notion-tag-blue' : 'notion-tag-gray'}" title="${escapeHtml(driveUrl)}">
                <i data-lucide="${isDrive ? 'folder-symlink' : 'paperclip'}" class="w-3 h-3"></i>
                <span class="truncate max-w-[120px]">${isDrive ? 'Open in Drive ↗' : 'Attachment ↗'}</span>
              </a>
              <button type="button" class="edit-drive-btn p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover/cell:opacity-100 transition-opacity" title="Edit Link">
                <i data-lucide="edit-2" class="w-2.5 h-2.5"></i>
              </button>
            </div>
          `;

          td.querySelector(".edit-drive-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            const newUrl = prompt("Enter Google Drive / File URL:", driveUrl);
            if (newUrl !== null) {
              if (!evt.meta) evt.meta = {};
              evt.meta.driveUrl = newUrl.trim();
              evt.meta.fileUrl = newUrl.trim();
              if (evt.properties) {
                const fProp = evt.properties.find(p => p.type === "file");
                if (fProp) fProp.value = newUrl.trim();
              }
              saveStudyItem(evt, { showNotification: false });
              renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
            }
          });
        } else {
          td.innerHTML = `
            <div class="flex items-center gap-1">
              <i data-lucide="folder-symlink" class="w-3 h-3 text-[var(--text-muted)] shrink-0"></i>
              <input type="url" placeholder="Paste Drive link..." class="table-cell-input text-[11px] text-[var(--text-secondary)]" />
            </div>
          `;

          td.querySelector("input").addEventListener("change", (e) => {
            const val = e.target.value.trim();
            if (!evt.meta) evt.meta = {};
            evt.meta.driveUrl = val;
            evt.meta.fileUrl = val;
            if (evt.properties) {
              const fProp = evt.properties.find(p => p.type === "file");
              if (fProp) fProp.value = val;
            }
            saveStudyItem(evt, { showNotification: false });
            renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
          });
        }
      } else if (col.type === "phone") {
        const phoneVal = (evt.meta && evt.meta.phone) || (evt.properties && evt.properties.find(p => p.type === "phone")?.value) || "";
        td.innerHTML = `
          <div class="flex items-center gap-1.5 w-full">
            <i data-lucide="phone" class="w-3 h-3 text-[var(--text-muted)] shrink-0"></i>
            <input type="tel" value="${escapeHtml(phoneVal)}" placeholder="+1..." class="table-cell-input text-[11px] font-mono" />
            ${phoneVal ? `<a href="tel:${phoneVal}" class="p-0.5 text-[var(--text-muted)] hover:text-indigo-400 shrink-0" title="Call ${phoneVal}"><i data-lucide="phone-call" class="w-3 h-3"></i></a>` : ''}
          </div>
        `;

        td.querySelector("input").addEventListener("change", (e) => {
          const val = e.target.value.trim();
          if (!evt.meta) evt.meta = {};
          evt.meta.phone = val;
          if (evt.properties) {
            const pProp = evt.properties.find(p => p.type === "phone");
            if (pProp) pProp.value = val;
          }
          saveStudyItem(evt, { showNotification: false });
        });
      } else if (col.type === "checkbox") {
        td.innerHTML = `
          <input type="checkbox" ${evt.completed ? 'checked' : ''} class="custom-checkbox" />
        `;

        td.querySelector(".custom-checkbox").addEventListener("change", (e) => {
          evt.completed = e.target.checked;
          evt.status = e.target.checked ? "done" : "not-started";
          saveStudyItem(evt, { showNotification: false });
        });
      } else if (col.type === "text") {
        const textVal = evt.notes || "";
        td.innerHTML = `
          <input type="text" value="${escapeHtml(textVal)}" placeholder="Empty note..." class="table-cell-input text-[11px]" />
        `;

        td.querySelector("input").addEventListener("change", (e) => {
          evt.notes = e.target.value.trim();
          saveStudyItem(evt, { showNotification: false });
        });
      }

      tr.appendChild(td);
    });

    // Empty cell for the add-column column alignment
    const emptyTd = document.createElement("td");
    tr.appendChild(emptyTd);

    tbody.appendChild(tr);
  });
}

// Fast New Row Creation at bottom of Table
const tableFastNewRowForm = document.getElementById("tableFastNewRowForm");
const tableFastNewRowInput = document.getElementById("tableFastNewRowInput");

if (tableFastNewRowForm) {
  tableFastNewRowForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = tableFastNewRowInput.value.trim();
    if (!title) return;

    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetCatId = isRoot ? (AppState.studies.categories[0]?.id || "sub_dayschool") : AppState.ui.activeSubPageId;

    const newRecord = {
      id: "evt_study_" + Date.now(),
      categoryId: targetCatId,
      module: "task",
      title: title,
      priority: "Medium",
      color: "blue",
      status: "not-started",
      completed: false,
      date: getTodayISO(),
      endDate: "",
      isRange: false,
      includeTime: false,
      properties: [
        { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
        { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" }
      ],
      meta: {}
    };

    saveStudyItem(newRecord, { showNotification: true });
    tableFastNewRowInput.value = "";
  });
}

// Add Column Popover
const addColumnPopover = document.getElementById("addColumnPopover");
function openAddColumnPopover(anchorEl, targetSub, isRoot) {
  if (!addColumnPopover) return;

  const rect = anchorEl.getBoundingClientRect();
  addColumnPopover.style.left = `${Math.min(window.innerWidth - 240, rect.left - 180)}px`;
  addColumnPopover.style.top = `${Math.min(window.innerHeight - 260, rect.bottom + 4)}px`;
  addColumnPopover.classList.remove("hidden");

  AppState.ui.activeColumnContext = { targetSub, isRoot };
}

function closeAddColumnPopover() {
  if (addColumnPopover) addColumnPopover.classList.add("hidden");
}

const addColTypeButtons = document.querySelectorAll(".add-col-type-btn");
addColTypeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const colType = btn.getAttribute("data-col-type");
    if (!colType || !AppState.ui.activeColumnContext) return;

    const { targetSub, isRoot } = AppState.ui.activeColumnContext;
    const defaultNames = {
      title: "Task / Title",
      status: "Status",
      priority: "Priority",
      date: "Date / Span",
      url: "URL / Media Link",
      file: "Google Drive Link",
      phone: "Phone Number",
      checkbox: "Checkbox",
      category: "Tags / Category",
      text: "Text / Note"
    };

    const newCol = {
      id: "col_" + Date.now(),
      key: colType === "title" ? "title" : (colType === "category" ? "categoryId" : colType),
      name: defaultNames[colType] || "Property",
      type: colType,
      width: colType === "title" ? "25%" : (colType === "date" ? "18%" : "14%")
    };

    if (isRoot) {
      if (!AppState.studies.rootTableColumns) AppState.studies.rootTableColumns = [...DEFAULT_TABLE_COLUMNS];
      AppState.studies.rootTableColumns.push(newCol);
      saveDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns);
    } else if (targetSub) {
      if (!targetSub.tableColumns) targetSub.tableColumns = [...DEFAULT_TABLE_COLUMNS];
      targetSub.tableColumns.push(newCol);
      saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
    }

    renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
    closeAddColumnPopover();
    showToast(`Added column "${newCol.name}"`, "info");
  });
});

// Column Context Menu (Move, Rename & Delete)
const columnContextMenu = document.getElementById("columnContextMenu");
const ctxMoveColLeftBtn = document.getElementById("ctxMoveColLeftBtn");
const ctxMoveColRightBtn = document.getElementById("ctxMoveColRightBtn");
const ctxRenameColBtn = document.getElementById("ctxRenameColBtn");
const ctxDeleteColBtn = document.getElementById("ctxDeleteColBtn");

function openColumnContextMenu(anchorEl, column, colIndex, targetSub, isRoot) {
  if (!columnContextMenu) return;

  AppState.ui.activeColumnContext = { column, colIndex, targetSub, isRoot };

  const columns = getActiveTableColumns(targetSub, isRoot);
  if (ctxMoveColLeftBtn) {
    ctxMoveColLeftBtn.style.display = colIndex > 0 ? "flex" : "none";
  }
  if (ctxMoveColRightBtn) {
    ctxMoveColRightBtn.style.display = colIndex < columns.length - 1 ? "flex" : "none";
  }

  const rect = anchorEl.getBoundingClientRect();
  columnContextMenu.style.left = `${Math.min(window.innerWidth - 190, rect.left)}px`;
  columnContextMenu.style.top = `${Math.min(window.innerHeight - 180, rect.bottom + 4)}px`;
  columnContextMenu.classList.remove("hidden");
}

function closeColumnContextMenu() {
  if (columnContextMenu) columnContextMenu.classList.add("hidden");
}

if (ctxMoveColLeftBtn) {
  ctxMoveColLeftBtn.addEventListener("click", () => {
    if (!AppState.ui.activeColumnContext) return;
    const { colIndex, targetSub, isRoot } = AppState.ui.activeColumnContext;
    const columns = getActiveTableColumns(targetSub, isRoot);
    if (colIndex > 0) {
      const moved = columns.splice(colIndex, 1)[0];
      columns.splice(colIndex - 1, 0, moved);
      if (isRoot) {
        saveDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns);
      } else if (targetSub) {
        saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
      }
      renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
      showToast("Moved column left", "info");
    }
    closeColumnContextMenu();
  });
}

if (ctxMoveColRightBtn) {
  ctxMoveColRightBtn.addEventListener("click", () => {
    if (!AppState.ui.activeColumnContext) return;
    const { colIndex, targetSub, isRoot } = AppState.ui.activeColumnContext;
    const columns = getActiveTableColumns(targetSub, isRoot);
    if (colIndex < columns.length - 1) {
      const moved = columns.splice(colIndex, 1)[0];
      columns.splice(colIndex + 1, 0, moved);
      if (isRoot) {
        saveDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns);
      } else if (targetSub) {
        saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
      }
      renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
      showToast("Moved column right", "info");
    }
    closeColumnContextMenu();
  });
}

if (ctxRenameColBtn) {
  ctxRenameColBtn.addEventListener("click", () => {
    if (!AppState.ui.activeColumnContext) return;
    const { column, targetSub, isRoot } = AppState.ui.activeColumnContext;
    const newName = prompt("Enter new column name:", column.name);
    if (newName && newName.trim()) {
      column.name = newName.trim();
      if (isRoot) {
        saveDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns);
      } else if (targetSub) {
        saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
      }
      renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
      showToast(`Renamed column to "${column.name}"`, "info");
    }
    closeColumnContextMenu();
  });
}

if (ctxDeleteColBtn) {
  ctxDeleteColBtn.addEventListener("click", () => {
    if (!AppState.ui.activeColumnContext) return;
    const { colIndex, column, targetSub, isRoot } = AppState.ui.activeColumnContext;
    confirmDeletion({
      desc: `Delete column "${column.name}" from table?`,
      onConfirm: () => {
        if (isRoot) {
          AppState.studies.rootTableColumns.splice(colIndex, 1);
          saveDomain(STORAGE_KEYS.STUDIES_ROOT_COLUMNS, AppState.studies.rootTableColumns);
        } else if (targetSub) {
          targetSub.tableColumns.splice(colIndex, 1);
          saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
        }
        renderScopedProjectView(isRoot ? "studies_root" : targetSub?.id || "studies_root");
        showToast(`Deleted column "${column.name}"`, "info");
      }
    });
    closeColumnContextMenu();
  });
}

// Priority Select Popover (Used for 1-click priority picker)
const prioritySelectPopover = document.getElementById("prioritySelectPopover");
function openPrioritySelectPopover(anchorEl, callback) {
  if (!prioritySelectPopover) return;

  const rect = anchorEl.getBoundingClientRect();
  prioritySelectPopover.style.left = `${Math.min(window.innerWidth - 190, rect.left)}px`;
  prioritySelectPopover.style.top = `${Math.min(window.innerHeight - 200, rect.bottom + 4)}px`;
  prioritySelectPopover.classList.remove("hidden");

  AppState.ui.activePriorityPropertyContext = { callback };
}

function closePrioritySelectPopover() {
  if (prioritySelectPopover) prioritySelectPopover.classList.add("hidden");
  AppState.ui.activePriorityPropertyContext = null;
}

const priorityOptButtons = document.querySelectorAll(".priority-opt-btn");
priorityOptButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const prioKey = btn.getAttribute("data-priority");
    if (prioKey && AppState.ui.activePriorityPropertyContext && AppState.ui.activePriorityPropertyContext.callback) {
      AppState.ui.activePriorityPropertyContext.callback(prioKey);
    }
    closePrioritySelectPopover();
  });
});

// Kanban & Timeline & To-Do Renderers
let scopedKanbanSortables = [];
function renderScopedBoard(events, targetSub, isRoot) {
  const cols = {
    "not-started": document.getElementById("scopedKanbanTodoCol"),
    "in-progress": document.getElementById("scopedKanbanProgressCol"),
    "review": document.getElementById("scopedKanbanReviewCol"),
    "done": document.getElementById("scopedKanbanDoneCol")
  };

  if (!cols["not-started"]) return;

  Object.values(cols).forEach(c => { if (c) c.innerHTML = ""; });
  scopedKanbanSortables.forEach(s => s.destroy && s.destroy());
  scopedKanbanSortables = [];

  const counts = { "not-started": 0, "in-progress": 0, "review": 0, "done": 0 };

  events.forEach(evt => {
    let statusKey = evt.status || "not-started";
    if (evt.completed && statusKey !== "done") statusKey = "done";
    if (!cols[statusKey]) statusKey = "not-started";

    counts[statusKey]++;
    const card = document.createElement("div");
    card.className = "kanban-card space-y-2";
    card.dataset.eventId = evt.id;

    const sub = AppState.studies.categories.find(s => s.id === evt.categoryId);
    const scopeLabel = sub ? sub.title : (isRoot ? "Studies" : targetSub?.title);
    const colorKey = evt.color || "purple";
    const prio = getPriorityInfo(evt.priority);

    card.innerHTML = `
      <div class="flex items-center justify-between gap-1">
        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium notion-tag-${colorKey}">${escapeHtml(scopeLabel)}</span>
        ${evt.priority && evt.priority !== "None" ? `<span class="notion-priority-badge ${prio.badgeClass}">${prio.key}</span>` : ''}
      </div>
      <p class="text-xs font-semibold text-[var(--text-primary)] leading-snug">${escapeHtml(evt.title || 'Untitled')}</p>
    `;

    card.addEventListener("click", () => openPageModal(evt));
    cols[statusKey].appendChild(card);
  });

  const countTodo = document.getElementById("scopedCountTodo");
  const countProg = document.getElementById("scopedCountProgress");
  const countRev = document.getElementById("scopedCountReview");
  const countDone = document.getElementById("scopedCountDone");

  if (countTodo) countTodo.textContent = counts["not-started"];
  if (countProg) countProg.textContent = counts["in-progress"];
  if (countRev) countRev.textContent = counts["review"];
  if (countDone) countDone.textContent = counts["done"];

  Object.keys(cols).forEach(statusKey => {
    const colEl = cols[statusKey];
    if (colEl) {
      const sortable = new Sortable(colEl, {
        group: 'scoped-kanban-lanes',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
          const cardEl = evt.item;
          const eventId = cardEl.dataset.eventId;
          const newStatus = evt.to.dataset.colStatus;
          const targetEvent = AppState.studies.items.find(e => e.id === eventId);
          if (targetEvent && newStatus) {
            targetEvent.status = newStatus;
            targetEvent.completed = newStatus === "done";
            saveStudyItem(targetEvent, { showNotification: false });
          }
        }
      });
      scopedKanbanSortables.push(sortable);
    }
  });

  const addButtons = document.querySelectorAll(".scoped-add-card-btn");
  addButtons.forEach(btn => {
    btn.onclick = () => {
      const targetStatus = btn.getAttribute("data-target-status") || "not-started";
      const targetCatId = isRoot ? (AppState.studies.categories[0]?.id || "sub_dayschool") : targetSub.id;
      const newEvt = {
        id: "evt_study_" + Date.now(),
        categoryId: targetCatId,
        title: "",
        module: "task",
        color: "purple",
        status: targetStatus,
        priority: "Medium",
        completed: targetStatus === "done",
        date: getTodayISO(),
        endDate: "",
        isRange: false,
        includeTime: false,
        properties: [
          { id: "p1", name: "Status", type: "status", value: targetStatus === "done" ? "Done" : "In Progress", color: targetStatus === "done" ? "green" : "yellow" },
          { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" }
        ],
        meta: {}
      };
      openPageModal(newEvt);
    };
  });
}

function renderScopedCalendar(events, targetSub, isRoot) {
  const grid = document.getElementById("scopedCalendarGrid");
  const heading = document.getElementById("scopedCalMonthHeading");
  if (!grid) return;
  grid.innerHTML = "";

  const d = AppState.ui.scopedCalendarDate;
  const year = d.getFullYear();
  const month = d.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (heading) heading.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  const todayStr = getTodayISO();

  function getEventsForDate(dateStr) {
    const normalizedTarget = normalizeDateStr(dateStr);
    return events.filter(e => {
      const eDate = normalizeDateStr(e.date);
      const eEndDate = normalizeDateStr(e.endDate);
      if (e.isRange && eEndDate) {
        return normalizedTarget >= eDate && normalizedTarget <= eEndDate;
      }
      return eDate === normalizedTarget;
    });
  }

  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevMonthTotalDays - i + 1;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = normalizeDateStr(prevDate);
    const cell = createCalendarCell(dayNum, dateStr, true, false, getEventsForDate(dateStr), events);
    grid.appendChild(cell);
  }

  for (let i = 1; i <= totalDaysInMonth; i++) {
    const currDate = new Date(year, month, i);
    const dateStr = normalizeDateStr(currDate);
    const isToday = dateStr === todayStr;
    const cell = createCalendarCell(i, dateStr, false, isToday, getEventsForDate(dateStr), events);
    grid.appendChild(cell);
  }

  const totalRendered = firstDayIndex + totalDaysInMonth;
  const nextMonthDays = 35 - totalRendered > 0 ? 35 - totalRendered : 42 - totalRendered;
  for (let i = 1; i <= nextMonthDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    const dateStr = normalizeDateStr(nextDate);
    const cell = createCalendarCell(i, dateStr, true, false, getEventsForDate(dateStr), events);
    grid.appendChild(cell);
  }
}

const scopedCalPrevBtn = document.getElementById("scopedCalPrevBtn");
const scopedCalNextBtn = document.getElementById("scopedCalNextBtn");
const scopedCalTodayBtn = document.getElementById("scopedCalTodayBtn");

if (scopedCalPrevBtn) {
  scopedCalPrevBtn.addEventListener("click", () => {
    AppState.ui.scopedCalendarDate.setMonth(AppState.ui.scopedCalendarDate.getMonth() - 1);
    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetSub = isRoot ? null : AppState.studies.categories.find(s => s.id === AppState.ui.activeSubPageId);
    renderScopedCalendar(getScopedStudyEvents(AppState.ui.activeSubPageId, isRoot), targetSub, isRoot);
  });
}
if (scopedCalNextBtn) {
  scopedCalNextBtn.addEventListener("click", () => {
    AppState.ui.scopedCalendarDate.setMonth(AppState.ui.scopedCalendarDate.getMonth() + 1);
    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetSub = isRoot ? null : AppState.studies.categories.find(s => s.id === AppState.ui.activeSubPageId);
    renderScopedCalendar(getScopedStudyEvents(AppState.ui.activeSubPageId, isRoot), targetSub, isRoot);
  });
}
if (scopedCalTodayBtn) {
  scopedCalTodayBtn.addEventListener("click", () => {
    AppState.ui.scopedCalendarDate = new Date();
    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetSub = isRoot ? null : AppState.studies.categories.find(s => s.id === AppState.ui.activeSubPageId);
    renderScopedCalendar(getScopedStudyEvents(AppState.ui.activeSubPageId, isRoot), targetSub, isRoot);
  });
}

// Media Hub: Nested Subject-Categorized Vault (Studies Domain)
function renderScopedMedia(events, targetSub, isRoot) {
  const container = document.getElementById("scopedMediaCardsContainer");
  if (!container) return;
  container.innerHTML = "";

  const grouped = {};
  events.forEach(video => {
    const subject = (video.meta && video.meta.subject) || "General Studies";
    if (!grouped[subject]) grouped[subject] = [];
    grouped[subject].push(video);
  });

  const subjectKeys = Object.keys(grouped);

  if (subjectKeys.length === 0) {
    const pageName = isRoot ? "Studies" : targetSub?.title;
    container.innerHTML = `<p class="text-xs text-[var(--text-muted)] py-6 text-center">No video recordings in ${pageName} yet. Click "+ Add Record" to log your first lecture.</p>`;
    return;
  }

  subjectKeys.forEach(subjectName => {
    const subjectGroup = document.createElement("div");
    subjectGroup.className = "media-subject-group space-y-3";

    const videosInGroup = grouped[subjectName];
    const watchedCount = videosInGroup.filter(v => (v.meta && v.meta.watched) || v.status === 'done').length;

    const header = document.createElement("div");
    header.className = "media-subject-header";
    header.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-[var(--text-primary)]">${escapeHtml(subjectName)}</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] text-[var(--text-muted)] border border-[var(--border-subtle)]">${watchedCount}/${videosInGroup.length} Watched</span>
      </div>
      <button type="button" class="media-subject-add-btn" data-subject="${escapeHtml(subjectName)}" title="Add lecture to this subject">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        <span>Add Media</span>
      </button>
    `;

    header.querySelector(".media-subject-add-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const targetCatId = isRoot ? (AppState.studies.categories[0]?.id || "sub_dayschool") : targetSub.id;
      const newMediaEvt = {
        id: "evt_ds_" + Date.now(),
        categoryId: targetCatId,
        module: "dayschool",
        title: "",
        priority: "Medium",
        date: getTodayISO(),
        endDate: "",
        isRange: false,
        includeTime: false,
        color: "blue",
        status: "not-started",
        completed: false,
        notes: `Lecture Recording for ${subjectName}`,
        properties: [
          { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
          { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" },
          { id: "p3", name: "Subject", type: "select", value: subjectName, color: "blue" },
          { id: "p4", name: "Video URL", type: "url", value: "" }
        ],
        meta: {
          subject: subjectName,
          videoUrl: "",
          watched: false
        }
      };
      openPageModal(newMediaEvt);
    });

    subjectGroup.appendChild(header);

    const cardsGrid = document.createElement("div");
    cardsGrid.className = "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3";

    videosInGroup.forEach(video => {
      const card = document.createElement("div");
      const isWatched = (video.meta && video.meta.watched) || video.status === 'done';
      card.className = `media-card-item ${isWatched ? 'watched' : ''} cursor-pointer p-2.5 sm:p-3`;
      const videoLink = (video.meta && video.meta.videoUrl) || "#";

      card.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-1 flex-wrap">
            <span class="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium notion-tag-blue truncate max-w-full">${escapeHtml(subjectName)}</span>
            <span class="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-mono">${video.date || 'No Date'}</span>
          </div>
          <p class="media-title text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] leading-tight pt-0.5 line-clamp-2">${escapeHtml(video.title || 'Untitled Lecture')}</p>
          ${video.notes ? `<p class="text-[10px] sm:text-[11px] text-[var(--text-muted)] line-clamp-1 sm:line-clamp-2">${escapeHtml(video.notes)}</p>` : ''}
        </div>

        <div class="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-[var(--border-subtle)] gap-1">
          <label class="flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
            <input type="checkbox" ${isWatched ? 'checked' : ''} class="custom-checkbox scoped-mark-watched-chk" data-id="${video.id}" />
            <span class="hidden sm:inline">Watched</span>
          </label>
          <a href="${videoLink}" target="_blank" rel="noopener noreferrer" class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] flex items-center gap-1" onclick="event.stopPropagation()">
            <span>Watch</span>
            <i data-lucide="external-link" class="w-2.5 h-2.5 sm:w-3 sm:h-3"></i>
          </a>
        </div>
      `;

      card.querySelector(".scoped-mark-watched-chk").addEventListener("change", (e) => {
        e.stopPropagation();
        if (!video.meta) video.meta = {};
        video.meta.watched = e.target.checked;
        video.status = e.target.checked ? "done" : "not-started";
        video.completed = e.target.checked;
        saveStudyItem(video, { showNotification: false });
      });

      card.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-checkbox") && !e.target.closest("a")) {
          openPageModal(video);
        }
      });

      cardsGrid.appendChild(card);
    });

    subjectGroup.appendChild(cardsGrid);
    container.appendChild(subjectGroup);
  });
}

// Layout 6: Scoped Simple To-Do List View Engine (Active & Completed Sink)
function renderScopedTodo(events, targetSub, isRoot) {
  const activeList = document.getElementById("scopedTodoActiveList");
  const completedList = document.getElementById("scopedTodoCompletedList");
  const activeCountEl = document.getElementById("scopedTodoActiveCount");
  const completedCountEl = document.getElementById("scopedTodoCompletedCount");
  if (!activeList || !completedList) return;

  activeList.innerHTML = "";
  completedList.innerHTML = "";

  const activeItems = events.filter(e => !e.completed && e.status !== "done");
  const completedItems = events.filter(e => e.completed || e.status === "done");

  if (activeCountEl) activeCountEl.textContent = `${activeItems.length} active`;
  if (completedCountEl) completedCountEl.textContent = completedItems.length;

  if (activeItems.length === 0) {
    activeList.innerHTML = `<p class="text-xs text-[var(--text-muted)] py-3 text-center">No pending tasks. You're all caught up!</p>`;
  } else {
    activeItems.forEach(item => {
      const row = createTodoItemRow(item);
      activeList.appendChild(row);
    });
  }

  if (completedItems.length > 0) {
    completedItems.forEach(item => {
      const row = createTodoItemRow(item);
      completedList.appendChild(row);
    });
  }
}

function createTodoItemRow(item) {
  const row = document.createElement("div");
  row.className = `todo-item-row ${item.completed ? 'completed' : ''} group cursor-pointer`;
  
  const sub = AppState.studies.categories.find(s => s.id === item.categoryId);
  const tagLabel = sub ? sub.title : "Task";
  const colorKey = item.color || "gray";
  const prio = getPriorityInfo(item.priority);

  row.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0 mr-2">
      <input type="checkbox" ${item.completed ? 'checked' : ''} class="custom-checkbox todo-chk-btn" />
      <span class="todo-item-title text-xs font-medium text-[var(--text-primary)] truncate">${escapeHtml(item.title || 'Untitled Task')}</span>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      ${item.priority && item.priority !== "None" ? `<span class="notion-priority-badge ${prio.badgeClass}">${prio.key}</span>` : ''}
      <span class="px-2 py-0.5 rounded text-[10px] font-medium notion-tag-${colorKey}">${escapeHtml(tagLabel)}</span>
      <button class="delete-todo-btn text-[var(--text-muted)] hover:text-rose-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Task">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>
    </div>
  `;

  const chk = row.querySelector(".todo-chk-btn");
  chk.addEventListener("change", (e) => {
    e.stopPropagation();
    item.completed = e.target.checked;
    item.status = e.target.checked ? "done" : "not-started";
    saveStudyItem(item, { showNotification: false });
  });

  const delBtn = row.querySelector(".delete-todo-btn");
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    confirmDeletion({
      desc: `Delete task "${item.title}"?`,
      onConfirm: () => {
        deleteStudyItem(item.id);
      }
    });
  });

  row.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-checkbox") && !e.target.closest(".delete-todo-btn")) {
      openPageModal(item);
    }
  });

  return row;
}

const scopedTodoAddForm = document.getElementById("scopedTodoAddForm");
const scopedTodoInput = document.getElementById("scopedTodoInput");
if (scopedTodoAddForm) {
  scopedTodoAddForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = scopedTodoInput.value.trim();
    if (!text) return;

    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetCatId = isRoot ? (AppState.studies.categories[0]?.id || "sub_dayschool") : AppState.ui.activeSubPageId;

    const newTodo = {
      id: "evt_study_" + Date.now(),
      categoryId: targetCatId,
      module: "task",
      title: text,
      priority: "Medium",
      date: getTodayISO(),
      endDate: "",
      isRange: false,
      includeTime: false,
      color: "yellow",
      status: "not-started",
      completed: false,
      notes: "",
      properties: [
        { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
        { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" }
      ],
      meta: {}
    };

    saveStudyItem(newTodo, { showNotification: true });
    scopedTodoInput.value = "";
  });
}

const toggleCompletedTodoBtn = document.getElementById("toggleCompletedTodoBtn");
const completedTodoChevron = document.getElementById("completedTodoChevron");
const scopedTodoCompletedList = document.getElementById("scopedTodoCompletedList");
if (toggleCompletedTodoBtn) {
  toggleCompletedTodoBtn.addEventListener("click", () => {
    if (scopedTodoCompletedList) {
      scopedTodoCompletedList.classList.toggle("hidden");
      if (completedTodoChevron) completedTodoChevron.classList.toggle("rotate-90");
    }
  });
}

if (addNewSubjectGroupBtn) {
  addNewSubjectGroupBtn.addEventListener("click", () => {
    const subjectName = prompt("Enter new Subject / Topic name:");
    if (!subjectName || !subjectName.trim()) return;

    const targetCatId = AppState.ui.activeSubPageId === "studies_root" ? (AppState.studies.categories[0]?.id || "sub_dayschool") : AppState.ui.activeSubPageId;

    const newEvt = {
      id: "evt_ds_" + Date.now(),
      categoryId: targetCatId,
      module: "dayschool",
      title: `Introductory Lecture — ${subjectName.trim()}`,
      priority: "Medium",
      date: getTodayISO(),
      endDate: "",
      isRange: false,
      includeTime: false,
      color: "blue",
      status: "not-started",
      completed: false,
      notes: `Subject notes for ${subjectName.trim()}`,
      properties: [
        { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
        { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" },
        { id: "p3", name: "Subject", type: "select", value: subjectName.trim(), color: "blue" }
      ],
      meta: {
        subject: subjectName.trim(),
        videoUrl: "",
        watched: false
      }
    };
    openPageModal(newEvt);
  });
}

function renderScopedTimeline(events, targetSub, isRoot) {
  const header = document.getElementById("scopedTimelineHeaderDays");
  const rows = document.getElementById("scopedTimelineRowsContainer");
  if (!header || !rows) return;
  header.innerHTML = "";
  rows.innerHTML = "";

  const startDate = new Date();
  const daysList = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    daysList.push(normalizeDateStr(d));
  }

  const titleCol = document.createElement("div");
  titleCol.className = "text-left pl-2 font-bold uppercase text-[10px] text-[var(--text-muted)]";
  titleCol.textContent = "Deliverable / Milestone";
  header.appendChild(titleCol);

  const todayISO = getTodayISO();
  daysList.forEach(dateStr => {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const isToday = dateStr === todayISO;

    const dayCell = document.createElement("div");
    dayCell.className = `flex flex-col items-center ${isToday ? 'text-[var(--text-primary)] font-bold' : ''}`;
    dayCell.innerHTML = `<span class="text-[9px] uppercase opacity-75">${dayName}</span><span class="text-xs font-mono">${dayNum}</span>`;
    header.appendChild(dayCell);
  });

  if (events.length === 0) {
    const pageName = isRoot ? "Studies" : targetSub?.title;
    rows.innerHTML = `<p class="text-xs text-[var(--text-muted)] py-4 text-center">No timeline items in ${pageName}.</p>`;
    return;
  }

  events.forEach(evt => {
    const evtDate = normalizeDateStr(evt.date);
    const evtEndDate = normalizeDateStr(evt.endDate) || evtDate;

    const row = document.createElement("div");
    row.className = "timeline-row";

    const label = document.createElement("div");
    label.className = "pr-3 truncate text-xs font-medium text-[var(--text-primary)] cursor-pointer hover:underline pl-2";
    label.textContent = evt.title || "Untitled";
    label.addEventListener("click", () => openPageModal(evt));
    row.appendChild(label);

    daysList.forEach(() => {
      const cell = document.createElement("div");
      cell.className = "timeline-track-cell";
      row.appendChild(cell);
    });

    const startIndex = daysList.indexOf(evtDate);
    const endIndex = daysList.indexOf(evtEndDate);

    if (startIndex >= 0 || endIndex >= 0 || (evtDate < daysList[0] && evtEndDate > daysList[daysList.length - 1])) {
      const actualStart = Math.max(0, startIndex >= 0 ? startIndex : 0);
      const actualEnd = Math.min(13, endIndex >= 0 ? endIndex : 13);
      const spanDays = actualEnd - actualStart + 1;

      const bar = document.createElement("div");
      const colorKey = evt.color || "pink";
      bar.className = `timeline-bar notion-tag-${colorKey}`;
      bar.style.left = `calc(200px + ${(actualStart * (100 / 14))}%)`;
      bar.style.width = `calc(${spanDays * (100 / 14)}% - 6px)`;
      bar.textContent = evt.title || "Untitled";
      bar.addEventListener("click", () => openPageModal(evt));
      row.appendChild(bar);
    }

    rows.appendChild(row);
  });
}

// Add View Dropdown Menu (Supports 6 Polymorphic Views)
if (openAddViewMenuBtn) {
  openAddViewMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (addViewMenuPopover) addViewMenuPopover.classList.toggle("hidden");
  });
}

document.addEventListener("click", (e) => {
  if (addViewMenuPopover && !addViewMenuPopover.contains(e.target) && e.target !== openAddViewMenuBtn) {
    addViewMenuPopover.classList.add("hidden");
  }
  if (addColumnPopover && !addColumnPopover.contains(e.target) && !e.target.closest("#addTableColumnBtn")) {
    closeAddColumnPopover();
  }
  if (columnContextMenu && !columnContextMenu.contains(e.target) && !e.target.closest(".table-th-menu-trigger") && !e.target.closest(".table-header-content")) {
    closeColumnContextMenu();
  }
  if (prioritySelectPopover && !prioritySelectPopover.contains(e.target) && !e.target.closest(".notion-priority-badge")) {
    closePrioritySelectPopover();
  }
});

const addViewTypeOptions = document.querySelectorAll(".add-view-type-opt");
addViewTypeOptions.forEach(opt => {
  opt.addEventListener("click", () => {
    const viewType = opt.getAttribute("data-view-type");
    if (viewType) {
      const isRoot = AppState.ui.activeSubPageId === "studies_root";
      if (isRoot) {
        if (!AppState.studies.rootViews.includes(viewType)) {
          AppState.studies.rootViews.push(viewType);
          saveDomain(STORAGE_KEYS.STUDIES_ROOT_VIEWS, AppState.studies.rootViews);
        }
      } else {
        const targetSub = AppState.studies.categories.find(s => s.id === AppState.ui.activeSubPageId);
        if (targetSub) {
          if (!targetSub.activeViews) targetSub.activeViews = ["table"];
          if (!targetSub.activeViews.includes(viewType)) {
            targetSub.activeViews.push(viewType);
            saveDomain(STORAGE_KEYS.STUDIES_CATEGORIES, AppState.studies.categories);
          }
        }
      }
      AppState.ui.activeScopedLayout = viewType;
      renderScopedProjectView(AppState.ui.activeSubPageId);
      showToast(`Added ${VIEW_METADATA[viewType]?.label || viewType} view`, "info");
    }
    if (addViewMenuPopover) addViewMenuPopover.classList.add("hidden");
  });
});

// Context-Aware "+ Add Record" Button (Page-Level: Bypasses Destination dropdown)
if (scopedNewItemBtn) {
  scopedNewItemBtn.addEventListener("click", () => {
    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetSub = isRoot ? null : AppState.studies.categories.find(s => s.id === AppState.ui.activeSubPageId);
    const targetCatId = isRoot ? (AppState.studies.categories[0]?.id || "sub_dayschool") : targetSub.id;
    const isMediaHub = AppState.ui.activeScopedLayout === "media" || (targetSub && targetSub.view === "media");

    const newRecord = {
      id: "evt_study_" + Date.now(),
      categoryId: targetCatId,
      module: isMediaHub ? "dayschool" : (AppState.ui.activeScopedLayout === "calendar" ? "viva" : "task"),
      title: "",
      priority: "Medium",
      color: isMediaHub ? "blue" : (AppState.ui.activeScopedLayout === "calendar" ? "purple" : "yellow"),
      status: "not-started",
      completed: false,
      date: getTodayISO(),
      endDate: "",
      isRange: false,
      includeTime: false,
      properties: [
        { id: "p1", name: "Status", type: "status", value: "Not Started", color: "gray" },
        { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" }
      ],
      meta: {
        subject: isMediaHub ? "General Studies" : undefined,
        videoUrl: isMediaHub ? "" : undefined,
        watched: false
      }
    };

    openPageModal(newRecord);
  });
}

if (scopedStatusFilter) {
  scopedStatusFilter.addEventListener("change", (e) => {
    AppState.ui.scopedStatusFilter = e.target.value;
    renderScopedProjectView(AppState.ui.activeSubPageId);
  });
}

// ============================================================================
// 12. CALENDAR DAY INSPECTOR POPOVER MODAL (#calendarDayInspector)
// ============================================================================
const calendarDayInspector = document.getElementById("calendarDayInspector");
const inspectorDateHeading = document.getElementById("inspectorDateHeading");
const inspectorEventsList = document.getElementById("inspectorEventsList");
const inspectorEmptyState = document.getElementById("inspectorEmptyState");
const inspectorAddEventBtn = document.getElementById("inspectorAddEventBtn");
const closeDayInspectorBtn = document.getElementById("closeDayInspectorBtn");

function openCalendarDayInspector(dateStr, scopedContextEvents = null) {
  if (!calendarDayInspector) return;

  AppState.ui.inspectorSelectedDateStr = normalizeDateStr(dateStr);
  const prettyDate = formatPrettyDate(AppState.ui.inspectorSelectedDateStr);
  if (inspectorDateHeading) inspectorDateHeading.textContent = prettyDate;

  // Filter events scheduled on this specific date
  const eventsPool = scopedContextEvents || getAllWorkspaceEvents();
  const dayEvents = eventsPool.filter(e => {
    const eDate = normalizeDateStr(e.date);
    const eEndDate = normalizeDateStr(e.endDate);
    if (e.isRange && eEndDate) {
      return AppState.ui.inspectorSelectedDateStr >= eDate && AppState.ui.inspectorSelectedDateStr <= eEndDate;
    }
    return eDate === AppState.ui.inspectorSelectedDateStr;
  });

  if (inspectorEventsList) inspectorEventsList.innerHTML = "";

  if (dayEvents.length === 0) {
    if (inspectorEmptyState) inspectorEmptyState.classList.remove("hidden");
  } else {
    if (inspectorEmptyState) inspectorEmptyState.classList.add("hidden");
    dayEvents.forEach(evt => {
      const itemEl = document.createElement("div");
      itemEl.className = "inspector-event-item space-y-1";

      const sub = AppState.studies.categories.find(s => s.id === evt.categoryId);
      const tagLabel = sub ? sub.title : (evt.module ? evt.module.toUpperCase() : "RECORD");
      const colorKey = evt.color || "purple";
      const statusText = evt.status === "done" ? "Done" : (evt.status === "in-progress" ? "In Progress" : (evt.status === "review" ? "Review" : "To Do"));
      const statusColor = evt.status === "done" ? "green" : (evt.status === "in-progress" ? "yellow" : (evt.status === "review" ? "purple" : "gray"));
      const timeStr = evt.includeTime && evt.startTime ? `${evt.startTime} ` : '';
      const prio = getPriorityInfo(evt.priority);

      itemEl.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium notion-tag-${colorKey}">${escapeHtml(tagLabel)}</span>
            ${evt.priority && evt.priority !== "None" ? `<span class="notion-priority-badge ${prio.badgeClass}">${prio.key}</span>` : ''}
          </div>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-medium notion-tag-${statusColor}">${statusText}</span>
        </div>
        <p class="text-xs font-semibold text-[var(--text-primary)] leading-snug">${escapeHtml(timeStr)}${escapeHtml(evt.title || 'Untitled')}</p>
      `;

      itemEl.addEventListener("click", () => {
        closeCalendarDayInspector();
        openPageModal(evt);
      });

      inspectorEventsList.appendChild(itemEl);
    });
  }

  calendarDayInspector.classList.remove("hidden");
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function closeCalendarDayInspector() {
  if (calendarDayInspector) calendarDayInspector.classList.add("hidden");
}

if (closeDayInspectorBtn) closeDayInspectorBtn.addEventListener("click", closeCalendarDayInspector);

if (inspectorAddEventBtn) {
  inspectorAddEventBtn.addEventListener("click", () => {
    const selectedDate = AppState.ui.inspectorSelectedDateStr || getTodayISO();
    closeCalendarDayInspector();
    openPageModal(selectedDate);
  });
}

if (calendarDayInspector) {
  calendarDayInspector.addEventListener("click", (e) => {
    if (e.target === calendarDayInspector) {
      closeCalendarDayInspector();
    }
  });
}

// ============================================================================
// 13. UNIVERSAL CROSS-MODULE QUICK ADD MODAL CONTROLLER (Home Omnibar)
// ============================================================================
const universalAddModal = document.getElementById("universalAddModal");
const universalNewItemBtn = document.getElementById("universalNewItemBtn");
const closeUniversalAddModalBtn = document.getElementById("closeUniversalAddModalBtn");
const cancelUniversalAddModalBtn = document.getElementById("cancelUniversalAddModalBtn");
const universalAddForm = document.getElementById("universalAddForm");
const universalDestSelect = document.getElementById("universalDestSelect");
const universalTitleInput = document.getElementById("universalTitleInput");
const universalDateInput = document.getElementById("universalDateInput");
const universalTimeInput = document.getElementById("universalTimeInput");
const universalVideoUrlInput = document.getElementById("universalVideoUrlInput");
const universalStatusSelect = document.getElementById("universalStatusSelect");
const universalColorSelect = document.getElementById("universalColorSelect");
const universalNotesInput = document.getElementById("universalNotesInput");
const uVideoUrlWrapper = document.getElementById("uVideoUrlWrapper");

function openUniversalAddModal(preselectedCatId = null) {
  if (!universalAddModal) return;

  if (universalDestSelect) {
    universalDestSelect.innerHTML = "";
    
    const studyGroup = document.createElement("optgroup");
    studyGroup.label = "📚 Studies Workspace";
    AppState.studies.categories.forEach(sub => {
      const subOpt = document.createElement("option");
      subOpt.value = sub.id;
      subOpt.textContent = `${sub.title}`;
      if (preselectedCatId === sub.id) subOpt.selected = true;
      studyGroup.appendChild(subOpt);
    });
    universalDestSelect.appendChild(studyGroup);
  }

  if (universalDateInput) {
    universalDateInput.value = getTodayISO();
  }

  universalAddModal.classList.remove("hidden");
  setTimeout(() => {
    if (universalTitleInput) universalTitleInput.focus();
  }, 50);

  updateUniversalContextFields();
}

function closeUniversalAddModal() {
  if (!universalAddModal) return;
  universalAddModal.classList.add("hidden");
  if (universalAddForm) universalAddForm.reset();
}

if (universalNewItemBtn) {
  universalNewItemBtn.addEventListener("click", () => openUniversalAddModal());
}
[closeUniversalAddModalBtn, cancelUniversalAddModalBtn].forEach(btn => {
  if (btn) btn.addEventListener("click", closeUniversalAddModal);
});

const uItemTypeRadios = document.querySelectorAll('input[name="uItemType"]');
uItemTypeRadios.forEach(radio => {
  radio.addEventListener("change", updateUniversalContextFields);
});

function updateUniversalContextFields() {
  const selectedType = document.querySelector('input[name="uItemType"]:checked')?.value || "task";
  if (uVideoUrlWrapper) {
    uVideoUrlWrapper.classList.toggle("hidden", selectedType !== "media");
  }
}

if (universalAddForm) {
  universalAddForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const destCatId = universalDestSelect ? universalDestSelect.value : AppState.studies.categories[0]?.id;
    const itemType = document.querySelector('input[name="uItemType"]:checked')?.value || "task";
    const title = universalTitleInput.value.trim();
    const date = normalizeDateStr(universalDateInput.value);
    const time = universalTimeInput.value;
    const videoUrl = universalVideoUrlInput.value.trim();
    const status = universalStatusSelect.value;
    const color = universalColorSelect.value;
    const notes = universalNotesInput.value.trim();

    if (!title) return;

    const moduleMapping = {
      task: "study",
      event: "viva",
      media: "dayschool"
    };

    const statusNames = { "not-started": "Not Started", "in-progress": "In Progress", "review": "Review", "done": "Done" };
    const statusColors = { "not-started": "gray", "in-progress": "yellow", "review": "purple", "done": "green" };

    const newEvent = {
      id: "evt_study_" + Date.now(),
      categoryId: destCatId,
      module: moduleMapping[itemType] || "study",
      title: title,
      priority: "Medium",
      date: date || getTodayISO(),
      endDate: "",
      isRange: false,
      includeTime: !!time,
      startTime: time || "09:00",
      endTime: "10:00",
      color: color,
      status: status,
      completed: status === "done",
      notes: notes,
      properties: [
        { id: "p1", name: "Status", type: "status", value: statusNames[status] || "Not Started", color: statusColors[status] || "gray" },
        { id: "p2", name: "Priority", type: "priority", value: "Medium", color: "yellow" }
      ],
      meta: {
        videoUrl: videoUrl,
        watched: status === "done"
      }
    };

    saveStudyItem(newEvent, { showNotification: true });
    closeUniversalAddModal();
  });
}

// ============================================================================
// 14. ULTRA-CLEAN HOME DASHBOARD LOGIC (Studies Focused)
// ============================================================================
const dashGreeting = document.getElementById("dashGreeting");
const dashTodayDatePill = document.getElementById("dashTodayDatePill");
const dashQuote = document.getElementById("dashQuote");

const pomoActiveDot = document.getElementById("pomoActiveDot");
const pomoTimerDisplay = document.getElementById("pomoTimerDisplay");
const pomoToggleBtn = document.getElementById("pomoToggleBtn");
const pomoResetBtn = document.getElementById("pomoResetBtn");

const todayTasksCount = document.getElementById("todayTasksCount");
const todayTasksList = document.getElementById("todayTasksList");
const addTodayTaskForm = document.getElementById("addTodayTaskForm");
const todayTaskInput = document.getElementById("todayTaskInput");

const upcomingDeadlinesList = document.getElementById("upcomingDeadlinesList");
const dashCalMonthHeading = document.getElementById("dashCalMonthHeading");
const dashboardCalendarGrid = document.getElementById("dashboardCalendarGrid");
const dashCalPrevBtn = document.getElementById("dashCalPrevBtn");
const dashCalNextBtn = document.getElementById("dashCalNextBtn");
const dashCalTodayBtn = document.getElementById("dashCalTodayBtn");

const pendingLecturesCount = document.getElementById("pendingLecturesCount");
const pendingLecturesContainer = document.getElementById("pendingLecturesContainer");

function initDashboardHeader() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "Good evening, Scholar";
  if (hour < 12) greeting = "Good morning, Scholar";
  else if (hour < 17) greeting = "Good afternoon, Scholar";

  if (dashGreeting) dashGreeting.textContent = greeting;
  if (dashTodayDatePill) {
    dashTodayDatePill.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (dashQuote && !dashQuote.dataset.initialized) {
    const randomQuote = STUDY_QUOTES[Math.floor(Math.random() * STUDY_QUOTES.length)];
    dashQuote.textContent = randomQuote;
    dashQuote.dataset.initialized = "true";
  }
}

function initPomodoroTimer() {
  if (!pomoTimerDisplay) return;

  function updatePomoDisplay() {
    const m = Math.floor(AppState.ui.pomo.remainingSeconds / 60);
    const s = AppState.ui.pomo.remainingSeconds % 60;
    pomoTimerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (pomoToggleBtn) {
    pomoToggleBtn.addEventListener("click", () => {
      AppState.ui.pomo.running = !AppState.ui.pomo.running;
      if (AppState.ui.pomo.running) {
        pomoToggleBtn.innerHTML = `<i data-lucide="pause" class="w-3.5 h-3.5"></i>`;
        if (pomoActiveDot) pomoActiveDot.classList.add("animate-pulse", "shadow-sm");
        
        AppState.ui.pomo.interval = setInterval(() => {
          if (AppState.ui.pomo.remainingSeconds > 0) {
            AppState.ui.pomo.remainingSeconds--;
            updatePomoDisplay();
          } else {
            clearInterval(AppState.ui.pomo.interval);
            AppState.ui.pomo.running = false;
            pomoToggleBtn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>`;
            if (pomoActiveDot) pomoActiveDot.classList.remove("animate-pulse");
            showToast("Pomodoro session completed! Take a 5-minute break.", "info");
            AppState.ui.pomo.remainingSeconds = 25 * 60;
            updatePomoDisplay();
          }
        }, 1000);
      } else {
        clearInterval(AppState.ui.pomo.interval);
        pomoToggleBtn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>`;
        if (pomoActiveDot) pomoActiveDot.classList.remove("animate-pulse");
      }
      lucide.createIcons();
    });
  }

  if (pomoResetBtn) {
    pomoResetBtn.addEventListener("click", () => {
      clearInterval(AppState.ui.pomo.interval);
      AppState.ui.pomo.running = false;
      AppState.ui.pomo.remainingSeconds = 25 * 60;
      updatePomoDisplay();
      if (pomoToggleBtn) pomoToggleBtn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>`;
      if (pomoActiveDot) pomoActiveDot.classList.remove("animate-pulse");
      lucide.createIcons();
    });
  }

  updatePomoDisplay();
}

function renderTodayChecklist() {
  if (!todayTasksList) return;
  todayTasksList.innerHTML = "";

  const todayStr = getTodayISO();
  const aggregatedItems = [];
  const seenKeys = new Set();

  (AppState.studies.items || []).forEach(evt => {
    const evtDate = normalizeDateStr(evt.date);
    const evtEndDate = normalizeDateStr(evt.endDate);

    const isToday = evtDate === todayStr;
    const isInsideRange = evt.isRange && evtEndDate && todayStr >= evtDate && todayStr <= evtEndDate;

    if (isToday || isInsideRange) {
      const sub = AppState.studies.categories.find(s => s.id === evt.categoryId);
      const catLabel = sub ? sub.title : "Studies";
      const colorKey = evt.color || "purple";
      const isCompleted = evt.status === 'done' || !!evt.completed || (evt.meta && !!evt.meta.watched);

      const key = `evt_${evt.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        aggregatedItems.push({
          id: evt.id,
          title: evt.title || "Untitled Event",
          priority: evt.priority || "Medium",
          category: catLabel,
          color: colorKey,
          completed: isCompleted,
          source: "event",
          rawRef: evt
        });
      }
    }
  });

  (AppState.studies.todos || []).forEach(task => {
    const key = `task_${task.id}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      aggregatedItems.push({
        id: task.id,
        title: task.text || "Quick Task",
        priority: "Low",
        category: "Study Task",
        color: "gray",
        completed: !!task.completed,
        source: "manual",
        rawRef: task
      });
    }
  });

  const totalCount = aggregatedItems.length;
  const completedCount = aggregatedItems.filter(item => item.completed).length;
  if (todayTasksCount) {
    todayTasksCount.textContent = `${completedCount}/${totalCount} Completed`;
  }

  if (totalCount === 0) {
    todayTasksList.innerHTML = `<p class="text-xs text-[var(--text-muted)] py-3 text-center">Nothing scheduled for today. You're all clear!</p>`;
    return;
  }

  aggregatedItems.forEach(item => {
    const card = document.createElement("div");
    card.className = `today-task-card ${item.completed ? 'completed' : ''} group cursor-pointer`;
    const prio = getPriorityInfo(item.priority);

    card.innerHTML = `
      <div class="flex items-center gap-2.5 truncate mr-2 min-w-0">
        <input type="checkbox" ${item.completed ? 'checked' : ''} class="custom-checkbox task-check-btn" />
        <span class="today-task-title text-xs font-medium text-[var(--text-primary)] truncate">${escapeHtml(item.title)}</span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        ${item.priority && item.priority !== "None" ? `<span class="notion-priority-badge ${prio.badgeClass}">${prio.key}</span>` : ''}
        <span class="px-2 py-0.5 rounded text-[10px] font-medium notion-tag-${item.color}">${escapeHtml(item.category)}</span>
        
        ${item.source === 'manual' ? `
          <button class="delete-task-btn text-[var(--text-muted)] hover:text-rose-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Task">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        ` : `
          <button class="open-ref-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Open Details">
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </button>
        `}
      </div>
    `;

    const checkbox = card.querySelector(".task-check-btn");
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      const isChecked = e.target.checked;

      if (item.source === "event") {
        item.rawRef.completed = isChecked;
        item.rawRef.status = isChecked ? "done" : "in-progress";

        if (item.rawRef.meta && item.rawRef.module === "dayschool") {
          item.rawRef.meta.watched = isChecked;
        }

        saveStudyItem(item.rawRef, { showNotification: false });
      } else if (item.source === "manual") {
        item.rawRef.completed = isChecked;
        saveDomain(STORAGE_KEYS.STUDIES_TODOS, AppState.studies.todos);
        renderTodayChecklist();
      }
    });

    if (item.source === "manual") {
      const delBtn = card.querySelector(".delete-task-btn");
      if (delBtn) {
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          AppState.studies.todos = AppState.studies.todos.filter(t => t.id !== item.id);
          saveDomain(STORAGE_KEYS.STUDIES_TODOS, AppState.studies.todos);
          renderTodayChecklist();
        });
      }
    } else if (item.source === "event") {
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-checkbox")) {
          openPageModal(item.rawRef);
        }
      });
    }

    todayTasksList.appendChild(card);
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (addTodayTaskForm) {
  addTodayTaskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = todayTaskInput.value.trim();
    if (!text) return;

    AppState.studies.todos.push({
      id: "st_" + Date.now(),
      text: text,
      completed: false,
      subject: "General Studies"
    });

    saveDomain(STORAGE_KEYS.STUDIES_TODOS, AppState.studies.todos);
    todayTaskInput.value = "";
    renderTodayChecklist();
    showToast("Task added to Studies Focus", "info");
  });
}

function renderUpcomingDeadlines() {
  if (!upcomingDeadlinesList) return;
  upcomingDeadlinesList.innerHTML = "";

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const threeDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 23, 59, 59);

  const upcoming = AppState.studies.items.filter(evt => {
    const evtDate = new Date(normalizeDateStr(evt.date));
    return evtDate >= todayStart && evtDate <= threeDaysLater;
  }).sort((a, b) => new Date(normalizeDateStr(a.date)) - new Date(normalizeDateStr(b.date)));

  if (upcoming.length === 0) {
    upcomingDeadlinesList.innerHTML = `<p class="text-xs text-[var(--text-muted)] py-3 text-center">No high-urgency deadlines in the next 72h.</p>`;
    return;
  }

  upcoming.forEach(evt => {
    const evtDate = new Date(normalizeDateStr(evt.date));
    const diffDays = Math.round((evtDate - todayStart) / (1000 * 60 * 60 * 24));
    let relativeStr = "Today";
    if (diffDays === 1) relativeStr = "Tomorrow";
    else if (diffDays === 2) relativeStr = "In 2 days";
    else if (diffDays === 3) relativeStr = "In 3 days";

    const colorKey = evt.color || "purple";
    const sub = AppState.studies.categories.find(s => s.id === evt.categoryId);
    const tagLabel = sub ? sub.title : (evt.module ? evt.module.toUpperCase() : 'STUDIES');
    const prio = getPriorityInfo(evt.priority);

    const card = document.createElement("div");
    card.className = "p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] cursor-pointer transition-all flex items-center justify-between gap-2 group";
    
    card.innerHTML = `
      <div class="truncate mr-2">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-medium notion-tag-${colorKey}">${tagLabel}</span>
          ${evt.priority && evt.priority !== "None" ? `<span class="notion-priority-badge ${prio.badgeClass}">${prio.key}</span>` : ''}
          <span class="text-[10px] text-[var(--text-muted)] font-mono">${(evt.meta && evt.meta.subject) || ''}</span>
        </div>
        <p class="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-purple-400 transition-colors">${escapeHtml(evt.title)}</p>
      </div>
      <div class="shrink-0 text-right">
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">${relativeStr}</span>
      </div>
    `;

    card.addEventListener("click", () => openPageModal(evt));
    upcomingDeadlinesList.appendChild(card);
  });
}

function renderDashboardCalendar() {
  if (!dashboardCalendarGrid) return;
  dashboardCalendarGrid.innerHTML = "";

  const d = AppState.ui.calendar.currentDate;
  const year = d.getFullYear();
  const month = d.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (dashCalMonthHeading) {
    dashCalMonthHeading.textContent = `${monthNames[month]} ${year}`;
  }

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  const todayStr = getTodayISO();

  const allEvents = getAllWorkspaceEvents();

  function getEventsForDate(dateStr) {
    const normalizedTarget = normalizeDateStr(dateStr);
    return allEvents.filter(e => {
      const eDate = normalizeDateStr(e.date);
      const eEndDate = normalizeDateStr(e.endDate);
      if (e.isRange && eEndDate) {
        return normalizedTarget >= eDate && normalizedTarget <= eEndDate;
      }
      return eDate === normalizedTarget;
    });
  }

  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevMonthTotalDays - i + 1;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = normalizeDateStr(prevDate);
    const cell = createCalendarCell(dayNum, dateStr, true, false, getEventsForDate(dateStr), allEvents);
    dashboardCalendarGrid.appendChild(cell);
  }

  for (let i = 1; i <= totalDaysInMonth; i++) {
    const currDate = new Date(year, month, i);
    const dateStr = normalizeDateStr(currDate);
    const isToday = dateStr === todayStr;
    const cell = createCalendarCell(i, dateStr, false, isToday, getEventsForDate(dateStr), allEvents);
    dashboardCalendarGrid.appendChild(cell);
  }

  const totalRendered = firstDayIndex + totalDaysInMonth;
  const nextMonthDays = 35 - totalRendered > 0 ? 35 - totalRendered : 42 - totalRendered;
  for (let i = 1; i <= nextMonthDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    const dateStr = normalizeDateStr(nextDate);
    const cell = createCalendarCell(i, dateStr, true, false, getEventsForDate(dateStr), allEvents);
    dashboardCalendarGrid.appendChild(cell);
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (dashCalPrevBtn) {
  dashCalPrevBtn.addEventListener("click", () => {
    AppState.ui.calendar.currentDate.setMonth(AppState.ui.calendar.currentDate.getMonth() - 1);
    renderDashboardCalendar();
  });
}
if (dashCalNextBtn) {
  dashCalNextBtn.addEventListener("click", () => {
    AppState.ui.calendar.currentDate.setMonth(AppState.ui.calendar.currentDate.getMonth() + 1);
    renderDashboardCalendar();
  });
}
if (dashCalTodayBtn) {
  dashCalTodayBtn.addEventListener("click", () => {
    AppState.ui.calendar.currentDate = new Date();
    renderDashboardCalendar();
  });
}

// ============================================================================
// 14. CUSTOMIZABLE HOME DASHBOARD BOTTOM WIDGET ENGINE (`#homeBottomWidget`)
// ============================================================================
const swapHomeWidgetBtn = document.getElementById("swapHomeWidgetBtn");
const swapHomeWidgetMenu = document.getElementById("swapHomeWidgetMenu");
const homeWidgetTitle = document.getElementById("homeWidgetTitle");
const homeWidgetBadge = document.getElementById("homeWidgetBadge");
const homeWidgetIcon = document.getElementById("homeWidgetIcon");
const homeWidgetBody = document.getElementById("homeWidgetBody");

const HOME_WIDGET_CONFIGS = {
  dayschools: {
    title: "Pending Day School Recordings",
    icon: "video",
    iconColor: "text-sky-500",
    label: "Pending Day Schools"
  },
  examsheet: {
    title: "Exam Study & Revision Sheet",
    icon: "file-check-2",
    iconColor: "text-rose-500",
    label: "Exam & Revision Sheet"
  },
  scratchpad: {
    title: "Study Scratchpad & Quick Notes",
    icon: "edit-3",
    iconColor: "text-amber-500",
    label: "Study Scratchpad"
  },
  sprints: {
    title: "Active Study Sprints & Milestones",
    icon: "target",
    iconColor: "text-emerald-500",
    label: "Active Study Sprints"
  }
};

function getActiveHomeWidget() {
  return localStorage.getItem("nexus_home_widget") || "dayschools";
}

function setActiveHomeWidget(widgetKey) {
  localStorage.setItem("nexus_home_widget", widgetKey);
  renderHomeBottomWidget();
  showToast(`Mounted "${HOME_WIDGET_CONFIGS[widgetKey]?.label || widgetKey}"`, "info");
}

function renderHomeBottomWidget() {
  if (!homeWidgetBody) return;
  const activeWidget = getActiveHomeWidget();
  const config = HOME_WIDGET_CONFIGS[activeWidget] || HOME_WIDGET_CONFIGS.dayschools;

  if (homeWidgetTitle) homeWidgetTitle.textContent = config.title;
  if (homeWidgetIcon) {
    homeWidgetIcon.setAttribute("data-lucide", config.icon);
    homeWidgetIcon.className = `w-4 h-4 ${config.iconColor}`;
  }

  homeWidgetBody.innerHTML = "";

  if (activeWidget === "dayschools") {
    renderWidgetPendingDaySchools();
  } else if (activeWidget === "examsheet") {
    renderWidgetExamRevisionSheet();
  } else if (activeWidget === "scratchpad") {
    renderWidgetStudyScratchpad();
  } else if (activeWidget === "sprints") {
    renderWidgetActiveSprints();
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// 1. Pending Day Schools Widget
function renderWidgetPendingDaySchools() {
  const daySchoolEvents = AppState.studies.items.filter(e => e.module === "dayschool" || (e.meta && e.meta.videoUrl));
  const pending = daySchoolEvents.filter(v => !(v.meta && v.meta.watched) && v.status !== "done");

  if (homeWidgetBadge) {
    homeWidgetBadge.className = "text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded notion-tag-blue font-medium whitespace-nowrap shrink-0";
    homeWidgetBadge.textContent = `${pending.length} Unwatched`;
  }

  if (pending.length === 0) {
    homeWidgetBody.innerHTML = `
      <div class="py-8 text-center text-xs text-[var(--text-muted)] space-y-1.5">
        <i data-lucide="check-check" class="w-6 h-6 mx-auto text-emerald-500"></i>
        <div class="font-medium text-[var(--text-secondary)]">All caught up!</div>
        <div>All day school recordings have been watched and completed.</div>
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3";

  pending.forEach(video => {
    const card = document.createElement("div");
    card.className = "p-2.5 sm:p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between space-y-2 sm:space-y-3 shadow-xs";
    const subjectName = (video.meta && video.meta.subject) || "Day School";
    const videoLink = (video.meta && video.meta.videoUrl) || "#";

    card.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center justify-between gap-1 flex-wrap">
          <span class="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium notion-tag-blue truncate max-w-full">${escapeHtml(subjectName)}</span>
          <span class="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-mono">${video.date}</span>
        </div>
        <p class="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] leading-tight pt-0.5 line-clamp-2">${escapeHtml(video.title)}</p>
      </div>

      <div class="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-[var(--border-subtle)] gap-1">
        <label class="flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
          <input type="checkbox" class="custom-checkbox mark-watched-chk" data-id="${video.id}" />
          <span class="hidden sm:inline">Mark Watched</span>
          <span class="sm:hidden">Watched</span>
        </label>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="open-record-btn p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hidden sm:block" title="Open record">
            <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          </button>
          <a href="${videoLink}" target="_blank" rel="noopener noreferrer" class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] flex items-center gap-1">
            <span>Watch</span>
            <i data-lucide="external-link" class="w-2.5 h-2.5 sm:w-3 sm:h-3"></i>
          </a>
        </div>
      </div>
    `;

    card.querySelector(".mark-watched-chk").addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!video.meta) video.meta = {};
        video.meta.watched = true;
        video.status = "done";
        video.completed = true;
        saveStudyItem(video, { showNotification: false });
        showToast(`Marked "${video.title}" as watched!`, "success");
        renderHomeBottomWidget();
        renderTodayChecklist();
      }
    });

    card.querySelector(".open-record-btn").addEventListener("click", () => openPageModal(video));

    grid.appendChild(card);
  });

  homeWidgetBody.appendChild(grid);
}

// 2. Exam Study & Revision Sheet Widget
function renderWidgetExamRevisionSheet() {
  const examItems = AppState.studies.items.filter(e => e.module === "exam" || e.categoryId === "sub_exams" || (e.title && e.title.toLowerCase().includes("exam")));

  const displayExams = examItems.length > 0 ? examItems : [
    {
      id: "sample_exam_1",
      title: "CS302 Advanced Algorithms Final Exam",
      date: "2026-09-15",
      meta: {
        confidence: "High",
        papers: { "2022": true, "2023": true, "2024": false, "Mock": false }
      }
    },
    {
      id: "sample_exam_2",
      title: "MA201 Linear Algebra & Discrete Math",
      date: "2026-09-22",
      meta: {
        confidence: "Medium",
        papers: { "2022": true, "2023": false, "2024": false, "Mock": false }
      }
    },
    {
      id: "sample_exam_3",
      title: "SE405 Distributed Systems Architecture",
      date: "2026-09-29",
      meta: {
        confidence: "Needs Focus",
        papers: { "2022": false, "2023": false, "2024": false, "Mock": false }
      }
    }
  ];

  if (homeWidgetBadge) {
    homeWidgetBadge.className = "text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded notion-tag-purple font-medium whitespace-nowrap shrink-0";
    homeWidgetBadge.textContent = `${displayExams.length} Subjects Active`;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-3 gap-3.5";

  displayExams.forEach(exam => {
    if (!exam.meta) exam.meta = {};
    if (!exam.meta.papers) exam.meta.papers = { "2022": true, "2023": false, "2024": false, "Mock": false };
    const conf = exam.meta.confidence || "Medium";

    const papersKeys = Object.keys(exam.meta.papers);
    const completedCount = papersKeys.filter(k => exam.meta.papers[k]).length;
    const totalCount = papersKeys.length;
    const progressPct = Math.round((completedCount / totalCount) * 100);

    const confClassMap = {
      "High": "notion-tag-green",
      "Medium": "notion-tag-yellow",
      "Needs Focus": "notion-tag-red"
    };

    const card = document.createElement("div");
    card.className = "p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between space-y-3 shadow-xs";

    card.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-1">
          <span class="px-2 py-0.5 rounded text-[10px] font-medium ${confClassMap[conf] || 'notion-tag-yellow'} cursor-pointer select-none conf-toggle-btn" title="Click to cycle confidence rating">
            ${escapeHtml(conf)}
          </span>
          <span class="text-[10px] text-[var(--text-muted)] font-mono">${exam.date || 'TBD'}</span>
        </div>
        <h4 class="text-xs font-semibold text-[var(--text-primary)] leading-snug">${escapeHtml(exam.title)}</h4>
      </div>

      <!-- Past Papers Checklist Pills -->
      <div class="space-y-1.5 pt-1">
        <div class="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>Past Papers & Mocks</span>
          <span class="font-mono">${completedCount}/${totalCount} Done (${progressPct}%)</span>
        </div>
        <div class="w-full bg-[var(--border-subtle)] rounded-full h-1.5 overflow-hidden">
          <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap pt-1">
          ${papersKeys.map(paperYear => `
            <button type="button" class="paper-toggle-btn px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${exam.meta.papers[paperYear] ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-semibold' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}" data-year="${paperYear}">
              ${exam.meta.papers[paperYear] ? '✓' : '○'} ${paperYear}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Confidence Toggle
    card.querySelector(".conf-toggle-btn").addEventListener("click", () => {
      const cycle = { "Needs Focus": "Medium", "Medium": "High", "High": "Needs Focus" };
      exam.meta.confidence = cycle[conf] || "Medium";
      if (!exam.id.startsWith("sample_")) {
        saveStudyItem(exam, { showNotification: false });
      }
      renderWidgetExamRevisionSheet();
      showToast(`Confidence for "${exam.title}": ${exam.meta.confidence}`, "info");
    });

    // Past Papers Toggle
    card.querySelectorAll(".paper-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const yr = btn.getAttribute("data-year");
        exam.meta.papers[yr] = !exam.meta.papers[yr];
        if (!exam.id.startsWith("sample_")) {
          saveStudyItem(exam, { showNotification: false });
        }
        renderWidgetExamRevisionSheet();
      });
    });

    grid.appendChild(card);
  });

  homeWidgetBody.appendChild(grid);
}

// 3. Study Scratchpad Widget
function renderWidgetStudyScratchpad() {
  const savedNotes = localStorage.getItem("nexus_study_scratchpad") || 
`# Lecture Key Points & Formulas
- CS302: Bellman-Ford complexity is O(V * E)
- Matrix Inverse requires det(A) ≠ 0
- Priority queue invariant must hold across all threads

## Next Action Items
1. Review Lecture 04 Day School recording
2. Solve 2024 Past Paper Section B`;

  if (homeWidgetBadge) {
    homeWidgetBadge.className = "text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded notion-tag-green font-medium whitespace-nowrap shrink-0";
    homeWidgetBadge.textContent = "Autosaved";
  }

  homeWidgetBody.innerHTML = `
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div class="flex items-center gap-2">
          <button type="button" id="scratchpadBulletBtn" class="px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[11px]">+ Bullet</button>
          <button type="button" id="scratchpadTaskBtn" class="px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[11px]">+ Task Checkbox</button>
          <button type="button" id="scratchpadClearBtn" class="px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:text-rose-400 text-[11px]">Clear</button>
        </div>
        <span id="scratchpadStatus" class="text-[10px] font-mono text-[var(--text-muted)]">Synced locally</span>
      </div>
      <textarea id="scratchpadTextarea" rows="6" placeholder="Type quick lecture notes, formulas, or markdown scratchpad..." class="w-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-[var(--border-hover)] rounded-xl p-3.5 text-xs text-[var(--text-primary)] font-mono leading-relaxed outline-none resize-y">${escapeHtml(savedNotes)}</textarea>
    </div>
  `;

  const textarea = homeWidgetBody.querySelector("#scratchpadTextarea");
  const status = homeWidgetBody.querySelector("#scratchpadStatus");

  let timeout = null;
  textarea.addEventListener("input", (e) => {
    status.textContent = "Saving...";
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      localStorage.setItem("nexus_study_scratchpad", e.target.value);
      status.textContent = "Saved";
      setTimeout(() => { status.textContent = "Synced locally"; }, 1500);
    }, 400);
  });

  homeWidgetBody.querySelector("#scratchpadBulletBtn").addEventListener("click", () => {
    textarea.value += "\n- ";
    textarea.focus();
  });
  homeWidgetBody.querySelector("#scratchpadTaskBtn").addEventListener("click", () => {
    textarea.value += "\n- [ ] ";
    textarea.focus();
  });
  homeWidgetBody.querySelector("#scratchpadClearBtn").addEventListener("click", () => {
    confirmDeletion({
      title: "Clear Scratchpad?",
      desc: "This will wipe all content in your current scratchpad. Are you sure?",
      onConfirm: () => {
        textarea.value = "";
        localStorage.setItem("nexus_study_scratchpad", "");
        showToast("Scratchpad cleared", "info");
      }
    });
  });
}

// 4. Active Study Sprints Widget
function renderWidgetActiveSprints() {
  const sprintModules = AppState.studies.categories.map((cat, idx) => {
    const items = AppState.studies.items.filter(i => i.categoryId === cat.id);
    const completed = items.filter(i => i.completed || i.status === "done").length;
    const total = items.length || 1;
    const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : (idx % 2 === 0 ? 60 : 35);
    return {
      id: cat.id,
      title: cat.title,
      icon: cat.icon || "folder",
      totalItems: items.length,
      completedItems: completed,
      pct: pct
    };
  });

  if (homeWidgetBadge) {
    homeWidgetBadge.className = "text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded notion-tag-yellow font-medium whitespace-nowrap shrink-0";
    homeWidgetBadge.textContent = `${sprintModules.length} Modules Tracking`;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3";

  sprintModules.forEach(mod => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between space-y-3 shadow-xs cursor-pointer";
    card.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <i data-lucide="${mod.icon}" class="w-4 h-4 text-indigo-400"></i>
          <span class="text-[10px] font-mono font-semibold text-[var(--text-secondary)]">${mod.pct}%</span>
        </div>
        <h4 class="text-xs font-semibold text-[var(--text-primary)] truncate pt-0.5">${escapeHtml(mod.title)}</h4>
        <div class="text-[10px] text-[var(--text-muted)]">${mod.completedItems}/${mod.totalItems} tasks completed</div>
      </div>
      <div class="w-full bg-[var(--border-subtle)] rounded-full h-1.5 overflow-hidden">
        <div class="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style="width: ${mod.pct}%"></div>
      </div>
    `;

    card.addEventListener("click", () => navigateToStudySubPage(mod.id));
    grid.appendChild(card);
  });

  homeWidgetBody.appendChild(grid);
}

// Swap Widget Event Listeners
if (swapHomeWidgetBtn && swapHomeWidgetMenu) {
  swapHomeWidgetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    swapHomeWidgetMenu.classList.toggle("hidden");
  });
}

document.addEventListener("click", (e) => {
  if (swapHomeWidgetMenu && !swapHomeWidgetMenu.contains(e.target) && e.target !== swapHomeWidgetBtn) {
    swapHomeWidgetMenu.classList.add("hidden");
  }
});

const swapWidgetOptions = document.querySelectorAll(".swap-widget-opt");
swapWidgetOptions.forEach(opt => {
  opt.addEventListener("click", () => {
    const widgetKey = opt.getAttribute("data-widget");
    if (widgetKey) {
      setActiveHomeWidget(widgetKey);
    }
    if (swapHomeWidgetMenu) swapHomeWidgetMenu.classList.add("hidden");
  });
});

// ============================================================================
// 15. GLOBAL MASTER WORKSPACE CALENDAR VIEW
// ============================================================================
const calMonthYearHeading = document.getElementById("calMonthYearHeading");
const smartCalendarGrid = document.getElementById("smartCalendarGrid");
const calPrevBtn = document.getElementById("calPrevBtn");
const calNextBtn = document.getElementById("calNextBtn");
const calTodayBtn = document.getElementById("calTodayBtn");

function renderSmartCalendar() {
  if (!smartCalendarGrid) return;
  smartCalendarGrid.innerHTML = "";

  const d = AppState.ui.calendar.currentDate;
  const year = d.getFullYear();
  const month = d.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (calMonthYearHeading) {
    calMonthYearHeading.textContent = `${monthNames[month]} ${year}`;
  }

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  const todayStr = getTodayISO();
  const allEvents = getAllWorkspaceEvents();

  function getEventsForDate(dateStr) {
    const normalizedTarget = normalizeDateStr(dateStr);
    return allEvents.filter(e => {
      const eDate = normalizeDateStr(e.date);
      const eEndDate = normalizeDateStr(e.endDate);
      if (e.isRange && eEndDate) {
        return normalizedTarget >= eDate && normalizedTarget <= eEndDate;
      }
      return eDate === normalizedTarget;
    });
  }

  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevMonthTotalDays - i + 1;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = normalizeDateStr(prevDate);
    const cell = createCalendarCell(dayNum, dateStr, true, false, getEventsForDate(dateStr), allEvents);
    smartCalendarGrid.appendChild(cell);
  }

  for (let i = 1; i <= totalDaysInMonth; i++) {
    const currDate = new Date(year, month, i);
    const dateStr = normalizeDateStr(currDate);
    const isToday = dateStr === todayStr;
    const cell = createCalendarCell(i, dateStr, false, isToday, getEventsForDate(dateStr), allEvents);
    smartCalendarGrid.appendChild(cell);
  }

  const totalRendered = firstDayIndex + totalDaysInMonth;
  const nextMonthDays = 35 - totalRendered > 0 ? 35 - totalRendered : 42 - totalRendered;
  for (let i = 1; i <= nextMonthDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    const dateStr = normalizeDateStr(nextDate);
    const cell = createCalendarCell(i, dateStr, true, false, getEventsForDate(dateStr), allEvents);
    smartCalendarGrid.appendChild(cell);
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Interactive Calendar Day Cell (Opens Day Inspector on click!)
function createCalendarCell(dayNumber, dateStr, isOtherMonth, isToday, events, contextEventsPool) {
  const cell = document.createElement("div");
  cell.className = `cal-day-cell group ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'current-day' : ''}`;
  cell.dataset.date = dateStr;

  const header = document.createElement("div");
  header.className = "cal-day-header";

  const numSpan = document.createElement("span");
  numSpan.className = `text-[11px] font-mono ${isToday ? 'text-[var(--text-primary)] font-bold' : (isOtherMonth ? 'text-[var(--text-muted)] opacity-60' : 'text-[var(--text-secondary)]')}`;
  numSpan.textContent = dayNumber;

  const addBtn = document.createElement("button");
  addBtn.className = "cal-add-event-btn";
  addBtn.title = "Add event";
  addBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i>`;
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPageModal(dateStr);
  });

  header.appendChild(numSpan);
  header.appendChild(addBtn);
  cell.appendChild(header);

  const eventsContainer = document.createElement("div");
  eventsContainer.className = "cal-events-container";

  events.forEach(evt => {
    const pill = document.createElement("div");
    const colorKey = evt.color || (evt.module === 'dayschool' ? 'blue' : evt.module === 'viva' ? 'purple' : evt.module === 'assignment' ? 'orange' : evt.module === 'exam' ? 'red' : 'green');
    
    const isSpan = evt.isRange && evt.endDate && evt.endDate !== evt.date;
    pill.className = `event-pill ${isSpan ? 'span-pill' : ''} notion-tag-${colorKey}`;
    
    const timeStr = evt.includeTime && evt.startTime ? `${evt.startTime} ` : '';
    pill.textContent = `${timeStr}${evt.title || 'Untitled'}`;
    pill.title = `${evt.title || 'Untitled'}`;

    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      openPageModal(evt);
    });

    eventsContainer.appendChild(pill);
  });

  cell.appendChild(eventsContainer);

  // Clicking the day cell opens the Day Inspector Popover Modal!
  cell.addEventListener("click", (e) => {
    if (!e.target.closest(".event-pill") && !e.target.closest(".cal-add-event-btn")) {
      openCalendarDayInspector(dateStr, contextEventsPool);
    }
  });

  return cell;
}

if (calPrevBtn) {
  calPrevBtn.addEventListener("click", () => {
    AppState.ui.calendar.currentDate.setMonth(AppState.ui.calendar.currentDate.getMonth() - 1);
    renderSmartCalendar();
  });
}

if (calNextBtn) {
  calNextBtn.addEventListener("click", () => {
    AppState.ui.calendar.currentDate.setMonth(AppState.ui.calendar.currentDate.getMonth() + 1);
    renderSmartCalendar();
  });
}

if (calTodayBtn) {
  calTodayBtn.addEventListener("click", () => {
    AppState.ui.calendar.currentDate = new Date();
    renderSmartCalendar();
  });
}

// ============================================================================
// 16. NOTION PAGE MODAL (Studies Domain Scoped with Priority Property)
// ============================================================================
const pageModal = document.getElementById("pageModal");
const pageModalCard = document.getElementById("pageModalCard");
const closePageModalBtn = document.getElementById("closePageModalBtn");
const expandPageModalBtn = document.getElementById("expandPageModalBtn");
const donePageModalBtn = document.getElementById("donePageModalBtn");
const deletePageItemBtn = document.getElementById("deletePageItemBtn");

const pageModalBadge = document.getElementById("pageModalBadge");
const pageModalBadgeText = document.getElementById("pageModalBadgeText");
const pageModalCreatedDate = document.getElementById("pageModalCreatedDate");

const pageTitleInput = document.getElementById("pageTitleInput");
const pageColorPicker = document.getElementById("pageColorPicker");
const pageStartDateInput = document.getElementById("pageStartDateInput");
const pageEndDateInput = document.getElementById("pageEndDateInput");
const pageEndDateWrapper = document.getElementById("pageEndDateWrapper");
const pageToggleRange = document.getElementById("pageToggleRange");
const pageToggleTime = document.getElementById("pageToggleTime");
const pageTimePickerRow = document.getElementById("pageTimePickerRow");
const pageStartTimeInput = document.getElementById("pageStartTimeInput");
const pageEndTimeInput = document.getElementById("pageEndTimeInput");
const pageReminderSelect = document.getElementById("pageReminderSelect");
const dynamicPropertiesList = document.getElementById("dynamicPropertiesList");

const openAddPropertyMenuBtn = document.getElementById("openAddPropertyMenuBtn");
const propertyTypeMenu = document.getElementById("propertyTypeMenu");
const pageNotesTextarea = document.getElementById("pageNotesTextarea");

const propertyContextMenu = document.getElementById("propertyContextMenu");
const ctxDuplicatePropBtn = document.getElementById("ctxDuplicatePropBtn");
const ctxRenamePropBtn = document.getElementById("ctxRenamePropBtn");
const ctxDeletePropBtn = document.getElementById("ctxDeletePropBtn");

const propertyEditPopover = document.getElementById("propertyEditPopover");
const propEditNameInput = document.getElementById("propEditNameInput");
const propEditTypeLabel = document.getElementById("propEditTypeLabel");
const propEditTypeIcon = document.getElementById("propEditTypeIcon");
const deletePropertyFromPopoverBtn = document.getElementById("deletePropertyFromPopoverBtn");
const savePropertyFromPopoverBtn = document.getElementById("savePropertyFromPopoverBtn");

const statusDropdownPopover = document.getElementById("statusDropdownPopover");
const statusSearchInput = document.getElementById("statusSearchInput");
const statusOptionsContainer = document.getElementById("statusOptionsContainer");
const statusColorSubmenu = document.getElementById("statusColorSubmenu");
const statusColorList = document.getElementById("statusColorList");
const deleteStatusOptionBtn = document.getElementById("deleteStatusOptionBtn");

const tagSelectPopover = document.getElementById("tagSelectPopover");
const tagSearchInput = document.getElementById("tagSearchInput");
const tagOptionsContainer = document.getElementById("tagOptionsContainer");
const tagColorSubmenu = document.getElementById("tagColorSubmenu");
const tagColorList = document.getElementById("tagColorList");
const deleteTagOptionBtn = document.getElementById("deleteTagOptionBtn");

let isFullscreenPageModal = false;

function openPageModal(eventOrDate) {
  if (typeof eventOrDate === "string") {
    const isRoot = AppState.ui.activeSubPageId === "studies_root";
    const targetSubId = isRoot ? (AppState.studies.categories[0]?.id || "sub_dayschool") : AppState.ui.activeSubPageId;

    AppState.ui.activePageItem = {
      id: "evt_study_" + Date.now(),
      categoryId: targetSubId,
      title: "",
      module: "task",
      priority: "Medium",
      color: "purple",
      status: "not-started",
      date: normalizeDateStr(eventOrDate),
      endDate: "",
      isRange: false,
      includeTime: false,
      startTime: "09:00",
      endTime: "10:00",
      reminder: "none",
      completed: false,
      notes: "",
      properties: [
        { id: "prop_1", name: "Status", type: "status", value: "Not Started", color: "gray" },
        { id: "prop_2", name: "Priority", type: "priority", value: "Medium", color: "yellow" }
      ],
      meta: {}
    };
  } else if (eventOrDate && typeof eventOrDate === "object") {
    AppState.ui.activePageItem = JSON.parse(JSON.stringify(eventOrDate));
    AppState.ui.activePageItem.date = normalizeDateStr(AppState.ui.activePageItem.date);
    if (AppState.ui.activePageItem.endDate) {
      AppState.ui.activePageItem.endDate = normalizeDateStr(AppState.ui.activePageItem.endDate);
    }
    if (!AppState.ui.activePageItem.priority) {
      AppState.ui.activePageItem.priority = "None";
    }
    if (!AppState.ui.activePageItem.categoryId || AppState.ui.activePageItem.categoryId === "studies_root") {
      AppState.ui.activePageItem.categoryId = AppState.studies.categories[0]?.id || "sub_dayschool";
    }
    if (!AppState.ui.activePageItem.properties) AppState.ui.activePageItem.properties = [];
    if (!AppState.ui.activePageItem.meta) AppState.ui.activePageItem.meta = {};
  }

  const p = AppState.ui.activePageItem;
  if (!p) return;

  pageTitleInput.value = p.title || "";
  setModalColorSwatches(p.color || "purple");
  
  const sub = AppState.studies.categories.find(s => s.id === p.categoryId);
  const badgeLabel = sub ? sub.title : (p.module || "Study Item");
  updatePageModalBadge(badgeLabel, p.color || "purple");
  pageModalCreatedDate.textContent = p.date || "Today";

  pageStartDateInput.value = p.date || getTodayISO();
  pageEndDateInput.value = p.endDate || "";
  pageToggleRange.checked = !!p.isRange;
  pageEndDateWrapper.style.display = p.isRange ? "flex" : "none";

  pageToggleTime.checked = !!p.includeTime;
  pageTimePickerRow.classList.toggle("hidden", !p.includeTime);
  pageStartTimeInput.value = p.startTime || "09:00";
  pageEndTimeInput.value = p.endTime || "10:30";
  pageReminderSelect.value = p.reminder || "none";

  pageNotesTextarea.value = p.notes || "";

  renderDynamicProperties();

  pageModal.classList.remove("hidden");
  setTimeout(() => pageTitleInput.focus(), 60);

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function updatePageModalBadge(badgeText, colorKey) {
  pageModalBadge.className = `text-xs px-2.5 py-0.5 rounded font-medium flex items-center gap-1.5 notion-tag-${colorKey}`;
  pageModalBadgeText.textContent = badgeText;
}

function setModalColorSwatches(selectedColor) {
  const swatches = pageColorPicker.querySelectorAll("button[data-color]");
  swatches.forEach(swatch => {
    if (swatch.getAttribute("data-color") === selectedColor) {
      swatch.classList.add("ring-2", "ring-offset-1", "ring-offset-[var(--bg-surface)]", "ring-[var(--text-primary)]");
    } else {
      swatch.classList.remove("ring-2", "ring-offset-1", "ring-offset-[var(--bg-surface)]", "ring-[var(--text-primary)]");
    }
  });
}

if (pageColorPicker) {
  const swatches = pageColorPicker.querySelectorAll("button[data-color]");
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const color = swatch.getAttribute("data-color");
      if (AppState.ui.activePageItem && color) {
        AppState.ui.activePageItem.color = color;
        setModalColorSwatches(color);
        const sub = AppState.studies.categories.find(s => s.id === AppState.ui.activePageItem.categoryId);
        updatePageModalBadge(sub ? sub.title : "Study Item", color);
        commitActivePageItem();
      }
    });
  });
}

if (pageToggleRange) {
  pageToggleRange.addEventListener("change", (e) => {
    if (AppState.ui.activePageItem) {
      AppState.ui.activePageItem.isRange = e.target.checked;
      pageEndDateWrapper.style.display = e.target.checked ? "flex" : "none";
      if (e.target.checked && !pageEndDateInput.value) {
        pageEndDateInput.value = pageStartDateInput.value;
      }
      commitActivePageItem();
    }
  });
}

if (pageToggleTime) {
  pageToggleTime.addEventListener("change", (e) => {
    if (AppState.ui.activePageItem) {
      AppState.ui.activePageItem.includeTime = e.target.checked;
      pageTimePickerRow.classList.toggle("hidden", !e.target.checked);
      commitActivePageItem();
    }
  });
}

[pageTitleInput, pageStartDateInput, pageEndDateInput, pageStartTimeInput, pageEndTimeInput, pageReminderSelect, pageNotesTextarea].forEach(input => {
  if (input) {
    input.addEventListener("input", commitActivePageItem);
    input.addEventListener("change", commitActivePageItem);
  }
});

function commitActivePageItem() {
  if (!AppState.ui.activePageItem) return;

  AppState.ui.activePageItem.title = pageTitleInput.value.trim() || "Untitled";
  AppState.ui.activePageItem.date = normalizeDateStr(pageStartDateInput.value);
  AppState.ui.activePageItem.endDate = normalizeDateStr(pageEndDateInput.value);
  AppState.ui.activePageItem.isRange = pageToggleRange.checked;
  AppState.ui.activePageItem.includeTime = pageToggleTime.checked;
  AppState.ui.activePageItem.startTime = pageStartTimeInput.value;
  AppState.ui.activePageItem.endTime = pageEndTimeInput.value;
  AppState.ui.activePageItem.reminder = pageReminderSelect.value;
  AppState.ui.activePageItem.notes = pageNotesTextarea.value;

  saveStudyItem(AppState.ui.activePageItem, { showNotification: false });
}

function closePageModal() {
  commitActivePageItem();
  if (pageModal) pageModal.classList.add("hidden");
  closePropertyEditPopover();
  closeStatusPopovers();
  closeTagPopovers();
  closePrioritySelectPopover();
  closePropertyContextMenu();
  AppState.ui.activePageItem = null;
}

if (closePageModalBtn) closePageModalBtn.addEventListener("click", closePageModal);
if (donePageModalBtn) donePageModalBtn.addEventListener("click", closePageModal);

if (deletePageItemBtn) {
  deletePageItemBtn.addEventListener("click", () => {
    if (!AppState.ui.activePageItem) return;
    const targetId = AppState.ui.activePageItem.id;
    const targetTitle = AppState.ui.activePageItem.title || "this study entry";

    confirmDeletion({
      desc: `Are you sure you want to delete "${targetTitle}"?`,
      onConfirm: () => {
        deleteStudyItem(targetId);
        pageModal.classList.add("hidden");
        AppState.ui.activePageItem = null;
      }
    });
  });
}

if (expandPageModalBtn) {
  expandPageModalBtn.addEventListener("click", () => {
    isFullscreenPageModal = !isFullscreenPageModal;
    if (isFullscreenPageModal) {
      pageModalCard.classList.remove("max-w-2xl", "max-h-[90vh]", "rounded-2xl");
      pageModalCard.classList.add("w-full", "h-full", "max-w-none", "max-h-none", "rounded-none");
    } else {
      pageModalCard.classList.add("max-w-2xl", "max-h-[90vh]", "rounded-2xl");
      pageModalCard.classList.remove("w-full", "h-full", "max-w-none", "max-h-none", "rounded-none");
    }
  });
}

// Dynamic Property Rendering inside Page Modal
const PROP_TYPE_META = {
  select: { label: "Select Tag", icon: "chevron-down-circle" },
  status: { label: "Status", icon: "check-circle-2" },
  priority: { label: "Priority", icon: "flag" },
  percentage: { label: "Number / Percentage", icon: "percent" },
  url: { label: "URL / Link", icon: "link" },
  file: { label: "Google Drive / File", icon: "folder-symlink" },
  checkbox: { label: "Checkbox", icon: "check-square" },
  email: { label: "Email", icon: "mail" },
  phone: { label: "Phone", icon: "phone" }
};

function renderDynamicProperties() {
  if (!dynamicPropertiesList || !AppState.ui.activePageItem) return;
  dynamicPropertiesList.innerHTML = "";

  AppState.ui.activePageItem.properties.forEach((prop, index) => {
    const row = document.createElement("div");
    row.className = "notion-property-row";
    row.dataset.propId = prop.id;

    const meta = PROP_TYPE_META[prop.type] || { label: "Property", icon: "tag" };

    let valueMarkup = "";
    if (prop.type === "select") {
      const tagColor = prop.color || "gray";
      const tagText = prop.value || "Empty";
      valueMarkup = `
        <div class="select-prop-trigger notion-tag-${tagColor} px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer flex items-center gap-1.5" data-prop-idx="${index}">
          <span>${escapeHtml(tagText)}</span>
          <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
        </div>
      `;
    } else if (prop.type === "status") {
      const statusText = prop.value || "Not Started";
      const statusColor = prop.color || (AppState.statusOptionsCache.find(s => s.name === statusText)?.color || "gray");
      valueMarkup = `
        <button type="button" class="notion-status-trigger notion-tag-${statusColor}" data-prop-idx="${index}" title="Click to change status">
          <span>${escapeHtml(statusText)}</span>
          <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
        </button>
      `;
    } else if (prop.type === "priority") {
      const prio = getPriorityInfo(prop.value || AppState.ui.activePageItem.priority);
      valueMarkup = `
        <button type="button" class="notion-priority-badge ${prio.badgeClass}" data-prop-idx="${index}" title="Click to change priority">
          <i data-lucide="flag" class="w-3 h-3"></i>
          <span>${prio.key}</span>
        </button>
      `;
    } else if (prop.type === "percentage") {
      const numVal = parseInt(prop.value) || 0;
      valueMarkup = `
        <div class="flex items-center gap-3 w-full">
          <input type="number" min="0" max="100" value="${numVal}" class="notion-property-input font-mono w-16" data-prop-idx="${index}" />
          <div class="w-24 bg-[var(--border-subtle)] rounded-full h-1.5 overflow-hidden">
            <div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${Math.min(100, numVal)}%"></div>
          </div>
          <span class="text-[11px] text-[var(--text-muted)] font-mono">%</span>
        </div>
      `;
    } else if (prop.type === "url") {
      const urlVal = prop.value || "";
      valueMarkup = `
        <div class="flex items-center gap-1.5 w-full">
          <input type="url" placeholder="https://..." value="${escapeHtml(urlVal)}" class="notion-property-input" data-prop-idx="${index}" />
          ${urlVal ? `<a href="${urlVal}" target="_blank" rel="noopener noreferrer" class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></a>` : ''}
        </div>
      `;
    } else if (prop.type === "file" || prop.type === "drive") {
      const fileVal = prop.value || "";
      const isDrive = fileVal.includes("drive.google.com") || fileVal.includes("docs.google.com");
      valueMarkup = `
        <div class="flex items-center gap-1.5 w-full">
          <input type="url" placeholder="Paste Google Drive / Resource Link..." value="${escapeHtml(fileVal)}" class="notion-property-input" data-prop-idx="${index}" />
          ${fileVal ? `
            <a href="${fileVal}" target="_blank" rel="noopener noreferrer" class="drive-attachment-badge ${isDrive ? 'notion-tag-blue' : 'notion-tag-gray'} shrink-0" title="Open Link">
              <i data-lucide="${isDrive ? 'folder-symlink' : 'paperclip'}" class="w-3 h-3"></i>
              <span>${isDrive ? 'Open in Drive ↗' : 'Open Link ↗'}</span>
            </a>
          ` : ''}
        </div>
      `;
    } else if (prop.type === "checkbox") {
      valueMarkup = `
        <input type="checkbox" ${prop.value ? 'checked' : ''} class="custom-checkbox" data-prop-idx="${index}" />
      `;
    } else if (prop.type === "email") {
      const emailVal = prop.value || "";
      valueMarkup = `
        <div class="flex items-center gap-1.5 w-full">
          <input type="email" placeholder="name@domain.com" value="${escapeHtml(emailVal)}" class="notion-property-input" data-prop-idx="${index}" />
          ${emailVal ? `<a href="mailto:${emailVal}" class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i data-lucide="send" class="w-3.5 h-3.5"></i></a>` : ''}
        </div>
      `;
    } else if (prop.type === "phone") {
      const phoneVal = prop.value || "";
      valueMarkup = `
        <div class="flex items-center gap-1.5 w-full">
          <input type="tel" placeholder="+1..." value="${escapeHtml(phoneVal)}" class="notion-property-input font-mono" data-prop-idx="${index}" />
          ${phoneVal ? `<a href="tel:${phoneVal}" class="p-1 text-[var(--text-muted)] hover:text-indigo-400 shrink-0" title="Call ${phoneVal}"><i data-lucide="phone-call" class="w-3.5 h-3.5"></i></a>` : ''}
        </div>
      `;
    }

    row.innerHTML = `
      <div class="notion-property-label" title="Click to rename or edit property">
        <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
        <span class="truncate font-medium">${escapeHtml(prop.name)}</span>
      </div>
      <div class="notion-property-value">
        ${valueMarkup}
      </div>
      <div class="flex justify-end">
        <button type="button" class="notion-property-menu-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded" data-prop-id="${prop.id}" data-prop-idx="${index}">
          <i data-lucide="more-horizontal" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const labelEl = row.querySelector(".notion-property-label");
    labelEl.addEventListener("click", (e) => {
      e.stopPropagation();
      openPropertyEditPopover(labelEl, index);
    });

    if (prop.type === "select") {
      const trigger = row.querySelector(".select-prop-trigger");
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        openTagSelectPopover(trigger, index);
      });
    }

    if (prop.type === "status") {
      const statusTrigger = row.querySelector(".notion-status-trigger");
      statusTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        openStatusDropdownPopover(statusTrigger, index);
      });
    }

    if (prop.type === "priority") {
      const prioBadge = row.querySelector(".notion-priority-badge");
      prioBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        openPrioritySelectPopover(prioBadge, (selectedPrio) => {
          prop.value = selectedPrio;
          prop.color = getPriorityInfo(selectedPrio).color;
          AppState.ui.activePageItem.priority = selectedPrio;
          commitActivePageItem();
          renderDynamicProperties();
          showToast(`Priority: ${selectedPrio}`, "info");
        });
      });
    }

    const inputEl = row.querySelector(".notion-property-input, input[type='checkbox']");
    if (inputEl) {
      if (inputEl.type === "checkbox") {
        inputEl.addEventListener("change", (e) => {
          prop.value = e.target.checked;
          commitActivePageItem();
        });
      } else {
        inputEl.addEventListener("input", (e) => {
          prop.value = e.target.value;
          commitActivePageItem();
        });
      }
    }

    const menuBtn = row.querySelector(".notion-property-menu-btn");
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPropertyEditPopover(menuBtn, index);
    });

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openPropertyEditPopover(row, index);
    });

    dynamicPropertiesList.appendChild(row);
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function openStatusDropdownPopover(triggerEl, propIndex) {
  AppState.ui.activeStatusPropertyContext = { propIndex };
  if (!statusDropdownPopover) return;

  const rect = triggerEl.getBoundingClientRect();
  statusDropdownPopover.style.left = `${Math.min(window.innerWidth - 270, rect.left)}px`;
  statusDropdownPopover.style.top = `${Math.min(window.innerHeight - 300, rect.bottom + 4)}px`;
  statusDropdownPopover.classList.remove("hidden");

  statusSearchInput.value = "";
  renderStatusOptionsList();
  setTimeout(() => statusSearchInput.focus(), 50);
}

function closeStatusPopovers() {
  if (statusDropdownPopover) statusDropdownPopover.classList.add("hidden");
  if (statusColorSubmenu) statusColorSubmenu.classList.add("hidden");
  AppState.ui.activeStatusPropertyContext = null;
  AppState.ui.activeStatusEditOption = null;
}

function renderStatusOptionsList(filterQuery = "") {
  if (!statusOptionsContainer) return;
  statusOptionsContainer.innerHTML = "";

  const query = filterQuery.toLowerCase().trim();
  const matched = AppState.statusOptionsCache.filter(opt => opt.name.toLowerCase().includes(query));

  matched.forEach(opt => {
    const row = document.createElement("div");
    row.className = "notion-popover-row group";
    
    row.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <span class="px-2 py-0.5 rounded text-[11px] font-medium notion-tag-${opt.color || 'gray'} truncate">${escapeHtml(opt.name)}</span>
      </div>
      <button type="button" class="opt-more-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <i data-lucide="more-horizontal" class="w-3.5 h-3.5"></i>
      </button>
    `;

    row.addEventListener("click", () => {
      if (AppState.ui.activePageItem && AppState.ui.activeStatusPropertyContext) {
        const prop = AppState.ui.activePageItem.properties[AppState.ui.activeStatusPropertyContext.propIndex];
        if (prop) {
          prop.value = opt.name;
          prop.color = opt.color;
          AppState.ui.activePageItem.status = opt.name.toLowerCase().replace(/\s+/g, '-');
          AppState.ui.activePageItem.completed = opt.name.toLowerCase() === "done";
          commitActivePageItem();
          renderDynamicProperties();
          showToast(`Status: ${opt.name}`, "info");
        }
      }
      closeStatusPopovers();
    });

    const moreBtn = row.querySelector(".opt-more-btn");
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openStatusColorSubmenu(moreBtn, opt);
    });

    statusOptionsContainer.appendChild(row);
  });

  if (query && !matched.some(o => o.name.toLowerCase() === query)) {
    const createRow = document.createElement("div");
    createRow.className = "notion-popover-row text-xs text-[var(--text-secondary)] flex items-center gap-1.5";
    createRow.innerHTML = `<span>+ Create</span> <span class="px-2 py-0.5 rounded text-[10px] notion-tag-gray font-medium">${escapeHtml(filterQuery)}</span>`;
    
    createRow.addEventListener("click", () => {
      const newStatus = {
        id: "st_" + Date.now(),
        name: filterQuery.trim(),
        color: "gray"
      };
      AppState.statusOptionsCache.push(newStatus);
      saveDomain(STORAGE_KEYS.STATUS_OPTIONS, AppState.statusOptionsCache);

      if (AppState.ui.activePageItem && AppState.ui.activeStatusPropertyContext) {
        const prop = AppState.ui.activePageItem.properties[AppState.ui.activeStatusPropertyContext.propIndex];
        if (prop) {
          prop.value = newStatus.name;
          prop.color = newStatus.color;
          AppState.ui.activePageItem.status = newStatus.name.toLowerCase().replace(/\s+/g, '-');
          commitActivePageItem();
          renderDynamicProperties();
        }
      }
      
      openStatusColorSubmenu(createRow, newStatus);
      showToast(`Created status "${newStatus.name}"`, "info");
    });
    statusOptionsContainer.appendChild(createRow);
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (statusSearchInput) {
  statusSearchInput.addEventListener("input", (e) => {
    renderStatusOptionsList(e.target.value);
  });
}

function openStatusColorSubmenu(btnEl, option) {
  AppState.ui.activeStatusEditOption = option;
  if (!statusColorSubmenu) return;

  const rect = btnEl.getBoundingClientRect();
  statusColorSubmenu.style.left = `${Math.min(window.innerWidth - 200, rect.right + 4)}px`;
  statusColorSubmenu.style.top = `${Math.min(window.innerHeight - 280, rect.top)}px`;
  statusColorSubmenu.classList.remove("hidden");

  renderStatusColorOptions();
}

function renderStatusColorOptions() {
  if (!statusColorList || !AppState.ui.activeStatusEditOption) return;
  statusColorList.innerHTML = "";

  NOTION_COLORS.forEach(c => {
    const item = document.createElement("div");
    item.className = "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--row-hover)] cursor-pointer text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
    const isCurrent = AppState.ui.activeStatusEditOption.color === c.key;

    item.innerHTML = `
      <span class="notion-swatch-sq ${c.swatchClass}"></span>
      <span class="flex-1">${c.label}</span>
      ${isCurrent ? '<i data-lucide="check" class="w-3.5 h-3.5 text-[var(--text-primary)]"></i>' : ''}
    `;

    item.addEventListener("click", () => {
      AppState.ui.activeStatusEditOption.color = c.key;
      saveDomain(STORAGE_KEYS.STATUS_OPTIONS, AppState.statusOptionsCache);

      if (AppState.ui.activePageItem) {
        AppState.ui.activePageItem.properties.forEach(p => {
          if (p.type === "status" && p.value === AppState.ui.activeStatusEditOption.name) {
            p.color = c.key;
          }
        });
        commitActivePageItem();
        renderDynamicProperties();
      }

      renderStatusOptionsList(statusSearchInput ? statusSearchInput.value : "");
      statusColorSubmenu.classList.add("hidden");
    });

    statusColorList.appendChild(item);
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (deleteStatusOptionBtn) {
  deleteStatusOptionBtn.addEventListener("click", () => {
    if (!AppState.ui.activeStatusEditOption) return;
    const optToDelete = AppState.ui.activeStatusEditOption;
    confirmDeletion({
      desc: `Delete status "${optToDelete.name}" from status options?`,
      onConfirm: () => {
        AppState.statusOptionsCache = AppState.statusOptionsCache.filter(o => o.id !== optToDelete.id);
        saveDomain(STORAGE_KEYS.STATUS_OPTIONS, AppState.statusOptionsCache);
        renderStatusOptionsList(statusSearchInput ? statusSearchInput.value : "");
        statusColorSubmenu.classList.add("hidden");
        showToast("Status option deleted", "info");
      }
    });
  });
}

function openPropertyEditPopover(anchorEl, propIndex) {
  AppState.ui.activeEditingPropertyIndex = propIndex;
  if (!propertyEditPopover || !AppState.ui.activePageItem) return;

  const prop = AppState.ui.activePageItem.properties[propIndex];
  if (!prop) return;

  const meta = PROP_TYPE_META[prop.type] || { label: "Property", icon: "tag" };
  propEditNameInput.value = prop.name;
  propEditTypeLabel.textContent = meta.label;
  propEditTypeIcon.setAttribute("data-lucide", meta.icon);

  const rect = anchorEl.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 4;

  if (left + 260 > window.innerWidth) {
    left = window.innerWidth - 275;
  }
  if (top + 160 > window.innerHeight) {
    top = rect.top - 150;
  }

  propertyEditPopover.style.left = `${Math.max(10, left)}px`;
  propertyEditPopover.style.top = `${Math.max(10, top)}px`;
  propertyEditPopover.classList.remove("hidden");

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  setTimeout(() => {
    propEditNameInput.focus();
    propEditNameInput.select();
  }, 40);
}

function commitPropertyEditPopover() {
  if (AppState.ui.activeEditingPropertyIndex === null || !AppState.ui.activePageItem) return;
  const prop = AppState.ui.activePageItem.properties[AppState.ui.activeEditingPropertyIndex];
  if (prop && propEditNameInput) {
    const newName = propEditNameInput.value.trim();
    if (newName) {
      prop.name = newName;
      commitActivePageItem();
      renderDynamicProperties();
    }
  }
  closePropertyEditPopover();
}

function closePropertyEditPopover() {
  if (propertyEditPopover) propertyEditPopover.classList.add("hidden");
  AppState.ui.activeEditingPropertyIndex = null;
}

if (propEditNameInput) {
  propEditNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitPropertyEditPopover();
    } else if (e.key === "Escape") {
      closePropertyEditPopover();
    }
  });
}

if (savePropertyFromPopoverBtn) {
  savePropertyFromPopoverBtn.addEventListener("click", commitPropertyEditPopover);
}

if (deletePropertyFromPopoverBtn) {
  deletePropertyFromPopoverBtn.addEventListener("click", () => {
    if (AppState.ui.activeEditingPropertyIndex === null || !AppState.ui.activePageItem) return;
    const propIdx = AppState.ui.activeEditingPropertyIndex;
    const prop = AppState.ui.activePageItem.properties[propIdx];
    if (prop) {
      confirmDeletion({
        desc: `Remove the property "${prop.name}" from this page?`,
        onConfirm: () => {
          AppState.ui.activePageItem.properties.splice(propIdx, 1);
          commitActivePageItem();
          renderDynamicProperties();
          closePropertyEditPopover();
          showToast("Property removed", "info");
        }
      });
    }
  });
}

if (openAddPropertyMenuBtn) {
  openAddPropertyMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    propertyTypeMenu.classList.toggle("hidden");
  });
}

document.addEventListener("click", (e) => {
  if (propertyTypeMenu && !propertyTypeMenu.contains(e.target) && e.target !== openAddPropertyMenuBtn) {
    propertyTypeMenu.classList.add("hidden");
  }
  if (propertyEditPopover && !propertyEditPopover.contains(e.target) && !e.target.closest(".notion-property-label") && !e.target.closest(".notion-property-menu-btn")) {
    commitPropertyEditPopover();
  }
  if (tagSelectPopover && !tagSelectPopover.contains(e.target) && !e.target.closest(".select-prop-trigger")) {
    if (!tagColorSubmenu || !tagColorSubmenu.contains(e.target)) {
      closeTagPopovers();
    }
  }
  if (statusDropdownPopover && !statusDropdownPopover.contains(e.target) && !e.target.closest(".notion-status-trigger")) {
    if (!statusColorSubmenu || !statusColorSubmenu.contains(e.target)) {
      closeStatusPopovers();
    }
  }
  closePropertyContextMenu();
});

const addPropTypeButtons = document.querySelectorAll(".add-prop-type-btn");
addPropTypeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.getAttribute("data-type");
    if (!AppState.ui.activePageItem || !type) return;

    const defaultNames = {
      select: "Tags",
      status: "Status",
      priority: "Priority",
      percentage: "Progress",
      url: "Link",
      file: "Attachment",
      checkbox: "Checkbox",
      email: "Contact Email",
      phone: "Phone Number"
    };

    const newProp = {
      id: "prop_" + Date.now(),
      name: defaultNames[type] || "Property",
      type: type,
      value: type === "checkbox" ? false : (type === "status" ? "Not Started" : (type === "priority" ? "Medium" : (type === "select" ? "Computer Science" : ""))),
      color: type === "status" ? "gray" : (type === "priority" ? "yellow" : (type === "select" ? "pink" : undefined))
    };

    AppState.ui.activePageItem.properties.push(newProp);
    commitActivePageItem();
    renderDynamicProperties();
    propertyTypeMenu.classList.add("hidden");

    const newIdx = AppState.ui.activePageItem.properties.length - 1;
    const allRows = dynamicPropertiesList.querySelectorAll(".notion-property-row");
    const lastRow = allRows[allRows.length - 1];
    if (lastRow) {
      const labelEl = lastRow.querySelector(".notion-property-label");
      setTimeout(() => {
        openPropertyEditPopover(labelEl || lastRow, newIdx);
      }, 50);
    }
  });
});

function openTagSelectPopover(triggerEl, propIndex) {
  AppState.ui.activeSelectPropertyContext = { propIndex };
  if (!tagSelectPopover) return;

  const rect = triggerEl.getBoundingClientRect();
  tagSelectPopover.style.left = `${Math.min(window.innerWidth - 270, rect.left)}px`;
  tagSelectPopover.style.top = `${Math.min(window.innerHeight - 300, rect.bottom + 4)}px`;
  tagSelectPopover.classList.remove("hidden");

  tagSearchInput.value = "";
  renderTagOptionsList();
  setTimeout(() => tagSearchInput.focus(), 50);
}

function closeTagPopovers() {
  if (tagSelectPopover) tagSelectPopover.classList.add("hidden");
  if (tagColorSubmenu) tagColorSubmenu.classList.add("hidden");
  AppState.ui.activeSelectPropertyContext = null;
  AppState.ui.activeTagEditOption = null;
}

function renderTagOptionsList(filterQuery = "") {
  if (!tagOptionsContainer) return;
  tagOptionsContainer.innerHTML = "";

  const query = filterQuery.toLowerCase().trim();
  const matched = AppState.selectOptionsCache.filter(opt => opt.name.toLowerCase().includes(query));

  matched.forEach(opt => {
    const row = document.createElement("div");
    row.className = "notion-popover-row group";
    
    row.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <span class="px-2 py-0.5 rounded text-[11px] font-medium notion-tag-${opt.color || 'gray'} truncate">${escapeHtml(opt.name)}</span>
      </div>
      <button type="button" class="opt-more-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <i data-lucide="more-horizontal" class="w-3.5 h-3.5"></i>
      </button>
    `;

    row.addEventListener("click", () => {
      if (AppState.ui.activePageItem && AppState.ui.activeSelectPropertyContext) {
        const prop = AppState.ui.activePageItem.properties[AppState.ui.activeSelectPropertyContext.propIndex];
        if (prop) {
          prop.value = opt.name;
          prop.color = opt.color;
          commitActivePageItem();
          renderDynamicProperties();
        }
      }
      closeTagPopovers();
    });

    const moreBtn = row.querySelector(".opt-more-btn");
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTagColorSubmenu(moreBtn, opt);
    });

    tagOptionsContainer.appendChild(row);
  });

  if (query && !matched.some(o => o.name.toLowerCase() === query)) {
    const createRow = document.createElement("div");
    createRow.className = "notion-popover-row text-xs text-[var(--text-secondary)] flex items-center gap-1.5";
    createRow.innerHTML = `<span>+ Create</span> <span class="px-1.5 py-0.5 rounded text-[10px] notion-tag-gray font-medium">${escapeHtml(filterQuery)}</span>`;
    
    createRow.addEventListener("click", () => {
      const newOpt = {
        id: "opt_" + Date.now(),
        name: filterQuery.trim(),
        color: "gray"
      };
      AppState.selectOptionsCache.push(newOpt);
      saveDomain(STORAGE_KEYS.SELECT_OPTIONS, AppState.selectOptionsCache);

      if (AppState.ui.activePageItem && AppState.ui.activeSelectPropertyContext) {
        const prop = AppState.ui.activePageItem.properties[AppState.ui.activeSelectPropertyContext.propIndex];
        if (prop) {
          prop.value = newOpt.name;
          prop.color = newOpt.color;
          commitActivePageItem();
          renderDynamicProperties();
        }
      }
      closeTagPopovers();
    });
    tagOptionsContainer.appendChild(createRow);
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (tagSearchInput) {
  tagSearchInput.addEventListener("input", (e) => {
    renderTagOptionsList(e.target.value);
  });
}

function openTagColorSubmenu(btnEl, option) {
  AppState.ui.activeTagEditOption = option;
  if (!tagColorSubmenu) return;

  const rect = btnEl.getBoundingClientRect();
  tagColorSubmenu.style.left = `${Math.min(window.innerWidth - 200, rect.right + 4)}px`;
  tagColorSubmenu.style.top = `${Math.min(window.innerHeight - 280, rect.top)}px`;
  tagColorSubmenu.classList.remove("hidden");

  renderTagColorOptions();
}

function renderTagColorOptions() {
  if (!tagColorList || !AppState.ui.activeTagEditOption) return;
  tagColorList.innerHTML = "";

  NOTION_COLORS.forEach(c => {
    const item = document.createElement("div");
    item.className = "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--row-hover)] cursor-pointer text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
    const isCurrent = AppState.ui.activeTagEditOption.color === c.key;

    item.innerHTML = `
      <span class="notion-swatch-sq ${c.swatchClass}"></span>
      <span class="flex-1">${c.label}</span>
      ${isCurrent ? '<i data-lucide="check" class="w-3.5 h-3.5 text-[var(--text-primary)]"></i>' : ''}
    `;

    item.addEventListener("click", () => {
      AppState.ui.activeTagEditOption.color = c.key;
      saveDomain(STORAGE_KEYS.SELECT_OPTIONS, AppState.selectOptionsCache);

      if (AppState.ui.activePageItem && AppState.ui.activeSelectPropertyContext) {
        const prop = AppState.ui.activePageItem.properties[AppState.ui.activeSelectPropertyContext.propIndex];
        if (prop && prop.value === AppState.ui.activeTagEditOption.name) {
          prop.color = c.key;
          commitActivePageItem();
          renderDynamicProperties();
        }
      }

      renderTagOptionsList(tagSearchInput ? tagSearchInput.value : "");
      tagColorSubmenu.classList.add("hidden");
    });

    tagColorList.appendChild(item);
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (deleteTagOptionBtn) {
  deleteTagOptionBtn.addEventListener("click", () => {
    if (!AppState.ui.activeTagEditOption) return;
    const optToDelete = AppState.ui.activeTagEditOption;
    confirmDeletion({
      desc: `Delete tag "${optToDelete.name}" from options?`,
      onConfirm: () => {
        AppState.selectOptionsCache = AppState.selectOptionsCache.filter(o => o.id !== optToDelete.id);
        saveDomain(STORAGE_KEYS.SELECT_OPTIONS, AppState.selectOptionsCache);
        renderTagOptionsList(tagSearchInput ? tagSearchInput.value : "");
        tagColorSubmenu.classList.add("hidden");
        showToast("Tag option deleted", "info");
      }
    });
  });
}

function openPropertyContextMenu(x, y, propId, propIndex) {
  AppState.ui.activePropertyContextMenu = { propId, propIndex };
  if (!propertyContextMenu) return;

  propertyContextMenu.style.left = `${Math.min(window.innerWidth - 200, x + 5)}px`;
  propertyContextMenu.style.top = `${Math.min(window.innerHeight - 150, y + 5)}px`;
  propertyContextMenu.classList.remove("hidden");
}

function closePropertyContextMenu() {
  if (propertyContextMenu) propertyContextMenu.classList.add("hidden");
  AppState.ui.activePropertyContextMenu = null;
}

if (ctxDuplicatePropBtn) {
  ctxDuplicatePropBtn.addEventListener("click", () => {
    if (!AppState.ui.activePageItem || !AppState.ui.activePropertyContextMenu) return;
    const { propIndex } = AppState.ui.activePropertyContextMenu;
    const targetProp = AppState.ui.activePageItem.properties[propIndex];
    if (targetProp) {
      const duplicated = {
        ...JSON.parse(JSON.stringify(targetProp)),
        id: "prop_" + Date.now(),
        name: targetProp.name + " (Copy)"
      };
      AppState.ui.activePageItem.properties.splice(propIndex + 1, 0, duplicated);
      commitActivePageItem();
      renderDynamicProperties();
      showToast("Property duplicated", "info");
    }
    closePropertyContextMenu();
  });
}

if (ctxRenamePropBtn) {
  ctxRenamePropBtn.addEventListener("click", () => {
    if (!AppState.ui.activePageItem || !AppState.ui.activePropertyContextMenu) return;
    const { propIndex } = AppState.ui.activePropertyContextMenu;
    const allRows = dynamicPropertiesList.querySelectorAll(".notion-property-row");
    const targetRow = allRows[propIndex];
    if (targetRow) {
      const labelEl = targetRow.querySelector(".notion-property-label");
      openPropertyEditPopover(labelEl || targetRow, propIndex);
    }
    closePropertyContextMenu();
  });
}

if (ctxDeletePropBtn) {
  ctxDeletePropBtn.addEventListener("click", () => {
    if (!AppState.ui.activePageItem || !AppState.ui.activePropertyContextMenu) return;
    const { propIndex } = AppState.ui.activePropertyContextMenu;
    const targetProp = AppState.ui.activePageItem.properties[propIndex];
    if (targetProp) {
      confirmDeletion({
        desc: `Remove the property "${targetProp.name}" from this page?`,
        onConfirm: () => {
          AppState.ui.activePageItem.properties.splice(propIndex, 1);
          commitActivePageItem();
          renderDynamicProperties();
          showToast("Property removed", "info");
        }
      });
    }
    closePropertyContextMenu();
  });
}


// ============================================================================
// 18. TOAST NOTIFICATIONS & UTILITIES
// ============================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  
  const iconMap = {
    success: `<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400 shrink-0"></i>`,
    error: `<i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-400 shrink-0"></i>`,
    warning: `<i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>`,
    info: `<i data-lucide="info" class="w-3.5 h-3.5 text-sky-400 shrink-0"></i>`
  };

  const iconMarkup = iconMap[type] || iconMap.info;

  toast.className = `toast-card toast-slide-in`;
  toast.innerHTML = `
    ${iconMarkup}
    <span class="truncate">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px) scale(0.96)';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 19. APPLICATION BOOTSTRAP
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  initThemeEngine();
  loadStateFromStorage();
  initRealTimeClock();
  initFixedNavButtons();
  initMobileSidebar();
  initPomodoroTimer();
  renderHierarchicalSidebar();

  initFirebase();

  navigateToView("view-today");

  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      showToast("Signed out", "info");
    });
  }
});
