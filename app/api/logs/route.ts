import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "all"; // 'chat', 'messenger', 'webhook', or 'all'
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    // Get logs from Firestore
    let query = db.collection('logs').orderBy('timestamp', 'desc').limit(limit);

    if (source !== 'all') {
      query = query.where('source', '==', source) as any;
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => doc.data());

    return NextResponse.json({
      logs,
      count: logs.length,
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
