import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { syncHoldingInterestRule } from "@/lib/services/investments";

export const dynamic = "force-dynamic";

/**
 * Edit a holding's trade entry.
 * When units or price changes, we:
 * 1. Recalculate the holding's weighted average
 * 2. Adjust the linked transaction amount (refund difference or deduct more)
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const holdingId = ctx.params.id;
    const body = await req.json();
    const { tradeId, amount } = body;
    let { units, pricePerUnit } = body;

    if (!tradeId) return fail("tradeId required", 400);

    let trade;
    if (tradeId === "latest") {
      // Find the most recent BUY trade for this holding
      trade = await prisma.trade.findFirst({
        where: { holdingId, action: { in: ["BUY", "SIP_BUY"] } },
        orderBy: { createdAt: "desc" },
      });
      if (!trade) {
        // No trade exists — just update the holding directly
        const newUnits = new Decimal(units ?? 1);
        const newPrice = new Decimal(pricePerUnit ?? 0);
        await prisma.holding.update({
          where: { id: holdingId },
          data: {
            units: newUnits.toFixed(6),
            avgBuyPrice: newPrice.toFixed(4),
            currentPrice: newPrice.toFixed(4),
          },
        });
        return ok({ updated: true, note: "No trade record — holding updated directly" });
      }
    } else {
      trade = await prisma.trade.findUnique({ where: { id: tradeId } });
      if (!trade || trade.holdingId !== holdingId) return fail("Trade not found", 404);
    }

    const holding = await prisma.holding.findUnique({ where: { id: holdingId } });
    if (!holding) return fail("Holding not found", 404);

    const isAmountOnly = holding.type === "BOND" || holding.type === "FIXED_DEPOSIT" || holding.assetClass === "RECURRING_DEPOSIT";
    if (isAmountOnly && amount !== undefined) {
      units = amount;
      pricePerUnit = 1;
    }

    const oldUnits = new Decimal(trade.units.toString());
    const oldPrice = new Decimal(trade.price.toString());
    const oldAmount = oldUnits.mul(oldPrice);

    const newUnits = new Decimal(units ?? trade.units.toString());
    const newPrice = new Decimal(pricePerUnit ?? trade.price.toString());
    const newAmount = newUnits.mul(newPrice);

    // Update the trade
    await prisma.trade.update({
      where: { id: trade.id },
      data: {
        units: newUnits.toFixed(6),
        price: newPrice.toFixed(4),
        amount: newAmount.toFixed(2),
        netAmount: newAmount.toFixed(2),
      },
    });

    // Recalculate holding totals from all BUY trades
    const allTrades = await prisma.trade.findMany({
      where: { holdingId, action: { in: ["BUY", "SIP_BUY"] } },
    });
    let totalBuyUnits = new Decimal(0);
    let totalCost = new Decimal(0);
    for (const t of allTrades) {
      const u = new Decimal(t.units.toString());
      const p = new Decimal(t.price.toString());
      totalBuyUnits = totalBuyUnits.plus(u);
      totalCost = totalCost.plus(u.mul(p));
    }
    // Subtract sold units
    const sellTrades = await prisma.trade.findMany({
      where: { holdingId, action: "SELL" },
    });
    let soldUnits = new Decimal(0);
    for (const t of sellTrades) {
      soldUnits = soldUnits.plus(new Decimal(t.units.toString()));
    }
    const currentUnits = totalBuyUnits.minus(soldUnits);
    const avgBuyPrice = totalBuyUnits.isZero() ? new Decimal(0) : totalCost.div(totalBuyUnits);

    await prisma.holding.update({
      where: { id: holdingId },
      data: {
        units: currentUnits.toFixed(6),
        avgBuyPrice: avgBuyPrice.toFixed(4),
        principalAmount: isAmountOnly ? currentUnits.mul(avgBuyPrice).toFixed(2) : undefined,
      },
    });

    if (isAmountOnly) {
      await syncHoldingInterestRule(holdingId, trade.occurredAt);
    }

    // Adjust linked transaction if it exists
    if (trade.transactionId) {
      const diff = newAmount.minus(oldAmount);
      if (!diff.isZero()) {
        const txn = await prisma.transaction.findUnique({ where: { id: trade.transactionId } });
        if (txn) {
          const newTxnAmount = new Decimal(txn.amount.toString()).plus(diff);
          if (newTxnAmount.greaterThan(0)) {
            await prisma.transaction.update({
              where: { id: trade.transactionId },
              data: { amount: newTxnAmount.toFixed(2) },
            });
          }
        }
      }
    }

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
