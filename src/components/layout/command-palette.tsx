"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { navItems } from "./nav-config";
import { OPEN_TRANSACTION_EVENT } from "@/lib/app-events";

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey ||
        isEditableTarget(event.target) ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }

      event.preventDefault();
      setOpen((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const openTransaction = React.useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(OPEN_TRANSACTION_EVENT));
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages and quick actions.
        </DialogDescription>
        <Command loop className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <Command.Input
            autoFocus
            placeholder="Search pages and actions..."
            className="h-12 w-full border-b bg-transparent px-4 pr-10 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-[min(22rem,60vh)] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matching page or action.
            </Command.Empty>
            <Command.Group heading="Actions">
              <Command.Item
                value="New transaction add income expense transfer"
                onSelect={openTransaction}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-none data-[selected=true]:bg-secondary"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>New transaction</span>
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Pages">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-none data-[selected=true]:bg-secondary"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
