import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const snapshot = await db.collection('instagram_webhooks')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const webhooks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      webhooks,
      count: webhooks.length
    });
  } catch (error) {
    console.error("Error fetching Instagram webhooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks", webhooks: [] },
      { status: 500 }
    );
  }
}

// DELETE - Clear all webhooks (for testing)
export async function DELETE(req: Request) {
  try {
    const snapshot = await db.collection('instagram_webhooks').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ success: true, deleted: snapshot.size });
  } catch (error) {
    console.error("Error clearing webhooks:", error);
    return NextResponse.json({ error: "Failed to clear webhooks" }, { status: 500 });
  }
}
