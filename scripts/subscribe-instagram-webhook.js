#!/usr/bin/env node

// Subscribe Instagram account to webhook
const subscribeInstagramWebhook = async () => {
  console.log('🔗 Subscribing Instagram to webhook...\n');

  const PAGE_ACCESS_TOKEN = 'IGAAMIjkDimTFBZAFRGQ2tDZAGNCQXlqeTkzSllQbzZA2c2l1UnFTRDBFT3pBb2VJQ1JfS0k4RzYwNnZAXTWhXcVFuaUwtbHZAkRmpyeGVsOUZAaM1NHNDJmcEhyQ2dxUEZAhekJwX2pBZAjhEbzhEVWFuVjRJdGk4cnoybzA5TS1NM1FuWQZDZD';
  const INSTAGRAM_ACCOUNT_ID = '17841424690552638'; // bebias_handcrafted

  // Step 1: Get Page ID from token
  console.log('Step 1: Getting Page info...');
  try {
    const meResponse = await fetch(
      `https://graph.facebook.com/v24.0/me?access_token=${PAGE_ACCESS_TOKEN}`
    );
    const meData = await meResponse.json();

    if (!meResponse.ok) {
      console.error('❌ Error getting page info:', meData);
      return;
    }

    const pageId = meData.id;
    console.log('✅ Page ID:', pageId);
    console.log('   Page Name:', meData.name || 'N/A');

    // Step 2: Subscribe the Page to receive webhooks
    console.log('\nStep 2: Subscribing Page to webhook...');
    const subscribeUrl = `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps`;

    const subscribeResponse = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscribed_fields: [
          'messages',
          'messaging_postbacks',
          'message_reactions',
          'message_echoes',
          'messaging_optins',
          'messaging_referrals'
        ],
        access_token: PAGE_ACCESS_TOKEN
      })
    });

    const subscribeData = await subscribeResponse.json();

    if (!subscribeResponse.ok) {
      console.error('❌ Error subscribing:', subscribeData);

      // Try alternate method
      console.log('\nTrying alternate subscription method...');
      const altUrl = `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${PAGE_ACCESS_TOKEN}`;

      const altResponse = await fetch(altUrl, { method: 'POST' });
      const altData = await altResponse.json();

      if (altResponse.ok) {
        console.log('✅ Subscription successful (alternate method):', altData);
      } else {
        console.error('❌ Alternate method also failed:', altData);
      }

      return;
    }

    console.log('✅ Subscription successful:', subscribeData);

    // Step 3: Verify subscription
    console.log('\nStep 3: Verifying subscription...');
    const verifyResponse = await fetch(
      `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps?access_token=${PAGE_ACCESS_TOKEN}`
    );
    const verifyData = await verifyResponse.json();

    if (verifyResponse.ok && verifyData.data) {
      console.log('✅ Currently subscribed apps:', verifyData.data);

      if (verifyData.data.length > 0) {
        console.log('\n🎉 SUCCESS! Instagram webhook subscription is active!');
        console.log('📱 Try sending a message to @bebias_handcrafted now!');
      } else {
        console.log('⚠️  No apps subscribed yet. This might take a moment to activate.');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
};

subscribeInstagramWebhook();