import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export const dynamic = 'force-dynamic';

/**
 * DELETE - Clear all Instagram conversations from Control Panel
 * Also clears instagram_webhooks collection
 */
export async function DELETE(req: Request) {
  try {
    const results = {
      metaMessages: 0,
      userProfiles: 0,
      webhooks: 0
    };

    // Find and delete all Instagram conversations in metaMessages
    const messagesSnapshot = await db.collection('metaMessages').get();

    for (const doc of messagesSnapshot.docs) {
      const id = doc.id;
      const data = doc.data();

      // Delete if it's an Instagram user (starts with IG_ or has platform: instagram)
      if (id.startsWith('IG_') || data?.platform === 'instagram') {
        await db.collection('metaMessages').doc(id).delete();
        results.metaMessages++;

        // Also delete from userProfiles
        try {
          await db.collection('userProfiles').doc(id).delete();
          results.userProfiles++;
        } catch (e) {
          // Profile might not exist
        }
      }
    }

    // Clear instagram_webhooks collection
    const webhooksSnapshot = await db.collection('instagram_webhooks').get();
    const batch = db.batch();
    webhooksSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    results.webhooks = webhooksSnapshot.size;

    console.log(`✅ Cleared Instagram data:`, results);

    return NextResponse.json({
      success: true,
      deleted: results,
      message: `Cleared ${results.metaMessages} conversations, ${results.userProfiles} profiles, ${results.webhooks} webhooks`
    });
  } catch (error) {
    console.error("Error clearing Instagram data:", error);
    return NextResponse.json(
      { error: "Failed to clear Instagram data", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - List all Instagram conversations (for debugging)
 */
export async function GET(req: Request) {
  try {
    const messagesSnapshot = await db.collection('metaMessages').get();

    const instagramConversations: any[] = [];

    for (const doc of messagesSnapshot.docs) {
      const id = doc.id;
      const data = doc.data();

      if (id.startsWith('IG_') || data?.platform === 'instagram') {
        instagramConversations.push({
          id,
          platform: data?.platform || 'instagram',
          messageCount: data?.messages?.length || 0,
          updatedAt: data?.updatedAt,
          lastMessage: data?.messages?.slice(-1)[0]?.text?.substring(0, 50)
        });
      }
    }

    return NextResponse.json({
      count: instagramConversations.length,
      conversations: instagramConversations
    });
  } catch (error) {
    console.error("Error listing Instagram data:", error);
    return NextResponse.json(
      { error: "Failed to list Instagram data", details: String(error) },
      { status: 500 }
    );
  }
}
