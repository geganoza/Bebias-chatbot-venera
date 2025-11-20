import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export type UserProfile = {
  id: string;
  name?: string;
  profile_pic?: string;
  first_name?: string;
  last_name?: string;
};

// Fetch user profile from Facebook Graph API
async function fetchFacebookProfile(userId: string): Promise<UserProfile | null> {
  try {
    const url = `https://graph.facebook.com/v18.0/${userId}?fields=id,name,first_name,last_name,profile_pic&access_token=${PAGE_ACCESS_TOKEN}`;

    console.log(`📋 Fetching Facebook profile for user ${userId}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Facebook API error fetching profile:`, data);
      return null;
    }

    console.log(`✅ Successfully fetched profile for ${data.name || userId}`);
    return data as UserProfile;
  } catch (err) {
    console.error(`❌ Error fetching Facebook profile for ${userId}:`, err);
    return null;
  }
}

// GET /api/user-profile?userId=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Check if profile is cached in Firestore
    const profileDoc = await db.collection('userProfiles').doc(userId).get();

    if (profileDoc.exists) {
      const cached = profileDoc.data() as UserProfile & { cachedAt: string };
      const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (cacheAge < sevenDays) {
        console.log(`✅ Returning cached profile for ${userId}`);
        return NextResponse.json({ success: true, profile: cached, cached: true });
      }
    }

    // Fetch from Facebook API
    const profile = await fetchFacebookProfile(userId);

    if (!profile) {
      return NextResponse.json(
        { error: "Failed to fetch user profile from Facebook" },
        { status: 500 }
      );
    }

    // Cache for 7 days in Firestore
    await db.collection('userProfiles').doc(userId).set({
      ...profile,
      cachedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, profile, cached: false });
  } catch (error: any) {
    console.error("❌ Error in user-profile endpoint:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
