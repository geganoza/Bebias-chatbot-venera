# Shipping Manager API Contract

Base URL: `https://shipping-manager-standalone.vercel.app`

**Address Resolution Version: v5.1** (Super Smart Hybrid Matching)

---

## Address Validation (v5.1)

**POST `/api/address/validate`**

Request:
```json
{
  "address": "ჭავჭავაძის 45"
}
```

Response:
```json
{
  "action": "SEND_MAP_LINK",
  "shipping": {
    "street": "ილია ჭავჭავაძის გამზირი",
    "city": "თბილისი",
    "coordinates": {
      "lat": 41.708846,
      "lon": 44.7746786
    }
  },
  "woltValid": true,
  "woltPrice": 6.85,
  "confidence": 0.95,
  "resolvedBy": "v5_smart_wolt",
  "streetDbMatch": {
    "officialName": "ილია ჭავჭავაძის გამზირი (N 2/2-ის გარდა)",
    "matchScore": 0.8,
    "streetType": "გამზირი",
    "streetTypePriority": 100
  }
}
```

### resolvedBy Values
- `v5_smart_wolt` - v5.1 matched from local DB, validated via Wolt
- `v5_smart_osm` - v5.1 matched, coordinates from OSM
- `v5_smart_google` - v5.1 matched, coordinates from Google
- `smart_wolt` - v3 fallback via Wolt
- `smart_osm` - v3 fallback via OSM
- `smart_google` - v3 fallback via Google

### v5.1 Features
- **PREFIX-BASED matching** - No false positives from similar surnames
- **STREET TYPE HIERARCHY** - Prefers გამზირი (100) > ქუჩა (80) > შესახვევი (40)
- **LOW-PRIORITY REJECTION** - ჩიხი/შესახვევი excluded unless explicitly mentioned
- **100% Wolt validation** - All results validated for deliverability

---

## Location Confirmation Flow

### 1. Generate Map Link

**POST `/api/location/generate-link`**

Request:
```json
{
  "address": "დიღმის მასივი",
  "senderId": "1234567890",           // Facebook Messenger sender ID (required for webhook)
  "callbackUrl": "https://your-chatbot.vercel.app/api/location-confirmed-webhook"  // Webhook URL (required)
}
```

Response:
```json
{
  "success": true,
  "link": "https://shipping-manager-standalone.vercel.app/confirm-location?lat=41.7559&lon=44.7728&order=sess_abc123&address=...",
  "sessionId": "sess_abc123",
  "coordinates": { "lat": 41.7559, "lon": 44.7728 }
}
```

### 2. Location Confirmation Webhook (Called by Shipping Manager)

When user confirms their location on the map, Shipping Manager will call your webhook with:

**POST `{callbackUrl}`**

Request body:
```json
{
  "type": "location_confirmed",
  "sessionId": "sess_abc123",
  "senderId": "1234567890",
  "lat": 41.710213,
  "lon": 44.784050,
  "address": "დიღმის მასივი",
  "distanceMovedMeters": 500,
  "woltEstimate": {
    "available": true,
    "price": 6.55,
    "currency": "GEL",
    "eta_minutes": 40
  }
}
```

**Important:** `woltEstimate` contains the UPDATED price based on the confirmed coordinates. This may differ from the initial estimate if the user moved the pin.

### 3. Get Confirmed Location (Optional - for order creation)

**GET `/api/location/confirm?sessionId=sess_abc123`**

Response:
```json
{
  "success": true,
  "confirmed": true,
  "data": {
    "lat": 41.710213,
    "lon": 44.784050,
    "address": "დიღმის მასივი",
    "confirmedAt": "2025-12-11T22:30:00.000Z"
  }
}
```

---

## Wolt Estimate

**POST `/api/wolt/estimate`**

Request:
```json
{
  "address": "დიღმის მასივი",
  "lat": 41.7559,    // Optional - skip geocoding
  "lon": 44.7728     // Optional
}
```

Response:
```json
{
  "available": true,
  "price": 6.55,
  "currency": "GEL",
  "eta_minutes": 40,
  "provider": "wolt",
  "formatted_address": "Digomi, Tbilisi",
  "coordinates": { "lat": 41.7559, "lon": 44.7728 }
}
```

---

## Chatbot Implementation Example

### 1. Update `generateMapLink()`:

```typescript
async function generateMapLink(address: string, senderId: string) {
  const response = await fetch('https://shipping-manager-standalone.vercel.app/api/location/generate-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      senderId,
      callbackUrl: 'https://your-chatbot.vercel.app/api/location-confirmed-webhook'
    })
  });
  return await response.json();
}
```

### 2. Create webhook endpoint `/api/location-confirmed-webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, senderId, sessionId, lat, lon, woltEstimate } = body;

  if (type === 'location_confirmed' && senderId) {
    // Build message with updated price
    let priceMessage = '';
    if (woltEstimate?.available) {
      priceMessage = `\n\nმიტანის ღირებულება: ${woltEstimate.price} ${woltEstimate.currency}`;
      priceMessage += `\nსავარაუდო დრო: ${woltEstimate.eta_minutes} წუთი`;
    }

    // Send message to user via Facebook Send API
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: {
          text: `მდებარეობა დადასტურდა! ✅${priceMessage}\n\nრა დროს გსურთ მიტანა?`
        }
      })
    });

    // TODO: Update conversation state with confirmed coordinates
    // Store sessionId, lat, lon for order creation

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false }, { status: 400 });
}
```

---

## Flow Summary

```
1. User sends address
   ↓
2. Bot calls generateMapLink(address, senderId) with callbackUrl
   ↓
3. Bot sends map link to user
   ↓
4. User clicks link, adjusts pin, confirms
   ↓
5. Shipping Manager saves location + calls webhook with UPDATED Wolt price
   ↓
6. Webhook receives { senderId, sessionId, lat, lon, woltEstimate }
   ↓
7. Bot sends proactive message: "მდებარეობა დადასტურდა! მიტანა: 6.55 GEL"
   ↓
8. User continues conversation (delivery time, name, etc.)
   ↓
9. When creating order, use sessionId to get confirmed coordinates
```

---

Last Updated: 2025-12-12

**Address Resolution v5.1 deployed** - See ADDRESS_RESOLUTION_DOCUMENTATION.md in shipping-manager-standalone for full details.
