"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
}

const SESSION_KEY = "finarc_auth";

export function PinGate({ children }: Props) {
  const [authenticated, setAuthenticated] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    // Check session storage
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === "true") {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) { setError("Enter 6-digit PIN"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setAuthenticated(true);
      } else {
        setError("Incorrect PIN");
        setPin("");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <img src="/logo.svg" alt="Finarc" className="h-12 w-auto mx-auto" />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Enter your 6-digit PIN to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              className="text-center text-2xl tracking-[0.5em] h-12"
              autoFocus
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || pin.length !== 6}>
              {loading ? "Verifying..." : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
