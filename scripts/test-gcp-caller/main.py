import functions_framework
import requests

@functions_framework.http
def test_wp_connection(request):
    """Test if we can reach WordPress from Google Cloud."""
    results = {}

    # Test 1: Simple PHP file
    try:
        resp = requests.get('https://bebias.ge/test-gcp.php', timeout=10)
        results['test_file'] = {'status': resp.status_code, 'response': resp.text[:300]}
    except Exception as e:
        results['test_file'] = {'error': str(e)}

    # Test 2: WordPress REST API base
    try:
        resp = requests.get('https://bebias.ge/wp-json/', timeout=10)
        results['wp_json_base'] = {'status': resp.status_code}
    except Exception as e:
        results['wp_json_base'] = {'error': str(e)}

    # Test 3: ASCII SKU (should work)
    import os
    api_key = os.environ.get('API_KEY', 'wcdbh_live_9x8d7f6g5h4j3k2l')
    try:
        resp = requests.post(
            'https://bebias.ge/wp-json/wcdbh/v1/update-stock',
            json={'sku': 'test-product', 'stock_qty': 10},
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            timeout=10
        )
        results['ascii_sku'] = {'status': resp.status_code, 'response': resp.text[:300]}
    except Exception as e:
        results['ascii_sku'] = {'error': str(e)}

    # Test 4: Georgian SKU (might fail with 415)
    try:
        resp = requests.post(
            'https://bebias.ge/wp-json/wcdbh/v1/update-stock',
            json={'sku': 'აგურისფერი სადა ქუდი - M', 'stock_qty': 2},
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json; charset=utf-8'},
            timeout=10
        )
        results['georgian_sku'] = {'status': resp.status_code, 'response': resp.text[:300]}
    except Exception as e:
        results['georgian_sku'] = {'error': str(e)}

    return results
