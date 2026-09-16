import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// A warm Vercel function can serve several requests. Keep one client for that
// function instance so it does not repeatedly create database connections.
globalForPrisma.prisma = prisma;
