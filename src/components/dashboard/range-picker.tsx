"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type RangeKind = "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

export interface RangeValue {
  kind: RangeKind;
  from?: Date;
  to?: Date;
}

interface Props {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
}

export function RangePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={value.kind === "CUSTOM" ? "" : value.kind}
        onValueChange={(v) => v && onChange({ kind: v as RangeKind })}
      >
        <TabsList>
          <TabsTrigger value="WEEK">Week</TabsTrigger>
          <TabsTrigger value="MONTH">Month</TabsTrigger>
          <TabsTrigger value="YEAR">Year</TabsTrigger>
        </TabsList>
      </Tabs>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={value.kind === "CUSTOM" ? "default" : "outline"}
            size="sm"
            className={cn("gap-1.5")}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {value.kind === "CUSTOM" && value.from
              ? `${format(value.from, "MMM d")}${value.to ? ` – ${format(value.to, "MMM d")}` : ""}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={
              value.kind === "CUSTOM" && value.from
                ? { from: value.from, to: value.to }
                : undefined
            }
            onSelect={(r) =>
              onChange({
                kind: "CUSTOM",
                from: r?.from,
                to: r?.to,
              })
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function buildRangeQuery(value: RangeValue) {
  const params = new URLSearchParams();
  params.set("kind", value.kind);
  if (value.kind === "CUSTOM") {
    if (value.from) params.set("from", value.from.toISOString());
    if (value.to) params.set("to", value.to.toISOString());
  }
  return params.toString();
}
