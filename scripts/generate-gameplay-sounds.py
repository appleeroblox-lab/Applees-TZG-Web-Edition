"""Original short foley-style effects; no Minecraft sound recordings are used."""
from pathlib import Path
import random, math, wave, struct, json, sys
root=Path(__file__).resolve().parents[1]/'public'/'sounds'
rate=22050
rng=random.Random(580)
def save(name, samples):
 if '--grass-only' in sys.argv and name not in {'step-grass','jump-grass','land-grass'}:return
 peak=max(.01,max(map(abs,samples)))
 with wave.open(str(root/(name+'.wav')),'wb') as f:
  f.setparams((1,2,rate,len(samples),'NONE','not compressed'))
  f.writeframes(struct.pack('<'+'h'*len(samples),*[int(max(-1,min(1,s/peak*.75))*32767) for s in samples]))
for material in ['grass','sand','snow','water','wood','stone']:
 for event in ['step','jump','land']:
  duration=({'step':.40,'jump':.26,'land':.62} if material=='water' else {'step':.32,'jump':.23,'land':.48} if material=='snow' else {'step':.19,'jump':.13,'land':.28})[event];a=[];low=0;deep=0;crackle=0
  for i in range(int(rate*duration)):
   t=i/rate;n=rng.uniform(-1,1);low+=({'grass':.09,'sand':.15,'snow':.06,'water':.075,'wood':.035,'stone':.06}[material])*(n-low);deep+=.006*(n-deep)
   if material=='water':
    # Two splashing packets plus quiet damped bubbles, rather than a generic boot thud.
    packet=lambda start,width: math.exp(-(t-start)/width)*min(1,(t-start)/.005) if t>=start else 0
    swell=packet(.006,.065)+.65*packet(.11,.10)+.3*packet(.21,.09)
    bubble=math.sin(2*math.pi*(320*t-180*t*t))*math.exp(-t*22)*.045
    value=(low*.7+(n-low)*.14+deep*.7)*swell+bubble
   elif material=='grass':
    attack=min(1,t/.016);env=attack*math.exp(-t/.042)
    boot=math.sin(2*math.pi*92*t)*math.exp(-t*42)*.045
    value=(low*.7+deep*.8)*env+boot*attack
   elif material=='snow':
    # Compacted granular crunch: a longer squeeze and many soft crackle transients.
    crackle*=.84
    if rng.random()<.0018:crackle+=rng.uniform(-1,1)
    squeeze=math.sin(min(1,t/duration)*math.pi)**.7
    env=min(1,t/.008)*math.exp(-t/ .11)
    value=((n-low)*.14*squeeze+low*.5+crackle*.6+deep*.5)*env
   else:
    env=min(1,t/.006)*math.exp(-t/.03)
    value=(low*.5+(n-low)*({'grass':.12,'sand':.2,'wood':.04,'stone':.13}[material]))*env
   a.append(value)
  save(event+'-'+material,a)
for name,duration in [('place',.16),('delete',.22),('tnt-fuse',4),('tnt-explosion',1.3)]:
 a=[];low=0
 for i in range(int(rate*duration)):
  t=i/rate;n=rng.uniform(-1,1);low+=.018*(n-low)
  if name=='tnt-fuse':s=(n-low)*.09*min(1,t/.025)*min(1,(duration-t)/.06)*(1+.2*math.sin(t*43))
  elif name=='tnt-explosion':s=(low*5*math.exp(-t*5)+(n-low)*.3*math.exp(-t*10))*min(1,t/.003)
  else:s=(low*3+(n-low)*(.15 if name=='delete' else .035))*math.exp(-t*(25 if name=='place' else 18))*min(1,t/.004)
  a.append(s)
 save(name,a)
p=root/'SOURCES.json';data=json.loads(p.read_text());data['generated_gameplay']={'author':'Applee game project','generator':'scripts/generate-gameplay-sounds.py','license':'Original project audio','description':'Foley-style noise textures, fuse hiss and bass explosion; no Minecraft recordings.'};p.write_text(json.dumps(data,indent=2)+'\n')
