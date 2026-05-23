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
import { budgetCreateSchema } from "@/lib/validators";
import { postJson } from "@/lib/fetcher";
import { useCategories } from "@/hooks/use-data";
import type { z } from "zod";

type FormValues = z.input<typeof budgetCreateSchema>;

export function BudgetDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { data: cats } = useCategories("EXPENSE");

  const form = useForm<FormValues>({
    resolver: zodResolver(budgetCreateSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      amount: "",
      period: "MONTHLY",
      startDate: new Date(),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await postJson("/api/budgets", values);
      toast.success("Budget created");
      setOpen(false);
      form.reset({
        name: "",
        categoryId: "",
        amount: "",
        period: "MONTHLY",
        startDate: new Date(),
      });
      mutate(
        (key) =>
          typeof key === "string" &&
          (key.startsWith("/api/budgets") || key.startsWith("/api/dashboard")),
        undefined,
        { revalidate: true }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create budget");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>
            Set a spending limit for an expense category.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" placeholder="Monthly groceries" {...form.register("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(cats ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.categoryId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryId.message as string}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Controller
                control={form.control}
                name="period"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-amount">Amount</Label>
            <Input id="b-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
