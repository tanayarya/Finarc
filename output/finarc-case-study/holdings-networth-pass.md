# Holding rhythms and net worth

[Open section 19 in Figma](https://www.figma.com/design/WXrskunGL8uEohZgQgvGYA/Finarc-Product-Case-Study?node-id=13-44)

20 of 27 sections now use the approved direction. Seven remain. The original master 11:25 is preserved at 1440 × 54830 pixels.

## Completed sections

| Section | Title | Node | Height |
| --- | --- | --- | --- |
| 19 | Contributions. Coupons. Maturity. | 13:44 | 3290 |
| 20 | Your net worth has a history. | 13:143 | 3080 |

Section 19 uses twelve monthly arcs, four quarterly arcs, and one maturity arc to explain distinct holding rhythms. There are twelve PF event markers, four bond event markers, and one deposit event marker, aligned to the numbered months. The cadence is illustrative, with actual schedules following recorded holding details. Supporting copy covers linked PF contributions, gross bond interest, TDS, net credit, and deposit terms.

Section 20 pairs an illustrative ₹8L net worth position with ₹12L of assets and ₹4L of liabilities. A sample path passes through ₹6.5L, ₹7.2L, ₹6.9L, and ₹8L. The curve is a story illustration, not a customer result. The historical valuation limitation is stated in the visible copy: earlier investment values currently use present valuation inputs, so the report does not provide exact historical market valuation.

## UI insertion spaces

| Screen | Instance | Dimensions |
| --- | --- | --- |
| PF contribution history and deposit details | 62:116 | 752 × 642 |
| Bond interest review | 62:120 | 408 × 642 |
| Net worth history and filters | 63:86 | 1232 × 807 |

## Evidence and verification

Copy checked against src/lib/services/recurring.ts, src/lib/services/bond-interest.ts, src/lib/services/investments.ts, and src/app/api/reports/networth-history/route.ts.

The two sections contain 119 editable descendant nodes: 62 text nodes, 25 frames, three rectangles, five vectors, 21 ellipses, and three placeholder instances. No raster content was added. Headings and metrics reuse Instrument Sans styles; body and labels reuse Inter. Colors use the existing variables.

Readback found no text overlap, out of bounds text, or hyphens in visible copy. Both sections were visually reviewed together. The calendar caption was then correctly parented and the resulting section was checked again. The temporary review board was removed. The master retains 27 sections.

## Remaining titles

21. **Your financial life. Under your control.** Self hosting, data ownership, exports, and optional AI sharing. Node 14:11.

22. **Start with one account. Build the whole picture.** A practical setup story from opening balances to accounts, records, and holdings. Node 17:67.

23. **Trust grows when the numbers can be checked.** Validation scenarios for transfers, card repayments, scheduled entries, and interest reviews. Node 17:85.

24. **One record makes the next question easier.** The product thesis connecting daily capture, reports, portfolio insight, and repeat value. Node 17:109.

25. **A clearer today. A more capable tomorrow.** A proposed roadmap with priorities distinguished from current capabilities. Node 17:130.

26. **Make room for your next move.** A closing invitation that brings the complete money story back to everyday life. Node 17:152.

27. **Sources, screen spaces, and proof.** Product sources, the UI insertion guide, and the status of illustrative examples. Node 17:164.

