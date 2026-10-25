import urllib.request,urllib.error,json,concurrent.futures,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];src=json.loads((ROOT/'assets/roblox/planet-asset-ids.json').read_text());aliases={'Actena':'Actaea','Scalacia':'Salacia'}
u='https://thumbnails.roblox.com/v1/assets?assetIds='+','.join(src.values())+'&size=420x420&format=Png&isCircular=false'
with urllib.request.urlopen(u,timeout=30) as r:data=json.load(r)
(ROOT/'assets/roblox/thumbnail-response.json').write_text(json.dumps(data,indent=2))
lookup={str(d['targetId']):d for d in data['data']};(ROOT/'public/textures/roblox').mkdir(exist_ok=True)
def download(row):
 supplied,aid=row;name=aliases.get(supplied,supplied);record={'name':name,'suppliedName':supplied,'assetId':aid,'texture':None,'downloadKind':'public-preview'};d=lookup.get(aid,{})
 if d.get('state')!='Completed' or not d.get('imageUrl'):record['error']=d.get('state','No thumbnail result');return record
 for attempt in range(2):
  try:
   with urllib.request.urlopen(d['imageUrl'],timeout=25) as r:b=r.read()
   path=ROOT/'public/textures/roblox'/(''.join(c if c.isalnum() else '-' for c in name.lower())+'.png');path.write_bytes(b)
   with Image.open(path) as im:
    im.verify()
   with Image.open(path) as im:w,h=im.size
   record.update(texture='roblox/'+path.name,width=w,height=h,sha256=hashlib.sha256(b).hexdigest());return record
  except Exception as e:record['error']=type(e).__name__+': '+str(e)[:120]
 return record
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for r in pool.map(download,src.items()):
  rows.append(r);print(r['name'],r.get('texture') or r.get('error'),str(r.get('width',''))+'x'+str(r.get('height','')),flush=True)
(ROOT/'assets/roblox/texture-download-report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(ROOT/'public/roblox-texture-assets.js').write_text('// Applee-selected Roblox assets; downloaded public preview images, not full-resolution originals.\nexport const robloxTextureAssets='+json.dumps(rows,ensure_ascii=False,indent=2)+';\n')
print('Downloaded',sum(bool(r['texture']) for r in rows),'of',len(rows),flush=True)
