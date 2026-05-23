"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryCreateSchema } from "@/lib/validators";
import { postJson } from "@/lib/fetcher";
import type { z } from "zod";

type FormValues = z.input<typeof categoryCreateSchema>;

interface Props {
  trigger: React.ReactNode;
  defaultKind?: "INCOME" | "EXPENSE";
}

const COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#facc15",
  "#06b6d4",
  "#6366f1",
];

export function CategoryDialog({ trigger, defaultKind = "EXPENSE" }: Props) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: "", kind: defaultKind, color: COLORS[0] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await postJson("/api/categories", values);
      toast.success("Category created");
      setOpen(false);
      form.reset({ name: "", kind: defaultKind, color: COLORS[0] });
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/categories"),
        undefined,
        { revalidate: true }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create category");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Categories group transactions and back budget tracking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" placeholder="Groceries" {...form.register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className="h-7 w-7 rounded-md border-2 transition-transform"
                      style={{
                        background: c,
                        borderColor: field.value === c ? "hsl(var(--foreground))" : "transparent",
                        transform: field.value === c ? "scale(1.05)" : "scale(1)",
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
