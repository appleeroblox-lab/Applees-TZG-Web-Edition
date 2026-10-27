"""Fetch accessible Roblox media, or import owner-exported files from a directory.
Usage: python scripts/import-roblox-assets.py [--from-dir /path/to/exported-media]
Name local files after a SoundName or numeric asset ID, with .ogg/.mp3/.wav/.png.
No Roblox credentials are requested or stored. Failed downloads leave fallbacks active.
"""
import argparse,concurrent.futures,gzip,json,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public'
a=argparse.ArgumentParser();a.add_argument('--from-dir',type=Path);args=a.parse_args()
manifest=json.loads((PUBLIC/'roblox-assets.json').read_text())
entries=[(name,item,'audio') for name,item in manifest['audio'].items()]+[(item['id'],item,'image') for item in manifest['sunshine']]
def media_type(b,kind):
 if kind=='image':
  if b.startswith(b'\x89PNG\r\n\x1a\n'):return '.png'
  if b.startswith(b'\xff\xd8\xff'):return '.jpg'
 else:
  if b.startswith(b'OggS'):return '.ogg'
  if b.startswith(b'RIFF') and b[8:12]==b'WAVE':return '.wav'
  if b.startswith(b'ID3') or len(b)>2 and b[0]==255 and b[1]&224==224:return '.mp3'
 raise ValueError('Response is not supported '+kind+' media')
def fetch(entry):
 name,item,kind=entry
 try:
  if item.get('file') and (PUBLIC/item['file']).is_file():return name,True,'Already imported'
  if args.from_dir:
   candidates=[f for f in args.from_dir.iterdir() if f.stem in (name,item['id']) and f.is_file()]
   if not candidates:raise ValueError('No exported file found')
   b=candidates[0].read_bytes()
  else:
   req=urllib.request.Request('https://assetdelivery.roblox.com/v1/asset/?id='+item['id'],headers={'User-Agent':'Roblox/WinInet'})
   with urllib.request.urlopen(req,timeout=20) as r:b=r.read(32*1024*1024+1)
  if b.startswith(b'\x1f\x8b'):b=gzip.decompress(b)
  if len(b)>32*1024*1024:raise ValueError('Asset exceeds 32 MiB')
  ext=media_type(b,kind);dest=('sounds/roblox/' if kind=='audio' else 'images/sunshine/')+item['id']+ext
  target=PUBLIC/dest;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);item['file']=dest
  return name,True,'Imported'
 except urllib.error.HTTPError as e:return name,False,'HTTP '+str(e.code)
 except Exception as e:return name,False,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(fetch,entries))
# Assets sharing an ID reuse the same successfully imported local file.
resolved={item['id']:item['file'] for _,item,_ in entries if item.get('file')}
for _,item,_ in entries:
 if item['id'] in resolved:item['file']=resolved[item['id']]
(PUBLIC/'roblox-assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
(PUBLIC/'roblox-assets.js').write_text('export const robloxAssets='+json.dumps(manifest,separators=(',',':'))+';\n')
loading=json.loads((PUBLIC/'source-manifest.json').read_text())
for _,item,_ in entries:
 if item.get('file') and item['file'] not in loading['files']:loading['files'].append(item['file'])
loading['files'].sort();(PUBLIC/'source-manifest.json').write_text(json.dumps(loading,indent=2)+'\n')
report={'results':[{'name':n,'available':ok,'status':reason} for n,ok,reason in results]}
(ROOT/'docs/ROBLOX_ASSET_IMPORT.json').write_text(json.dumps(report,indent=2)+'\n')
for n,ok,reason in results:print(n+': '+reason,flush=True)
