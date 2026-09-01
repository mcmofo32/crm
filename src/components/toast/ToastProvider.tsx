"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;

/**
 * Globale melding-laag: een korte pill onderaan rechts die vanzelf verdwijnt
 * (geen sluitknop nodig) — de visuele bevestiging dat een actie ergens in de
 * CRM gelukt is. Eenmaal gemount in de root-layout; overal in de app
 * bruikbaar via useToast()/FormToast/useToastAction.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.variant === "success" ? "bg-slate-900" : "bg-red-600"
            }`}
          >
            {t.variant === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast moet binnen ToastProvider gebruikt worden");
  return ctx;
}
