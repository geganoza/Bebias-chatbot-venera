import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

type Message = {
  id: string;
  senderId: string;
  senderType: 'user' | 'bot';
  text: string;
  timestamp: string;
};

type Conversation = {
  userId: string;
  messages: Message[];
};

export async function GET() {
  try {
    // Get all meta-message keys (stored as meta-messages:{userId})
    const keys = await kv.keys('meta-messages:*');

    const conversations: Conversation[] = [];

    // Fetch each conversation
    for (const key of keys) {
      const data = await kv.get<Conversation>(key);
      if (data && data.messages && data.messages.length > 0) {
        conversations.push(data);
      }
    }

    // Sort conversations by most recent message
    conversations.sort((a, b) => {
      const aTime = new Date(a.messages[a.messages.length - 1]?.timestamp || 0).getTime();
      const bTime = new Date(b.messages[b.messages.length - 1]?.timestamp || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error("Error fetching meta messages:", error);
    return NextResponse.json({
      success: false,
      conversations: [],
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
