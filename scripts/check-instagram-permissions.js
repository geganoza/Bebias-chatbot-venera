#!/usr/bin/env node

/**
 * Quick Instagram Permission Checker
 * Run this after adding permissions to verify everything is working
 */

const TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN ||
  'EAAL9sPOK4AoBPZCAedC6Pnk6MO3kJynAfgGpOkgrjUKlOjr6rHsYYvnefBQW8G7yoLk9fJ7GZANew43ZBRb9PFLhQG5cl2FkxDDWZAbhWr34P7JnmW9CZAiCeZAeyCtWQDDoPWuOgKZAZALjhqbO55FqzRjyPyO3nsZCZBZBSv41jL7A1wBYIOJ9IEUDZCiqwupmDBYxyHhHnHQiFMQLZBIkxvZBRiEQZDZD';

async function checkPermissions() {
  console.log('🔍 Instagram Permission Check\n');
  console.log('='.repeat(50));

  let hasAllPermissions = true;

  // 1. Check token permissions
  console.log('\n1️⃣  Checking Token Permissions...');
  try {
    const permResponse = await fetch(
      `https://graph.facebook.com/v24.0/me/permissions?access_token=${TOKEN}`
    );
    const permData = await permResponse.json();

    if (permData.error) {
      console.log('❌ Error checking permissions:', permData.error.message);
      hasAllPermissions = false;
    } else if (permData.data && permData.data.length > 0) {
      console.log('✅ Permissions found:');

      // Check for required permissions
      const required = [
        'pages_read_engagement',
        'instagram_basic',
        'instagram_manage_messages'
      ];

      const granted = permData.data
        .filter(p => p.status === 'granted')
        .map(p => p.permission);

      required.forEach(perm => {
        if (granted.includes(perm)) {
          console.log(`   ✅ ${perm} - GRANTED`);
        } else {
          console.log(`   ❌ ${perm} - MISSING`);
          hasAllPermissions = false;
        }
      });

      // Show other permissions
      const others = granted.filter(p => !required.includes(p));
      if (others.length > 0) {
        console.log('   📋 Other permissions:', others.join(', '));
      }
    } else {
      console.log('❌ No permissions found on token');
      hasAllPermissions = false;
    }
  } catch (error) {
    console.log('❌ Failed to check permissions:', error.message);
    hasAllPermissions = false;
  }

  // 2. Check Instagram Business Account access
  console.log('\n2️⃣  Checking Instagram Business Account...');
  try {
    const igResponse = await fetch(
      `https://graph.facebook.com/v24.0/me?fields=instagram_business_account&access_token=${TOKEN}`
    );
    const igData = await igResponse.json();

    if (igData.error) {
      console.log('❌ Cannot access Instagram account:', igData.error.message);
      hasAllPermissions = false;
    } else if (igData.instagram_business_account) {
      console.log('✅ Instagram Business Account found:', igData.instagram_business_account.id);

      // Try to check webhook subscription for Instagram account
      const igId = igData.instagram_business_account.id;
      const subResponse = await fetch(
        `https://graph.facebook.com/v24.0/${igId}/subscribed_apps?access_token=${TOKEN}`
      );
      const subData = await subResponse.json();

      if (subData.data) {
        console.log('✅ Instagram webhook subscribed');
      } else if (subData.error) {
        console.log('⚠️  Instagram webhook not accessible:', subData.error.message);
      }
    } else {
      console.log('❌ No Instagram Business Account connected');
      hasAllPermissions = false;
    }
  } catch (error) {
    console.log('❌ Failed to check Instagram account:', error.message);
    hasAllPermissions = false;
  }

  // 3. Check Page subscription
  console.log('\n3️⃣  Checking Page Webhook Subscription...');
  try {
    const subResponse = await fetch(
      `https://graph.facebook.com/v24.0/me/subscribed_apps?access_token=${TOKEN}`
    );
    const subData = await subResponse.json();

    if (subData.data && subData.data.length > 0) {
      console.log('✅ Page is subscribed to webhooks');
      subData.data.forEach(app => {
        console.log(`   App: ${app.name} (${app.id})`);
        console.log(`   Fields: ${app.subscribed_fields.join(', ')}`);
      });
    } else {
      console.log('❌ Page not subscribed to webhooks');
      hasAllPermissions = false;
    }
  } catch (error) {
    console.log('❌ Failed to check subscription:', error.message);
    hasAllPermissions = false;
  }

  // 4. Test webhook endpoint
  console.log('\n4️⃣  Testing Webhook Endpoint...');
  try {
    const webhookUrl = 'https://bebias-venera-chatbot.vercel.app/api/instagram';
    const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=ig_webhook_bebias_2025_secure_token_xyz789&hub.challenge=TEST123`;

    const testResponse = await fetch(testUrl);
    const testResult = await testResponse.text();

    if (testResult === 'TEST123') {
      console.log('✅ Webhook verification working');
    } else {
      console.log('❌ Webhook verification failed');
      console.log('   Response:', testResult);
      hasAllPermissions = false;
    }
  } catch (error) {
    console.log('❌ Failed to test webhook:', error.message);
    hasAllPermissions = false;
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  if (hasAllPermissions) {
    console.log('\n✅ All permissions are configured correctly!');
    console.log('Instagram DMs should now be forwarded to your webhook.');
    console.log('\nTest by sending a message to @bebias_handcrafted');
  } else {
    console.log('\n❌ Missing required permissions!');
    console.log('\n📋 Next Steps:');
    console.log('1. Go to https://developers.facebook.com/apps/841886395457546/');
    console.log('2. Navigate to App Review → Permissions and Features');
    console.log('3. Request these permissions:');
    console.log('   - pages_read_engagement');
    console.log('   - instagram_basic');
    console.log('   - instagram_manage_messages');
    console.log('4. Generate a new token with these permissions');
    console.log('5. Update INSTAGRAM_PAGE_ACCESS_TOKEN in Vercel');
    console.log('6. Run this script again to verify');
  }
}

checkPermissions().catch(console.error);