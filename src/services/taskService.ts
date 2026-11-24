import { supabase } from '../lib/supabase';
import type { Task } from '../types/task';

interface SupabaseTaskRow {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type TaskErrorCode =
  | 'NOT_CONFIGURED'
  | 'MISSING_TABLE'
  | 'PERMISSION_DENIED'
  | 'VALIDATION'
  | 'UNKNOWN';

export class TaskServiceError extends Error {
  readonly code: TaskErrorCode;

  constructor(message: string, code: TaskErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TaskServiceError';
    this.code = code;
  }
}

export const TASKS_SCHEMA_SQL = `create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

drop policy if exists "Allow full CRUD access on tasks" on public.tasks;
create policy "Allow full CRUD access on tasks"
  on public.tasks
  for all
  to anon, authenticated
  using (true)
  with check (true);`;

function mapRowToTask(row: SupabaseTaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function translateSupabaseError(
  error: { code?: string; message?: string; status?: number },
  fallbackMessage: string,
): TaskServiceError {
  const code = error.code ?? '';
  const msg = error.message ?? '';

  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes("Could not find the table 'public.tasks'")
  ) {
    return new TaskServiceError(
      'The "tasks" table does not exist in your Supabase project yet.',
      'MISSING_TABLE',
      { cause: error },
    );
  }

  if (code === '42501' || msg.toLowerCase().includes('row-level security')) {
    return new TaskServiceError(
      'Database access policy blocked this action. Check your Supabase RLS policy for public.tasks.',
      'PERMISSION_DENIED',
      { cause: error },
    );
  }

  if (code === '23514' || code === '23502') {
    return new TaskServiceError(
      'Task title cannot be empty.',
      'VALIDATION',
      { cause: error },
    );
  }

  return new TaskServiceError(fallbackMessage, 'UNKNOWN', { cause: error });
}

function requireClient() {
  if (!supabase) {
    throw new TaskServiceError(
      'Supabase is not configured.',
      'NOT_CONFIGURED',
    );
  }
  return supabase;
}

export async function fetchTasksFromSupabase(): Promise<Task[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('tasks')
    .select('id, title, description, completed, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw translateSupabaseError(error, 'Failed to load tasks from Supabase.');
  }

  return (data as SupabaseTaskRow[]).map(mapRowToTask);
}

export async function createTaskInSupabase(
  title: string,
  description: string,
): Promise<Task> {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  if (!trimmedTitle) {
    throw new TaskServiceError('Task title cannot be empty.', 'VALIDATION');
  }

  const client = requireClient();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('tasks')
    .insert({
      title: trimmedTitle,
      description: trimmedDescription,
      completed: false,
      created_at: now,
      updated_at: now,
    })
    .select('id, title, description, completed, created_at, updated_at')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to create task in Supabase.');
  }

  return mapRowToTask(data as SupabaseTaskRow);
}

export async function updateTaskInSupabase(
  id: string,
  updates: { title?: string; description?: string; completed?: boolean },
): Promise<Task> {
  const client = requireClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (!trimmed) {
      throw new TaskServiceError('Task title cannot be empty.', 'VALIDATION');
    }
    payload.title = trimmed;
  }

  if (updates.description !== undefined) {
    payload.description = updates.description.trim();
  }

  if (updates.completed !== undefined) {
    payload.completed = updates.completed;
  }

  const { data, error } = await client
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .select('id, title, description, completed, created_at, updated_at')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update task in Supabase.');
  }

  return mapRowToTask(data as SupabaseTaskRow);
}

export async function deleteTaskInSupabase(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('tasks').delete().eq('id', id);

  if (error) {
    throw translateSupabaseError(error, 'Failed to delete task from Supabase.');
  }
}

export async function importTasksToSupabase(tasks: Task[]): Promise<Task[]> {
  if (tasks.length === 0) return [];
  const client = requireClient();

  const rows = tasks
    .filter((task) => task.title.trim().length > 0)
    .map((task) => ({
      title: task.title.trim(),
      description: task.description.trim(),
      completed: Boolean(task.completed),
      created_at: task.createdAt || new Date().toISOString(),
      updated_at: task.updatedAt || new Date().toISOString(),
    }));

  if (rows.length === 0) return [];

  const { data, error } = await client
    .from('tasks')
    .insert(rows)
    .select('id, title, description, completed, created_at, updated_at');

  if (error) {
    throw translateSupabaseError(error, 'Failed to import local tasks to Supabase.');
  }

  return (data as SupabaseTaskRow[]).map(mapRowToTask);
}
