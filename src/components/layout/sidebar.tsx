"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-config";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("finarc_sidebar");
      return saved !== null ? saved === "collapsed" : true;
    }
    return true;
  });
  React.useEffect(() => {
    localStorage.setItem("finarc_sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  return (
    <aside className={cn(
      "hidden md:flex md:flex-col md:border-r md:bg-card/40 md:sticky md:top-0 md:h-screen transition-all duration-200",
      collapsed ? "md:w-16" : "md:w-60"
    )}>
      {/* Logo */}
      <div className={cn("flex h-14 shrink-0 items-center border-b", collapsed ? "justify-center px-2" : "gap-2 px-4")}>
        {collapsed ? (
          <img src="/logo.svg" alt="Finarc" className="h-6 w-6 object-contain" />
        ) : (
          <img src="/logo.svg" alt="Finarc" className="h-7 w-auto" />
        )}
      </div>

      {/* Navigation — takes all available space */}
      <ScrollArea className="flex-1">
        <nav className={cn("space-y-0.5 p-2", collapsed && "px-1.5")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center rounded-md p-2.5 transition-colors",
                        active
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer — Collapse + Logout at the BOTTOM, always visible */}
      <div className={cn("shrink-0 border-t", collapsed ? "p-1.5 space-y-1" : "p-2 space-y-1")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { sessionStorage.removeItem("finarc_auth"); window.location.reload(); }}
              className={cn(
                "flex w-full items-center rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2"
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && "Logout"}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Logout</TooltipContent>}
        </Tooltip>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="ml-2 text-xs">Collapse</span></>}
        </Button>
      </div>
    </aside>
  );
}
