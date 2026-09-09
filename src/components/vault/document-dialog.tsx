"use client";

import * as React from "react";
import { FileUp, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPE_OPTIONS, type VaultDocument, type VaultDocumentReference } from "./types";

type ReferenceKind = "NONE" | "ACCOUNT" | "HOLDING" | "TRANSACTION" | "DUE";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: VaultDocument | null;
  references: VaultDocumentReference;
  onSaved: () => void;
}

export function DocumentDialog({ open, onOpenChange, document, references, onSaved }: Props) {
  const isEdit = Boolean(document);
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState("OTHER");
  const [notes, setNotes] = React.useState("");
  const [referenceKind, setReferenceKind] = React.useState<ReferenceKind>("NONE");
  const [referenceId, setReferenceId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle(document?.title ?? "");
    setType(document?.type ?? "OTHER");
    setNotes(document?.notes ?? "");
    const linked = document?.accountId ? ["ACCOUNT", document.accountId] : document?.holdingId ? ["HOLDING", document.holdingId] : document?.transactionId ? ["TRANSACTION", document.transactionId] : document?.dueId ? ["DUE", document.dueId] : ["NONE", ""];
    setReferenceKind(linked[0] as ReferenceKind);
    setReferenceId(linked[1]);
  }, [open, document]);

  const onFile = (next: File | null) => {
    if (!next) return;
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.[^/.]+$/, ""));
  };

  const referenceOptions = referenceKind === "ACCOUNT"
    ? references.accounts
    : referenceKind === "HOLDING"
      ? references.holdings
      : referenceKind === "TRANSACTION"
        ? references.transactions
        : referenceKind === "DUE"
          ? references.dues
          : [];

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("Give this document a title");
    if (!isEdit && !file) return toast.error("Choose a document to upload");
    setSubmitting(true);
    try {
      const links = {
        accountId: referenceKind === "ACCOUNT" ? referenceId || null : null,
        holdingId: referenceKind === "HOLDING" ? referenceId || null : null,
        transactionId: referenceKind === "TRANSACTION" ? referenceId || null : null,
        dueId: referenceKind === "DUE" ? referenceId || null : null,
      };
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/documents/${document!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, type, notes: notes || null, ...links }),
        });
      } else {
        const form = new FormData();
        form.set("file", file!);
        form.set("title", title);
        form.set("type", type);
        form.set("notes", notes);
        for (const [key, value] of Object.entries(links)) if (value) form.set(key, value);
        res = await fetch("/api/documents", { method: "POST", body: form });
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error?.message ?? "Unable to save document");
      toast.success(isEdit ? "Document details updated" : "Document secured in vault");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save document");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit document" : "Add to vault"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update its label, classification, or linked finance record." : "Files are encrypted before they are stored with your finance data."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {!isEdit && (
            <div className="space-y-2">
              <Label>Document</Label>
              <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.txt" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => inputRef.current?.click()} className={cn("flex w-full items-center gap-3 rounded-md border border-dashed px-4 py-4 text-left transition-colors hover:bg-muted/40", file && "border-emerald-500/50 bg-emerald-500/5")}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{file ? <Paperclip className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{file ? file.name : "Choose a receipt, statement, or note"}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">PDF, images, Word, or text · up to 4 MB</span>
                </span>
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <div className="space-y-1.5"><Label htmlFor="vault-title">Title</Label><Input id="vault-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="HDFC FD receipt" /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOCUMENT_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-1.5">
              <Label>Link to</Label>
              <Select value={referenceKind} onValueChange={(value) => { setReferenceKind(value as ReferenceKind); setReferenceId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No linked record</SelectItem>
                  <SelectItem value="ACCOUNT">Account</SelectItem>
                  <SelectItem value="HOLDING">Investment</SelectItem>
                  <SelectItem value="TRANSACTION">Transaction</SelectItem>
                  <SelectItem value="DUE">Due or receivable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {referenceKind !== "NONE" && <div className="space-y-1.5">
              <Label>Record</Label>
              <Select value={referenceId} onValueChange={setReferenceId}>
                <SelectTrigger><SelectValue placeholder="Choose record" /></SelectTrigger>
                <SelectContent>{referenceOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
          </div>

          <div className="space-y-1.5"><Label htmlFor="vault-notes">Notes</Label><Textarea id="vault-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional reference or renewal details" /></div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? "Securing..." : isEdit ? "Save changes" : "Secure document"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
