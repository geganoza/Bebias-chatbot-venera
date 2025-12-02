const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Launching browser to check control panel...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();

  console.log('📍 Navigating to control panel...');
  await page.goto('https://bebias-venera-chatbot.vercel.app/control-panel', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Force reload with cache bypass
  console.log('🔄 Force reloading page (bypassing cache)...');
  await page.evaluate(() => {
    location.reload(true);
  });

  await page.waitForTimeout(3000);

  // Check what's displayed
  console.log('📋 Checking conversations displayed...');

  try {
    const conversations = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="conversation"], [class*="user-item"], div[role="listitem"]');
      const results = [];
      elements.forEach(el => {
        const text = el.textContent;
        if (text && text.length > 0) {
          results.push(text.substring(0, 100));
        }
      });
      return results;
    });

    console.log('\nFound conversations on page:');
    conversations.slice(0, 10).forEach((conv, i) => {
      console.log(`${i + 1}. ${conv}`);
    });
  } catch (err) {
    console.log('Could not extract conversations:', err.message);
  }

  // Check total count
  const totalText = await page.evaluate(() => {
    const el = document.querySelector('[class*="total"]');
    return el ? el.textContent : null;
  });

  if (totalText) {
    console.log(`\nTotal shown: ${totalText}`);
  }

  console.log('\n✅ Check complete! Browser will stay open.');

  // Keep browser open
  await new Promise(() => {});
})();