import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ToastMessage } from '../types/task';

interface ToastBannerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastBanner({ toasts, onDismiss }: ToastBannerProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const isSuccess = toast.variant === 'success';
          const isWarning = toast.variant === 'warning';
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl p-4 soft-card-shadow ${
                isSuccess
                  ? 'bg-[#edf9f4] text-[#114232]'
                  : isWarning
                    ? 'bg-[#fdecee] text-[#881337]'
                    : 'bg-[#eff1fe] text-[#282b59]'
              }`}
            >
              <span className="mt-0.5 shrink-0" aria-hidden="true">
                {isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-[#0f766e]" />
                ) : isWarning ? (
                  <AlertCircle className="h-5 w-5 text-[#be123c]" />
                ) : (
                  <Info className="h-5 w-5 text-[#4f46e5]" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{toast.title}</p>
                {toast.detail ? (
                  <p className="mt-0.5 truncate text-xs opacity-80">{toast.detail}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-lg p-1 opacity-65 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
