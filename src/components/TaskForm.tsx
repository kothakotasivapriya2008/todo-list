import { Plus } from 'lucide-react';
import { useState, type FormEvent, type RefObject } from 'react';

interface TaskFormProps {
  onAddTask: (title: string, description: string) => Promise<boolean>;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}

export function TaskForm({
  onAddTask,
  titleInputRef,
  disabled = false,
}: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || disabled) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setError('Please enter a task title before adding.');
      titleInputRef?.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onAddTask(trimmedTitle, trimmedDescription);
      if (created) {
        setTitle('');
        setDescription('');
        setError('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="create-task-heading"
      className="rounded-2xl bg-white p-6 soft-card-shadow"
    >
      <div className="mb-5">
        <h2
          id="create-task-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Add a New Task
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Capture a title and optional details to keep your day organized.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="new-task-title"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Task Title <span className="text-[#be123c]" aria-hidden="true">*</span>
          </label>
          <input
            ref={titleInputRef}
            id="new-task-title"
            type="text"
            value={title}
            disabled={isSubmitting || disabled}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error && event.target.value.trim()) {
                setError('');
              }
            }}
            placeholder="e.g., Prepare sprint review slides"
            maxLength={120}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'new-task-title-error' : undefined}
            className={`w-full rounded-xl bg-[#f7f8fc] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 disabled:opacity-60 ${
              error
                ? 'ring-2 ring-[#be123c]/50 focus:ring-[#be123c]'
                : 'focus:ring-[#5b5bd6]/40'
            }`}
          />
          {error ? (
            <p
              id="new-task-title-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[#be123c]"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="new-task-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="new-task-description"
            value={description}
            disabled={isSubmitting || disabled}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context, links, or sub-steps..."
            rows={3}
            maxLength={500}
            className="w-full resize-y rounded-xl bg-[#f7f8fc] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5b5bd6]/40 disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || disabled}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#5b5bd6] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4b4bc2] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? 'Adding Task...' : 'Add Task'}
        </button>
      </form>
    </section>
  );
}
