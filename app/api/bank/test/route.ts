// Test endpoint for BOG integration
import { NextResponse } from 'next/server';
import { getBOGClient } from '../../../../lib/bogClient';
import { getRecentTransactions } from '../../../../lib/bank';

export async function GET(request: Request) {
  try {
    console.log('🧪 Testing BOG integration...');

    // Check environment variables
    const hasClientId = !!process.env.BOG_CLIENT_ID;
    const hasClientSecret = !!process.env.BOG_CLIENT_SECRET;
    const hasAccountId = !!process.env.BOG_ACCOUNT_ID;

    const clientIdLength = process.env.BOG_CLIENT_ID?.length || 0;
    const clientSecretLength = process.env.BOG_CLIENT_SECRET?.length || 0;
    const clientIdPreview = process.env.BOG_CLIENT_ID?.substring(0, 10) + '...';

    console.log('Environment check:');
    console.log(`  BOG_CLIENT_ID: ${hasClientId ? '✅ Set' : '❌ Missing'} (length: ${clientIdLength}, preview: ${clientIdPreview})`);
    console.log(`  BOG_CLIENT_SECRET: ${hasClientSecret ? '✅ Set' : '❌ Missing'} (length: ${clientSecretLength})`);
    console.log(`  BOG_ACCOUNT_ID: ${hasAccountId ? '✅ Set' : '❌ Missing'}`);

    if (!hasClientId || !hasClientSecret) {
      return NextResponse.json({
        success: false,
        error: 'BOG credentials not configured',
        details: {
          hasClientId,
          hasClientSecret,
          hasAccountId,
        }
      }, { status: 500 });
    }

    // Test authentication
    console.log('🔐 Testing authentication...');
    const bog = getBOGClient();
    const authResult = await bog.authenticate();

    if (!authResult) {
      return NextResponse.json({
        success: false,
        error: 'BOG authentication failed',
        step: 'authenticate'
      }, { status: 500 });
    }

    console.log('✅ Authentication successful');

    // Test getting account info
    if (hasAccountId) {
      console.log('📊 Testing account info...');
      const accountInfo = await bog.getAccountInfo();

      if (!accountInfo) {
        return NextResponse.json({
          success: false,
          error: 'Failed to get account info',
          step: 'getAccountInfo',
          authenticated: true
        }, { status: 500 });
      }

      console.log('✅ Account info retrieved');
      console.log(`   Account: ${accountInfo.accountNumber}`);
      console.log(`   Balance: ${accountInfo.balance} ${accountInfo.currency}`);
    }

    // Test getting recent transactions
    console.log('📋 Testing recent transactions...');
    const transactions = await getRecentTransactions();

    console.log(`✅ Retrieved ${transactions.length} recent transactions`);

    return NextResponse.json({
      success: true,
      message: 'BOG integration working correctly',
      data: {
        authenticated: true,
        accountConfigured: hasAccountId,
        recentTransactionsCount: transactions.length,
        sampleTransaction: transactions[0] || null,
      }
    });

  } catch (error: any) {
    console.error('❌ BOG test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}
