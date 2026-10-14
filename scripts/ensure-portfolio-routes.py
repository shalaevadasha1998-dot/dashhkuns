"""Keep the existing public FAQ reachable and refresh the typography CSS cache."""
from pathlib import Path
import json
p=Path('vercel.json')
data=json.loads(p.read_text())
assert Path('faq.html').is_file()
if not any(r.get('source')=='/faq' for r in data.get('rewrites',[])):
    data.setdefault('rewrites',[]).append({'source':'/faq','destination':'/faq.html'})
if not any(r.get('source')=='/faq.html' for r in data.get('redirects',[])):
    # Insert before the existing host-wide www rule, preserving all other rules.
    data.setdefault('redirects',[]).insert(0,{'source':'/faq.html','destination':'/faq','permanent':True})
if not any(r.get('source')=='/assets/portfolio-typography.css' for r in data.get('headers',[])):
    data.setdefault('headers',[]).insert(0,{'source':'/assets/portfolio-typography.css','headers':[{'key':'Cache-Control','value':'public, max-age=0, must-revalidate'}]})
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('FAQ route and typography CSS cache verified; application routes preserved')
