#!/usr/bin/env python3
import csv
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Initialize Firebase
cred = credentials.Certificate('bebias-chatbot-key.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

print('📥 Reading WooCommerce CSV export...\n')

csv_path = '/Users/giorginozadze/Downloads/wc-product-export-20-11-2025-1763612693038.csv'

products_to_update = []

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)

    for row in reader:
        product_type = row.get('Type', '').lower()
        name = row.get('Name', '').strip()
        price_str = row.get('Regular price', '').strip()
        stock_str = row.get('Stock', '').strip()
        product_id = row.get('ID', '').strip()

        if not name:
            continue

        # Only variations and simple products
        if product_type not in ['variation', 'simple']:
            continue

        # Parse price
        try:
            price = float(price_str) if price_str else 0
        except ValueError:
            price = 0

        # Parse stock
        try:
            stock = int(stock_str) if stock_str else 0
        except ValueError:
            stock = 0

        if price > 0:
            products_to_update.append({
                'id': product_id,
                'name': name,
                'type': product_type,
                'price': price,
                'stock': stock
            })

print(f'Found {len(products_to_update)} products with prices in CSV\n')

# Get all Firestore products
firestore_products = {}
products_ref = db.collection('products')
docs = products_ref.stream()

for doc in docs:
    data = doc.to_dict()
    firestore_products[doc.id] = {'id': doc.id, **data}

    # Also index by name for easier matching
    if 'name' in data:
        firestore_products[data['name']] = {'id': doc.id, **data}

print(f'Firestore products: {len(set([p["id"] for p in firestore_products.values()]))}\n')
print('🔄 Updating prices...\n')

updated = 0
skipped = 0
not_found = 0

for csv_product in products_to_update:
    name = csv_product['name']
    price = csv_product['price']
    csv_id = csv_product['id']

    # Try to find in Firestore by name or ID
    firestore_product = firestore_products.get(name) or firestore_products.get(csv_id)

    if not firestore_product:
        print(f'⚠️  Not found: {name}')
        not_found += 1
        continue

    # Check if update needed
    current_price = firestore_product.get('price', 0)

    if current_price == price:
        skipped += 1
        continue

    # Update price in Firestore
    try:
        doc_ref = products_ref.document(firestore_product['id'])
        doc_ref.update({
            'price': price,
            'currency': 'GEL',
            'last_updated': datetime.now().isoformat(),
            'last_updated_by': 'csv_price_sync'
        })

        print(f'✅ {name}: {current_price} → {price} GEL')
        updated += 1
    except Exception as e:
        print(f'❌ Failed to update {name}: {e}')

print(f'\n📊 Summary:')
print(f'   Updated: {updated}')
print(f'   Skipped (no change): {skipped}')
print(f'   Not found: {not_found}')
print(f'\n✅ Price sync complete!')
print('\nNext step: Run sync to update products.json')
print('  node scripts/sync-from-firestore.js')
