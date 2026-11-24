export type TaskFilter = 'all' | 'pending' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ToastVariant = 'success' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  variant: ToastVariant;
}
