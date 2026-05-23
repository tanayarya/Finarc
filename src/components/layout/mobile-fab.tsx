"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import * as React from "react";

export function MobileFab() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Add transaction"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <TransactionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
