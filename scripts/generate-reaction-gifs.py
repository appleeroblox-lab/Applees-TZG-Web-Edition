"""Original animated reaction stickers, generated for TZG; no external assets."""
from PIL import Image, ImageDraw, ImageFont
import math, json
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'public'/'gifs'
out.mkdir(exist_ok=True)
names=['wave','happy','dance','laugh','think','smile','clap','shrug','sleep','facepalm','thumbsup','nod','confused','salute','wink','spin','love','cry','angry','shocked','rocket','party','hello','thanks']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',17)
for index,name in enumerate(names):
 frames=[]
 for t in range(12):
  im=Image.new('RGB',(160,144),(12,56,85)); d=ImageDraw.Draw(im); p=t*math.tau/12; y=54+int(math.sin(p)*5)
  color=(105,215,245) if index%2 else (255,211,91)
  d.ellipse((43,y-32,117,y+42),fill=color,outline=(228,251,255),width=3)
  if name in ['laugh','happy','smile','party']:
   d.arc((57,y-6,73,y+9),180,355,fill=(15,53,77),width=3);d.arc((87,y-6,103,y+9),180,355,fill=(15,53,77),width=3)
  else:
   d.ellipse((61,y,67,y+8),fill=(15,53,77)); d.ellipse((93,y,99,y+8),fill=(15,53,77))
  if name in ['cry','shocked','confused','think']:
   d.ellipse((74,y+19,86,y+30),fill=(15,53,77))
  else:d.arc((65,y+9,95,y+31),0,180,fill=(15,53,77),width=4)
  for k in range(4):
   a=p+k*math.pi/2; x=80+math.cos(a)*58; z=y+5+math.sin(a)*43
   d.ellipse((x-3,z-3,x+3,z+3),fill=(157,237,255))
  if name in ['wave','hello','salute','thanks','thumbsup','clap']:
   x=127+int(math.sin(p)*8); d.line((111,y+21,x,y-1),fill=color,width=7);d.ellipse((x-6,y-13,x+6,y+3),fill=color)
  if name=='cry':d.ellipse((62,y+10+int(t%4)*3,68,y+22+int(t%4)*3),fill=(65,159,250))
  if name=='love':
   d.ellipse((68,y-24,80,y-12),fill=(245,85,134));d.ellipse((79,y-24,91,y-12),fill=(245,85,134));d.polygon([(68,y-17),(91,y-17),(80,y-5)],fill=(245,85,134))
  label=name.upper();box=d.textbbox((0,0),label,font=font);d.text(((160-box[2])/2,117),label,font=font,fill=(230,250,255))
  frames.append(im)
 frames[0].save(out/(name+'.gif'),save_all=True,append_images=frames[1:],duration=85,loop=0,optimize=True)
print('Generated',len(names),'original animated GIFs:',sum(p.stat().st_size for p in out.glob('*.gif')),'bytes')
