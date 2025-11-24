import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

type Message = {
  id: string;
  senderId: string;
  senderType: 'user' | 'bot' | 'human';
  text: string;
  timestamp: string;
};

type Conversation = {
  userId: string;
  messages: Message[];
  // Enriched data (fetched in bulk)
  userName?: string;
  profilePic?: string;
  manualMode?: boolean;
  botInstruction?: string | null;
  needsAttention?: boolean;
  escalationReason?: string;
  escalationDetails?: string;
};

// Cache to reduce Firestore calls
let cachedData: { conversations: Conversation[]; timestamp: number } | null = null;
const CACHE_TTL = 5000; // 5 seconds (reduced for more real-time updates)

export async function GET() {
  try {
    // Return cached data if fresh
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        conversations: cachedData.conversations,
        count: cachedData.conversations.length,
        cached: true
      });
    }

    // Fetch all data in parallel for better performance
    const [metaSnapshot, profilesSnapshot, conversationsSnapshot] = await Promise.all([
      db.collection('metaMessages').get(),
      db.collection('userProfiles').get(),
      db.collection('conversations').get()
    ]);

    // Build lookup maps for O(1) access
    const profilesMap = new Map<string, { name?: string; profile_pic?: string }>();
    profilesSnapshot.forEach(doc => {
      const data = doc.data();
      profilesMap.set(doc.id, {
        name: data.name || data.first_name,
        profile_pic: data.profile_pic
      });
    });

    const statusMap = new Map<string, {
      manualMode?: boolean;
      botInstruction?: string;
      needsAttention?: boolean;
      escalationReason?: string;
      escalationDetails?: string;
    }>();
    conversationsSnapshot.forEach(doc => {
      const data = doc.data();
      statusMap.set(doc.id, {
        manualMode: data.manualMode,
        botInstruction: data.botInstruction,
        needsAttention: data.needsAttention,
        escalationReason: data.escalationReason,
        escalationDetails: data.escalationDetails
      });
    });

    // Build enriched conversations
    const conversations: Conversation[] = [];
    metaSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data && data.messages && data.messages.length > 0) {
        const userId = data.userId || doc.id;
        const profile = profilesMap.get(userId);
        const status = statusMap.get(userId);

        conversations.push({
          userId,
          messages: data.messages,
          // Enrich with profile data
          userName: profile?.name,
          profilePic: profile?.profile_pic,
          // Enrich with status data
          manualMode: status?.manualMode,
          botInstruction: status?.botInstruction,
          needsAttention: status?.needsAttention,
          escalationReason: status?.escalationReason,
          escalationDetails: status?.escalationDetails
        });
      }
    });

    // Sort by most recent message
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
