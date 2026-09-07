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
  authPrimaryMethod: "pin" | "totp";
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
  const [config, setConfig] = React.useState<AuthConfig>({ authPrimaryMethod: "pin", pinEnabled: true, totpEnabled: false, webAuthnEnabled: false });
  const lastTotpAttempt = React.useRef("");
  const useTotp = config.authPrimaryMethod === "totp" && config.totpEnabled;

  React.useEffect(() => {
    async function checkSession() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionBody = await sessionRes.json().catch(() => ({}));
        if (sessionBody?.data?.authenticated) {
          sessionStorage.setItem(SESSION_KEY, "true");
          setAuthenticated(true);
          return;
        }
        sessionStorage.removeItem(SESSION_KEY);

        const configRes = await fetch("/api/auth/config");
        const configBody = await configRes.json().catch(() => ({}));
        if (configBody?.data) setConfig(configBody.data);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      } finally {
        setChecking(false);
      }
    }

    void checkSession();
  }, []);

  const markAuthenticated = React.useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setAuthenticated(true);
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

  const verifyTotpCode = React.useCallback(async (code: string) => {
    if (code.length !== 6) { setError("Enter 6-digit code"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "totp", code }),
      });
      if (res.ok) {
        markAuthenticated();
      } else {
        setError("Incorrect authenticator code");
        setTotpCode("");
        lastTotpAttempt.current = "";
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, [markAuthenticated]);

  const onTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    lastTotpAttempt.current = totpCode;
    await verifyTotpCode(totpCode);
  };

  React.useEffect(() => {
    if (!useTotp || loading || totpCode.length !== 6 || lastTotpAttempt.current === totpCode) return;
    lastTotpAttempt.current = totpCode;
    void verifyTotpCode(totpCode);
  }, [loading, totpCode, useTotp, verifyTotpCode]);

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
          <CardDescription>
            {useTotp ? "Enter your authenticator code to continue." : "Enter your 6-digit PIN to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {useTotp ? (
            <form onSubmit={onTotpSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                Authenticator app
              </div>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTotpCode(next);
                  setError("");
                  if (next.length < 6) lastTotpAttempt.current = "";
                }}
                className="h-12 text-center text-xl font-medium tabular-nums tracking-normal placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground"
                autoFocus
              />
              {loading && <p className="text-center text-xs text-muted-foreground">Verifying...</p>}
            </form>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                className="h-12 text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={loading || pin.length !== 6}>
                {loading ? "Verifying..." : "Unlock"}
              </Button>
            </form>
          )}

          {config.webAuthnEnabled && (
            <Button type="button" variant="outline" className="w-full gap-2" onClick={onSecurityKey} disabled={loading}>
              <KeyRound className="h-4 w-4" />
              Touch security key
            </Button>
          )}

          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
