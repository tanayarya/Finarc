"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryUpdateSchema } from "@/lib/validators";
import { patchJson } from "@/lib/fetcher";
import type { Category } from "@/hooks/use-data";
import type { z } from "zod";

type FormValues = z.input<typeof categoryUpdateSchema>;

const COLORS = [
  "#0ea5e9", "#22c55e", "#f97316", "#a855f7",
  "#ef4444", "#facc15", "#06b6d4", "#6366f1",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export function CategoryEditDialog({ open, onOpenChange, category }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(categoryUpdateSchema),
    defaultValues: { name: category?.name ?? "", color: category?.color ?? COLORS[0] },
  });

  React.useEffect(() => {
    if (open && category) {
      form.reset({ name: category.name, color: category.color ?? COLORS[0] });
    }
  }, [open, category, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!category) return;
    try {
      await patchJson(`/api/categories/${category.id}`, values);
      toast.success("Category updated");
      onOpenChange(false);
      mutate((key) => typeof key === "string" && key.startsWith("/api/categories"), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>Update the name or color.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <Controller control={form.control} name="color" render={({ field }) => (
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
            )} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
