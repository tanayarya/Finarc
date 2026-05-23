#!/bin/bash
# Full QA test flow for Finarc
BASE="http://localhost:3000"

echo "=== QA TEST: Full Money Flow ==="
echo ""

# 1. Create HDFC Savings account with ₹1,00,000
echo "1. Creating HDFC Savings (₹1,00,000)..."
HDFC=$(curl -s -X POST "$BASE/api/accounts" -H "Content-Type: application/json" -d '{"name":"HDFC Savings","type":"SAVINGS","currency":"INR","openingBalance":"100000"}')
HDFC_ID=$(echo $HDFC | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Account ID: $HDFC_ID"

# 2. Create Credit Card account
echo "2. Creating HDFC Credit Card (limit ₹50,000, due day 5)..."
CC=$(curl -s -X POST "$BASE/api/accounts" -H "Content-Type: application/json" -d '{"name":"HDFC Credit","type":"CREDIT","currency":"INR","openingBalance":"0","creditLimit":"50000","dueDay":5,"statementDay":25}')
CC_ID=$(echo $CC | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Account ID: $CC_ID"

# 3. Create Loan account
echo "3. Creating Home Loan (₹20,00,000 principal)..."
LOAN=$(curl -s -X POST "$BASE/api/accounts" -H "Content-Type: application/json" -d '{"name":"Home Loan","type":"LOAN","currency":"INR","openingBalance":"2000000","loanPrincipal":"2000000"}')
LOAN_ID=$(echo $LOAN | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Account ID: $LOAN_ID"

# 4. Add salary income
echo "4. Adding salary ₹75,000..."
curl -s -X POST "$BASE/api/transactions" -H "Content-Type: application/json" -d "{\"type\":\"INCOME\",\"amount\":\"75000\",\"occurredAt\":\"2026-05-01\",\"description\":\"Salary\",\"accountId\":\"$HDFC_ID\"}" > /dev/null
echo "   Expected balance: ₹1,75,000"

# 5. Add expense
echo "5. Adding groceries expense ₹3,500..."
curl -s -X POST "$BASE/api/transactions" -H "Content-Type: application/json" -d "{\"type\":\"EXPENSE\",\"amount\":\"3500\",\"occurredAt\":\"2026-05-03\",\"description\":\"Groceries\",\"accountId\":\"$HDFC_ID\"}" > /dev/null
echo "   Expected balance: ₹1,71,500"

# 6. Buy stock (1 unit SBIN @ ₹950)
echo "6. Buying 1 SBIN.NS @ ₹950..."
curl -s -X POST "$BASE/api/investments" -H "Content-Type: application/json" -d "{\"type\":\"STOCK\",\"assetClass\":\"STOCKS_INDIA\",\"symbol\":\"SBIN.NS\",\"name\":\"SBI\",\"units\":\"1\",\"pricePerUnit\":\"950\",\"occurredAt\":\"2026-05-05\",\"accountId\":\"$HDFC_ID\",\"applyCharges\":true}" > /dev/null
echo "   Expected balance: ~₹1,70,550 (after charges)"

# 7. Credit card purchase
echo "7. Credit card purchase ₹5,000..."
curl -s -X POST "$BASE/api/transactions" -H "Content-Type: application/json" -d "{\"type\":\"EXPENSE\",\"amount\":\"5000\",\"occurredAt\":\"2026-05-07\",\"description\":\"Amazon\",\"accountId\":\"$CC_ID\"}" > /dev/null
echo "   HDFC unchanged, Credit liability: ₹5,000"

# 8. Credit card payment
echo "8. Credit card payment ₹5,000..."
curl -s -X POST "$BASE/api/transactions" -H "Content-Type: application/json" -d "{\"type\":\"CREDIT_PAYMENT\",\"amount\":\"5000\",\"occurredAt\":\"2026-05-10\",\"fromAccountId\":\"$HDFC_ID\",\"toAccountId\":\"$CC_ID\"}" > /dev/null
echo "   HDFC: -₹5,000, Credit: back to ₹0"

# 9. Loan EMI
echo "9. Loan EMI ₹25,000..."
curl -s -X POST "$BASE/api/transactions" -H "Content-Type: application/json" -d "{\"type\":\"LOAN_PAYMENT\",\"amount\":\"25000\",\"occurredAt\":\"2026-05-15\",\"fromAccountId\":\"$HDFC_ID\",\"toAccountId\":\"$LOAN_ID\"}" > /dev/null
echo "   HDFC: -₹25,000, Loan reduces by ₹25,000"

# 10. Buy MF (skip transaction - existing holding)
echo "10. Adding existing MF holding (no transaction)..."
curl -s -X POST "$BASE/api/investments" -H "Content-Type: application/json" -d "{\"type\":\"MUTUAL_FUND\",\"assetClass\":\"MUTUAL_FUND\",\"symbol\":\"119551\",\"name\":\"Axis Bluechip\",\"units\":\"100\",\"pricePerUnit\":\"50\",\"occurredAt\":\"2026-01-01\",\"accountId\":\"$HDFC_ID\",\"skipTransaction\":true}" > /dev/null
echo "   HDFC unchanged (skip transaction), MF: 100 units @ ₹50"

# 11. Buy ETF
echo "11. Buying 1 GOLDBEES.NS @ ₹65..."
curl -s -X POST "$BASE/api/investments" -H "Content-Type: application/json" -d "{\"type\":\"STOCK\",\"assetClass\":\"ETF\",\"symbol\":\"GOLDBEES.NS\",\"name\":\"Gold ETF\",\"units\":\"1\",\"pricePerUnit\":\"65\",\"occurredAt\":\"2026-05-18\",\"accountId\":\"$HDFC_ID\",\"applyCharges\":true}" > /dev/null
echo "   HDFC: -₹65 (+ charges)"

# 12. Set up recurring loan EMI
echo "12. Setting up recurring Loan EMI..."
curl -s -X POST "$BASE/api/recurring" -H "Content-Type: application/json" -d "{\"name\":\"Home Loan EMI\",\"type\":\"LOAN_PAYMENT\",\"amount\":\"25000\",\"frequency\":\"MONTHLY\",\"interval\":1,\"startDate\":\"2026-06-15\",\"accountId\":\"$HDFC_ID\",\"toAccountId\":\"$LOAN_ID\"}" > /dev/null
echo "   Monthly ₹25,000 from HDFC → Home Loan"

# 13. Set up recurring credit card payment
echo "13. Setting up recurring Credit Card payment..."
curl -s -X POST "$BASE/api/recurring" -H "Content-Type: application/json" -d "{\"name\":\"HDFC Card Auto-Pay\",\"type\":\"CREDIT_PAYMENT\",\"amount\":\"1\",\"frequency\":\"MONTHLY\",\"interval\":1,\"startDate\":\"2026-06-05\",\"accountId\":\"$HDFC_ID\",\"toAccountId\":\"$CC_ID\"}" > /dev/null
echo "   Monthly auto-pay (actual balance) from HDFC → Credit"

echo ""
echo "=== VERIFICATION ==="

# Check balances
echo ""
echo "Account balances:"
curl -s "$BASE/api/accounts" | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
for a in data:
    print(f\"  {a['name']} ({a['type']}): {a['balance']}\")
"

echo ""
echo "Investments:"
curl -s "$BASE/api/investments" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f\"  Total invested: {d['totalInvested']}\")
print(f\"  Current value: {d['totalCurrentValue']}\")
print(f\"  Holdings: {len(d['holdings'])}\")
for h in d['holdings']:
    print(f\"    {h['symbol']} ({h['assetClass']}): {h['units']} units, value={h['currentValue']}\")
"

echo ""
echo "Recurring rules:"
curl -s "$BASE/api/recurring" | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
for r in data:
    print(f\"  {r['name']} ({r['type']}): {r['amount']} {r['frequency']} - {r['status']}\")
"

echo ""
echo "=== QA TEST COMPLETE ==="
