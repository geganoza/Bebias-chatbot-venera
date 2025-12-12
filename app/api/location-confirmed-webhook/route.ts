import { NextRequest, NextResponse } from "next/server";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(`[LOCATION WEBHOOK] Received:`, JSON.stringify(body));

    const { type, senderId, sessionId, lat, lon, address, woltEstimate } = body;

    if (type === "location_confirmed" && senderId) {
      console.log(`[LOCATION WEBHOOK] ✅ Location confirmed for user ${senderId}`);
      console.log(`[LOCATION WEBHOOK] 📍 Coordinates: ${lat}, ${lon}`);
      console.log(`[LOCATION WEBHOOK] 📍 Address: ${address}`);
      console.log(`[LOCATION WEBHOOK] 💰 Wolt Estimate:`, woltEstimate);

      // Decode address if URL-encoded
      let decodedAddress = address || "მისამართი შენახულია";
      try {
        decodedAddress = decodeURIComponent(decodedAddress);
      } catch {
        // Already decoded
      }

      // Build message with price info
      let message = `მდებარეობა დადასტურდა! ✅\n\n📍 ${decodedAddress}`;

      if (woltEstimate?.available && woltEstimate?.price) {
        message += `\n\n🚚 მიტანის ფასი: ${woltEstimate.price} ${woltEstimate.currency || "GEL"}`;
        if (woltEstimate.eta_minutes) {
          message += `\n⏱ სავარაუდო დრო: ${woltEstimate.eta_minutes} წუთი`;
        }
      }

      message += `\n\nროდის გინდა მიიღო შეკვეთა? (ორშაბათი-პარასკევი, 14:00-20:00)\nთუ ახლავე გინდა, დაწერე 'ახლა'`;

      // Send message to user via Facebook Send API
      const messageResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: message },
          }),
        }
      );

      if (messageResponse.ok) {
        console.log(`[LOCATION WEBHOOK] ✅ Message sent to user ${senderId}`);
        return NextResponse.json({ success: true, message: "Message sent" });
      } else {
        const errorData = await messageResponse.json();
        console.error(`[LOCATION WEBHOOK] ❌ Failed to send message:`, errorData);
        return NextResponse.json(
          { success: false, error: "Failed to send message", details: errorData },
          { status: 500 }
        );
      }
    }

    console.log(`[LOCATION WEBHOOK] ⚠️ Invalid request - missing type or senderId`);
    return NextResponse.json(
      { success: false, error: "Invalid request - missing type or senderId" },
      { status: 400 }
    );
  } catch (error) {
    console.error(`[LOCATION WEBHOOK] ❌ Error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle GET for verification (if needed)
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "Location confirmed webhook active" });
}
