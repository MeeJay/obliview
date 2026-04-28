import { create } from 'zustand';

export type DashboardLayout = 'list' | 'cards';

interface UiState {
  /** True when the pinned sidebar is visible (also used as the open/close trigger on mobile). */
  sidebarOpen: boolean;
  sidebarWidth: number;
  /** Floating overlay mode — auto-hides, slides in on hover. Mutex with collapsed. */
  sidebarFloating: boolean;
  /** Pinned-collapsed mode — 64 px icon-only column. Mutex with floating. */
  sidebarCollapsed: boolean;
  addAgentModalOpen: boolean;
  dashboardLayout: DashboardLayout;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  /** Toggle floating mode. Forces collapsed = false (mutex). */
  toggleSidebarFloating: () => void;
  /** Toggle collapsed mode. Forces floating = false (mutex). */
  toggleSidebarCollapsed: () => void;
  openAddAgentModal: () => void;
  closeAddAgentModal: () => void;
  setDashboardLayout: (layout: DashboardLayout) => void;
}

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 600;
const STORAGE_KEY_WIDTH       = 'ov-sidebar-width';
const STORAGE_KEY_FLOATING    = 'obliview:sidebarFloating';
const STORAGE_KEY_COLLAPSED   = 'obliview:groupPanelCollapsed';
const STORAGE_KEY_DASH_LAYOUT = 'ov-dashboard-layout';

function loadSavedDashLayout(): DashboardLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DASH_LAYOUT);
    if (saved === 'cards' || saved === 'list') return saved;
  } catch { /* ignore */ }
  return 'cards';
}

function loadSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (saved) {
      const w = parseInt(saved, 10);
      if (!isNaN(w) && w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) return w;
    }
  } catch { /* ignore */ }
  return 280;
}

/**
 * Resolve the initial mutex pair. If localStorage somehow holds both flags as
 * "true" (legacy state, manual edit), prefer collapsed and clear floating —
 * that way the user gets a consistent rendering on first load and the bad
 * combination is wiped on the next toggle.
 */
function loadSavedSidebarMutex(): { collapsed: boolean; floating: boolean } {
  let collapsed = false;
  let floating = false;
  try {
    collapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
    floating  = localStorage.getItem(STORAGE_KEY_FLOATING)  === 'true';
  } catch { /* ignore */ }
  if (collapsed && floating) {
    floating = false;
    try { localStorage.setItem(STORAGE_KEY_FLOATING, 'false'); } catch { /* ignore */ }
  }
  return { collapsed, floating };
}

const initialMutex = loadSavedSidebarMutex();

function persistMutex(collapsed: boolean, floating: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
    localStorage.setItem(STORAGE_KEY_FLOATING,  String(floating));
  } catch { /* ignore */ }
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: loadSavedWidth(),
  sidebarFloating: initialMutex.floating,
  sidebarCollapsed: initialMutex.collapsed,
  addAgentModalOpen: false,
  dashboardLayout: loadSavedDashLayout(),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openAddAgentModal: () => set({ addAgentModalOpen: true }),
  closeAddAgentModal: () => set({ addAgentModalOpen: false }),
  setDashboardLayout: (layout) => {
    try { localStorage.setItem(STORAGE_KEY_DASH_LAYOUT, layout); } catch { /* ignore */ }
    set({ dashboardLayout: layout });
  },

  // Mutex toggles — flipping one always clears the other so the AppLayout
  // never has to render an inconsistent (260-px overlay around 64-px column)
  // intermediate state.
  toggleSidebarFloating: () => set((s) => {
    const next = !s.sidebarFloating;
    persistMutex(false, next);
    return { sidebarFloating: next, sidebarCollapsed: false };
  }),
  toggleSidebarCollapsed: () => set((s) => {
    const next = !s.sidebarCollapsed;
    persistMutex(next, false);
    return { sidebarCollapsed: next, sidebarFloating: false };
  }),

  setSidebarWidth: (width) => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    try { localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped)); } catch { /* ignore */ }
    set({ sidebarWidth: clamped });
  },
}));
