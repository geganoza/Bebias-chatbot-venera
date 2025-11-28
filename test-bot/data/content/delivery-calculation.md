# Smart Delivery Date Calculation

When customer asks about delivery timing, you MUST calculate ACTUAL delivery dates, not generic timeframes.

## How to Calculate

1. Check the current date/time in Georgia (GMT+4) - provided in your context
2. Determine if order would ship today or next working day:
   - If it's a working day (Mon-Fri) and BEFORE 15:00 → ships today
   - If it's Saturday and BEFORE 11:00 → ships today
   - If it's after cutoff time or Sunday → ships next working day
3. Add delivery time:
   - Tbilisi: 1-3 days
   - Regions: 3-5 days
4. **Respond with ACTUAL DATES** like "ორშაბათს" (Monday), "სამშაბათს" (Tuesday), etc.

---

## Georgian Day Names
- ორშაბათი - Monday
- სამშაბათი - Tuesday
- ოთხშაბათი - Wednesday
- ხუთშაბათი - Thursday
- პარასკევი - Friday
- შაბათი - Saturday
- კვირა - Sunday

---

## Examples

### Example 1: Before 15:00 on Thursday (midnight)
User asks at 00:00: "როდის მივიღებ?"

**Good Response:**
"თქვენი შეკვეთა დღეს (ხუთშაბათს) 15:00-მდე უნდა მიიღოს, რომ დღესვე გაიგზავნოს. თბილისში მიწოდება მოხდება პარასკევიდან ორშაბათამდე."

### Example 2: After 15:00 on Friday (Tbilisi)
User asks at 16:00: "როდის მივიღებ?"

**Good Response:**
"15:00 საათის შემდგომ მიღებული შეკვეთები იგზავნება შემდეგ სამუშაო დღეს, ამიტომ თქვენი შეკვეთა ორშაბათს გაიგზავნება და მიიღებთ სამშაბათს ან უკიდურეს შემთხვევაში ოთხშაბათს (თბილისში)."

### Example 3: After 15:00 on Friday (Regions)
User asks at 16:00, region delivery: "როდის მივიღებ?"

**Good Response:**
"15:00 საათის შემდგომ მიღებული შეკვეთები იგზავნება შემდეგ სამუშაო დღეს, ამიტომ თქვენი შეკვეთა ორშაბათს გაიგზავნება და რეგიონში მიიღებთ ოთხშაბათიდან პარასკევამდე."

---

## Bad vs Good Responses

**Bad Response:**
"თბილისში სტანდარტული მიწოდება 1-3 სამუშაო დღეში მოხდება"

**Good Response:**
"თბილისში მიიღებთ სამშაბათს ან უკიდურეს შემთხვევაში ოთხშაბათს"

---

## Critical Formatting for After 15:00

Always start with: "15:00 საათის შემდგომ მიღებული შეკვეთები იგზავნება შემდეგ სამუშაო დღეს, ამიტომ..."

Then provide:
- Shipment day (next working day)
- Delivery day for Tbilisi: usually next working day after shipment, max 1 day delay
- Delivery for regions: 2-3 working days from shipment
