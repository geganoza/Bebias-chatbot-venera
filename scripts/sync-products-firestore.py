#!/usr/bin/env python3
"""
Sync products.json to Firestore products collection
- Converts stock -> stock_qty
- Encodes Georgian URLs for Facebook Messenger
- Uses SKU (id) as document ID

Usage:
    python3 scripts/sync-products-firestore.py
"""

import json
import os
from pathlib import Path
from urllib.parse import urlparse, quote, urlunparse
from google.cloud import firestore
from google.oauth2 import service_account

def encode_url(url):
    """Encode Georgian characters in URL"""
    if not url or not url.strip():
        return url

    try:
        parsed = urlparse(url)
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
    except Exception as e:
        print(f"  Warning: Error encoding URL: {e}")
        return url

def load_env():
    """Load .env.local file"""
    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Remove quotes and handle \n
                    value = value.strip('"').strip("'")
                    value = value.replace('\\n', '\n')
                    os.environ[key] = value

def main():
    print("=" * 50)
    print("PRODUCTS SYNC TO FIRESTORE")
    print("=" * 50)

    # Load environment
    load_env()

    project_id = os.environ.get('GOOGLE_CLOUD_PROJECT_ID', '').strip()
    client_email = os.environ.get('GOOGLE_CLOUD_CLIENT_EMAIL', '').strip()
    private_key = os.environ.get('GOOGLE_CLOUD_PRIVATE_KEY', '').strip()

    if not all([project_id, client_email, private_key]):
        print("Error: Missing Firebase credentials")
        print(f"  Project ID: {'OK' if project_id else 'MISSING'}")
        print(f"  Client Email: {'OK' if client_email else 'MISSING'}")
        print(f"  Private Key: {'OK' if private_key else 'MISSING'}")
        return

    print(f"\nProject: {project_id}")
    print(f"Service Account: {client_email}")

    # Create credentials
    credentials = service_account.Credentials.from_service_account_info({
        'type': 'service_account',
        'project_id': project_id,
        'private_key': private_key,
        'client_email': client_email,
        'token_uri': 'https://oauth2.googleapis.com/token',
    })

    # Initialize Firestore
    db = firestore.Client(project=project_id, credentials=credentials)

    # Load products.json
    products_path = Path(__file__).parent.parent / 'data' / 'products.json'
    with open(products_path, 'r', encoding='utf-8') as f:
        products = json.load(f)

    print(f"\nFound {len(products)} products in products.json")
    print("\nSyncing to Firestore...")
    print("-" * 50)

    synced = 0
    errors = 0

    for product in products:
        sku = product.get('id', '')
        if not sku:
            continue

        try:
            # Convert to Firestore format
            firestore_product = {
                'name': product.get('name', ''),
                'stock_qty': product.get('stock', 0),
                'price': product.get('price', 0),
                'currency': product.get('currency', 'GEL'),
                'category': product.get('category', ''),
                'image': encode_url(product.get('image', '')),
                'last_updated_by': 'sync_script',
                'synced_at': firestore.SERVER_TIMESTAMP
            }

            # Save to Firestore
            db.collection('products').document(sku).set(firestore_product, merge=True)

            stock = firestore_product['stock_qty']
            name = firestore_product['name'][:30]
            print(f"  OK {sku}: {name}... (stock: {stock})")
            synced += 1

        except Exception as e:
            print(f"  ERROR {sku}: {e}")
            errors += 1

    print("-" * 50)
    print(f"\nSYNC COMPLETE")
    print(f"  Synced: {synced}")
    print(f"  Errors: {errors}")
    print("=" * 50)

if __name__ == "__main__":
    main()
