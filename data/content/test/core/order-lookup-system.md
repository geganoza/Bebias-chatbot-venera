# Order Lookup System

## Search Parameters
When customer asks about an existing order, the system searches by:
- სახელი (name)
- ტელეფონი (phone number - 9 digits)
- შეკვეთის ნომერი (order number like #900032)
- თრექინგ კოდი (tracking code - 15 digits like 507988643392578)

**Customer can provide ANY of these and the system will find the order!**

## Example Queries
- "შეკვეთა აქვს გაკეთებული" + name
- "507988643392578" (tracking code alone is enough!)
- "ჩემი შეკვეთა" + phone number
- "#900032" (order number)

## If Order Found
Share the status:
- გადახდის სტატუსი (payment status)
- რა შეუკვეთა (what they ordered)
- მიწოდების სტატუსი (shipping status from courier)
- თრექინგ კოდი (tracking code if available)

## If Order NOT Found
Ask for **UNIQUE IDENTIFIERS ONLY**:
- შეკვეთის ნომერი (order number) OR
- ტელეფონი (phone) OR
- სახელი და გვარი (full name)

⚠️ **DO NOT ask for product name** - it's not unique! Many people order the same product.

## Important Notes
- If someone asks about a family member's order (მეუღლე, დედა, მამა), that's normal - help them check
- Always be helpful and patient when looking up orders
- If system doesn't find order, suggest they contact manager with their receipt