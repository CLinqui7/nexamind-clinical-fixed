import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
const manifest=JSON.parse(await fs.readFile('public/tutorials/pages/manifest.json','utf8'));
assert.equal(manifest.narration,false);assert.equal(manifest.mode,'reading-music');
const ffmpeg=spawnSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).stdout.trim();
const audio=file=>{const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-i',file,'-ss','3','-t','10','-vn','-ac','1','-ar','24000','-f','f32le','pipe:1'],{maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stderr?.toString());return r.stdout};
const reference=audio('public'+manifest.music.file);
const compareMusic=file=>{const data=audio(file);assert.equal(data.length,reference.length);let dot=0,power=0,refPower=0;for(let i=0;i<data.length;i+=4){const a=data.readFloatLE(i),b=reference.readFloatLE(i);dot+=a*b;power+=a*a;refPower+=b*b}const correlation=dot/Math.sqrt(power*refPower),rmsDb=10*Math.log10(power/(data.length/4));assert.ok(correlation>0.98,`Audio differs from instrumental: ${file} (${correlation})`);assert.ok(rmsDb>-45&&rmsDb<-18,`Music level ${rmsDb}`);return {correlation,rmsDb}};
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();const result=[];
try{
 await page.goto('http://127.0.0.1:4173');await page.setContent('<video controls muted width="640"></video>');
 for(const c of LEARNING_CHAPTERS){const meta=manifest.chapters.find(x=>x.id===c.id);assert.equal(meta.sha256,crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),'Stale video: '+c.id);assert.equal(meta.controls,c.controls.length);
  const media=await page.evaluate(async c=>{const video=document.querySelector('video');video.src='http://127.0.0.1:4173'+c.video;await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('video cannot load'));setTimeout(()=>reject(Error('metadata timeout')),10000)});const duration=video.duration;await video.play();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('playback did not advance')),5000);video.ontimeupdate=()=>{if(video.currentTime>0){clearTimeout(timer);resolve()}}});video.ontimeupdate=null;video.pause();const played=video.currentTime;video.currentTime=duration-1;await new Promise((resolve,reject)=>{video.onseeked=resolve;setTimeout(()=>reject(Error('seek timeout')),10000)});return {duration,played,ready:video.readyState,width:video.videoWidth}},c);
  assert.ok(media.duration>60&&media.played>0&&media.ready>=2&&media.width===1280,c.id);
  const decoded=spawnSync(ffmpeg,['-hide_banner','-i','public'+c.video,'-t','0.1','-f','null','-'],{encoding:'utf8'});assert.equal(decoded.status,0);assert.match(decoded.stderr,/Audio: aac/);assert.match(decoded.stderr,/Video: h264/);
  assert.ok(Math.abs(media.duration-meta.seconds)<0.2,'Reading timings differ '+c.id);
  const music=compareMusic('public'+c.video);
  const captions=await fs.readFile('public'+c.captions,'utf8');assert.ok(captions.startsWith('WEBVTT'));assert.ok(captions.includes('-->'));result.push({id:c.id,seconds:media.duration,controls:c.controls.length,audio:true,musicOnly:music,captions:true,playback:true,endSeek:true});
 }
 await fs.writeFile('qa/results/page-videos-verified.json',JSON.stringify(result,null,2));console.log('ALL_PAGE_VIDEOS_VERIFIED '+result.length);
}finally{await browser.close()}
