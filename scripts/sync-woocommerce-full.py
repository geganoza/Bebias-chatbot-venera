#!/usr/bin/env python3
"""
Sync WooCommerce CSV to:
1. Firestore products collection (document ID = product name)
2. AI products.json (id field = WooCommerce ID)

Usage:
    python3 scripts/sync-woocommerce-full.py /path/to/export.csv
"""

import csv
import sys
import os
import re
import json
from pathlib import Path
from urllib.parse import urlparse, quote, urlunparse
from google.cloud import firestore
from google.oauth2 import service_account
from html import unescape

def encode_url(url):
    """Encode Georgian characters in URL for Facebook Messenger"""
    if not url or not url.strip():
        return url
    try:
        parsed = urlparse(url.strip())
        path_segments = parsed.path.split('/')
        encoded_segments = []
        for segment in path_segments:
            if segment:
                if any(ord(char) > 127 for char in segment):
                    encoded_segment = quote(segment, safe='-._~')
                    encoded_segments.append(encoded_segment)
                else:
                    encoded_segments.append(segment)
            else:
                encoded_segments.append('')
        encoded_path = '/'.join(encoded_segments)
        return urlunparse((parsed.scheme, parsed.netloc, encoded_path, parsed.params, parsed.query, parsed.fragment))
    except:
        return url

def clean_html(text):
    """Remove HTML tags and clean up text"""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_images(images_str):
    """Parse comma-separated image URLs and encode them"""
    if not images_str:
        return []
    urls = [url.strip() for url in images_str.split(',') if url.strip()]
    return [encode_url(url) for url in urls]

def sanitize_doc_id(name):
    """Sanitize product name for use as Firestore document ID"""
    # Remove problematic characters for Firestore doc IDs
    # Keep Georgian letters, alphanumeric, spaces, hyphens
    sanitized = re.sub(r'[/\\.\[\]*`]', '', name)
    return sanitized.strip()[:500]  # Firestore doc ID max 1500 bytes

def load_env():
    """Load .env.local file"""
    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    value = value.strip('"').strip("'").replace('\\n', '\n')
                    os.environ[key] = value

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/sync-woocommerce-full.py /path/to/export.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"Error: File not found: {csv_path}")
        sys.exit(1)

    print("=" * 60)
    print("FULL SYNC: WOOCOMMERCE → FIRESTORE + AI DATABASE")
    print("=" * 60)

    # Load environment
    load_env()

    project_id = os.environ.get('GOOGLE_CLOUD_PROJECT_ID', '').strip()
    client_email = os.environ.get('GOOGLE_CLOUD_CLIENT_EMAIL', '').strip()
    private_key = os.environ.get('GOOGLE_CLOUD_PRIVATE_KEY', '').strip()

    if not all([project_id, client_email, private_key]):
        print("Error: Missing Firebase credentials")
        sys.exit(1)

    print(f"\nProject: {project_id}")

    # Create credentials
    credentials = service_account.Credentials.from_service_account_info({
        'type': 'service_account',
        'project_id': project_id,
        'private_key': private_key,
        'client_email': client_email,
        'token_uri': 'https://oauth2.googleapis.com/token',
    })

    db = firestore.Client(project=project_id, credentials=credentials)

    # Read CSV
    print(f"\nReading: {csv_path}")

    products_csv = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            products_csv.append(row)

    print(f"Found {len(products_csv)} rows in CSV")

    # First pass: Build parent name -> images map
    parent_images = {}
    for product in products_csv:
        name = product.get('Name', '').strip()
        product_type = product.get('Type', '').strip()
        images = parse_images(product.get('Images', ''))
        if product_type == 'variable' and images:
            parent_images[name] = images
            print(f"  Parent images: '{name[:30]}...' has {len(images)} images")

    print(f"\nFound {len(parent_images)} parent products with images")

    # Process products
    ai_products = []  # For products.json
    firestore_synced = 0
    firestore_errors = 0

    print("\n" + "-" * 60)
    print("SYNCING TO FIRESTORE (Document ID = Product Name)")
    print("-" * 60)

    for product in products_csv:
        wc_id = product.get('ID', '').strip()
        name = product.get('Name', '').strip()
        product_type = product.get('Type', '').strip()

        if not wc_id or not name:
            continue

        # Skip variable parents for stock management (only variations have real stock)
        # But include them for product catalog

        try:
            # Parse data
            stock_str = product.get('Stock', '0').strip()
            stock = int(stock_str) if stock_str else 0

            price_str = product.get('Regular price', '0').strip()
            price = float(price_str) if price_str else 0

            sale_price_str = product.get('Sale price', '').strip()
            sale_price = float(sale_price_str) if sale_price_str else None

            images = parse_images(product.get('Images', ''))

            # For variations, get image from parent product
            if product_type == 'variation' and not images:
                parent_name = product.get('Parent', '').strip()
                if parent_name and parent_name in parent_images:
                    images = parent_images[parent_name]

            short_desc = clean_html(product.get('Short description', ''))
            description = clean_html(product.get('Description', ''))

            # Document ID = sanitized product name
            doc_id = sanitize_doc_id(name)

            # Firestore document
            firestore_product = {
                'id': wc_id,  # WooCommerce ID as field
                'sku': product.get('SKU', '').strip(),
                'name': name,
                'type': product_type,
                'short_description': short_desc,
                'description': description,
                'stock_qty': stock,
                'in_stock': product.get('In stock?', '0') == '1',
                'price': price,
                'sale_price': sale_price,
                'currency': 'GEL',
                'categories': product.get('Categories', '').strip(),
                'tags': product.get('Tags', '').strip(),
                'images': images,
                'image': images[0] if images else '',
                'published': product.get('Published', '0') == '1',
                'last_updated_by': 'woocommerce_sync',
                'synced_at': firestore.SERVER_TIMESTAMP
            }

            # Remove None values
            firestore_product = {k: v for k, v in firestore_product.items() if v is not None}

            # Save to Firestore with product name as document ID
            db.collection('products').document(doc_id).set(firestore_product, merge=True)
            firestore_synced += 1

            if firestore_synced <= 10:
                print(f"  OK '{doc_id[:40]}...' (ID: {wc_id}, stock: {stock})")

            # Add to AI products list (only variations with price, or simple products)
            if product_type in ['simple', 'variation'] and price > 0:
                ai_product = {
                    'id': wc_id,  # WooCommerce ID
                    'name': name,
                    'price': price,
                    'currency': 'GEL',
                    'category': product.get('Categories', '').split('>')[0].strip() if product.get('Categories') else '',
                    'stock': stock,
                    'image': images[0] if images else '',
                    'short_description': short_desc[:200] if short_desc else ''
                }
                ai_products.append(ai_product)

        except Exception as e:
            print(f"  ERROR {wc_id}: {e}")
            firestore_errors += 1

    if firestore_synced > 10:
        print(f"  ... and {firestore_synced - 10} more")

    print(f"\nFirestore: {firestore_synced} synced, {firestore_errors} errors")

    # Save AI products.json
    print("\n" + "-" * 60)
    print("SAVING AI PRODUCTS DATABASE (products.json)")
    print("-" * 60)

    products_json_path = Path(__file__).parent.parent / 'data' / 'products.json'

    # Sort by name for easier reading
    ai_products.sort(key=lambda x: x.get('name', ''))

    with open(products_json_path, 'w', encoding='utf-8') as f:
        json.dump(ai_products, f, ensure_ascii=False, indent=2)

    print(f"  Saved {len(ai_products)} products to {products_json_path}")
    print(f"  (Only variations and simple products with price > 0)")

    print("\n" + "=" * 60)
    print("SYNC COMPLETE!")
    print(f"  Firestore: {firestore_synced} products (doc ID = product name)")
    print(f"  AI Database: {len(ai_products)} products (id = WooCommerce ID)")
    print("=" * 60)

if __name__ == "__main__":
    main()
