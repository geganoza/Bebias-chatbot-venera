# BEBIAS Chatbot VENERA - Runbook

## Session: 2024-12-10

### Changes Made

#### 1. Manual Order - Separate City Field
**Files changed:**
- `components/ControlPanelDashboard.tsx`
- `app/api/analyze-conversation/route.ts`
- `app/api/create-manual-order/route.ts`
- `lib/sendOrderEmail.ts`
- `lib/orderLoggerWithFirestore.ts`

**What was done:**
- Added separate `city` field to manual order form (dropdown with 66 Georgian cities)
- City is now stored as separate field in Firestore orders (not inside address)
- AI extracts city separately when analyzing conversation
- Address field now contains street only, city is separate
- Email template updated to show city
- Default city: თბილისი

**Firestore order structure:**
```json
{
  "customer": {
    "address": "კოსტავას 1"  // Street only
  },
  "city": "ხაშური",  // Separate field
  ...
}
```

**Georgian cities list (66 cities):**
თბილისი, ბათუმი, ქუთაისი, რუსთავი, გორი, ზუგდიდი, ფოთი, სამტრედია, ხაშური, სენაკი, ზესტაფონი, მარნეული, თელავი, ახალციხე, ქობულეთი, ოზურგეთი, კასპი, ჭიათურა, წყალტუბო, საგარეჯო, გარდაბანი, ბორჯომი, ხონი, ბოლნისი, ტყიბული, ახალქალაქი, მცხეთა, ყვარელი, გურჯაანი, ქარელი, ლანჩხუთი, ახმეტა, დუშეთი, ხელვაჩაური, საჩხერე, დედოფლისწყარო, ლაგოდეხი, ნინოწმინდა, თერჯოლა, ხობი, მარტვილი, ვანი, ბაღდათი, წალენჯიხა, ჩხოროწყუ, წალკა, თეთრიწყარო, ასპინძა, დმანისი, ონი, თიანეთი, ამბროლაური, მესტია, ხარაგაული, ჩოხატაური, აბაშა, ქედა, სიღნაღი, სტეფანწმინდა, წაგერი, ლენტეხი, ხულო, შუახევი, ადიგენი

---

#### 2. Product Matching Improvements
**File:** `app/api/create-manual-order/route.ts`

**What was done:**
- Changed from `find()` to `filter()` + sort to find ALL matching products
- Sorting prioritizes:
  1. Products with stock > 0
  2. Products with price > 0
  3. Variations over variable (parent) products
- Added detailed logging for debugging

---

#### 3. Firestore Error Handling
**File:** `app/api/create-manual-order/route.ts`

**What was done:**
- Fixed `notes: notes || undefined` which caused Firestore errors (Firestore doesn't accept undefined)
- Changed to conditional assignment: `if (notes) { orderData.notes = notes; }`
- Added detailed logging for product loading from Firestore

---

### Known Issues / Pending Investigation

#### Stock Mismatch Issue
**Problem:** Manual order shows 0 stock for "შავი ბამბის მოკლე ქუდი" but Firestore shows different value.

**Investigation added:**
- Detailed logging for black beanie products specifically
- Logs show: document count, product names, stock values, types

**To check logs after creating order:**
```bash
vercel logs bebias-venera-chatbot.vercel.app --output raw | grep "Black beanie"
```

**Potential causes:**
1. Product name mismatch (exact name vs variation name)
2. Firestore field name (`stock_qty` vs `stock`)
3. Multiple products with similar names, wrong one being matched

---

### Data Sources

| Component | Data Source | Stock Field |
|-----------|-------------|-------------|
| Chatbot (lib/bot-core.ts) | Firestore | `stock_qty ?? stock ?? 0` |
| Manual Order (create-manual-order) | Firestore | `stock_qty \|\| 0` |
| Analyze Conversation | Firestore | `stock_qty` |

Both should be reading from Firestore `products` collection.

---

### Deployment

All changes deployed to Vercel production via:
```bash
git add -A && git commit -m "message" && git push && vercel --prod
```

Production URL: https://bebias-venera-chatbot.vercel.app
