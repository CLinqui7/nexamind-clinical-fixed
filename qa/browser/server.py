"""Isolated source-render QA: React/HTM are real; Supabase is mocked; no external requests.
LINKARE_QA_RUNTIME points to browser ESM files in node_modules/.vite/deps.
Never use this server to deploy or to store actual patient records.
"""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import os,json,mimetypes
ROOT=Path(__file__).resolve().parents[2]
RUNTIME=Path(os.environ['LINKARE_QA_RUNTIME']).resolve()
ENV={'VITE_APP_MODE':'production','VITE_PUBLIC_APP_URL':'http://127.0.0.1:4388','VITE_SUPABASE_URL':'https://qa.invalid','VITE_SUPABASE_ANON_KEY':'qa-only-public'}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  url=self.path.split('?')[0]
  if url in ['/', '/index.html']:
   text=(ROOT/'index.html').read_text().replace('</head>', '<link rel="stylesheet" href="/styles.css"/><script type="importmap">'+json.dumps({'imports':{'react':'/rt/react.js','react-dom/client':'/rt/react-dom_client.js','htm':'/rt/htm.js','@supabase/supabase-js':'/qa/browser/mock-sdk.js'}})+'</script></head>')
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(text.encode());return
  base=RUNTIME if url.startswith('/rt/') else ROOT
  p=(base/url.removeprefix('/rt/').lstrip('/')).resolve() if url.startswith('/rt/') else (base/url.lstrip('/')).resolve()
  if base not in p.parents or not p.is_file():self.send_error(404);return
  body=p.read_bytes();ctype=mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
  if p.suffix in ['.js','.mjs']:
   text=body.decode().replace('import.meta.env', '('+json.dumps(ENV)+')')
   text=text.replace("import '../styles.css';",'')
   body=text.encode();ctype='text/javascript'
  self.send_response(200);self.send_header('Content-Type',ctype);self.end_headers();self.wfile.write(body)
ThreadingHTTPServer(('127.0.0.1',4388),Handler).serve_forever()
