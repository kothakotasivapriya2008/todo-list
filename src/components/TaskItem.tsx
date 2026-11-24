import { Check, Clock, Pencil, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import type { Task } from '../types/task';
import { formatTaskTimestamp } from '../utils/storage';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => Promise<void>;
  onUpdateTask: (id: string, title: string, description: string) => Promise<boolean>;
  onRequestDelete: (task: Task) => void;
}

export function TaskItem({
  task,
  onToggleComplete,
  onUpdateTask,
  onRequestDelete,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const startEditing = () => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditError('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditError('');
    setIsEditing(false);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const trimmedTitle = editTitle.trim();
    const trimmedDescription = editDescription.trim();

    if (!trimmedTitle) {
      setEditError('Task title cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await onUpdateTask(task.id, trimmedTitle, trimmedDescription);
      if (updated) {
        setEditError('');
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await onToggleComplete(task.id);
    } finally {
      setIsToggling(false);
    }
  };

  const wasEdited = task.updatedAt !== task.createdAt;
  const formattedTime = formatTaskTimestamp(wasEdited ? task.updatedAt : task.createdAt);

  if (isEditing) {
    return (
      <motion.li
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl bg-[#f4f3fd] p-5 soft-task-shadow"
      >
        <form onSubmit={handleSave} noValidate className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4b4bc2]">
              Editing Task
            </span>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              aria-label="Cancel editing"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label
              htmlFor={`edit-title-${task.id}`}
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              Task Title <span className="text-[#be123c]" aria-hidden="true">*</span>
            </label>
            <input
              id={`edit-title-${task.id}`}
              type="text"
              value={editTitle}
              disabled={isSaving}
              onChange={(event) => {
                setEditTitle(event.target.value);
                if (editError && event.target.value.trim()) {
                  setEditError('');
                }
              }}
              maxLength={120}
              autoFocus
              aria-invalid={editError ? 'true' : 'false'}
              className={`w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                editError
                  ? 'ring-2 ring-[#be123c]/50 focus:ring-[#be123c]'
                  : 'focus:ring-[#5b5bd6]/45'
              }`}
            />
            {editError ? (
              <p role="alert" className="mt-1 text-xs font-medium text-[#be123c]">
                {editError}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={`edit-description-${task.id}`}
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id={`edit-description-${task.id}`}
              value={editDescription}
              disabled={isSaving}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional description..."
              className="w-full resize-y rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b5bd6]/45 disabled:opacity-60"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#5b5bd6] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4b4bc2] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.li>
    );
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`group rounded-2xl p-5 transition-colors soft-task-shadow ${
        task.completed ? 'bg-[#f4fbf8]' : 'bg-white'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div className="pt-0.5">
          <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={task.completed}
              disabled={isToggling}
              onChange={handleToggle}
              aria-label={`Mark "${task.title}" as ${
                task.completed ? 'pending' : 'completed'
              }`}
              className="peer sr-only"
            />
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#5b5bd6] ${
                isToggling ? 'opacity-60' : ''
              } ${
                task.completed
                  ? 'border-[#0f766e] bg-[#0f766e] text-white'
                  : 'border-[#c6cae8] bg-[#f7f8fc] text-transparent group-hover:border-[#5b5bd6]'
              }`}
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
            </span>
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h3
                className={`text-base font-semibold leading-snug break-words transition-colors ${
                  task.completed
                    ? 'text-slate-500 line-through decoration-slate-400/70'
                    : 'text-slate-900'
                }`}
              >
                {task.title}
              </h3>

              {task.description ? (
                <p
                  className={`mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line ${
                    task.completed ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {task.description}
                </p>
              ) : (
                <p className="mt-1 text-xs italic text-slate-400">
                  No description provided
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                {task.completed ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[#0f766e]">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-[#b45309]">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Pending
                  </span>
                )}

                {formattedTime ? (
                  <>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {wasEdited ? `Updated ${formattedTime}` : `Added ${formattedTime}`}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
              <button
                type="button"
                onClick={startEditing}
                aria-label={`Edit "${task.title}"`}
                className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-xl bg-[#eef0fc] px-3.5 py-2 text-xs font-medium text-[#4338ca] transition-colors hover:bg-[#e1e4fb] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(task)}
                aria-label={`Delete "${task.title}"`}
                className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-xl bg-[#fdecee] px-3.5 py-2 text-xs font-medium text-[#be123c] transition-colors hover:bg-[#fad8dd] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be123c]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.li>
  );
}
