import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { ToastBanner } from './components/ToastBanner';
import { isSupabaseConfigured } from './lib/supabase';
import {
  TASKS_SCHEMA_SQL,
  TaskServiceError,
  createTaskInSupabase,
  deleteTaskInSupabase,
  fetchTasksFromSupabase,
  importTasksToSupabase,
  updateTaskInSupabase,
} from './services/taskService';
import type { Task, TaskFilter, ToastMessage, ToastVariant } from './types/task';
import {
  generateId,
  loadTasksFromStorage,
  saveTasksToStorage,
} from './utils/storage';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() =>
    isSupabaseConfigured ? [] : loadTasksFromStorage(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [schemaMissing, setSchemaMissing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [localDraftTasks, setLocalDraftTasks] = useState<Task[]>(() =>
    isSupabaseConfigured ? loadTasksFromStorage() : [],
  );

  const [filter, setFilter] = useState<TaskFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, detail?: string, variant: ToastVariant = 'success') => {
      const id = generateId();
      setToasts((prev) => [...prev.slice(-2), { id, title, detail, variant }]);
      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, 3800);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const loadSupabaseTasks = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const remoteTasks = await fetchTasksFromSupabase();
      setTasks(remoteTasks);
      setSchemaMissing(false);
    } catch (error) {
      if (error instanceof TaskServiceError && error.code === 'MISSING_TABLE') {
        setSchemaMissing(true);
        setLoadError(null);
      } else {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to reach Supabase right now.';
        setLoadError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) {
      void loadSupabaseTasks();
    }
  }, [loadSupabaseTasks]);

  const updateLocalTasks = useCallback((updater: (prev: Task[]) => Task[]) => {
    setTasks((prev) => {
      const next = updater(prev);
      saveTasksToStorage(next);
      return next;
    });
  }, []);

  const handleAddTask = useCallback(
    async (title: string, description: string): Promise<boolean> => {
      if (isSupabaseConfigured) {
        try {
          const created = await createTaskInSupabase(title, description);
          setTasks((prev) => [created, ...prev]);
          showToast('Task added successfully', created.title, 'success');
          return true;
        } catch (error) {
          if (error instanceof TaskServiceError && error.code === 'MISSING_TABLE') {
            setSchemaMissing(true);
          }
          const message =
            error instanceof Error ? error.message : 'Failed to save task.';
          showToast('Could not add task', message, 'warning');
          return false;
        }
      }

      const now = new Date().toISOString();
      const newTask: Task = {
        id: generateId(),
        title,
        description,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
      updateLocalTasks((prev) => [newTask, ...prev]);
      showToast('Task added successfully', title, 'success');
      return true;
    },
    [updateLocalTasks, showToast],
  );

  const handleToggleComplete = useCallback(
    async (id: string) => {
      const target = tasks.find((item) => item.id === id);
      if (!target) return;

      if (isSupabaseConfigured) {
        try {
          const updated = await updateTaskInSupabase(id, {
            completed: !target.completed,
          });
          setTasks((prev) =>
            prev.map((item) => (item.id === id ? updated : item)),
          );
          showToast(
            updated.completed
              ? 'Task marked as completed'
              : 'Task marked as pending',
            updated.title,
            updated.completed ? 'success' : 'info',
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to update task.';
          showToast('Could not update task', message, 'warning');
        }
        return;
      }

      let toggledTask: Task | undefined;
      updateLocalTasks((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          toggledTask = {
            ...item,
            completed: !item.completed,
            updatedAt: new Date().toISOString(),
          };
          return toggledTask;
        }),
      );
      if (toggledTask) {
        showToast(
          toggledTask.completed
            ? 'Task marked as completed'
            : 'Task marked as pending',
          toggledTask.title,
          toggledTask.completed ? 'success' : 'info',
        );
      }
    },
    [tasks, updateLocalTasks, showToast],
  );

  const handleUpdateTask = useCallback(
    async (id: string, title: string, description: string): Promise<boolean> => {
      if (isSupabaseConfigured) {
        try {
          const updated = await updateTaskInSupabase(id, { title, description });
          setTasks((prev) =>
            prev.map((item) => (item.id === id ? updated : item)),
          );
          showToast('Task updated successfully', updated.title, 'success');
          return true;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to update task.';
          showToast('Could not update task', message, 'warning');
          return false;
        }
      }

      const now = new Date().toISOString();
      updateLocalTasks((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, title, description, updatedAt: now }
            : item,
        ),
      );
      showToast('Task updated successfully', title, 'success');
      return true;
    },
    [updateLocalTasks, showToast],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!taskToDelete) return;
    const deletedTitle = taskToDelete.title;
    const deleteId = taskToDelete.id;

    if (isSupabaseConfigured) {
      try {
        await deleteTaskInSupabase(deleteId);
        setTasks((prev) => prev.filter((item) => item.id !== deleteId));
        setTaskToDelete(null);
        showToast('Task deleted successfully', deletedTitle, 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete task.';
        showToast('Could not delete task', message, 'warning');
      }
      return;
    }

    updateLocalTasks((prev) => prev.filter((item) => item.id !== deleteId));
    setTaskToDelete(null);
    showToast('Task deleted successfully', deletedTitle, 'success');
  }, [taskToDelete, updateLocalTasks, showToast]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(TASKS_SCHEMA_SQL);
      setCopiedSql(true);
      window.setTimeout(() => setCopiedSql(false), 2200);
      showToast('SQL copied to clipboard', 'Paste it in Supabase SQL Editor', 'info');
    } catch {
      showToast('Copy failed', 'Select and copy the SQL manually.', 'warning');
    }
  };

  const handleImportLocalTasks = async () => {
    if (localDraftTasks.length === 0 || isImporting) return;
    setIsImporting(true);
    try {
      const imported = await importTasksToSupabase(localDraftTasks);
      setTasks((prev) => [...imported, ...prev]);
      saveTasksToStorage([]);
      setLocalDraftTasks([]);
      showToast(
        'Local tasks imported',
        `${imported.length} task${imported.length === 1 ? '' : 's'} synced to Supabase`,
        'success',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to import local tasks.';
      showToast('Import failed', message, 'warning');
    } finally {
      setIsImporting(false);
    }
  };

  const counts = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, pending, completed, completionRate };
  }, [tasks]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchingTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!normalizedQuery) return true;
      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        task.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [tasks, normalizedQuery]);

  const pendingMatchingTasks = useMemo(
    () => matchingTasks.filter((task) => !task.completed),
    [matchingTasks],
  );

  const completedMatchingTasks = useMemo(
    () => matchingTasks.filter((task) => task.completed),
    [matchingTasks],
  );

  const visibleTasks = useMemo(() => {
    if (filter === 'pending') return pendingMatchingTasks;
    if (filter === 'completed') return completedMatchingTasks;
    return matchingTasks;
  }, [filter, pendingMatchingTasks, completedMatchingTasks, matchingTasks]);

  const filterOptions: { key: TaskFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Tasks', count: counts.total },
    { key: 'pending', label: 'Pending Tasks', count: counts.pending },
    { key: 'completed', label: 'Completed Tasks', count: counts.completed },
  ];

  const focusCreateInput = () => {
    titleInputRef.current?.focus();
    titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const resetSearchAndFilter = () => {
    setSearchQuery('');
    setFilter('all');
  };

  return (
    <div className="pastel-canvas min-h-screen text-slate-900">
      <header className="border-b border-slate-200/70 bg-white/75 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-4 sm:px-8">
          <a
            href="#top"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaecfc] text-[#4f46e5]">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>PastelTask</span>
          </a>

          <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-600 tabular-nums">
            <span className="hidden sm:inline">
              <strong className="font-semibold text-slate-900">{counts.pending}</strong> pending
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-slate-300">
              ·
            </span>
            <span>
              <strong className="font-semibold text-[#0f766e]">{counts.completed}</strong> of{' '}
              <strong className="font-semibold text-slate-900">{counts.total}</strong> completed
            </span>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
            Organize your tasks with calm clarity
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Create, edit, search, and complete tasks effortlessly.{' '}
            {isSupabaseConfigured
              ? 'Synced directly with your Supabase database.'
              : 'Everything stays saved in your browser automatically.'}
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Create Task + Progress Summary */}
          <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-6">
            <TaskForm
              onAddTask={handleAddTask}
              titleInputRef={titleInputRef}
              disabled={schemaMissing || isLoading}
            />

            <section
              aria-label="Task progress summary"
              className="rounded-2xl bg-[#f1effa] p-6 soft-task-shadow"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                  Progress Overview
                </h2>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#4338ca]">
                  {counts.completionRate}%
                </span>
              </div>

              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white"
                role="progressbar"
                aria-valuenow={counts.completionRate}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Task completion percentage"
              >
                <div
                  className="h-full rounded-full bg-[#5b5bd6] transition-[width] duration-300 ease-out"
                  style={{ width: `${counts.completionRate}%` }}
                />
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-indigo-200/50 pt-4 text-center">
                <div>
                  <dt className="text-xs text-slate-500">Total</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-900">
                    {counts.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Pending</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[#b45309]">
                    {counts.pending}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Completed</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[#0f766e]">
                    {counts.completed}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>

          {/* Right Column: Search, Filter Tabs & Task Lists */}
          <section aria-label="Task list workspace" className="space-y-6 lg:col-span-8">
            <div className="rounded-2xl bg-white p-4 sm:p-5 soft-card-shadow">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search tasks by title or description..."
                    aria-label="Search tasks"
                    className="w-full rounded-xl bg-[#f7f8fc] py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5b5bd6]/40"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div
                  role="tablist"
                  aria-label="Filter tasks by status"
                  className="grid grid-cols-1 gap-1.5 rounded-xl bg-[#f3f4fa] p-1.5 sm:grid-cols-3"
                >
                  {filterOptions.map((option) => {
                    const isActive = filter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setFilter(option.key)}
                        className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6] ${
                          isActive
                            ? 'bg-white text-[#4338ca] shadow-sm'
                            : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                        }`}
                      >
                        <span>{option.label}</span>
                        <span
                          className={`font-mono text-xs tabular-nums ${
                            isActive ? 'text-[#5b5bd6]' : 'text-slate-400'
                          }`}
                        >
                          ({option.count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3.5" aria-busy="true" aria-label="Loading tasks">
                {[0, 1, 2].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="animate-pulse rounded-2xl bg-white p-5 soft-task-shadow"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="h-6 w-6 rounded-lg bg-slate-200/80" />
                      <div className="flex-1 space-y-2.5">
                        <div className="h-4 w-2/5 rounded bg-slate-200/80" />
                        <div className="h-3 w-3/4 rounded bg-slate-100" />
                        <div className="h-3 w-1/4 rounded bg-slate-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : schemaMissing ? (
              <div className="rounded-2xl bg-white p-6 sm:p-7 soft-card-shadow">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0fc] text-[#4f46e5]">
                    <Database className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Create the tasks table in Supabase
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Your app is connected to your Supabase project, but the{' '}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                        public.tasks
                      </code>{' '}
                      table does not exist yet. Run this SQL in your Supabase Dashboard SQL Editor, then click Check Again.
                    </p>
                  </div>
                </div>

                <pre className="mt-5 overflow-x-auto rounded-xl bg-[#f7f8fc] p-4 font-mono text-xs leading-relaxed text-slate-800">
                  {TASKS_SCHEMA_SQL}
                </pre>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#eef0fc] px-4 py-2 text-sm font-medium text-[#4338ca] transition-colors hover:bg-[#e1e4fb] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Copied SQL
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        Copy SQL
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSupabaseTasks()}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#5b5bd6] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4b4bc2] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Check Again
                  </button>
                </div>
              </div>
            ) : loadError ? (
              <div className="rounded-2xl bg-white p-6 text-center soft-card-shadow">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdecee] text-[#be123c]">
                  <AlertCircle className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">
                  Unable to load tasks from Supabase
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadSupabaseTasks()}
                  className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#5b5bd6] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4b4bc2] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-2xl bg-white px-6 py-14 text-center soft-card-shadow">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0fc] text-[#5b5bd6]">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  No tasks yet
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                  Your task list is currently empty. Add your first task using the form to start tracking your work.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={focusCreateInput}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#eef0fc] px-5 py-2.5 text-sm font-semibold text-[#4338ca] transition-colors hover:bg-[#e1e4fb] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
                  >
                    Create your first task
                  </button>
                  {isSupabaseConfigured && localDraftTasks.length > 0 ? (
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => void handleImportLocalTasks()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#edf9f4] px-5 py-2.5 text-sm font-semibold text-[#0f766e] transition-colors hover:bg-[#daf3e8] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {isImporting
                        ? 'Importing...'
                        : `Import ${localDraftTasks.length} local task${localDraftTasks.length === 1 ? '' : 's'}`}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : visibleTasks.length === 0 ? (
              <div className="rounded-2xl bg-white px-6 py-12 text-center soft-card-shadow">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf2f4] text-[#be123c]">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">
                  {normalizedQuery
                    ? 'No matching tasks found'
                    : filter === 'pending'
                      ? 'No pending tasks'
                      : 'No completed tasks yet'}
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                  {normalizedQuery
                    ? `We couldn't find any tasks matching "${searchQuery.trim()}".`
                    : filter === 'pending'
                      ? 'All of your current tasks are completed.'
                      : 'Check off a pending task to see it listed here.'}
                </p>
                {(normalizedQuery || filter !== 'all') && (
                  <button
                    type="button"
                    onClick={resetSearchAndFilter}
                    className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#eef0fc] px-5 py-2 text-sm font-medium text-[#4338ca] transition-colors hover:bg-[#e1e4fb] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
                  >
                    Show all tasks
                  </button>
                )}
              </div>
            ) : filter === 'all' ? (
              <div className="space-y-8">
                {pendingMatchingTasks.length > 0 ? (
                  <section aria-labelledby="pending-section-heading">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2
                        id="pending-section-heading"
                        className="text-sm font-semibold text-slate-700"
                      >
                        Pending Tasks
                      </h2>
                      <span className="font-mono text-xs tabular-nums text-slate-500">
                        {pendingMatchingTasks.length}
                      </span>
                    </div>
                    <ul className="space-y-3.5">
                      <AnimatePresence initial={false}>
                        {pendingMatchingTasks.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            onToggleComplete={handleToggleComplete}
                            onUpdateTask={handleUpdateTask}
                            onRequestDelete={setTaskToDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </section>
                ) : null}

                {completedMatchingTasks.length > 0 ? (
                  <section aria-labelledby="completed-section-heading">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2
                        id="completed-section-heading"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f766e]"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Completed Tasks
                      </h2>
                      <span className="font-mono text-xs tabular-nums text-slate-500">
                        {completedMatchingTasks.length}
                      </span>
                    </div>
                    <ul className="space-y-3.5">
                      <AnimatePresence initial={false}>
                        {completedMatchingTasks.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            onToggleComplete={handleToggleComplete}
                            onUpdateTask={handleUpdateTask}
                            onRequestDelete={setTaskToDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : (
              <section aria-label={`${filter} tasks`}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-slate-700">
                    {filter === 'pending' ? 'Pending Tasks' : 'Completed Tasks'}
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {visibleTasks.length}
                  </span>
                </div>
                <ul className="space-y-3.5">
                  <AnimatePresence initial={false}>
                    {visibleTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggleComplete={handleToggleComplete}
                        onUpdateTask={handleUpdateTask}
                        onRequestDelete={setTaskToDelete}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            )}
          </section>
        </div>
      </main>

      <DeleteConfirmModal
        task={taskToDelete}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setTaskToDelete(null)}
      />

      <ToastBanner toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
