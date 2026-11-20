"""Local dev server: serves the repo with Cache-Control: no-store on
every response, so browser caching never hides a deployed change.
Run:  python3 serve.py [port]   (default port 8461)"""
import http.server
import socketserver
import sys


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


socketserver.ThreadingTCPServer.allow_reuse_address = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8461
    print('serving ./ on http://127.0.0.1:%d (no-store)' % port)
    with socketserver.ThreadingTCPServer(('127.0.0.1', port), NoStoreHandler) as httpd:
        httpd.serve_forever()
