export const DOCUMENT_TYPE_OPTIONS = [
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "FD_RECEIPT", label: "FD receipt" },
  { value: "BOND_DOCUMENT", label: "Bond document" },
  { value: "INVESTMENT_STATEMENT", label: "Investment statement" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "LOAN_STATEMENT", label: "Loan statement" },
  { value: "TAX", label: "Tax" },
  { value: "CONTRACT_NOTE", label: "Contract note" },
  { value: "INVOICE", label: "Invoice" },
  { value: "OTHER", label: "Other" },
] as const;

export type VaultDocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number]["value"];

export interface VaultDocument {
  id: string;
  title: string;
  type: VaultDocumentType;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  notes: string | null;
  accountId: string | null;
  holdingId: string | null;
  transactionId: string | null;
  dueId: string | null;
  createdAt: string;
  updatedAt: string;
  account: { id: string; name: string; type: string } | null;
  holding: { id: string; name: string; type: string; assetClass: string } | null;
  transaction: { id: string; description: string | null; amount: string; occurredAt: string } | null;
  due: { id: string; personName: string; description: string | null } | null;
}

export interface VaultDocumentReference {
  accounts: Array<{ id: string; label: string }>;
  holdings: Array<{ id: string; label: string }>;
  transactions: Array<{ id: string; label: string }>;
  dues: Array<{ id: string; label: string }>;
}

export function documentTypeLabel(type: VaultDocumentType) {
  return DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Other";
}
