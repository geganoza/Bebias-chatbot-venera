import { NextResponse } from "next/server";
import {
  isManualModeEnabled,
  enableManualModeForConversation,
  disableManualMode
} from "@/lib/managerDetection";
import { db } from "@/lib/firestore";

/**
 * API endpoint for managing and checking manager intervention status
 *
 * GET /api/manager-status?userId=XXX - Check if manual mode is enabled for a user
 * POST /api/manager-status - Enable/disable manual mode
 * DELETE /api/manager-status?userId=XXX - Disable manual mode for a user
 */

// GET - Check manual mode status for a user
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const all = searchParams.get("all");

    // Get status for all users with manual mode
    if (all === "true") {
      const conversationsRef = db.collection('conversations');
      const snapshot = await conversationsRef
        .where('manualMode', '==', true)
        .get();

      const activeManualModes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: doc.id,
          manualMode: data.manualMode,
          enabledAt: data.manualModeEnabledAt,
          reason: data.manualModeReason,
          lastActive: data.lastActive
        };
      });

      return NextResponse.json({
        success: true,
        count: activeManualModes.length,
        users: activeManualModes
      });
    }

    // Get status for specific user
    if (!userId) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    const isEnabled = await isManualModeEnabled(userId);

    // Get additional details if manual mode is enabled
    let details = {};
    if (isEnabled) {
      const conversationDoc = await db.collection('conversations').doc(userId).get();
      if (conversationDoc.exists) {
        const data = conversationDoc.data();
        details = {
          enabledAt: data?.manualModeEnabledAt,
          reason: data?.manualModeReason,
          lastActive: data?.lastActive
        };
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      manualMode: isEnabled,
      ...details
    });

  } catch (error: any) {
    console.error("❌ Error checking manager status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Enable manual mode for a user
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, reason = "Manual intervention via API" } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const success = await enableManualModeForConversation(userId, reason);

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Manual mode enabled for ${userId}`,
        userId,
        reason
      });
    } else {
      return NextResponse.json({
        error: "Failed to enable manual mode",
        userId
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("❌ Error enabling manual mode:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Disable manual mode for a user
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    const success = await disableManualMode(userId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Manual mode disabled for ${userId}`,
        userId
      });
    } else {
      return NextResponse.json({
        error: "Failed to disable manual mode",
        userId
      }, { status: 404 });
    }

  } catch (error: any) {
    console.error("❌ Error disabling manual mode:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}