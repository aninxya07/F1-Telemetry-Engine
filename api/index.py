import sys
import os
import io

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# Vercel serverless function handler
def handler(request):
    """Vercel serverless function handler for Flask app"""
    # Handle both dict and object-style requests
    if isinstance(request, dict):
        method = request.get('method', 'GET')
        path = request.get('path', '/')
        headers = request.get('headers', {})
        body = request.get('body', b'')
        query_string = request.get('query_string', '')
    else:
        method = getattr(request, 'method', 'GET')
        path = getattr(request, 'path', '/')
        headers = getattr(request, 'headers', {})
        body = getattr(request, 'body', b'')
        query_string = getattr(request, 'query_string', '')
    
    # Ensure body is bytes
    if isinstance(body, str):
        body = body.encode('utf-8')
    
    # Convert Vercel request to WSGI environ format
    environ = {
        'REQUEST_METHOD': method,
        'SCRIPT_NAME': '',
        'PATH_INFO': path,
        'QUERY_STRING': query_string,
        'CONTENT_TYPE': headers.get('Content-Type', '') if isinstance(headers, dict) else getattr(headers, 'get', lambda k, d: d)('Content-Type', ''),
        'CONTENT_LENGTH': str(len(body)) if body else '0',
        'SERVER_NAME': headers.get('Host', 'localhost') if isinstance(headers, dict) else getattr(headers, 'get', lambda k, d: d)('Host', 'localhost'),
        'SERVER_PORT': '80',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'https' if (headers.get('X-Forwarded-Proto') if isinstance(headers, dict) else getattr(headers, 'get', lambda k, d: d)('X-Forwarded-Proto', 'http')) == 'https' else 'http',
        'wsgi.input': io.BytesIO(body) if body else None,
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': True,
        'wsgi.run_once': False,
    }
    
    # Add headers to environ
    if isinstance(headers, dict):
        for key, value in headers.items():
            key = key.upper().replace('-', '_')
            if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                environ[f'HTTP_{key}'] = value
    else:
        # Handle object-style headers
        for key in dir(headers):
            if not key.startswith('_'):
                value = getattr(headers, key)
                if not callable(value):
                    key = key.upper().replace('-', '_')
                    if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                        environ[f'HTTP_{key}'] = str(value)
    
    # Call Flask app and collect response
    response_data = []
    status_code = [200]
    response_headers = []
    
    def start_response(status, headers_list):
        status_code[0] = int(status.split()[0])
        response_headers.extend(headers_list)
    
    try:
        app_iter = app(environ, start_response)
        
        # Collect response body
        try:
            for data in app_iter:
                if isinstance(data, bytes):
                    response_data.append(data)
                else:
                    response_data.append(data.encode('utf-8'))
        finally:
            if hasattr(app_iter, 'close'):
                app_iter.close()
    except Exception as e:
        import traceback
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': f'{{"error": "{str(e)}", "traceback": "{traceback.format_exc()}"}}'
        }
    
    body_bytes = b''.join(response_data) if response_data else b''
    
    # Return response in Vercel format
    response_headers_dict = {k: v for k, v in response_headers}
    
    return {
        'statusCode': status_code[0],
        'headers': response_headers_dict,
        'body': body_bytes.decode('utf-8') if body_bytes else ''
    }

