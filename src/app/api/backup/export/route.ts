import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { vaultEncryptionKeyId } from "@/lib/services/document-vault";

export const dynamic = "force-dynamic";

const BACKUP_VERSION = 3;
const BACKUP_FORMAT = "finarc.backup";

export async function GET() {
  try {
    const [accounts, categories, transactions, recurringRules, budgets, holdings, trades, settings, vaultDocuments] =
      await Promise.all([
        prisma.account.findMany(),
        prisma.category.findMany(),
        prisma.transaction.findMany(),
        prisma.recurringRule.findMany(),
        prisma.budget.findMany(),
        prisma.holding.findMany(),
        prisma.trade.findMany(),
        prisma.appSetting.findMany(),
        prisma.vaultDocument.findMany(),
      ]);

    const dues = await prisma.due.findMany();

    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      vaultEncryptionKeyId: vaultDocuments.length ? vaultEncryptionKeyId() : undefined,
      counts: {
        accounts: accounts.length,
        categories: categories.length,
        transactions: transactions.length,
        recurringRules: recurringRules.length,
        budgets: budgets.length,
        holdings: holdings.length,
        trades: trades.length,
        dues: dues.length,
        settings: settings.length,
        vaultDocuments: vaultDocuments.length,
      },
      data: {
        accounts: serializeRows(accounts),
        categories: serializeRows(categories),
        transactions: serializeRows(transactions),
        recurringRules: serializeRows(recurringRules),
        budgets: serializeRows(budgets),
        holdings: serializeRows(holdings),
        trades: serializeRows(trades),
        dues: serializeRows(dues),
        settings: serializeRows(settings),
        vaultDocuments: vaultDocuments.map(serializeVaultDocument),
      },
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="finarc-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

function serializeVaultDocument(document: {
  encryptedData: Uint8Array;
  encryptionIv: Uint8Array;
  encryptionTag: Uint8Array;
  [key: string]: unknown;
}) {
  const row = serializeRows([document])[0] as Record<string, unknown>;
  return {
    ...row,
    encryptedData: Buffer.from(document.encryptedData).toString("base64"),
    encryptionIv: Buffer.from(document.encryptionIv).toString("base64"),
    encryptionTag: Buffer.from(document.encryptionTag).toString("base64"),
  };
}

function serializeRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === "object" && "toFixed" in (v as object) && typeof (v as { toFixed?: unknown }).toFixed === "function")
        o[k] = (v as { toFixed: (dp: number) => string }).toFixed(6);
      else if (v instanceof Date) o[k] = v.toISOString();
      else if (Array.isArray(v))
        o[k] = v.map((d) => (d instanceof Date ? d.toISOString() : d));
      else o[k] = v;
    }
    return o;
  });
}
