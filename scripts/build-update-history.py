"""Build public history from recoverable documentation and actual release commits."""
import json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True,stderr=subprocess.DEVNULL)
readme=(root/'README.md').read_text();entries={}
# Explicit historical headings and version paragraphs, preserved in the imported README.
markers=[]
for m in re.finditer(r'(?m)^#{1,3}[^\n]*(?:\bv(\d+)\b|Edition (\d+)\b)[^\n]*|^Version (\d+)\b[^\n]*',readme):
 n=int(next(v for v in m.groups() if v));markers.append((m.start(),m.end(),n,m.group()))
for i,(start,end,n,title) in enumerate(markers):
 stop=min([pos for pos,_,_,_ in markers if pos>start]+[len(readme)])
 body=readme[end:stop].strip() if title.startswith('#') else readme[start:stop].strip()
 # Keep the first descriptive paragraph, without tests or claims from later unnumbered revisions.
 paragraph=next((p for p in re.split(r'\n\s*\n',body) if p.strip() and not p.startswith('Validation:')),'')
 paragraph=re.sub(r'\s+',' ',paragraph).strip('- ')
 if paragraph:entries[n]={'legacyVersion':n,'version':f'v0.0.{n}','title':re.sub(r'^#+\s*|^Version \d+\s*','',title).strip()[:120] if title.startswith('#') else f'World and gameplay update {n}','changes':[paragraph],'source':{'path':'README.md','kind':'historical documentation'}}
# v14 and v6 are explicitly identified within otherwise unnumbered sections.
for n,heading in [(14,'# The Zero Gravity - Web — Reference HUD / Model Rework'),(6,'# The Zero Gravity - Web — Surface Edition 6')]:
 start=readme.index(heading)+len(heading);text=readme[start:].strip().split('\n\n')[0]
 entries[n]={'legacyVersion':n,'version':f'v0.0.{n}','title':'Reference HUD and Blender models' if n==14 else 'Surface launch and landing','changes':[re.sub(r'\s+',' ',text)],'source':{'path':'README.md','kind':'historical documentation'}}
# Cache versions 91 remained unchanged through several named releases: prefer the explicit commit version.
for sha in git('rev-list','--reverse','HEAD').splitlines():
 subject=git('show','-s','--format=%s',sha).strip()
 if subject.startswith('Merge '):continue
 explicit=re.search(r'\bv(\d+)\b',subject)
 try:n=int(json.loads(git('show',sha+':public/source-manifest.json'))['version'])
 except (subprocess.CalledProcessError,ValueError,KeyError):continue
 if explicit and int(explicit.group(1))>=60:n=int(explicit.group(1))
 # The restore commit calls its archive v61, but its source manifest and README are v59.
 if sha.startswith('ef953e7'):n=59
 # This patch mentions the stale boot version it fixed, not its release number.
 if sha.startswith('07faad9'):n=102
 if n<59:continue
 date=git('show','-s','--format=%cs',sha).strip()
 description=re.sub(r'\s*\(v\d+\)|^v\d+:\s*','',subject)
 entry=entries.setdefault(n,{'legacyVersion':n,'version':f'v0.0.{n}','title':description,'changes':[]})
 if n==59 and entry['changes']:continue
 entry.update({'title':description,'date':date,'source':{'commit':sha,'kind':'Git history'}})
 if description not in entry['changes']:entry['changes'].append(description)
entries[102]={'legacyVersion':102,'version':'v0.0.102','date':'2026-10-27','title':'Update history, full game screenshots and legacy cleanup','changes':['Added the Update Logs menu with recoverable release history and consistent semantic version labels.','Screenshots now capture the game viewport with HUD, controls, chat and open menus.','Removed legacy installation overlays and generated asteroid/hash labels across world, sky and map paths.','Corrected the HTML entrypoint still loading the legacy v0.0.100 boot module; startup now reads fresh release metadata and imports the matching game revision.'],'source':{'kind':'current release'}}
entries[103]={'legacyVersion':103,'version':'v0.0.103','date':'2026-10-27','title':'I polished the release and added phone notification support','changes':['I centered and cleaned up Update Logs on phones and computers.','I added distance fog to hide terrain edges on airless worlds.','I fixed the unnecessary exploration error in the account menu.','I removed saved places from More. Entering free camera now costs 100 RC.','I added separate phone notification settings: global chat is off by default; party chats and friend requests are on.','I added a pending friend-request count and message-style request sounds. Closed-game notifications require the push backend and browser permission.'],'source':{'kind':'current release'}}
for entry in entries.values():
 entry['changes']=[re.sub(r"Applee[’']s\s*",'my ',text) for text in entry['changes']]
 entry['title']=re.sub(r'\bv(\d+)\b',r'v0.0.\1',re.sub(r"Applee[’']s\s*",'My ',entry['title']))
data={'currentVersion':'v0.0.103','legacyMapping':'Legacy source N is displayed as v0.0.N.','historyNote':'The earliest separately documented release is v0.0.3. Original creation notes and separate entries for v0.0.1–v0.0.2, v0.0.9–v0.0.13 and v0.0.18–v0.0.22 are not recoverable from this repository. The first Git import on 25 October 2026 already contained earlier development. Historical features may be replaced by later updates.','entries':sorted(entries.values(),key=lambda e:e['legacyVersion'],reverse=True)}
(root/'public/update-history.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(len(entries),'documented releases, earliest',min(entries))
