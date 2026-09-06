"use client";

import * as React from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
}

const SESSION_KEY = "finarc_auth";

interface AuthConfig {
  pinEnabled: boolean;
  totpEnabled: boolean;
  webAuthnEnabled: boolean;
}

export function PinGate({ children }: Props) {
  const [authenticated, setAuthenticated] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [config, setConfig] = React.useState<AuthConfig>({ pinEnabled: true, totpEnabled: false, webAuthnEnabled: false });

  React.useEffect(() => {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === "true") {
      setAuthenticated(true);
      setChecking(false);
      return;
    }
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) setConfig(d.data);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const markAuthenticated = () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setAuthenticated(true);
  };

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
        markAuthenticated();
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

  const onTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) { setError("Enter 6-digit code"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "totp", code: totpCode }),
      });
      if (res.ok) {
        markAuthenticated();
      } else {
        setError("Incorrect authenticator code");
        setTotpCode("");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const onSecurityKey = async () => {
    setLoading(true);
    setError("");
    try {
      const optionsRes = await fetch("/api/auth/webauthn/authentication-options", { method: "POST" });
      if (!optionsRes.ok) throw new Error("Security key is not configured");
      const optionsBody = await optionsRes.json();
      const authentication = await startAuthentication({ optionsJSON: optionsBody.data });
      const verifyRes = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authentication),
      });
      if (!verifyRes.ok) throw new Error("Security key verification failed");
      markAuthenticated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Security key verification failed");
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
          <CardDescription>Unlock with your PIN, authenticator app, or security key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={loading || pin.length !== 6}>
              {loading ? "Verifying..." : "Unlock"}
            </Button>
          </form>

          {config.totpEnabled && (
            <form onSubmit={onTotpSubmit} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                Authenticator app
              </div>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={totpCode}
                onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                className="text-center text-lg"
              />
              <Button type="submit" variant="outline" className="w-full" disabled={loading || totpCode.length !== 6}>
                Verify code
              </Button>
            </form>
          )}

          {config.webAuthnEnabled && (
            <Button type="button" variant="outline" className="w-full gap-2" onClick={onSecurityKey} disabled={loading}>
              <KeyRound className="h-4 w-4" />
              Use security key
            </Button>
          )}

          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
