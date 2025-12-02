#!/usr/bin/env node

/**
 * Fetch Facebook profiles for users who don't have names
 */

const admin = require('firebase-admin');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// Get Facebook page access token from environment
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;

if (!PAGE_ACCESS_TOKEN) {
  console.error('❌ No Facebook Page Access Token found in environment!');
  process.exit(1);
}

async function fetchFacebookProfile(userId) {
  try {
    const url = `https://graph.facebook.com/v18.0/${userId}?fields=id,name,profile_pic&access_token=${PAGE_ACCESS_TOKEN}`;
    console.log(`📋 Fetching profile for ${userId}...`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`   ❌ Facebook API error:`, data.error?.message || 'Unknown error');
      return null;
    }

    console.log(`   ✅ Got profile: ${data.name || 'No name'}`);
    return {
      name: data.name,
      profile_pic: data.profile_pic,
      cachedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error(`   ❌ Error fetching profile:`, err.message);
    return null;
  }
}

async function fetchAllUserProfiles() {
  console.log('🔍 Fetching profiles for users without names...\n');
  console.log('=' .repeat(60));

  // Get recent conversations
  const convSnapshot = await db.collection('conversations')
    .orderBy('lastActive', 'desc')
    .limit(50)
    .get();

  console.log(`Found ${convSnapshot.size} recent conversations\n`);

  let fetchedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const doc of convSnapshot.docs) {
    const convData = doc.data();
    const userId = doc.id;

    // Skip if user already has a name in conversation
    if (convData.userName && convData.userName !== 'Unknown') {
      console.log(`⏭️  ${userId} - Already has name: ${convData.userName}`);
      skippedCount++;
      continue;
    }

    // Check if profile exists in userProfiles collection
    const profileDoc = await db.collection('userProfiles').doc(userId).get();
    if (profileDoc.exists && profileDoc.data().name) {
      console.log(`⏭️  ${userId} - Profile exists: ${profileDoc.data().name}`);

      // Update conversation with the profile name
      await db.collection('conversations').doc(userId).update({
        userName: profileDoc.data().name,
        profilePic: profileDoc.data().profile_pic
      });
      skippedCount++;
      continue;
    }

    // Fetch from Facebook
    const profile = await fetchFacebookProfile(userId);

    if (profile && profile.name) {
      // Save to userProfiles collection
      await db.collection('userProfiles').doc(userId).set(profile);

      // Update conversation
      await db.collection('conversations').doc(userId).update({
        userName: profile.name,
        profilePic: profile.profile_pic
      });

      // Also update metaMessages if it exists
      const metaDoc = await db.collection('metaMessages').doc(userId).get();
      if (metaDoc.exists) {
        await db.collection('metaMessages').doc(userId).update({
          userName: profile.name,
          profilePic: profile.profile_pic
        });
      }

      fetchedCount++;
      console.log(`✅ Saved profile for ${userId}: ${profile.name}`);
    } else {
      errorCount++;
      console.log(`❌ Could not fetch profile for ${userId}`);
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESULTS:');
  console.log(`  ✅ Fetched: ${fetchedCount} profiles`);
  console.log(`  ⏭️  Skipped: ${skippedCount} (already have names)`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (fetchedCount > 0) {
    console.log('\n🔄 Refresh the control panel to see the names!');
  }
}

// Run
fetchAllUserProfiles().then(() => {
  console.log('\n✅ Profile fetch complete!');
  process.exit(0);
}).catch(console.error);