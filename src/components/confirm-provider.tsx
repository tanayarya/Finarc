"use client";

import * as React from "react";
import { AlertDialog } from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "destructive" | "default";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

interface InternalState extends ConfirmOptions {
  open: boolean;
  loading: boolean;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<InternalState>({
    open: false,
    loading: false,
    title: "",
    resolve: () => undefined,
  });

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        open: true,
        loading: false,
        resolve,
      });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state.resolve(result);
    setState((s) => ({ ...s, open: false, loading: false }));
  };

  const handleConfirm = () => {
    handleClose(true);
  };

  const value = React.useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(o) => {
          if (!o) handleClose(false);
        }}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        tone={state.tone}
        loading={state.loading}
        onConfirm={handleConfirm}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
