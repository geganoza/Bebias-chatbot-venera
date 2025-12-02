#!/usr/bin/env node

const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Launching browser...');

  // Launch browser in non-headless mode so you can see it
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  console.log('📍 Navigating to control panel...');
  await page.goto('https://bebias-venera-chatbot.vercel.app/control-panel', {
    waitUntil: 'networkidle2'
  });

  console.log('✅ Control panel opened!');
  console.log('🎯 The browser will stay open for you to interact with.');
  console.log('Press Ctrl+C to close when done.');

  // Keep the browser open
  await new Promise(() => {});
})();