import { NextResponse } from "next/server";

/**
 * LEGACY WEBHOOK ROUTE - DEPRECATED
 *
 * This route only handles Facebook webhook verification (GET).
 * All message processing is handled by /api/messenger which uses QStash.
 *
 * DO NOT add message processing here - it will cause duplicate OpenAI calls!
 */

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token_123";

// GET handler for webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("🔍 Webhook verification request:");
  console.log("  Mode:", mode);
  console.log("  Token received:", token);
  console.log("  Token expected:", VERIFY_TOKEN);
  console.log("  Tokens match:", token === VERIFY_TOKEN);
  console.log("  Challenge:", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("❌ Webhook verification failed");
  console.error(`  Expected: '${VERIFY_TOKEN}', Received: '${token}'`);
  return new NextResponse("Forbidden", { status: 403 });
}

// POST handler - DEPRECATED
// All message processing is handled by /api/messenger
// This just returns 200 OK to prevent Facebook errors
export async function POST(req: Request) {
  console.log("⚠️ POST /api/webhook called - this route is deprecated, use /api/messenger instead");

  // Return 200 OK immediately to acknowledge receipt
  // Do NOT process messages here - /api/messenger handles that via QStash
  return NextResponse.json({ status: "deprecated - use /api/messenger" }, { status: 200 });
}
