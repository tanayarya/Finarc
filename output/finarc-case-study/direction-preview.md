# Product page direction preview

[Review the opening](https://www.figma.com/design/WXrskunGL8uEohZgQgvGYA/Finarc-Product-Case-Study?node-id=12-3)

The opening direction was approved. Twenty sections now use the new direction in the same master. See holdings-networth-pass.md for the latest completed sections and the seven remaining section titles.

* 12:3 / Hero / 1880 px tall
* 12:16 / The commitment story / 1770 px tall
* 12:39 / Product benefit bento / 2490 px tall

Instrument Sans Medium headlines pair with Inter body text. Reusable Figma text styles define display, title, feature, body, label, and metric sizes. Headline containers allow glyph overflow and provide bottom space for descenders. The clipping correction was also applied to title containers in the rest of the master.

The three sections use the existing monochrome color variables, editable UI placeholder components, and transparent cutout asset. The narrative connects less financial admin to the difference between a balance and known commitments, then introduces the product benefits.

## Continuation batch

[Review sections 4 through 8](https://www.figma.com/design/WXrskunGL8uEohZgQgvGYA/Finarc-Product-Case-Study?node-id=12-54)

* 12:54 / Clarity for a full life / 1700 px tall
* 13:7 / The question behind the product / 1430 px tall
* 14:27 / One overview, a clearer next step / 2050 px tall
* 14:51 / A small message, a useful record / 1930 px tall
* 14:70 / Every movement has a place / 2070 px tall

The continuation uses the same Product page text styles, monochrome variables, and transparent asset as the approved opening. Compositions include a daily timeline, a large question panel, a desktop showcase, an annotated Telegram sentence, and movement categories around the ledger showcase.

Current UI spaces in this batch:

* 39:107 / Dashboard / 1232 × 755
* 40:51 / Telegram / 350 × 754
* 40:90 / Ledger / 1232 × 690

Visual and text bound checks passed. The remaining sections retain the previous design direction. The screen inventory in design-notes.md reflects the earlier full pass and is superseded for the first nine sections.

## Budget story

[Review section 9](https://www.figma.com/design/WXrskunGL8uEohZgQgvGYA/Finarc-Product-Case-Study?node-id=14-92)

The hook is “The next ₹280 feels different.” It carries the Telegram lunch example into a monthly dining budget. The illustrative plan is ₹6,000, recorded expenses are ₹5,100, and the remainder is ₹900. Another ₹280 lunch would use about 31 percent of that remainder. The graphic shows 17 of 20 segments used, matching 85 percent of the plan.

The section ends with an editable budget UI space and copy about weekly, monthly, and yearly planning. The preceding ledger copy distinguishes the roles of income, expenses, and transfers.

* Section: 14:92 / 2990 px tall
* UI placeholder: 45:90 / 1232 × 683
* Typography: existing Product page styles, unchanged
* Verification: no text overlap, clipped text bounds, or hyphens in the section copy

Capabilities checked against src/lib/finance/budgets.ts and src/lib/services/notifications.ts. The graphic is an illustrative explanation, not a product screenshot or customer result.
