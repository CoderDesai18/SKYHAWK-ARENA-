import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: string; message: string; kind: ToastKind; }
interface ToastContextShape { toast: (message: string, kind?: ToastKind) => void; }
const ToastContext = createContext<ToastContextShape | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => remove(id), 4200);
  }, [remove]);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence>{items.map((item) => {
        const Icon = item.kind === 'success' ? Check : item.kind === 'error' ? TriangleAlert : Info;
        return <motion.div key={item.id} className={`toast toast-${item.kind}`} initial={{ opacity: 0, x: 28, scale: .97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 22 }}>
          <Icon size={17} /><span>{item.message}</span><button className="icon-btn toast-close" aria-label="Dismiss notification" onClick={() => remove(item.id)}><X size={15} /></button>
        </motion.div>;
      })}</AnimatePresence>
    </div>
  </ToastContext.Provider>;
}

export function useToast(): ToastContextShape {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
