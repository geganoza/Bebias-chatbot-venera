#!/usr/bin/env python3
"""
Encode Product Image URLs for Facebook Messenger API
Converts Georgian Unicode characters in URLs to percent-encoding

Usage:
    python3 encode_product_urls.py

This will update data/products.json with encoded URLs
"""

import json
from urllib.parse import urlparse, quote, urlunparse
from pathlib import Path


def encode_url(url):
    """
    Encode a URL by converting non-ASCII characters to percent-encoding

    Example:
        https://bebias.ge/wp-content/uploads/სტაფილოსფერი-ქუდი.jpg
        -> https://bebias.ge/wp-content/uploads/%E1%83%A1%E1%83%A2%E1%83%90...
    """
    if not url or not url.strip():
        return url

    try:
        parsed = urlparse(url)

        # Split path into segments and encode each one
        path_segments = parsed.path.split('/')
        encoded_segments = []

        for segment in path_segments:
            if segment:
                # Only encode if segment contains non-ASCII characters
                if any(ord(char) > 127 for char in segment):
                    # Use quote with safe='-._~' to encode Georgian chars but keep hyphens, dots, etc
                    encoded_segment = quote(segment, safe='-._~')
                    encoded_segments.append(encoded_segment)
                else:
                    encoded_segments.append(segment)
            else:
                encoded_segments.append('')

        # Reconstruct path
        encoded_path = '/'.join(encoded_segments)

        # Reconstruct full URL
        encoded_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            encoded_path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))

        return encoded_url

    except Exception as e:
        print(f"⚠️  Error encoding URL {url}: {e}")
        return url


def main():
    products_file = Path(__file__).parent / "data" / "products.json"

    if not products_file.exists():
        print(f"❌ Error: {products_file} not found")
        return

    print(f"📖 Reading products from: {products_file}")

    with open(products_file, 'r', encoding='utf-8') as f:
        products = json.load(f)

    print(f"   Found {len(products)} products")

    # Track changes
    changed_count = 0
    unchanged_count = 0

    # Process each product
    for i, product in enumerate(products):
        product_id = product.get('id', f'Product {i+1}')
        original_url = product.get('image', '')

        if not original_url:
            unchanged_count += 1
            continue

        encoded_url = encode_url(original_url)

        if encoded_url != original_url:
            product['image'] = encoded_url
            changed_count += 1

            # Show first 5 changes as examples
            if changed_count <= 5:
                print(f"\n   {changed_count}. {product_id}")
                print(f"      Original: {original_url}")
                print(f"      Encoded:  {encoded_url}")
        else:
            unchanged_count += 1

    # Save updated products
    print(f"\n💾 Saving updated products...")

    with open(products_file, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Success!")
    print(f"   Changed: {changed_count} products")
    print(f"   Unchanged: {unchanged_count} products")
    print(f"   Total: {len(products)} products")

    if changed_count > 5:
        print(f"\n   (Showing first 5 changes, {changed_count - 5} more changed)")


if __name__ == "__main__":
    main()
