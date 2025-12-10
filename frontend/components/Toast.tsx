import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastProps {
    toasts: ToastItem[];
    removeToast: (id: string) => void;
}

const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
};

const styles = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-rose-600 border-rose-500',
    warning: 'bg-amber-600 border-amber-500',
    info: 'bg-blue-600 border-blue-500',
};

export const Toast: React.FC<ToastProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => {
                const Icon = icons[toast.type];
                return (
                    <div
                        key={toast.id}
                        className={`${styles[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 animate-in slide-in-from-right-full duration-300`}
                    >
                        <Icon size={20} className="shrink-0" />
                        <span className="text-sm flex-1">{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="hover:bg-white/20 rounded p-1 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

// Hook pour utiliser les toasts
export const useToast = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now().toString();
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto-remove après 4 secondes
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
};

export default Toast;
