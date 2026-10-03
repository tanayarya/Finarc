# Reports, cash flow, comparison, and IPO story

[Open section 15 in the existing Figma file](https://www.figma.com/design/WXrskunGL8uEohZgQgvGYA/Finarc-Product-Case-Study?node-id=17-40)

18 of 27 sections now use the approved direction. Nine remain. Master 11:25 remains a single 1440 pixel wide page and is now 50700 pixels tall.

## This pass

| Section | Title | Node | Height |
| --- | --- | --- | --- |
| 15 | You earned it. Where did it go? | 17:40 | 2890 |
| 16 | Follow the money. All the way through. | 13:164 | 2830 |
| 17 | This month changed. Here is where. | 12:74 | 2870 |
| 18 | The window opens. You hear about it. | 13:14 | 2980 |

The new compositions use an oversized receipt, proportional Sankey ribbons, a paired column comparison with explanatory bento panels, and a transparent portrait inside an application window motif. Typography continues the approved Instrument Sans and Inter styles. The artwork remains editable, with existing variables and placeholder component instances.

## UI spaces

| Screen | Instance | Dimensions |
| --- | --- | --- |
| Reports overview and category spending | 55:112 | 1232 × 712 |
| Sankey cash flow report | 55:152 | 1232 × 632 |
| Month on month comparison | 56:80 | 1232 × 624 |
| IPO settings or preview | 56:101 | 760 × 604 |
| IPO alert digest | 56:105 | 384 × 784 |

## Connected illustrative examples

Section 15 shows spending of ₹48,000: living ₹24,000, shopping ₹8,000, travel ₹6,000, and dining ₹10,000. Section 17 compares this with a previous ₹40,000 month: living and shopping unchanged, travel ₹0, and dining ₹8,000. The increase is ₹8,000, or 20 percent. Travel explains 75 percent of the increase.

The separate Sankey example conserves ₹1,00,000 across expenses ₹40,000, debt payments ₹20,000, investments ₹25,000, and retained money ₹15,000. Ribbon widths have the same proportions. The two comparison columns are 450 and 540 pixels tall, matching the 1.2 ratio.

All monetary examples and the comparison percentages are labeled illustrative. No customer or research outcomes are claimed. The IPO 30 day look ahead is a verified product behavior, not an invented metric.

## Product evidence

* src/app/api/reports/cashflow/route.ts
* src/app/api/reports/comparison/route.ts
* src/app/(app)/reports/page.tsx
* src/lib/services/ipo-alerts.ts
* src/app/(app)/settings/page.tsx

IPO copy describes current and upcoming NSE issues checked during the daily notification run, with optional delivery through the configured Telegram connection. It does not claim investment recommendations or guaranteed returns.

## Verification

The four sections contain 183 editable descendant nodes: 86 text nodes, 47 frames, 10 rectangles, 35 vectors, and five UI instances. The only raster content is the previously approved transparent lifestyle portrait. No complete product UI has been flattened into an image.

Readback confirmed Instrument Sans and Inter, no hyphens in visible copy, and no text overflow. One heading wrap was corrected. The four compositions were reviewed together, then the report introduction was refined and checked again. The temporary review board was removed. The master still contains 27 sections.

## Remaining sections

19. **Contributions. Coupons. Maturity.** PF contributions, bond interest reviews, deposits, and the life of a holding. Node 13:44.

20. **Your net worth has a history.** Assets, liabilities, asset distribution, and the changing net worth picture. Node 13:143.

21. **Your financial life. Under your control.** Self hosting, data ownership, exports, and optional AI sharing. Node 14:11.

22. **Start with one account. Build the whole picture.** A practical setup story from opening balances to accounts, records, and holdings. Node 17:67.

23. **Trust grows when the numbers can be checked.** Validation scenarios for transfers, card repayments, scheduled entries, and interest reviews. Node 17:85.

24. **One record makes the next question easier.** The product thesis connecting daily capture, reports, portfolio insight, and repeat value. Node 17:109.

25. **A clearer today. A more capable tomorrow.** A proposed roadmap with priorities distinguished from current capabilities. Node 17:130.

26. **Make room for your next move.** A closing invitation that brings the complete money story back to everyday life. Node 17:152.

27. **Sources, screen spaces, and proof.** Product sources, the UI insertion guide, and the status of illustrative examples. Node 17:164.

