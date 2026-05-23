"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Download, Upload, Moon, Sun, Monitor, Database, Globe, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/components/currency-provider";
import { useConfirm } from "@/components/confirm-provider";
import { CURRENCIES } from "@/lib/currencies";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const confirm = useConfirm();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [fyStart, setFyStart] = React.useState(4);
  const [defaultAccountId, setDefaultAccountId] = React.useState("");
  const [defaultInvestmentAccountId, setDefaultInvestmentAccountId] = React.useState("");
  const { data: allAccounts } = useSWR<Array<{ id: string; name: string; type: string }>>("/api/accounts");

  // Load settings
  React.useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d?.data?.financialYearStart) setFyStart(d.data.financialYearStart);
      if (d?.data?.defaultAccountId) setDefaultAccountId(d.data.defaultAccountId);
      if (d?.data?.defaultInvestmentAccountId) setDefaultInvestmentAccountId(d.data.defaultInvestmentAccountId);
    }).catch(() => {});
  }, []);

  const handleExport = () => { window.open("/api/backup/export", "_blank"); };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/backup/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Import failed"); }
      toast.success("Backup restored");
      mutate(() => true, undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCurrencyChange = async (code: string) => {
    try {
      await setCurrency(code);
      toast.success(`Currency set to ${code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update currency");
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: "Clear all financial data?",
      description: "This permanently deletes every account, transaction, budget, category, and recurring rule. Your settings (currency, theme) will be kept. This cannot be undone — consider exporting a backup first.",
      confirmLabel: "Yes, delete everything",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/backup/clear", { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear");
      toast.success("All data cleared — fresh start");
      mutate(() => true, undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear data");
    }
  };

  const handleFYChange = async (month: number) => {
    setFyStart(month);
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ financialYearStart: month }) });
    toast.success(`Financial year starts in ${["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]}`);
  };

  const handleDefaultAccount = async (id: string) => {
    const val = id === "none" ? "" : id;
    setDefaultAccountId(val);
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultAccountId: val }) });
    toast.success(val ? "Default account set" : "Default account cleared");
  };

  const handleDefaultInvestmentAccount = async (id: string) => {
    const val = id === "none" ? "" : id;
    setDefaultInvestmentAccountId(val);
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultInvestmentAccountId: val }) });
    toast.success(val ? "Default investment account set" : "Cleared");
  };

  const handleExportCSV = () => { window.open("/api/backup/export-csv", "_blank"); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage appearance, currency, and your data backup.</p>
      </div>

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="charges">Trading Charges</TabsTrigger>
          <TabsTrigger value="telegram">Notifications</TabsTrigger>
          <TabsTrigger value="ai">AI Assistant</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle className="text-sm">Theme</CardTitle><CardDescription>Light, dark, or follow your system.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                <ThemeOption Icon={Sun} label="Light" active={theme === "light"} onClick={() => setTheme("light")} />
                <ThemeOption Icon={Moon} label="Dark" active={theme === "dark"} onClick={() => setTheme("dark")} />
                <ThemeOption Icon={Monitor} label="System" active={theme === "system"} onClick={() => setTheme("system")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-sm">Display currency</CardTitle></div>
              <CardDescription>All monetary values across the platform will be displayed in this currency. This does not convert amounts — it only changes the formatting symbol.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="font-medium">{c.code}</span>
                        <span className="ml-2 text-muted-foreground">{c.symbol} — {c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Currently set to <strong>{currency}</strong>. Supported: {CURRENCIES.map((c) => c.code).join(", ")}.
              </p>

              <Separator className="my-4" />

              <div className="max-w-xs space-y-1.5">
                <Label>Financial year start</Label>
                <Select value={String(fyStart)} onValueChange={(v) => handleFYChange(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April (India)</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Used for yearly reports. India uses April-March.</p>
              </div>

              <Separator className="my-4" />

              <div className="max-w-xs space-y-1.5">
                <Label>Default account</Label>
                <Select value={defaultAccountId} onValueChange={handleDefaultAccount}>
                  <SelectTrigger><SelectValue placeholder="None (ask every time)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (ask every time)</SelectItem>
                    {(allAccounts ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Pre-selected when creating new transactions.</p>
              </div>

              <Separator className="my-4" />

              <div className="max-w-xs space-y-1.5">
                <Label>Default investment account</Label>
                <Select value={defaultInvestmentAccountId} onValueChange={handleDefaultInvestmentAccount}>
                  <SelectTrigger><SelectValue placeholder="None (ask every time)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (ask every time)</SelectItem>
                    {(allAccounts ?? []).filter((a: any) => ["SAVINGS", "CASH", "INVESTMENT"].includes(a.type)).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Pre-selected when buying investments.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="space-y-4">
            <PinResetCard />
          </div>
        </TabsContent>

        <TabsContent value="charges">
          <TradingChargesSettings />
        </TabsContent>

        <TabsContent value="telegram">
          <TelegramSettings />
        </TabsContent>

        <TabsContent value="ai">
          <AISettings />
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-sm">Backup &amp; restore</CardTitle></div>
              <CardDescription>Export all of your data to a single JSON file. Imports must come from a Finarc-format file. Restoring replaces all current data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Button onClick={handleExport} className="gap-2"><Download className="h-4 w-4" /> Export JSON</Button>
                <Button variant="outline" onClick={handleExportCSV} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2"><Upload className="h-4 w-4" />{importing ? "Restoring..." : "Restore backup"}</Button>
              </div>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
              <p className="text-xs text-muted-foreground">Backups preserve relationships across accounts, transactions, budgets, and recurring rules.</p>

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Danger zone</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete all financial data — accounts, transactions, budgets, categories, and recurring rules. Your settings (currency, theme) will be preserved.
                </p>
                <Button variant="destructive" className="gap-2" onClick={handleClear}>
                  <Trash2 className="h-4 w-4" /> Clear all data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThemeOption({ Icon, label, active, onClick }: { Icon: typeof Sun; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-center gap-2 rounded-md border p-4 text-sm transition-colors ${active ? "border-foreground bg-secondary text-secondary-foreground" : "border-border hover:bg-accent"}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}

function PrefRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5"><Label className="text-sm">{title}</Label><p className="text-xs text-muted-foreground">{description}</p></div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function TradingChargesSettings() {
  const { data, mutate: mutateCharges } = useSWR<Record<string, number>>("/api/settings/charges");
  const [saving, setSaving] = React.useState(false);

  const fields = [
    { key: "brokeragePercent", label: "Brokerage %", hint: "Zerodha: 0% for delivery" },
    { key: "brokerageFlat", label: "Brokerage flat (₹)", hint: "Flat fee per order (0 for delivery)" },
    { key: "sttBuyPercent", label: "STT Buy %", hint: "0.1% for equity delivery" },
    { key: "sttSellPercent", label: "STT Sell %", hint: "0.1% for equity delivery" },
    { key: "exchangeTxnPercent", label: "Exchange Txn %", hint: "NSE: 0.00297%" },
    { key: "sebiPerCrore", label: "SEBI fee (₹/crore)", hint: "₹10 per crore turnover" },
    { key: "stampDutyBuyPercent", label: "Stamp Duty Buy %", hint: "0.015% on buy side" },
    { key: "stampDutySellPercent", label: "Stamp Duty Sell %", hint: "0% on sell" },
    { key: "gstPercent", label: "GST %", hint: "18% on brokerage + exchange + SEBI" },
    { key: "dpCharges", label: "DP Charges (₹)", hint: "₹15.93 per sell (Zerodha)" },
  ];

  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (data) {
      const v: Record<string, string> = {};
      for (const f of fields) v[f.key] = String(data[f.key] ?? "");
      setValues(v);
    }
  }, [data]);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      for (const f of fields) payload[f.key] = Number(values[f.key] ?? 0);
      await fetch("/api/settings/charges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Trading charges updated");
      mutateCharges();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Trading charges (equity delivery)</CardTitle>
        <CardDescription>
          These rates are applied automatically when you buy or sell stocks. Pre-filled with Zerodha&apos;s current delivery rates. Adjust if your broker differs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    inputMode="decimal"
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">{f.hint}</p>
                </div>
              ))}
            </div>
            <Button onClick={onSave} disabled={saving} className="mt-2">
              {saving ? "Saving..." : "Save charges"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PinResetCard() {
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const onReset = async () => {
    if (currentPin.length !== 6 || newPin.length !== 6) {
      toast.error("Both PINs must be exactly 6 digits");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Failed");
      }
      toast.success("PIN updated");
      setCurrentPin("");
      setNewPin("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Security PIN</CardTitle>
        <CardDescription>Change the 6-digit PIN used to unlock the app. Default is 123456.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 max-w-md">
          <div className="space-y-1">
            <Label className="text-xs">Current PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">New PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
        </div>
        <Button onClick={onReset} disabled={saving || currentPin.length !== 6 || newPin.length !== 6}>
          {saving ? "Updating..." : "Update PIN"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TelegramSettings() {
  const { data: config, mutate: mutateConfig } = useSWR<{
    botToken: string;
    chatId: string;
    configured: boolean;
    webhookUrl: string;
    notifications: { creditDue: boolean; budgetExceeded: boolean; recurringDue: boolean; lowBalance: boolean; botInput: boolean };
  }>("/api/telegram/config");

  const [botToken, setBotToken] = React.useState("");
  const [chatId, setChatId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  React.useEffect(() => {
    if (config) {
      setChatId(config.chatId);
    }
  }, [config]);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { chatId };
      if (botToken) payload.botToken = botToken;
      await fetch("/api/telegram/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast.success("Telegram config saved");
      mutateConfig();
      setBotToken("");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed"); }
      toast.success("Test message sent to Telegram");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to send test"); }
    finally { setTesting(false); }
  };

  const onToggle = async (key: string, value: boolean) => {
    await fetch("/api/telegram/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
    mutateConfig();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Telegram Bot Configuration</CardTitle>
          <CardDescription>
            Connect a Telegram bot to receive notifications. Create a bot via @BotFather, then paste the token and your chat ID here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
            <div className="space-y-1">
              <Label className="text-xs">Bot Token</Label>
              <Input
                type="password"
                placeholder={config?.configured ? "••••••(configured)" : "123456:ABC-DEF..."}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chat ID</Label>
              <Input
                placeholder="Your numeric chat ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save config"}</Button>
            <Button variant="outline" onClick={onTest} disabled={testing || !config?.configured} className="gap-1.5">
              <Send className="h-4 w-4" /> {testing ? "Sending..." : "Test message"}
            </Button>
          </div>
          {config?.configured && <p className="text-xs text-emerald-600">Connected and configured</p>}
          {config?.configured && (
            <div className="space-y-2 border-t pt-3 mt-3">
              <p className="text-xs font-medium">Webhook setup (for bot input)</p>
              <p className="text-[10px] text-muted-foreground">
                To receive messages from Telegram, set your webhook URL. Use your Vercel URL or Tailscale Funnel URL.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://your-app.vercel.app/api/telegram/webhook"
                  className="h-8 text-xs flex-1"
                  id="webhook-url"
                  defaultValue={config?.webhookUrl ?? ""}
                />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={async () => {
                  const url = (document.getElementById("webhook-url") as HTMLInputElement)?.value;
                  if (!url) { toast.error("Enter webhook URL"); return; }
                  const res = await fetch("/api/telegram/setup-webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl: url }) });
                  if (res.ok) { toast.success("Webhook registered"); mutateConfig(); }
                  else { const err = await res.json().catch(() => ({})); toast.error(err?.error?.message ?? "Failed"); }
                }}>Setup</Button>
              </div>
              {config?.webhookUrl && <p className="text-[10px] text-emerald-600">Active: {config.webhookUrl}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notification Triggers</CardTitle>
          <CardDescription>Choose which events send a Telegram notification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Credit card due reminders</p><p className="text-xs text-muted-foreground">Notify when a credit card payment is due within 5 days</p></div>
            <Switch checked={config?.notifications.creditDue ?? false} onCheckedChange={(v) => onToggle("notifyCreditDue", v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Budget exceeded</p><p className="text-xs text-muted-foreground">Notify when a budget goes over the allocated limit</p></div>
            <Switch checked={config?.notifications.budgetExceeded ?? false} onCheckedChange={(v) => onToggle("notifyBudgetExceeded", v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Recurring transactions due</p><p className="text-xs text-muted-foreground">Notify when a recurring transaction is about to trigger</p></div>
            <Switch checked={config?.notifications.recurringDue ?? false} onCheckedChange={(v) => onToggle("notifyRecurring", v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Low balance warning</p><p className="text-xs text-muted-foreground">Notify 1 day before a recurring payment if account balance is insufficient</p></div>
            <Switch checked={config?.notifications.lowBalance ?? false} onCheckedChange={(v) => onToggle("notifyLowBalance", v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Bot transaction input</p><p className="text-xs text-muted-foreground">Allow recording income/expense by messaging the bot in natural language</p></div>
            <Switch checked={config?.notifications.botInput ?? false} onCheckedChange={(v) => onToggle("telegramBotInput", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AISettings() {
  const { data: config, mutate: mutateConfig } = useSWR<{
    provider: string;
    hasOpenAIKey: boolean;
    ollamaUrl: string;
    shareDetails: boolean;
    openaiModel: string;
    ollamaModel: string;
  }>("/api/ai/config");

  const [provider, setProvider] = React.useState("openai");
  const [openaiKey, setOpenaiKey] = React.useState("");
  const [ollamaUrl, setOllamaUrl] = React.useState("http://localhost:11434");
  const [openaiModel, setOpenaiModel] = React.useState("gpt-4o-mini");
  const [ollamaModel, setOllamaModel] = React.useState("llama3.2");
  const [shareDetails, setShareDetails] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setOllamaUrl(config.ollamaUrl);
      setShareDetails(config.shareDetails);
      setOpenaiModel(config.openaiModel);
      setOllamaModel(config.ollamaModel);
    }
  }, [config]);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { provider, ollamaUrl, shareDetails, openaiModel, ollamaModel };
      if (openaiKey) payload.openaiApiKey = openaiKey;
      await fetch("/api/ai/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast.success("AI settings saved");
      mutateConfig();
      setOpenaiKey("");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">AI Assistant Configuration</CardTitle>
        <CardDescription>Configure the AI provider for the chat assistant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm space-y-1.5">
          <Label className="text-xs">Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="ollama">Ollama (Local)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider === "openai" && (
          <>
            <div className="max-w-sm space-y-1.5">
              <Label className="text-xs">OpenAI API Key</Label>
              <Input type="password" placeholder={config?.hasOpenAIKey ? "••••••(configured)" : "sk-..."} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
            </div>
            <div className="max-w-sm space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Input value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} placeholder="gpt-4o-mini" />
              <p className="text-[10px] text-muted-foreground">e.g. gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo</p>
            </div>
          </>
        )}

        {provider === "ollama" && (
          <>
            <div className="max-w-sm space-y-1.5">
              <Label className="text-xs">Ollama URL</Label>
              <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} />
            </div>
            <div className="max-w-sm space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="llama3.2" />
              <p className="text-[10px] text-muted-foreground">e.g. llama3.2, mistral, gemma2, phi3</p>
            </div>
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between max-w-sm">
          <div>
            <p className="text-sm font-medium">Share full transaction details</p>
            <p className="text-xs text-muted-foreground">Off = AI sees only summaries. On = AI sees individual transactions.</p>
          </div>
          <Switch checked={shareDetails} onCheckedChange={setShareDetails} />
        </div>

        <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save AI settings"}</Button>
      </CardContent>
    </Card>
  );
}
