#!/usr/bin/env node

/**
 * Check Facebook webhook subscription status for the page
 * This will help diagnose why messages aren't being received
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID || 'bebias_venera_';
const APP_ID = process.env.APP_ID || '1195810071646607';

if (!PAGE_ACCESS_TOKEN) {
  console.error('❌ PAGE_ACCESS_TOKEN not found in environment');
  process.exit(1);
}

async function checkWebhookSubscription() {
  console.log('🔍 CHECKING FACEBOOK WEBHOOK SUBSCRIPTION STATUS');
  console.log('=' .repeat(60));
  console.log(`Page ID: ${PAGE_ID}`);
  console.log(`App ID: ${APP_ID}`);
  console.log();

  try {
    // Check subscribed fields for the page
    const subscriptionUrl = `https://graph.facebook.com/v21.0/${PAGE_ID}/subscribed_apps?access_token=${PAGE_ACCESS_TOKEN}`;

    console.log('📡 Fetching subscription info...');
    const response = await fetch(subscriptionUrl);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to fetch subscription info:', error);
      return;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      console.log('✅ WEBHOOK IS SUBSCRIBED!');
      console.log();
      console.log('Subscribed Apps:');

      data.data.forEach(app => {
        console.log(`\n  App ID: ${app.id}`);
        console.log(`  Name: ${app.name || 'Unknown'}`);
        console.log(`  Category: ${app.category || 'Unknown'}`);

        if (app.subscribed_fields && app.subscribed_fields.length > 0) {
          console.log('  Subscribed Fields:');
          app.subscribed_fields.forEach(field => {
            console.log(`    - ${field.name} (v${field.version})`);
          });
        } else {
          console.log('  ⚠️  NO FIELDS SUBSCRIBED!');
        }
      });

      // Check if 'messages' field is subscribed
      const hasMessages = data.data.some(app =>
        app.subscribed_fields?.some(field => field.name === 'messages')
      );

      const hasMessaging = data.data.some(app =>
        app.subscribed_fields?.some(field => field.name === 'messaging')
      );

      console.log('\n' + '=' .repeat(60));
      console.log('CRITICAL FIELDS CHECK:');
      console.log(`  ✅ messages: ${hasMessages ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);
      console.log(`  ✅ messaging: ${hasMessaging ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);

      if (!hasMessages && !hasMessaging) {
        console.log('\n⚠️  CRITICAL ISSUE:');
        console.log('Neither "messages" nor "messaging" fields are subscribed!');
        console.log('The webhook will NOT receive any messages!');
        console.log('\nTO FIX:');
        console.log('1. Go to https://developers.facebook.com');
        console.log('2. Select your app');
        console.log('3. Go to Messenger > Webhooks');
        console.log('4. Edit the page subscription');
        console.log('5. Enable "messages" and "messaging_postbacks" fields');
      }
    } else {
      console.log('❌ NO WEBHOOK SUBSCRIPTIONS FOUND!');
      console.log('\nTO FIX:');
      console.log('1. Go to https://developers.facebook.com');
      console.log('2. Select your app');
      console.log('3. Go to Messenger > Webhooks');
      console.log('4. Subscribe your page');
      console.log('5. Enable "messages" and "messaging_postbacks" fields');
    }

    // Also check webhook callback URL
    console.log('\n' + '=' .repeat(60));
    console.log('WEBHOOK CALLBACK URL:');
    console.log('Should be: https://bebias-venera-chatbot.vercel.app/api/messenger');
    console.log('\nVerify this in Facebook Developer Console:');
    console.log('Messenger > Webhooks > Callback URL');

  } catch (error) {
    console.error('❌ Error checking subscription:', error);
  }
}

checkWebhookSubscription().then(() => process.exit(0));