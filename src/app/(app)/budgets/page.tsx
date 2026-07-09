"use client";

import * as React from "react";
import { mutate } from "swr";
import { CircleAlert, PiggyBank, Plus, Target, Trash2, Tag, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BudgetDialog } from "@/components/budgets/budget-dialog";
import { BudgetEditDialog } from "@/components/budgets/budget-edit-dialog";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { CategoryEditDialog } from "@/components/categories/category-edit-dialog";
import { useConfirm } from "@/components/confirm-provider";
import { useCurrency } from "@/components/currency-provider";
import { useBudgets, useCategories, type BudgetWithProgress, type Category } from "@/hooks/use-data";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { delJson } from "@/lib/fetcher";

export default function BudgetsPage() {
  const { data: budgets, isLoading } = useBudgets();
  const { data: cats } = useCategories();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  const [editBudget, setEditBudget] = React.useState<BudgetWithProgress | null>(null);
  const [editCat, setEditCat] = React.useState<Category | null>(null);
  const budgetSummary = React.useMemo(() => {
    const rows = budgets ?? [];
    const totalAllocated = rows.reduce((sum, b) => sum + Number(b.allocated), 0);
    const totalSpent = rows.reduce((sum, b) => sum + Number(b.spent), 0);
    const remaining = totalAllocated - totalSpent;
    const overBudget = rows.filter((b) => b.status === "OVER_BUDGET").length;
    const usage = totalAllocated > 0 ? totalSpent / totalAllocated : 0;

    return { totalAllocated, totalSpent, remaining, overBudget, usage };
  }, [budgets]);

  const onDelete = async (b: BudgetWithProgress) => {
    const ok = await confirm({
      title: `Delete "${b.name}" budget?`,
      description: `This removes the ${b.period.toLowerCase()} spending limit for ${b.category.name}. Existing transactions are not affected.`,
      confirmLabel: "Delete budget",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await delJson(`/api/budgets/${b.id}`);
      toast.success("Budget removed");
      mutate("/api/budgets");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const onDeleteCategory = async (c: Category) => {
    const ok = await confirm({
      title: `Delete "${c.name}" category?`,
      description: "The category will be archived. Existing transactions keep their label but new ones won't see it.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await delJson(`/api/categories/${c.id}`);
      toast.success("Category removed");
      mutate((key) => typeof key === "string" && key.startsWith("/api/categories"), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Budgets</h2>
          <p className="text-sm text-muted-foreground">Set spending caps per category and track progress.</p>
        </div>
        <div className="flex gap-2">
          <CategoryDialog trigger={<Button variant="outline" size="sm" className="gap-1.5"><Tag className="h-4 w-4" /> New category</Button>} />
          <BudgetDialog trigger={<Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New budget</Button>} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-[116px]" />))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <BudgetKpiCard
            icon={Target}
            label="Total planned"
            value={formatCurrency(budgetSummary.totalAllocated)}
            detail={`${(budgets ?? []).length} active ${(budgets ?? []).length === 1 ? "budget" : "budgets"}`}
          />
          <BudgetKpiCard
            icon={PiggyBank}
            label="Used so far"
            value={formatCurrency(budgetSummary.totalSpent)}
            detail={`${formatPercent(budgetSummary.usage)} of planned budget`}
          />
          <BudgetKpiCard
            icon={CircleAlert}
            label={budgetSummary.remaining >= 0 ? "Still available" : "Over planned"}
            value={formatCurrency(Math.abs(budgetSummary.remaining))}
            detail={budgetSummary.overBudget > 0 ? `${budgetSummary.overBudget} over budget` : "All tracked budgets within plan"}
            tone={budgetSummary.remaining < 0 || budgetSummary.overBudget > 0 ? "danger" : "success"}
          />
        </div>
      )}

      <Tabs defaultValue="budgets">
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-3">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-[140px]" />))}</div>
          ) : (budgets ?? []).length === 0 ? (
            <EmptyState title="No budgets yet" description="Create one to track your spending against allocated limits." action={<BudgetDialog trigger={<Button><Plus className="h-4 w-4" /> Create budget</Button>} />} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(budgets ?? []).map((b) => (
                <Card key={b.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                      <CardDescription className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.category.color ?? "hsl(var(--muted))" }} />
                        {b.period.toLowerCase()}
                      </CardDescription>
                      <CardTitle className="mt-1 text-base">{b.category.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={b.status} />
                      <Button variant="ghost" size="icon" onClick={() => setEditBudget(b)} aria-label="Edit budget"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(b)} aria-label="Delete budget"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(b.spent)}</span>
                      <span className="text-xs text-muted-foreground">of {formatCurrency(b.allocated)}</span>
                    </div>
                    <Progress value={Math.min(100, b.usage * 100)} indicatorClassName={cn(b.status === "HEALTHY" && "bg-emerald-500", b.status === "NEAR_LIMIT" && "bg-amber-500", b.status === "OVER_BUDGET" && "bg-rose-500")} />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{formatCurrency(b.remaining)} remaining</span>
                      <span className="tabular">{formatPercent(b.usage)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader><CardTitle className="text-sm">All categories</CardTitle><CardDescription>Used to label transactions and group budgets</CardDescription></CardHeader>
            <CardContent>
              {(cats ?? []).length === 0 ? (
                <EmptyState title="No categories yet" description="Add categories to label income and expense transactions." action={<CategoryDialog trigger={<Button>Create category</Button>} />} />
              ) : (
                <div className="space-y-2">
                  {(cats ?? []).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="flex items-center gap-2">
                        {c.color ? <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} /> : null}
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant="muted" className="text-[10px]">{c.kind}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditCat(c)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteCategory(c)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BudgetEditDialog open={Boolean(editBudget)} onOpenChange={(o) => { if (!o) setEditBudget(null); }} budget={editBudget} />
      <CategoryEditDialog open={Boolean(editCat)} onOpenChange={(o) => { if (!o) setEditCat(null); }} category={editCat} />
    </div>
  );
}

function BudgetKpiCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
          <p className={cn(
            "text-xs text-muted-foreground",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
            tone === "danger" && "text-rose-600 dark:text-rose-400"
          )}>{detail}</p>
        </div>
        <div className={cn(
          "rounded-md border bg-muted p-2 text-muted-foreground",
          tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-400",
          tone === "danger" && "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-400"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET" }) {
  if (status === "OVER_BUDGET") return <Badge variant="destructive">Over budget</Badge>;
  if (status === "NEAR_LIMIT") return <Badge variant="warning">Near limit</Badge>;
  return <Badge variant="success">Healthy</Badge>;
}
