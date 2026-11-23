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

    def translate_path(self, path):
        # pretty share links: /s/apple-orange-grape serves the app itself;
        # /s/<anything else> serves the repo file the page's relative assets
        # (fonts, scripts, the guide) need while the app sits on that path
        p = path.split('?')[0].rstrip('/')
        if p.startswith('/s/'):
            leaf = p[3:]
            if not leaf or ('.' not in leaf and '/' not in leaf):
                return super().translate_path('/index.html')
            return super().translate_path('/' + leaf)
        return super().translate_path(path)


socketserver.ThreadingTCPServer.allow_reuse_address = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8461
    print('serving ./ on http://127.0.0.1:%d (no-store)' % port)
    with socketserver.ThreadingTCPServer(('127.0.0.1', port), NoStoreHandler) as httpd:
        httpd.serve_forever()
