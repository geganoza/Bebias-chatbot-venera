#!/bin/bash

echo "Adding QStash environment variables to Vercel..."

# Add QSTASH_TOKEN
echo "Adding QSTASH_TOKEN..."
echo 'eyJVc2VySUQiOiI2YjRlZjA5OS1iMjhhLTQzNTAtOWIzMC1iZWNiZTFiMmU2MDAiLCJQYXNzd29yZCI6ImU1NzZhMTc5OGQzOTRlNzk4NWJhYTM3OTdlMDU5N2RjIn0=' | vercel env add QSTASH_TOKEN

# Add QSTASH_CURRENT_SIGNING_KEY
echo "Adding QSTASH_CURRENT_SIGNING_KEY..."
echo 'sig_6w41ipmNcokR3w67vZGAg4BwueCU' | vercel env add QSTASH_CURRENT_SIGNING_KEY

# Add QSTASH_NEXT_SIGNING_KEY
echo "Adding QSTASH_NEXT_SIGNING_KEY..."
echo 'sig_6nWNJnVF9pea9a6xMpgShptzFFtv' | vercel env add QSTASH_NEXT_SIGNING_KEY

# Add QSTASH_URL
echo "Adding QSTASH_URL..."
echo 'https://qstash.upstash.io' | vercel env add QSTASH_URL

echo "✅ Done! All QStash variables added."
echo "Run 'vercel env pull' to update local .env file"
