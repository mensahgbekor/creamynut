import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => onDismiss(t.id), 2200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-full bg-cocoa-950/95 px-5 py-3 text-sm font-semibold text-cream-50 shadow-warm-lg backdrop-blur"
          role="status"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-leaf-400" />
          {toast.message}
        </div>
      ))}
    </div>
  );
}
