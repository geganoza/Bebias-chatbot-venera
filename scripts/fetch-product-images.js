/**
 * Script to fetch product images from bebias.ge URLs and update products.json
 * Run with: node scripts/fetch-product-images.js
 */

const fs = require('fs').promises;
const path = require('path');

async function fetchImageFromUrl(url) {
  try {
    console.log(`🔍 Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Try multiple patterns to find product image
    const patterns = [
      // WooCommerce single product image
      /<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]+src="([^"]+)"/i,
      // General product image with data-src
      /<img[^>]+data-src="([^"]+)"[^>]*class="[^"]*product[^"]*"/i,
      // Open Graph image
      /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
      // First image in product gallery
      /<div[^>]+class="[^"]*woocommerce-product-gallery[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i,
      // Any image with "product" in class
      /<img[^>]+class="[^"]*product[^"]*"[^>]+src="([^"]+)"/i,
      // Fallback: first image tag with http(s) src
      /<img[^>]+src="(https?:\/\/[^"]+)"/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];

        // Clean up image URL
        imageUrl = imageUrl.split('?')[0]; // Remove query params

        // Skip placeholder images
        if (imageUrl.includes('placeholder') || imageUrl.includes('woocommerce-placeholder')) {
          continue;
        }

        console.log(`✅ Found image: ${imageUrl}`);
        return imageUrl;
      }
    }

    console.warn(`⚠️  No image found for ${url}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error.message);
    return null;
  }
}

async function updateProductImages() {
  try {
    const productsPath = path.join(__dirname, '..', 'data', 'products.json');

    // Read products.json
    console.log('📖 Reading products.json...');
    const productsText = await fs.readFile(productsPath, 'utf8');
    const products = JSON.parse(productsText);

    console.log(`Found ${products.length} products\n`);

    // Process each product
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      console.log(`\n[${i + 1}/${products.length}] Processing: ${product.name_en || product.name}`);

      // Skip if already has a real image URL
      if (product.image && product.image !== 'IMAGE_URL_HERE' && product.image.startsWith('http')) {
        console.log(`⏭️  Already has image, skipping`);
        skipped++;
        continue;
      }

      // Skip if no URL
      if (!product.url || !product.url.startsWith('http')) {
        console.log(`⏭️  No valid URL, skipping`);
        skipped++;
        continue;
      }

      // Fetch image
      const imageUrl = await fetchImageFromUrl(product.url);

      if (imageUrl) {
        product.image = imageUrl;
        updated++;
      } else {
        failed++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save updated products.json
    console.log('\n💾 Saving updated products.json...');
    await fs.writeFile(
      productsPath,
      JSON.stringify(products, null, 2),
      'utf8'
    );

    console.log('\n✅ Done!');
    console.log(`📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${products.length}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
updateProductImages();
