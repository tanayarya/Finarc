"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./transaction-dialog";
import { useAppSettings } from "@/hooks/use-settings";

export function QuickAddButton() {
  const [open, setOpen] = React.useState(false);
  const { defaultAccountId } = useAppSettings();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        New transaction
      </Button>
      <TransactionDialog open={open} onOpenChange={setOpen} defaultAccountId={defaultAccountId} />
    </>
  );
}
