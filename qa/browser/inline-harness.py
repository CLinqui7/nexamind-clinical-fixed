"""Render actual React/HTM source without external network, with a mock Supabase adapter.
This does not test a Vite build or a live Supabase/Wompi deployment.
"""
from pathlib import Path
import os,re,json,base64,posixpath
ROOT=Path(__file__).resolve().parents[2]
RUNTIME=Path(os.environ['LINKARE_QA_RUNTIME'])
def encode(s):return 'data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
def html():
 modules={}
 for p in (ROOT/'src').rglob('*.js'):modules['source/'+p.relative_to(ROOT).as_posix()]=p.read_text()
 for rel in ['qa/browser/mock-sdk.js','qa/fixtures/legacy-data.js']:modules['source/'+rel]=(ROOT/rel).read_text()
 for p in RUNTIME.glob('*.js'):modules['runtime/'+p.name]=p.read_text()
 modules['runtime/react-dom-named.js']="import client from './react-dom_client.js'; export const createRoot=client.createRoot;"
 aliases={'react':'runtime/react.js','react-dom/client':'runtime/react-dom-named.js','htm':'runtime/htm.js','@supabase/supabase-js':'source/qa/browser/mock-sdk.js'}
 env={'VITE_APP_MODE':'production','VITE_PUBLIC_APP_URL':'https://qa.invalid','VITE_SUPABASE_URL':'https://qa.invalid','VITE_SUPABASE_ANON_KEY':'qa-only-public'}
 imports={}
 for key,text in modules.items():
  text=text.replace("import '../styles.css';",'').replace('import.meta.env','('+json.dumps(env)+')')
  # The harness has about:blank origin. Match the production root location for rendering.
  text=text.replace('location.pathname',"'/'").replace('location.search',"''")
  def resolve(m):
   prefix,q,value=m.group(1),m.group(2),m.group(3)
   if value.startswith('.'):value=posixpath.normpath(posixpath.join(posixpath.dirname(key),value))
   elif value.startswith('/'):value='source/'+value.lstrip('/')
   else:value=aliases.get(value,value)
   return prefix+q+value+q
  text=re.sub(r'(\bfrom\s*|\bimport\s*)([\'\"])([^\'\"]+)\2',resolve,text)
  text=re.sub(r'//# sourceMappingURL=.*','',text)
  # Inline the supplied brand image to prevent all asset/network access.
  for img in ['linkare-logo.jpg','linkare-wordmark.png']:
   p=ROOT/'public/assets'/img
   url='data:image/'+('jpeg' if img.endswith('jpg') else 'png')+';base64,'+base64.b64encode(p.read_bytes()).decode()
   text=text.replace('/assets/'+img,url)
  imports[key]=encode(text)
 css=re.sub(r'@import[^;]+;','',(ROOT/'styles.css').read_text())
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><script type="importmap">'+json.dumps({'imports':imports})+'</script></head><body><div id="root"></div><script type="module">import "source/src/app.js";</script></body></html>'
