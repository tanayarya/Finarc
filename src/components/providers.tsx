"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { CurrencyProvider } from "@/components/currency-provider";
import { ConfirmProvider } from "@/components/confirm-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false,
          shouldRetryOnError: false,
          dedupingInterval: 1000,
        }}
      >
        <TooltipProvider delayDuration={150}>
          <CurrencyProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </CurrencyProvider>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </SWRConfig>
    </NextThemesProvider>
  );
}
