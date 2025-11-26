import { NextResponse } from 'next/server';
import { testRedisConnection } from '@/lib/redis';
import { getFeatureStatus } from '@/lib/featureFlags';

/**
 * Test endpoint to verify Redis connection and feature flags
 * Access via: https://bebias-venera-chatbot.vercel.app/api/test-redis
 */
export async function GET() {
  try {
    // Test Redis connection
    const redisConnected = await testRedisConnection();

    // Get feature flag status
    const features = getFeatureStatus();

    // Get environment status
    const config = {
      redis: {
        connected: redisConnected,
        url: process.env.UPSTASH_REDIS_REST_URL ? '✅ Configured' : '❌ Not configured',
        token: process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Configured' : '❌ Not configured',
      },
      qstash: {
        token: process.env.QSTASH_TOKEN ? '✅ Configured' : '❌ Not configured',
      },
      features: {
        redisBatching: {
          enabled: process.env.ENABLE_REDIS_BATCHING === 'true',
          testUsers: features.REDIS_MESSAGE_BATCHING.testUserCount,
          rolloutPercentage: features.REDIS_MESSAGE_BATCHING.rolloutPercentage,
        }
      },
      testUserIds: [
        '3282789748459241 (Giorgi)'
      ]
    };

    return NextResponse.json({
      status: 'ok',
      message: 'Redis batching test endpoint',
      config,
      instructions: {
        toEnable: "Set environment variable ENABLE_REDIS_BATCHING=true in Vercel dashboard",
        toTest: "Send messages from user 3282789748459241",
        toMonitor: "Check logs for [REDIS] tags",
        toDisable: "Remove ENABLE_REDIS_BATCHING from environment variables",
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

/**
 * POST endpoint to enable/disable Redis batching
 */
export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (action === 'enable') {
      // Note: In production, you'd update the environment variable via Vercel API
      // For now, just return instructions
      return NextResponse.json({
        status: 'ok',
        message: 'To enable Redis batching:',
        steps: [
          '1. Go to Vercel Dashboard',
          '2. Navigate to Settings → Environment Variables',
          '3. Add: ENABLE_REDIS_BATCHING = true',
          '4. Redeploy the application',
          '5. Test with user 3282789748459241'
        ]
      });
    }

    if (action === 'test') {
      // Test Redis connection
      const connected = await testRedisConnection();
      return NextResponse.json({
        status: connected ? 'ok' : 'error',
        redis: connected ? 'Connected ✅' : 'Failed ❌',
        message: connected
          ? 'Redis is working! You can enable batching.'
          : 'Redis connection failed. Check credentials.'
      });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Invalid action. Use: enable, disable, or test'
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}