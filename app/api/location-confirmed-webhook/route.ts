import { NextRequest, NextResponse } from "next/server";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(`[LOCATION WEBHOOK] Received:`, JSON.stringify(body));

    const { type, senderId, sessionId, lat, lon, address } = body;

    if (type === "location_confirmed" && senderId) {
      console.log(`[LOCATION WEBHOOK] ✅ Location confirmed for user ${senderId}`);
      console.log(`[LOCATION WEBHOOK] 📍 Coordinates: ${lat}, ${lon}`);
      console.log(`[LOCATION WEBHOOK] 📍 Address: ${address}`);

      // Send message to user via Facebook Send API
      const messageResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: {
              text: `მდებარეობა დადასტურდა! ✅\n\n📍 ${address || "მისამართი შენახულია"}\n\nროდის გინდა მიიღო შეკვეთა? (ორშაბათი-პარასკევი, 14:00-20:00)\nთუ ახლავე გინდა, დაწერე 'ახლა'`,
            },
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
