import { handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { occurredAt: "desc" },
      include: { category: true, account: true, fromAccount: true, toAccount: true },
    });

    const headers = [
      "Date", "Type", "Amount", "Description", "Notes",
      "Account", "From Account", "To Account",
      "Category", "Tax Deductible", "Created At"
    ];
    const rows = transactions.map((t) => [
      t.occurredAt.toISOString().slice(0, 10),
      t.type,
      t.amount.toString(),
      escapeCsv(t.description ?? ""),
      escapeCsv(t.notes ?? ""),
      t.account?.name ?? "",
      t.fromAccount?.name ?? "",
      t.toAccount?.name ?? "",
      t.category?.name ?? "",
      t.taxDeductible ? "Yes" : "No",
      t.createdAt.toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="finarc-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
