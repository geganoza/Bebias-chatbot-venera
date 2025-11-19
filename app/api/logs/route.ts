import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "all"; // 'chat', 'messenger', 'webhook', or 'all'
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    // Get logs from KV store
    const logs = await kv.get<Array<any>>(`logs:${source}`) || [];

    // Return most recent logs
    const recentLogs = logs.slice(-limit).reverse();

    return NextResponse.json({
      logs: recentLogs,
      count: recentLogs.length,
      source
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
