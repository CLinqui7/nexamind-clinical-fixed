"""Original, deterministic instrumental bed; no voices or third-party samples.

Writes only the explicitly supplied WAV path. Pads and soft electric-piano notes
follow a slow major-key progression. Circular tails make the 64-second bed loop.
"""
import sys
import wave
from pathlib import Path
import numpy as np

rate=24000
seconds=64
tail=12
length=(seconds+tail)*rate
track=np.zeros((length,2),dtype=np.float64)
rng=np.random.default_rng(20261028)
chords=[(50,[62,66,69,73,76]),(47,[59,62,66,69,74]),
        (43,[59,62,66,69,74]),(45,[61,64,69,71,76])]

def add_note(start,midi,duration,level,piano=False,pan=0.5):
    n=int(duration*rate)
    t=np.arange(n)/rate
    f=440*2**((midi-69)/12)
    if piano:
        env=(1-np.exp(-t/0.024))*np.exp(-t/1.65)
        env*=np.minimum(1,(duration-t)/0.8)
        tone=np.sin(2*np.pi*f*t)+0.17*np.sin(2*np.pi*2*f*t)*np.exp(-t/0.8)+0.035*np.sin(2*np.pi*3*f*t)*np.exp(-t/0.4)
        note=tone*env*level
        stereo=np.column_stack((note*np.sqrt(1-pan),note*np.sqrt(pan)))
    else:
        env=np.sin(np.pi*np.minimum(t/2.4,1)/2)**2*np.sin(np.pi*np.minimum((duration-t)/3.5,1)/2)**2
        phase=rng.random()*2*np.pi
        left=(np.sin(2*np.pi*f*0.9997*t+phase)+0.10*np.sin(2*np.pi*2*f*t+phase))*env*level
        right=(np.sin(2*np.pi*f*1.0003*t+phase)+0.10*np.sin(2*np.pi*2*f*t+phase))*env*level
        stereo=np.column_stack((left,right))
    at=int(start*rate)
    end=min(length,at+n)
    track[at:end]+=stereo[:end-at]

for bar in range(16):
    root,notes=chords[bar%4]
    start=bar*4
    add_note(start,root,8,0.026)
    for note in notes[:4]:
        add_note(start,note,9,0.014)
    add_note(start+0.4,notes[bar%len(notes)],5.5,0.060,True,0.32)
    add_note(start+2.5,notes[(bar+2)%len(notes)],5.5,0.042,True,0.68)

loop=track[:seconds*rate].copy()
loop[:tail*rate]+=track[seconds*rate:]
dry=loop.copy()
for delay,gain in [(0.173,0.13),(0.293,0.10),(0.421,0.08),(0.637,0.06),(1.019,0.04)]:
    loop+=np.roll(dry,int(delay*rate),axis=0)[:,::-1]*gain
loop-=loop.mean(axis=0)
loop*=0.28/max(np.abs(loop).max(),1e-9)
output=Path(sys.argv[1])
output.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(output),'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(rate)
    wav.writeframes((np.clip(loop,-1,1)*32767).astype('<i2').tobytes())
print(f'ORIGINAL_INSTRUMENTAL_OK {seconds}s stereo; no voice input')
