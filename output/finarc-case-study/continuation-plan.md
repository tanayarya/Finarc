# Finarc product story continuation

Updated October 3, 2026.

[Open the new sections in Figma](https://www.figma.com/design/WXrskunGL8uEohZgQgvGYA/Finarc-Product-Case-Study?node-id=16-25)

20 of 27 sections now use the approved refreshed direction. Seven sections retain their earlier compositions and await refinement. See holdings-networth-pass.md for the latest pass and remaining titles. The section 15 through 20 plan below is now completed. Master 11:25 is preserved at 1440 pixels wide.

## Completed in this pass

| Section | Title | Node | Height |
| --- | --- | --- | --- |
| 10 | Rent. SIP. Repeat. Your month, remembered. | 16:25 | 2360 |
| 11 | Your wealth is bigger than your watchlist. | 16:49 | 2770 |
| 12 | A card swipe ends. The obligation stays. | 16:65 | 2480 |
| 13 | Ask the question. Skip the search. | 16:83 | 2270 |
| 14 | Even the quiet balance has a story. | 16:98 | 2420 |

Instrument Sans Medium headings and Inter body text reuse the existing Product page styles. Large headlines keep the approved line height and tracking. Colors reuse the existing monochrome variables. Every product screen space is an editable instance. The compositions include an illustrative monthly rhythm, an investment bento, card obligations, example AI questions, and an interest calculation story.

The preceding budget copy now describes weekly, monthly, and yearly planning instead of repeating the Telegram pitch. The ledger copy now distinguishes the roles of income, expenses, and transfers. Their layouts were preserved.

## Screen insertion spaces

| Screen | Instance | Dimensions |
| --- | --- | --- |
| Recurring rules and upcoming payments | 50:75 | 792 × 772 |
| Portfolio overview and holdings | 50:116 | 1232 × 696 |
| Credit card and statement detail | 51:61 | 744 × 602 |
| Dues and settlements | 51:65 | 416 × 602 |
| AI conversation | 51:87 | 802 × 814 |
| Account activity and savings interest review | 51:117 | 722 × 752 |

## Pending sections

15. **You earned it. Where did it go?** Total recorded spending, income, category breakdowns, and account activity. Figma node 17:40.

16. **Follow the money. All the way through.** Sankey flow from income into spending, debt, investments, and retained money. Figma node 13:164.

17. **This month changed. Here is where.** Month on month comparison of income, spending, savings, and category shifts. Figma node 12:74.

18. **The window opens. You hear about it.** Current and upcoming Indian IPO alerts, application dates, and source context. Figma node 13:14.

19. **Contributions. Coupons. Maturity.** PF contributions, bond interest reviews, deposits, and the life of a holding. Figma node 13:44.

20. **Your net worth has a history.** Assets, liabilities, asset distribution, and the changing net worth picture. Figma node 13:143.

21. **Your financial life. Under your control.** Self hosting, data ownership, exports, and optional AI sharing. Figma node 14:11.

22. **Start with one account. Build the whole picture.** A practical setup story from opening balances to accounts, records, and holdings. Figma node 17:67.

23. **Trust grows when the numbers can be checked.** Validation scenarios for transfers, card repayments, scheduled entries, and interest reviews. Figma node 17:85.

24. **One record makes the next question easier.** The product thesis connecting daily capture, reports, portfolio insight, and repeat value. Figma node 17:109.

25. **A clearer today. A more capable tomorrow.** A proposed roadmap with priorities distinguished from current capabilities. Figma node 17:130.

26. **Make room for your next move.** A closing invitation that brings the complete money story back to everyday life. Figma node 17:152.

27. **Sources, screen spaces, and proof.** Product sources, the UI insertion guide, and the status of illustrative examples. Figma node 17:164.

## Product evidence

Copy checked against the local product implementation:

* src/lib/services/recurring.ts: scheduled transaction materialization, linked investments, pause and skip behavior.
* src/lib/services/commitment-forecast.ts: 90 day known commitments with a 30 day summary. It excludes unscheduled spending, future card purchases, and investment sale proceeds.
* src/lib/services/notifications.ts: optional recurring, credit, dues, and low balance alerts.
* src/lib/services/investments.ts: supported holdings, trades, price refresh, and portfolio snapshots.
* src/lib/finance/credit-cards.ts: statement dues adjusted for subsequent payments and credits.
* src/app/api/ai/chat/route.ts: summaries or recent transaction context and configured cloud or local AI. No claim of complete historical access or guaranteed answers.
* src/lib/services/savings-interest.ts: daily recorded balances, configured annual rate, monthly or quarterly review, approval before income entry.
* src/lib/services/bond-interest.ts: bond interest review.
* src/lib/services/ipo-alerts.ts: current and upcoming NSE issues and optional alerts.
* src/app/(app)/reports/page.tsx: Sankey, comparison, category and account views, net worth, and asset distribution.

The dates in section 10 are an illustrative schedule. No fabricated adoption, research, performance, or competitor claims were added. Recurring records do not execute bank payments. Interest calculations require verification against bank records.

## Verification

All five new sections use only Instrument Sans and Inter. Readback found no text overflow, text overlap, or hyphens in the visible copy. Native composition screenshots were reviewed. The five sections contain 161 editable descendants, including 98 text nodes and six UI placeholder instances. No product UI images or flattened layouts were created.
