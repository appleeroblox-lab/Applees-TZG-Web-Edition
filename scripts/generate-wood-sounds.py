"""Generate original, deterministic saw rasp and wood-crack effects; encode with ffmpeg."""
import math, random, struct, subprocess, tempfile, wave
from pathlib import Path
root=Path(__file__).resolve().parents[1]
rate=32000
for name,duration in [('tree-cut',.38),('tree-fall',.62)]:
 rng=random.Random(360 if name=='tree-cut' else 361);samples=[];filtered=0.;prev=0.
 for i in range(int(rate*duration)):
  t=i/rate;noise=rng.uniform(-1,1);filtered=.72*filtered+.28*noise
  if name=='tree-cut':
   rasp=noise-filtered;pulse=.25+.75*abs(math.sin(t*math.pi*47));env=min(1,t/.018)*max(0,1-t/duration)**.65
   s=(rasp*.7*pulse+math.sin(2*math.pi*174*t)*.09)*env
  else:
   crack=sum(math.exp(-(t-start)*55) for start in [0,.052,.11,.19,.29] if t>=start);env=max(0,1-t/duration)
   s=(filtered*.7*crack+math.sin(2*math.pi*(90-40*t)*t)*math.exp(-t*12)*.25)*env
  samples.append(max(-.95,min(.95,s))*.8)
 with tempfile.TemporaryDirectory() as tmp:
  wav=Path(tmp)/'wood.wav'
  with wave.open(str(wav),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(b''.join(struct.pack('<h',round(s*32767)) for s in samples))
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libvorbis','-q:a','4',str(root/'dist/sounds'/f'{name}.ogg')],check=True)
