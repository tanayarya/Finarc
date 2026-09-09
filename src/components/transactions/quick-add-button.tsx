"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./transaction-dialog";
import { useAppSettings } from "@/hooks/use-settings";

export function QuickAddButton() {
  const [open, setOpen] = React.useState(false);
  const { defaultAccountId } = useAppSettings();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "n" ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        New transaction
      </Button>
      <TransactionDialog open={open} onOpenChange={setOpen} defaultAccountId={defaultAccountId} />
    </>
  );
}
