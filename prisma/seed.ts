import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.category.count();
  if (existing > 0) {
    console.log("Categories already exist, skipping seed.");
    return;
  }

  const expenseCategories = [
    { name: "Food", color: "#f97316" },
    { name: "Shopping", color: "#a855f7" },
    { name: "Utilities", color: "#06b6d4" },
    { name: "Entertainment", color: "#facc15" },
    { name: "Household", color: "#22c55e" },
    { name: "Travel", color: "#0ea5e9" },
    { name: "Health", color: "#ef4444" },
    { name: "Transport", color: "#6366f1" },
  ];
  for (const c of expenseCategories) {
    await prisma.category.create({ data: { ...c, kind: "EXPENSE" } });
  }

  const incomeCategories = [
    { name: "Salary", color: "#22c55e" },
    { name: "Freelance", color: "#0ea5e9" },
    { name: "Interest", color: "#a855f7" },
    { name: "Dividends", color: "#facc15" },
    { name: "Refund", color: "#94a3b8" },
  ];
  for (const c of incomeCategories) {
    await prisma.category.create({ data: { ...c, kind: "INCOME" } });
  }

  console.log("Seeded default categories.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
