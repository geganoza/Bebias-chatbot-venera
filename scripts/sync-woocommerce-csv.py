#!/usr/bin/env python3
"""
Sync WooCommerce CSV export to Firestore products collection
Uses WooCommerce ID as the document ID

Usage:
    python3 scripts/sync-woocommerce-csv.py /path/to/export.csv
"""

import csv
import sys
import os
import re
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
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Unescape HTML entities
    text = unescape(text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_images(images_str):
    """Parse comma-separated image URLs and encode them"""
    if not images_str:
        return []
    urls = [url.strip() for url in images_str.split(',') if url.strip()]
    return [encode_url(url) for url in urls]

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
        print("Usage: python3 scripts/sync-woocommerce-csv.py /path/to/export.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"Error: File not found: {csv_path}")
        sys.exit(1)

    print("=" * 60)
    print("WOOCOMMERCE CSV TO FIRESTORE SYNC")
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

    products = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            products.append(row)

    print(f"Found {len(products)} products")
    print("\nSyncing to Firestore...")
    print("-" * 60)

    synced = 0
    skipped = 0
    errors = 0

    for product in products:
        product_id = product.get('ID', '').strip()

        if not product_id:
            skipped += 1
            continue

        try:
            # Parse stock - handle empty values
            stock_str = product.get('Stock', '0').strip()
            stock = int(stock_str) if stock_str else 0

            # Parse price
            price_str = product.get('Regular price', '0').strip()
            price = float(price_str) if price_str else 0

            sale_price_str = product.get('Sale price', '').strip()
            sale_price = float(sale_price_str) if sale_price_str else None

            # Parse images
            images = parse_images(product.get('Images', ''))

            # Build Firestore document
            firestore_product = {
                'wc_id': product_id,
                'sku': product.get('SKU', '').strip(),
                'name': product.get('Name', '').strip(),
                'type': product.get('Type', '').strip(),
                'short_description': clean_html(product.get('Short description', '')),
                'description': clean_html(product.get('Description', '')),
                'stock_qty': stock,
                'in_stock': product.get('In stock?', '0') == '1',
                'price': price,
                'sale_price': sale_price,
                'currency': 'GEL',
                'categories': product.get('Categories', '').strip(),
                'tags': product.get('Tags', '').strip(),
                'images': images,
                'image': images[0] if images else '',
                # Attributes
                'attr_size': product.get('Attribute 1 value(s)', '').strip() if product.get('Attribute 1 name', '') == 'ზომა' else '',
                'attr_color': product.get('Attribute 2 value(s)', '').strip() if product.get('Attribute 2 name', '') == 'ფერი' else '',
                'attr_material': product.get('Attribute 4 value(s)', '').strip() if product.get('Attribute 4 name', '') == 'მატერია' else '',
                # Meta
                'published': product.get('Published', '0') == '1',
                'visibility': product.get('Visibility in catalog', '').strip(),
                'upsells': product.get('Upsells', '').strip(),
                'cross_sells': product.get('Cross-sells', '').strip(),
                # Sync info
                'last_updated_by': 'woocommerce_sync',
                'synced_at': firestore.SERVER_TIMESTAMP
            }

            # Remove None values
            firestore_product = {k: v for k, v in firestore_product.items() if v is not None}

            # Save to Firestore with WooCommerce ID as document ID
            db.collection('products').document(product_id).set(firestore_product, merge=True)

            name = firestore_product.get('name', '')[:35]
            print(f"  OK {product_id}: {name}... (stock: {stock})")
            synced += 1

        except Exception as e:
            print(f"  ERROR {product_id}: {e}")
            errors += 1

    print("-" * 60)
    print(f"\nSYNC COMPLETE")
    print(f"  Synced: {synced}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")
    print("=" * 60)

if __name__ == "__main__":
    main()
