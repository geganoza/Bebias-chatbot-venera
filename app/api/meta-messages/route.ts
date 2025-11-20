import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

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

// Cache to reduce Firestore calls
let cachedData: { conversations: Conversation[]; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

export async function GET() {
  try {
    // Return cached data if fresh
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log("Returning cached meta-messages");
      return NextResponse.json({
        success: true,
        conversations: cachedData.conversations,
        count: cachedData.conversations.length,
        cached: true
      });
    }

    // Get all meta messages from Firestore
    const snapshot = await db.collection('metaMessages').get();

    const conversations: Conversation[] = [];

    // Fetch each conversation
    snapshot.forEach((doc) => {
      const data = doc.data() as Conversation;
      if (data && data.messages && data.messages.length > 0) {
        conversations.push(data);
      }
    });

    // Sort conversations by most recent message
    conversations.sort((a, b) => {
      const aTime = new Date(a.messages[a.messages.length - 1]?.timestamp || 0).getTime();
      const bTime = new Date(b.messages[b.messages.length - 1]?.timestamp || 0).getTime();
      return bTime - aTime;
    });

    // Update cache
    cachedData = {
      conversations,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
      cached: false
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
