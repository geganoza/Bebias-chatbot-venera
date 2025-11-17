import { NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token_123";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const debugInfo = {
    mode: mode,
    modeCheck: mode === "subscribe",
    tokenReceived: token,
    tokenExpected: VERIFY_TOKEN,
    tokenMatch: token === VERIFY_TOKEN,
    challenge: challenge,
    hasChallenge: !!challenge,
    allMatch: mode === "subscribe" && token === VERIFY_TOKEN && !!challenge
  };

  return NextResponse.json(debugInfo);
}
