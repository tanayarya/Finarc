"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { Archive, Download, Eye, FileArchive, FileCheck2, FileText, FileUp, FolderLock, ImageIcon, Landmark, Pencil, ReceiptText, Search, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-provider";
import { useAccounts, type TransactionRow } from "@/hooks/use-data";
import { DocumentDialog } from "@/components/vault/document-dialog";
import { DOCUMENT_TYPE_OPTIONS, documentTypeLabel, type VaultDocument, type VaultDocumentReference, type VaultDocumentType } from "@/components/vault/types";

interface PortfolioResponse { holdings: Array<{ id: string; name: string; type: string; symbol: string }>; }
interface TransactionResponse { items: TransactionRow[]; }
interface Due { id: string; personName: string; description: string | null; }

const TYPE_ICONS: Record<VaultDocumentType, LucideIcon> = {
  BANK_STATEMENT: Landmark,
  FD_RECEIPT: FileCheck2,
  BOND_DOCUMENT: FileText,
  INVESTMENT_STATEMENT: Archive,
  INSURANCE: ShieldCheck,
  LOAN_STATEMENT: ReceiptText,
  TAX: FileArchive,
  CONTRACT_NOTE: FileText,
  INVOICE: ReceiptText,
  OTHER: FileText,
};

export default function VaultPage() {
  const confirm = useConfirm();
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VaultDocument | null>(null);
  const [previewing, setPreviewing] = React.useState<VaultDocument | null>(null);
  const { data: accounts } = useAccounts();
  const { data: portfolio } = useSWR<PortfolioResponse>("/api/investments");
  const { data: transactionData } = useSWR<TransactionResponse>("/api/transactions?take=150");
  const { data: dues } = useSWR<Due[]>("/api/dues");

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const params = new URLSearchParams();
  if (debouncedQuery) params.set("q", debouncedQuery);
  if (typeFilter !== "ALL") params.set("type", typeFilter);
  const documentsKey = `/api/documents${params.size ? `?${params}` : ""}`;
  const { data: documents, isLoading } = useSWR<VaultDocument[]>(documentsKey);

  const references = React.useMemo<VaultDocumentReference>(() => ({
    accounts: (accounts ?? []).map((account) => ({ id: account.id, label: `${account.name} · ${account.type.toLowerCase()}` })),
    holdings: (portfolio?.holdings ?? []).map((holding) => ({ id: holding.id, label: `${holding.name} · ${holding.symbol}` })),
    transactions: (transactionData?.items ?? []).map((transaction) => ({ id: transaction.id, label: `${transaction.description || transaction.type} · ${format(new Date(transaction.occurredAt), "MMM d")}` })),
    dues: (dues ?? []).map((due) => ({ id: due.id, label: due.description ? `${due.personName} · ${due.description}` : due.personName })),
  }), [accounts, portfolio, transactionData, dues]);

  const refreshVault = () => mutate((key) => typeof key === "string" && key.startsWith("/api/documents"), undefined, { revalidate: true });
  const totalSize = (documents ?? []).reduce((sum, document) => sum + document.byteSize, 0);
  const linkedCount = (documents ?? []).filter((document) => document.accountId || document.holdingId || document.transactionId || document.dueId).length;
  const typeCount = new Set((documents ?? []).map((document) => document.type)).size;

  const removeDocument = async (document: VaultDocument) => {
    const accepted = await confirm({
      title: `Delete “${document.title}”?`,
      description: "This permanently removes the encrypted file and its metadata from the vault.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!accepted) return;
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to delete document");
      toast.success("Document deleted");
      if (previewing?.id === document.id) setPreviewing(null);
      refreshVault();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete document");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2"><FolderLock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /><h2 className="text-xl font-semibold tracking-tight md:text-2xl">Document vault</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Receipts, statements, and records secured alongside your financial history.</p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}><FileUp className="h-4 w-4" /> Add document</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <VaultMetric icon={FolderLock} label="Documents" value={String(documents?.length ?? 0)} detail="Encrypted at rest" />
        <VaultMetric icon={FileArchive} label="Vault size" value={formatBytes(totalSize)} detail="Included in JSON backup" />
        <VaultMetric icon={FileCheck2} label="Linked records" value={`${linkedCount}/${documents?.length ?? 0}`} detail={`${typeCount} document types in use`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, file, or linked record" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All document types</SelectItem>{DOCUMENT_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      </div>

      {isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-48" />)}</div> : !documents?.length ? (
        <EmptyState icon={<FolderLock className="h-5 w-5" />} title={query || typeFilter !== "ALL" ? "No documents match" : "Your vault is ready"} description={query || typeFilter !== "ALL" ? "Try another search or document type." : "Add an FD receipt, insurance document, statement, or contract note to start your private record."} action={!query && typeFilter === "ALL" ? <Button onClick={() => setCreateOpen(true)}><FileUp className="h-4 w-4" /> Add first document</Button> : undefined} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => <DocumentCard key={document.id} document={document} onPreview={() => setPreviewing(document)} onEdit={() => setEditing(document)} onDelete={() => removeDocument(document)} />)}
        </div>
      )}

      <DocumentDialog open={createOpen} onOpenChange={setCreateOpen} references={references} onSaved={refreshVault} />
      <DocumentDialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }} document={editing} references={references} onSaved={refreshVault} />
      <DocumentPreview document={previewing} onOpenChange={(open) => { if (!open) setPreviewing(null); }} />
    </div>
  );
}

function VaultMetric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return <Card className="rounded-lg"><CardContent className="flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-lg font-semibold tabular">{value}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function DocumentCard({ document, onPreview, onEdit, onDelete }: { document: VaultDocument; onPreview: () => void; onEdit: () => void; onDelete: () => void }) {
  const Icon = TYPE_ICONS[document.type];
  const isImage = document.mimeType.startsWith("image/");
  return <Card className="group rounded-lg transition-colors hover:border-foreground/25"><CardContent className="p-4">
    <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{isImage ? <ImageIcon className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><Badge variant="muted" className="text-[10px]">{documentTypeLabel(document.type)}</Badge></div>
    <div className="mt-4"><p className="truncate font-medium" title={document.title}>{document.title}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={document.originalFilename}>{document.originalFilename}</p></div>
    <div className="mt-4 border-t pt-3"><p className="truncate text-xs text-muted-foreground">{referenceLabel(document)}</p><div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>{format(new Date(document.createdAt), "MMM d, yyyy")}</span><span>{formatBytes(document.byteSize)}</span></div></div>
    <div className="mt-4 flex items-center justify-between"><Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onPreview}><Eye className="h-3.5 w-3.5" /> View</Button><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Download document" onClick={() => window.open(`/api/documents/${document.id}/content?download=1`, "_blank")}><Download className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit document" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Delete document" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
  </CardContent></Card>;
}

function DocumentPreview({ document, onOpenChange }: { document: VaultDocument | null; onOpenChange: (open: boolean) => void }) {
  if (!document) return null;
  const contentUrl = `/api/documents/${document.id}/content`;
  const previewable = document.mimeType === "application/pdf" || document.mimeType.startsWith("image/");
  return <Dialog open={Boolean(document)} onOpenChange={onOpenChange}><DialogContent className="flex h-[86vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"><DialogHeader className="shrink-0 border-b px-6 py-4 pr-12"><DialogTitle className="truncate">{document.title}</DialogTitle><DialogDescription>{document.originalFilename} · {formatBytes(document.byteSize)}</DialogDescription></DialogHeader>{previewable ? <div className="min-h-0 flex-1 bg-muted/30 p-3">{document.mimeType === "application/pdf" ? <iframe title={document.title} src={contentUrl} className="h-full w-full rounded-md border bg-background" /> : <img src={contentUrl} alt={document.title} className="h-full w-full rounded-md object-contain" />}</div> : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><FileText className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Preview is available for PDFs and images.</p><Button asChild><a href={`${contentUrl}?download=1`}><Download className="h-4 w-4" /> Download document</a></Button></div>}</DialogContent></Dialog>;
}

function referenceLabel(document: VaultDocument) {
  if (document.account) return `Account · ${document.account.name}`;
  if (document.holding) return `Investment · ${document.holding.name}`;
  if (document.transaction) return `Transaction · ${document.transaction.description || document.transaction.amount}`;
  if (document.due) return `Due · ${document.due.personName}`;
  return "Unlinked document";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
