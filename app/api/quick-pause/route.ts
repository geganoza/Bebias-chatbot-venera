import { NextResponse } from "next/server";
import {
  enableManualModeForConversation,
  disableManualMode
} from "@/lib/managerDetection";

/**
 * Simple API endpoint for managers to pause/resume bot for specific users
 *
 * Usage:
 * - Visit: https://your-domain.vercel.app/api/quick-pause?userId=XXX&action=pause
 * - Visit: https://your-domain.vercel.app/api/quick-pause?userId=XXX&action=resume
 *
 * Can be bookmarked or used as a quick link
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    if (!userId) {
      return NextResponse.json({
        error: "Missing userId parameter",
        usage: "Add ?userId=XXX&action=pause or ?userId=XXX&action=resume"
      }, { status: 400 });
    }

    if (action === "pause") {
      const success = await enableManualModeForConversation(
        userId,
        "Manager paused via quick link"
      );

      if (success) {
        // Return a simple HTML page with confirmation
        return new NextResponse(
          `<!DOCTYPE html>
          <html>
          <head>
            <title>Bot Paused</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 600px;
                margin: 0 auto;
                background: #f5f5f5;
              }
              .status {
                background: #dc3545;
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
              }
              .info {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              button {
                background: #28a745;
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 16px;
                border-radius: 5px;
                cursor: pointer;
                display: block;
                width: 100%;
                margin: 20px 0;
              }
              button:hover {
                background: #218838;
              }
            </style>
          </head>
          <body>
            <h1>🔴 Bot Paused</h1>
            <div class="status">
              Bot is now PAUSED for user: ${userId}
            </div>
            <div class="info">
              <p>✅ The bot will not respond to this customer</p>
              <p>✅ You can now handle the conversation manually</p>
              <p>✅ All messages are still being saved to history</p>
            </div>
            <button onclick="window.location.href='?userId=${userId}&action=resume'">
              🟢 Resume Bot When Done
            </button>
            <p style="color: #666; font-size: 14px;">
              Bookmark this page for quick access
            </p>
          </body>
          </html>`,
          {
            status: 200,
            headers: { "Content-Type": "text/html" }
          }
        );
      } else {
        return NextResponse.json({
          error: "Failed to pause bot",
          userId
        }, { status: 500 });
      }
    } else if (action === "resume") {
      const success = await disableManualMode(userId);

      if (success) {
        return new NextResponse(
          `<!DOCTYPE html>
          <html>
          <head>
            <title>Bot Resumed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 600px;
                margin: 0 auto;
                background: #f5f5f5;
              }
              .status {
                background: #28a745;
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
              }
              .info {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              button {
                background: #dc3545;
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 16px;
                border-radius: 5px;
                cursor: pointer;
                display: block;
                width: 100%;
                margin: 20px 0;
              }
              button:hover {
                background: #c82333;
              }
            </style>
          </head>
          <body>
            <h1>🟢 Bot Resumed</h1>
            <div class="status">
              Bot is now ACTIVE for user: ${userId}
            </div>
            <div class="info">
              <p>✅ The bot will now respond to this customer</p>
              <p>✅ Bot has full context of the conversation</p>
              <p>✅ Automated responses are active</p>
            </div>
            <button onclick="window.location.href='?userId=${userId}&action=pause'">
              🔴 Pause Bot Again
            </button>
            <p style="color: #666; font-size: 14px;">
              Bookmark this page for quick access
            </p>
          </body>
          </html>`,
          {
            status: 200,
            headers: { "Content-Type": "text/html" }
          }
        );
      } else {
        return NextResponse.json({
          error: "Failed to resume bot",
          userId
        }, { status: 404 });
      }
    } else {
      // Show current status
      const { isManualModeEnabled } = await import('@/lib/managerDetection');
      const isPaused = await isManualModeEnabled(userId);

      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>Bot Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 600px;
              margin: 0 auto;
              background: #f5f5f5;
            }
            .status {
              background: ${isPaused ? '#dc3545' : '#28a745'};
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: center;
              font-size: 20px;
            }
            button {
              background: ${isPaused ? '#28a745' : '#dc3545'};
              color: white;
              border: none;
              padding: 15px 30px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              display: block;
              width: 100%;
              margin: 20px 0;
            }
            button:hover {
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <h1>Bot Status for User: ${userId}</h1>
          <div class="status">
            ${isPaused ? '🔴 PAUSED - Manager in control' : '🟢 ACTIVE - Bot responding'}
          </div>
          <button onclick="window.location.href='?userId=${userId}&action=${isPaused ? 'resume' : 'pause'}'">
            ${isPaused ? '🟢 Resume Bot' : '🔴 Pause Bot'}
          </button>
          <p style="color: #666; font-size: 14px;">
            Bookmark this page for quick access to control this user's bot status
          </p>
        </body>
        </html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" }
        }
      );
    }
  } catch (error: any) {
    console.error("❌ Error in quick-pause:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}