# Phase 4: Feature Parity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port all user-visible features from the web dashboard to the embedded Vite + React SPA, including server-side LLM analysis and CLI config commands.

**Architecture:** Layer-by-layer bottom-up: foundation → data → LLM engine → components → pages → polish. Each layer is a feature branch with its own PR.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, shadcn/ui (New York), Hono, Recharts 3, react-markdown, react-syntax-highlighter

**Source repo reference:** `/Users/melagiri/Workspace/codeInsights/code-insights-web/` (web dashboard to port from)

---

## Prerequisites

Before starting any task:
1. Ensure you're on a feature branch (never commit to `master`)
2. Web repo is at `/Users/melagiri/Workspace/codeInsights/code-insights-web/`
3. `pnpm install` has been run at workspace root
4. `pnpm build` passes before you start

**No test framework is configured.** Verification is via `pnpm build` (TypeScript compilation) and manual browser testing with `pnpm dev` in the dashboard package.

---

## Layer 1: Foundation

**Branch:** `feature/phase4-layer1-foundation`
**Estimated effort:** ~1 day

### Task 1.1: Install shadcn/ui Dependencies

**Files:**
- Modify: `dashboard/package.json`
- Create: `dashboard/src/lib/utils.ts`

**Step 1:** Install core shadcn/ui dependencies

```bash
cd dashboard
pnpm add clsx tailwind-merge class-variance-authority
pnpm add date-fns
```

**Step 2:** Create the `cn()` utility that shadcn/ui components require

Create `dashboard/src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(startedAt: Date, endedAt: Date): string {
  const totalMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString();
}

export function formatDateRange(startedAt: Date, endedAt: Date): string {
  const sameDay = startedAt.toDateString() === endedAt.toDateString();
  if (sameDay) {
    return `${format(startedAt, 'MMM d, h:mm a')} – ${format(endedAt, 'h:mm a')}`;
  }
  return `${format(startedAt, 'MMM d, h:mm a')} – ${format(endedAt, 'MMM d, h:mm a')}`;
}

export function formatModelName(model: string): string {
  return model.replace('claude-', '').replace(/-\d{8}$/, '');
}

export function getSessionTitle(session: { customTitle?: string; generatedTitle?: string | null; summary?: string | null }): string {
  return session.customTitle || session.generatedTitle || session.summary || 'Untitled Session';
}
```

**Step 3:** Verify build

```bash
cd /path/to/code-insights && pnpm build
```

**Step 4:** Commit

```bash
git add dashboard/package.json dashboard/pnpm-lock.yaml dashboard/src/lib/utils.ts
git commit -m "feat(dashboard): add shadcn/ui dependencies and utility functions"
```

---

### Task 1.2: Install shadcn/ui Components

**Files:**
- Create: `dashboard/src/components/ui/*.tsx` (26 component files)

**Step 1:** Install shadcn/ui components. Run from dashboard directory:

```bash
cd dashboard
npx shadcn@latest add alert alert-dialog badge button card checkbox collapsible dialog dropdown-menu input scroll-area select separator sheet skeleton switch tabs tooltip
```

If `npx shadcn` requires interactive prompts, install components one at a time. The `components.json` in `dashboard/` already has the correct config (New York style, zinc base).

**Step 2:** Install `sonner` for toast notifications:

```bash
pnpm add sonner
```

Create `dashboard/src/components/ui/sonner.tsx` — port from `web:src/components/ui/sonner.tsx`:
```typescript
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
```

**Step 3:** Verify build

```bash
cd /path/to/code-insights && pnpm build
```

**Step 4:** Commit

```bash
git add dashboard/src/components/ui/
git commit -m "feat(dashboard): install 26 shadcn/ui components and sonner toaster"
```

---

### Task 1.3: Add Types and Constants

**Files:**
- Create: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/lib/constants/colors.ts`

**Step 1:** Create dashboard types. These re-export CLI types where possible and add UI-specific types.

Create `dashboard/src/lib/types.ts` — port from `web:src/lib/types.ts` with adaptations:

The web repo types use `Date` objects. The API returns ISO strings. Create types that match the API response format (strings for dates) and add converter functions.

```typescript
// Dashboard types — aligned with CLI types but using API response format
// Dates come as ISO 8601 strings from the Hono API

export interface Project {
  id: string;
  name: string;
  path: string;
  git_remote_url: string | null;
  project_id_source: 'git-remote' | 'path-hash';
  session_count: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
  total_input_tokens: number;
  total_output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  estimated_cost_usd: number;
}

export interface Session {
  id: string;
  project_id: string;
  project_name: string;
  project_path: string;
  git_remote_url: string | null;
  summary: string | null;
  custom_title: string | null;
  generated_title: string | null;
  title_source: string | null;
  session_character: string | null;
  started_at: string;
  ended_at: string;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
  tool_call_count: number;
  git_branch: string | null;
  claude_version: string | null;
  source_tool: string;
  device_id: string | null;
  device_hostname: string | null;
  device_platform: string | null;
  synced_at: string;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
  estimated_cost_usd: number | null;
  models_used: string | null;  // JSON string from SQLite
  primary_model: string | null;
  usage_source: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  thinking: string | null;
  tool_calls: string | null;    // JSON string
  tool_results: string | null;  // JSON string
  usage: string | null;         // JSON string
  timestamp: string;
  parent_id: string | null;
}

export type InsightType = 'summary' | 'decision' | 'learning' | 'technique' | 'prompt_quality';

export interface Insight {
  id: string;
  session_id: string;
  project_id: string;
  project_name: string;
  type: InsightType;
  title: string;
  content: string;
  summary: string;
  bullets: string | null;       // JSON string
  confidence: number;
  source: string;
  metadata: string | null;      // JSON string
  timestamp: string;
  created_at: string;
  scope: string;
  analysis_version: string;
  linked_insight_ids: string | null; // JSON string
}

export interface UsageStats {
  total_input_tokens: number;
  total_output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  estimated_cost_usd: number;
  sessions_with_usage: number;
  last_updated_at: string;
}

export interface DashboardStats {
  totalSessions: number;
  totalProjects: number;
  totalInsights: number;
  totalMessages: number;
  totalCost: number;
  dailyStats: DailyStats[];
  recentSessions: Session[];
}

export interface DailyStats {
  date: string;
  session_count: number;
  message_count: number;
  insight_count: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

// Parsed versions (after JSON.parse on string fields)
export interface ParsedToolCall {
  id: string;
  name: string;
  input: string;
}

export interface ParsedToolResult {
  toolUseId: string;
  output: string;
}

export interface ParsedMessageUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  estimatedCostUsd: number;
}

// LLM Config types (for settings page)
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

// Helper to parse JSON string fields safely
export function parseJsonField<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Session title helper
export function getSessionTitle(session: Pick<Session, 'custom_title' | 'generated_title' | 'summary'>): string {
  return session.custom_title || session.generated_title || session.summary || 'Untitled Session';
}
```

**Step 2:** Create `dashboard/src/lib/constants/colors.ts` — copy from `web:src/lib/constants/colors.ts` verbatim (already shown in exploration). Only change: import `InsightType` from `@/lib/types` instead of `@/lib/types`.

**Step 3:** Verify build, commit:

```bash
pnpm build
git add dashboard/src/lib/types.ts dashboard/src/lib/constants/
git commit -m "feat(dashboard): add dashboard types and color constants"
```

---

### Task 1.4: Create Layout Shell

**Files:**
- Create: `dashboard/src/components/layout/Header.tsx`
- Create: `dashboard/src/components/layout/ThemeProvider.tsx`
- Create: `dashboard/src/components/layout/ThemeToggle.tsx`
- Create: `dashboard/src/components/layout/Layout.tsx`
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/main.tsx`
- Modify: `dashboard/index.html`

**Step 1:** Create `ThemeProvider.tsx` — replaces `next-themes`:

```typescript
// dashboard/src/components/layout/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.classList.toggle('dark', mq.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

**Step 2:** Create `ThemeToggle.tsx` — port from web repo, use custom `useTheme` instead of `next-themes`:

```typescript
// dashboard/src/components/layout/ThemeToggle.tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

**Step 3:** Create `Header.tsx` — simplified from web repo's `UnifiedHeader.tsx` (486 lines down to ~80). No auth, no session sidebar (initially). Just navigation + theme toggle:

```typescript
// dashboard/src/components/layout/Header.tsx
import { Link, useLocation } from 'react-router';
import { BarChart3, BookOpen, Brain, Download, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sessions', label: 'Sessions', icon: BookOpen },
  { path: '/insights', label: 'Insights', icon: Brain },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/export', label: 'Export', icon: Download },
];

export function Header() {
  const location = useLocation();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          Code Insights
        </Link>
        <nav className="flex items-center gap-1 ml-4">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                location.pathname.startsWith(path)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/settings"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
              location.pathname === '/settings'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

**Step 4:** Create `Layout.tsx` wrapper:

```typescript
// dashboard/src/components/layout/Layout.tsx
import { Outlet } from 'react-router';
import { Header } from './Header';
import { Toaster } from '@/components/ui/sonner';

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
```

**Step 5:** Update `App.tsx` to use layout wrapper and add `ScrollRestoration`:

```typescript
// dashboard/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import SessionsPage from '@/pages/SessionsPage';
import SessionDetailPage from '@/pages/SessionDetailPage';
import InsightsPage from '@/pages/InsightsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SettingsPage from '@/pages/SettingsPage';
import ExportPage from '@/pages/ExportPage';
import JournalPage from '@/pages/JournalPage';

// Scroll to top on route change + update document title
function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sessions': 'Sessions',
  '/insights': 'Insights',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/export': 'Export',
  '/journal': 'Journal',
};

function TitleUpdater() {
  const location = useLocation();
  useEffect(() => {
    const base = 'Code Insights';
    const pageTitle = PAGE_TITLES[location.pathname];
    document.title = pageTitle ? `${pageTitle} — ${base}` : base;
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteEffects />
      <TitleUpdater />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 6:** Update `main.tsx` to wrap with ThemeProvider:

```typescript
// dashboard/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 2000,  // 2s polling (amendment #4)
      staleTime: 1500,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

**Step 7:** Add FOUC prevention script to `dashboard/index.html` (amendment #5):

Add inline script in `<head>` before any CSS loads:

```html
<script>
  (function() {
    var theme = localStorage.getItem('theme') || 'system';
    var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  })();
</script>
```

**Step 8:** Verify build, verify dev server shows navigation:

```bash
pnpm build
cd dashboard && pnpm dev  # Open localhost:5173, verify header nav appears
```

**Step 9:** Commit

```bash
git add dashboard/src/components/layout/ dashboard/src/App.tsx dashboard/src/main.tsx dashboard/index.html
git commit -m "feat(dashboard): add layout shell with header, theme, and routing"
```

---

### Task 1.5: Install lucide-react icons

**Step 1:** Verify lucide-react is already a dependency (it should be from Phase 3). If not:

```bash
cd dashboard && pnpm add lucide-react
```

**Step 2:** Commit if any changes.

---

## Layer 2: Data Layer

**Branch:** `feature/phase4-layer2-data-hooks`
**Estimated effort:** ~2-3 days

### Task 2.1: Create React Query Hooks

**Files:**
- Create: `dashboard/src/hooks/useProjects.ts`
- Create: `dashboard/src/hooks/useSessions.ts`
- Create: `dashboard/src/hooks/useSession.ts`
- Create: `dashboard/src/hooks/useMessages.ts`
- Create: `dashboard/src/hooks/useInsights.ts`
- Create: `dashboard/src/hooks/useDashboardStats.ts`
- Create: `dashboard/src/hooks/useUsageStats.ts`
- Create: `dashboard/src/hooks/useLlmConfig.ts`
- Create: `dashboard/src/hooks/useAnalysis.ts`
- Create: `dashboard/src/hooks/useExport.ts`

Each hook wraps one or more functions from `dashboard/src/lib/api.ts` (already exists from Phase 3).

**Step 1:** Create all hooks. Reference the 13 API functions in `dashboard/src/lib/api.ts`.

Example pattern for `useProjects.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '@/lib/api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}
```

Example pattern for `useSessions.ts` (with filters):
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchSessions } from '@/lib/api';

export interface SessionFilters {
  projectId?: string;
  sourceTool?: string;
  limit?: number;
  offset?: number;
}

export function useSessions(filters?: SessionFilters) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => fetchSessions(filters),
  });
}
```

Example pattern for `useMessages.ts` (infinite query for pagination):
```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMessages } from '@/lib/api';

export function useMessages(sessionId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', sessionId],
    queryFn: ({ pageParam = 0 }) => fetchMessages(sessionId, { limit: 50, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.messages.length < 50) return undefined;
      return allPages.reduce((acc, p) => acc + p.messages.length, 0);
    },
    enabled: !!sessionId,
  });
}
```

Example pattern for mutations (`useAnalysis.ts`):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { analyzeSession } from '@/lib/api';

export function useAnalyzeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => analyzeSession(sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
}
```

Create all 10 hooks following these patterns. Each hook is a separate file in `dashboard/src/hooks/`.

**Step 2:** Create an index file `dashboard/src/hooks/index.ts` that re-exports all hooks.

**Step 3:** Verify build:

```bash
pnpm build
```

**Step 4:** Commit

```bash
git add dashboard/src/hooks/
git commit -m "feat(dashboard): add React Query hooks for all API endpoints"
```

---

### Task 2.2: Verify API Client Completeness

**Files:**
- Modify: `dashboard/src/lib/api.ts` (if needed)

**Step 1:** Compare the 13 API functions in `api.ts` against the server routes. Ensure these endpoints exist and match:
- `fetchProjects()` → `GET /api/projects`
- `fetchProject(id)` → `GET /api/projects/:id`
- `fetchSessions(params)` → `GET /api/sessions`
- `fetchSession(id)` → `GET /api/sessions/:id`
- `patchSession(id, body)` → `PATCH /api/sessions/:id`
- `fetchMessages(sessionId, params)` → `GET /api/messages/:sessionId`
- `fetchInsights(params)` → `GET /api/insights`
- `deleteInsight(id)` → `DELETE /api/insights/:id`
- `fetchDashboardStats(range)` → `GET /api/analytics/dashboard`
- `fetchUsageStats()` → `GET /api/analytics/usage`
- `analyzeSession(sessionId)` → `POST /api/analysis/session`
- `fetchLlmConfig()` → `GET /api/config/llm`
- `saveLlmConfig(body)` → `PUT /api/config/llm`
- `exportMarkdown(body)` → `POST /api/export/markdown`

**Step 2:** Add missing API functions if any are not present. Key ones likely missing:
- `analyzePromptQuality(sessionId)` → `POST /api/analysis/prompt-quality`
- `findRecurringInsights(projectId)` → `POST /api/analysis/recurring`
- `createInsight(insight)` → `POST /api/insights`

**Step 3:** Verify build, commit if modified.

---

## Layer 3: Server-Side LLM Engine

**Branch:** `feature/phase4-layer3-llm-engine`
**Estimated effort:** ~2-3 days

### Task 3.1: Extend CLI Types for LLM Config

**Files:**
- Modify: `cli/src/types.ts`

**Step 1:** Add LLM config to `ClaudeInsightConfig` interface.

In `cli/src/types.ts`, update the `ClaudeInsightConfig` interface:

```typescript
export interface ClaudeInsightConfig {
  sync: {
    claudeDir: string;
    excludeProjects: string[];
  };
  dashboard?: {
    port?: number;
    llm?: {
      provider: 'openai' | 'anthropic' | 'gemini' | 'ollama';
      apiKey?: string;
      model: string;
      baseUrl?: string;
    };
  };
  telemetry?: boolean;
}
```

**Step 2:** Add prompt quality metadata fields to `InsightMetadata`:

```typescript
export interface InsightMetadata {
  // Decision-specific
  alternatives?: string[];
  reasoning?: string;
  evidence?: string[];
  // Technique/learning-specific
  context?: string;
  applicability?: string;
  // Prompt quality-specific
  efficiencyScore?: number;
  wastedTurns?: Array<{ messageIndex: number; reason: string; suggestedRewrite: string }>;
  antiPatterns?: Array<{ name: string; count: number; examples: string[] }>;
  potentialMessageReduction?: number;
}
```

**Step 3:** Verify build, commit.

---

### Task 3.2: Port LLM Abstraction to Server

**Files:**
- Create: `server/src/llm/types.ts`
- Create: `server/src/llm/client.ts`
- Create: `server/src/llm/providers/anthropic.ts`
- Create: `server/src/llm/providers/openai.ts`
- Create: `server/src/llm/providers/gemini.ts`
- Create: `server/src/llm/providers/ollama.ts`
- Create: `server/src/llm/prompts.ts`
- Create: `server/src/llm/analysis.ts`
- Create: `server/src/llm/index.ts`

**Step 1:** Copy `web:src/lib/llm/types.ts` to `server/src/llm/types.ts` — verbatim, no changes needed.

**Step 2:** Port `web:src/lib/llm/client.ts` to `server/src/llm/client.ts`. Key changes:
- Remove all `localStorage` references
- Remove `typeof window` guards
- Load config from `~/.code-insights/config.json` via CLI's `loadConfig()`

```typescript
// server/src/llm/client.ts
import type { LLMClient, LLMConfig } from './types.js';
import { createOpenAIClient } from './providers/openai.js';
import { createAnthropicClient } from './providers/anthropic.js';
import { createGeminiClient } from './providers/gemini.js';
import { createOllamaClient } from './providers/ollama.js';
import { loadConfig } from '@code-insights/cli/utils/config';

export function loadLLMConfig(): LLMConfig | null {
  const config = loadConfig();
  const llm = config?.dashboard?.llm;
  if (!llm) return null;
  return {
    provider: llm.provider,
    apiKey: llm.apiKey || '',
    model: llm.model,
    baseUrl: llm.baseUrl,
  };
}

export function isLLMConfigured(): boolean {
  const config = loadLLMConfig();
  if (!config) return false;
  if (config.provider === 'ollama') return !!config.model;
  return !!config.apiKey && !!config.model;
}

export function createLLMClient(): LLMClient {
  const config = loadLLMConfig();
  if (!config) throw new Error('LLM not configured. Use `code-insights config llm` or the dashboard Settings page.');
  return createClientFromConfig(config);
}

export function createClientFromConfig(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case 'openai': return createOpenAIClient(config.apiKey, config.model);
    case 'anthropic': return createAnthropicClient(config.apiKey, config.model);
    case 'gemini': return createGeminiClient(config.apiKey, config.model);
    case 'ollama': return createOllamaClient(config.model, config.baseUrl);
    default: throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

export async function testLLMConfig(config: LLMConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClientFromConfig(config);
    await client.chat([{ role: 'user', content: 'Say "ok" and nothing else.' }]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
```

**Step 3:** Port 4 provider files. Copy from web repo with one change to `anthropic.ts` — remove the `'anthropic-dangerous-direct-browser-access': 'true'` header. All other providers copy verbatim.

**Step 4:** Port `prompts.ts` — copy verbatim from web repo. The import for types changes: `import type { Message } from '../types'` becomes the local server type definition (or inline the Message shape).

Since the server reads messages from SQLite in a different format (snake_case), create a `formatMessagesForAnalysis` that accepts the SQLite row format and converts.

**Step 5:** Port `analysis.ts` — this is the largest file (712 lines). Key changes:
- Replace `import { saveInsights, deleteSessionInsights } from '../firestore/insights'` with direct SQLite writes via `getDb()` from CLI
- Replace `import { updateSessionSummary } from '../hooks/useFirestore'` with a direct SQLite UPDATE
- Remove `DOMException` abort handling (server-side uses different abort mechanism)

The core logic (chunking, merging, insight conversion) stays the same.

**Step 6:** Create `server/src/llm/index.ts` — re-export all public APIs:
```typescript
export * from './types.js';
export * from './client.js';
export * from './analysis.js';
export * from './prompts.js';
export { discoverOllamaModels, checkOllamaConnection } from './providers/ollama.js';
```

**Step 7:** Verify build, commit.

---

### Task 3.3: Implement Analysis API Routes

**Files:**
- Modify: `server/src/routes/analysis.ts`

**Step 1:** Replace the 501 stubs with real implementations.

`POST /api/analysis/session`:
1. Read `sessionId` from request body
2. Fetch session from SQLite via `getDb()`
3. Fetch messages from SQLite
4. Call `analyzeSession()` from `server/src/llm/analysis.ts`
5. Return `{ success: true, insights: [...] }` or `{ error: '...' }`

`POST /api/analysis/prompt-quality`:
1. Read `sessionId` from request body
2. Fetch session + messages
3. Call `analyzePromptQuality()`
4. Return result

`POST /api/analysis/recurring`:
1. Read `projectId` (optional) from request body
2. Fetch insights from SQLite (filter by projectId if provided)
3. Call `findRecurringInsights()`
4. Return result

**Step 2:** Verify build, commit.

---

### Task 3.4: Update Config API Routes for LLM

**Files:**
- Modify: `server/src/routes/config.ts`

**Step 1:** Expand the config routes to support LLM configuration:

`GET /api/config/llm`:
- Return the full LLM config (provider, model, baseUrl) but **mask the API key**
- Also return `dashboardPort` as before

`PUT /api/config/llm`:
- Accept `{ provider, apiKey, model, baseUrl, dashboardPort }`
- Save to `~/.code-insights/config.json` under `dashboard.llm`

`POST /api/config/llm/test`:
- Accept `{ provider, apiKey, model, baseUrl }`
- Call `testLLMConfig()` from the LLM client
- Return `{ success: true }` or `{ success: false, error: '...' }`

`GET /api/config/llm/ollama-models`:
- Call `discoverOllamaModels()` from the Ollama provider
- Return `{ models: [...] }`

**Step 2:** Verify build, commit.

---

### Task 3.5: Add CLI `config llm` Command

**Files:**
- Modify: `cli/src/commands/config.ts`

**Step 1:** Add an `llm` subcommand to the existing `configCommand`:

```typescript
configCommand
  .command('llm')
  .description('Configure LLM provider for dashboard analysis')
  .option('--show', 'Show current LLM configuration')
  .option('--provider <name>', 'LLM provider (openai, anthropic, gemini, ollama)')
  .option('--model <name>', 'Model name')
  .option('--api-key <key>', 'API key')
  .option('--base-url <url>', 'Base URL (for Ollama)')
  .action(async (options) => {
    // If --show flag, display current config with masked API key
    // If provider/model/api-key flags provided, save non-interactively
    // If no flags, run interactive prompt (inquirer)
  });
```

**Step 2:** Implement the interactive flow using `inquirer` (already a CLI dependency):
1. Select provider (openai, anthropic, gemini, ollama)
2. If not ollama, prompt for API key
3. Select model from provider's model list (hardcoded in PROVIDERS array)
4. If ollama, auto-discover local models

**Step 3:** Also update `showConfigAction()` in config.ts to display LLM config if present.

**Step 4:** Verify build, commit.

---

## Layer 4: Component Layer

**Branch:** `feature/phase4-layer4-components`
**Estimated effort:** ~3-4 days

### Task 4.1: Install Remaining Dashboard Dependencies

**Step 1:**
```bash
cd dashboard
pnpm add react-markdown remark-gfm react-syntax-highlighter recharts
pnpm add -D @types/react-syntax-highlighter
```

**Step 2:** Commit.

---

### Task 4.2: Port Chat Components

**Files:**
- Create: `dashboard/src/components/chat/conversation/ChatConversation.tsx`
- Create: `dashboard/src/components/chat/conversation/LoadMoreSentinel.tsx`
- Create: `dashboard/src/components/chat/conversation/DateSeparator.tsx`
- Create: `dashboard/src/components/chat/message/MessageBubble.tsx`
- Create: `dashboard/src/components/chat/message/ThinkingBlock.tsx`
- Create: `dashboard/src/components/chat/message/CopyButton.tsx`
- Create: `dashboard/src/components/chat/message/AssistantMarkdown.tsx`
- Create: `dashboard/src/components/chat/message/UserMarkdown.tsx`
- Create: `dashboard/src/components/chat/message/preprocess.ts`
- Create: `dashboard/src/components/chat/tools/ToolPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/FileToolPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/SearchToolPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/TerminalToolPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/AgentToolPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/AskUserQuestionPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/GenericToolPanel.tsx`
- Create: `dashboard/src/components/chat/tools/panels/ToolPanelHeader.tsx`

**Port instructions:** Copy from `web:src/components/chat/` with these changes:
1. Update all imports from `@/lib/types` to use the dashboard's types (snake_case fields)
2. The `Message` type in dashboard uses `tool_calls: string | null` (JSON string). Components must parse: `const toolCalls = parseJsonField(message.tool_calls, [])`.
3. Replace any `next/link` with `react-router Link`
4. `AssistantMarkdown.tsx` uses `react-markdown` + `react-syntax-highlighter` — these port 1:1

**Step 1:** Port all files. This is mechanical — copy, adjust imports, adjust field names.

**Step 2:** Verify build, commit.

---

### Task 4.3: Port Dashboard Components

**Files:**
- Create: `dashboard/src/components/dashboard/StatsHero.tsx`
- Create: `dashboard/src/components/dashboard/DashboardActivityChart.tsx`
- Create: `dashboard/src/components/dashboard/ActivityFeed.tsx`

**Port from:** `web:src/components/dashboard/` with data source changes (props from React Query instead of Firestore hooks).

**Step 1:** Port all 3. Verify build, commit.

---

### Task 4.4: Port Session Components

**Files:**
- Create: `dashboard/src/components/sessions/SessionList.tsx`
- Create: `dashboard/src/components/sessions/SessionCard.tsx`
- Create: `dashboard/src/components/sessions/RenameSessionDialog.tsx`

**Port from:** `web:src/components/sessions/`. Key change: `RenameSessionDialog` calls `patchSession()` from api.ts instead of Firestore.

**Step 1:** Port all 3. Verify build, commit.

---

### Task 4.5: Port Insight Components

**Files:**
- Create: `dashboard/src/components/insights/InsightCard.tsx`
- Create: `dashboard/src/components/insights/InsightList.tsx`
- Create: `dashboard/src/components/insights/InsightListItem.tsx`
- Create: `dashboard/src/components/insights/PromptQualityCard.tsx`

**Port from:** `web:src/components/insights/` — mostly 1:1.

**Step 1:** Port all 4. Verify build, commit.

---

### Task 4.6: Port Analysis Components

**Files:**
- Create: `dashboard/src/components/analysis/AnalyzeButton.tsx`
- Create: `dashboard/src/components/analysis/AnalyzeDropdown.tsx`
- Create: `dashboard/src/components/analysis/AnalyzePromptQualityButton.tsx`
- Create: `dashboard/src/components/analysis/BulkAnalyzeButton.tsx`
- Create: `dashboard/src/components/analysis/AnalysisContext.tsx`

**Port from:** `web:src/components/analysis/` and `web:src/lib/analysis/context.tsx`. Key changes:
- Replace direct `analyzeSession(session, messages)` browser-side calls with `useMutation` → `POST /api/analysis/session`
- Replace `saveInsights()` / `deleteSessionInsights()` Firestore calls with API calls
- Use `useAnalyzeSession()` hook from Layer 2

**Step 1:** Port all 5. Verify build, commit.

---

### Task 4.7: Port Chart Components

**Files:**
- Create: `dashboard/src/components/charts/ActivityChart.tsx`
- Create: `dashboard/src/components/charts/InsightTypeChart.tsx`

**Port from:** `web:src/components/charts/` — 1:1, Recharts works identically.

**Step 1:** Port both. Verify build, commit.

---

### Task 4.8: Create Empty State Components

**Files:**
- Create: `dashboard/src/components/empty-states/EmptyDashboard.tsx`
- Create: `dashboard/src/components/empty-states/EmptySessions.tsx`
- Create: `dashboard/src/components/empty-states/EmptyInsights.tsx`

These replace demo mode (amendment #2). Show the real UI shell with embedded guidance.

```typescript
// Example: EmptyDashboard.tsx
import { TerminalSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyDashboard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <TerminalSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No sessions synced yet</h3>
        <p className="text-muted-foreground max-w-md">
          Run <code className="bg-muted px-1.5 py-0.5 rounded text-sm">code-insights sync</code> to
          import your AI coding sessions, then come back here to explore your data.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 1:** Create all 3. Verify build, commit.

---

## Layer 5: Page Layer

**Branch:** `feature/phase4-layer5-pages`
**Estimated effort:** ~3-4 days

### Task 5.1: Implement Dashboard Page

**Files:**
- Modify: `dashboard/src/pages/DashboardPage.tsx`

Replace stub with full implementation. Port from `web:app/dashboard/page.tsx` (209 lines).

Wire up: `useDashboardStats('7d')`, `useSessions({ limit: 5 })`. Render `StatsHero`, `DashboardActivityChart`, `ActivityFeed`. Show `EmptyDashboard` when no data.

**Step 1:** Implement. Verify build, commit.

---

### Task 5.2: Implement Sessions Page

**Files:**
- Modify: `dashboard/src/pages/SessionsPage.tsx`

Port from `web:app/sessions/page.tsx` (400 lines). Include:
- Project filter dropdown (from `useProjects()`)
- Source tool filter dropdown
- Session character filter
- Search input
- Paginated session grid/list
- Show `EmptySessions` when no results

**Step 1:** Implement. Verify build, commit.

---

### Task 5.3: Implement Session Detail Page

**Files:**
- Modify: `dashboard/src/pages/SessionDetailPage.tsx`

Port from `web:app/sessions/[id]/page.tsx` (610 lines — largest page). Include:
- Session metadata header (title, duration, character badge, source tool badge)
- Rename session dialog
- Chat conversation view with infinite scroll
- Insights sidebar
- Analyze button
- Prompt quality button

**Step 1:** Implement. Verify build, commit.

---

### Task 5.4: Implement Insights Page

**Files:**
- Modify: `dashboard/src/pages/InsightsPage.tsx`

Port from `web:app/insights/page.tsx` and sub-routes. Include:
- Insight type distribution chart (InsightTypeChart)
- Insight list with filters (type, project, search)
- Insight cards with expand/collapse

**Step 1:** Implement. Verify build, commit.

---

### Task 5.5: Implement Analytics Page

**Files:**
- Modify: `dashboard/src/pages/AnalyticsPage.tsx`

Port from `web:app/analytics/page.tsx`. Include:
- Usage stats (token counts, costs)
- Activity charts (sessions over time)
- Model distribution
- Per-project breakdown

**Step 1:** Implement. Verify build, commit.

---

### Task 5.6: Implement Settings Page

**Files:**
- Modify: `dashboard/src/pages/SettingsPage.tsx`

Port from `web:app/settings/page.tsx` (638 lines) but **heavily simplified**. Remove Firebase/Supabase sections. Keep:
- LLM provider selection (radio group: OpenAI, Anthropic, Gemini, Ollama)
- API key input (masked)
- Model selection (from PROVIDERS list)
- Test connection button
- Ollama model discovery
- Save button (calls `PUT /api/config/llm`)

**Step 1:** Implement. Verify build, commit.

---

### Task 5.7: Implement Export Page

**Files:**
- Modify: `dashboard/src/pages/ExportPage.tsx`

Port from `web:app/export/page.tsx` (487 lines). Include:
- Session range selection
- Format selection (plain, obsidian, notion)
- Preview
- Download button

**Step 1:** Implement. Verify build, commit.

---

### Task 5.8: Implement Journal Page

**Files:**
- Modify: `dashboard/src/pages/JournalPage.tsx`

Port from `web:app/journal/page.tsx` (373 lines). This is the interactive insights chat journal.

**Step 1:** Implement. Verify build, commit.

---

## Layer 6: Polish & Integration

**Branch:** `feature/phase4-layer6-polish`
**Estimated effort:** ~1-2 days

### Task 6.1: Loading States and Skeletons

**Files:**
- Create: `dashboard/src/components/skeletons/SessionCardSkeleton.tsx`
- Create: `dashboard/src/components/skeletons/InsightCardSkeleton.tsx`
- Create: `dashboard/src/components/skeletons/StatsHeroSkeleton.tsx`

Add Skeleton components for all pages that fetch data. Use the shadcn `Skeleton` component.

**Step 1:** Create skeleton components. Add them to pages (render while `isLoading`). Verify build, commit.

---

### Task 6.2: Error States

Add error handling to all pages. When a query fails, show a friendly error with retry button.

**Step 1:** Create a reusable `ErrorCard` component. Add to all pages. Commit.

---

### Task 6.3: Toast Notifications

Wire up `sonner` toasts for all mutations:
- Session renamed → success toast
- Analysis complete → success toast
- Analysis failed → error toast
- Settings saved → success toast
- Export downloaded → success toast

**Step 1:** Add toast calls to all mutation `onSuccess` / `onError` callbacks. Commit.

---

### Task 6.4: Bundle Size Audit

**Step 1:** Build and check sizes:

```bash
cd dashboard && pnpm build
du -sh dist/
ls -la dist/assets/
```

**Step 2:** If `react-syntax-highlighter` contributes >2MB, consider:
- Switching to `highlight.js` import (lighter)
- Only importing specific languages: `import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter/dist/esm/prism-light'`

**Step 3:** Document final bundle size. Commit any optimizations.

---

### Task 6.5: Full Integration Test

**Step 1:** Build entire workspace:

```bash
cd /path/to/code-insights && pnpm build
```

**Step 2:** Start dashboard:

```bash
code-insights dashboard
```

**Step 3:** Verify every page:
- [ ] `/dashboard` — renders stats, charts, feed (or empty state)
- [ ] `/sessions` — lists sessions, filters work, pagination works
- [ ] `/sessions/:id` — chat view renders, tool panels work, analyze button works
- [ ] `/insights` — insight type chart, insight list, filters
- [ ] `/analytics` — usage stats, charts
- [ ] `/settings` — LLM config saves, test connection works
- [ ] `/export` — export generates markdown
- [ ] Dark mode toggle works on all pages
- [ ] No console errors
- [ ] Theme persists across refresh (no FOUC)

**Step 4:** Verify CLI LLM config:

```bash
code-insights config llm --show
code-insights config llm  # interactive
```

**Step 5:** Commit any fixes. Create PR.

---

## Summary: PR Structure

| PR | Branch | Contents |
|----|--------|----------|
| 1 | `feature/phase4-layer1-foundation` | shadcn/ui, utils, types, constants, layout shell, theme, routing |
| 2 | `feature/phase4-layer2-data-hooks` | 10 React Query hooks, API client verification |
| 3 | `feature/phase4-layer3-llm-engine` | Server LLM port (8 files), analysis routes, config routes, CLI `config llm` |
| 4 | `feature/phase4-layer4-components` | Chat (17 files), dashboard (3), sessions (3), insights (4), analysis (5), charts (2), empty states (3) |
| 5 | `feature/phase4-layer5-pages` | All 9 page implementations |
| 6 | `feature/phase4-layer6-polish` | Skeletons, error states, toasts, bundle audit, integration test |

Each PR goes through triple-layer review (`/start-review`). Founder merges.

---

## Key Reference Files

| What | Path |
|------|------|
| Web repo (source) | `/Users/melagiri/Workspace/codeInsights/code-insights-web/` |
| Dashboard API client | `dashboard/src/lib/api.ts` |
| CLI types (SSOT) | `cli/src/types.ts` |
| Server routes | `server/src/routes/*.ts` |
| Server entry | `server/src/index.ts` |
| CLI config | `cli/src/commands/config.ts` |
| Web LLM engine | `web:src/lib/llm/` (7 files) |
| Web hooks | `web:src/lib/hooks/useFirestore.ts` |
| Web components | `web:src/components/` (80 files) |
| Web pages | `web:src/app/` (19 files) |
| Design doc | `docs/plans/2026-02-27-phase4-feature-parity-design.md` |
| Migration plan | `docs/plans/2026-02-27-local-first-migration.md` (Phase 4 section) |
