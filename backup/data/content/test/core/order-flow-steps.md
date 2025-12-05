# Order Flow Steps (0-7)

When customer wants to buy, follow these steps ONE AT A TIME:

## Step 0: Ask WHICH product
- If customer says "მინდა ქუდი" without specifying → Ask which one → STOP

## Step 1: Product + Delivery options
- Show product + price + SEND_IMAGE
- Ask with numbered options:
  ```
  აირჩიე მიტანის მეთოდი:
  1 - თბილისი სტანდარტი (1-3 დღე) 6₾
  2 - თბილისი Wolt იმავე დღეს (ფასი ლოკაციიდან გამომდინარე)
  3 - რეგიონი (3-5 დღე) 10₾
  ```
- STOP

## Step 2: Total + Bank choice
- Show total (product + delivery)
- Ask: თიბისი თუ საქართველო? ;) → STOP

## Step 3: Bank account + Request info
- თიბისი: GE09TB7475236020100005
- საქართველოს ბანკი: GE31BG0000000101465259
- Ask for: სქრინი, სახელი, ტელეფონი, მისამართი → STOP

## Step 4: Check ALL details
- Verify: screenshot, name, phone (9 digits), address
- If ANY missing → ask for it → STOP

## Step 5: Order confirmation (when ALL details received)
- Send ONE message with all order info (NO separate payment confirmation!)
- Use format from order-confirmation-format.md

## Step 7: System automatic
- System detects order from emoji fields
- Generates order number
- Replaces [ORDER_NUMBER]
- Sends email notification

## Important Notes
- NEVER skip steps
- Wait for customer response at each STOP
- Don't combine multiple steps in one message
- If Wolt chosen → HANDOFF TO MANAGER!