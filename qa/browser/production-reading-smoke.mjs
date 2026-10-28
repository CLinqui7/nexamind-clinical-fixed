// Public help only: no login, patient reads or clinical writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
import {timedLearningScenes} from '../../src/domain/learning-scenes.js';
const base='https://nexamind-clinical.vercel.app';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await page.request.get(base+'/tutorials/pages/manifest.json');assert.equal(response.status(),200);const m=await response.json();assert.equal(m.version,2);assert.equal(m.narration,false);assert.equal(m.chapters.length,32);
 for(const c of LEARNING_CHAPTERS){const meta=m.chapters.find(x=>x.id===c.id);assert.equal(meta.sha256,crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'));const copy=await page.request.get(base+`/tutorials/pages/${c.id}.json`);assert.equal(copy.status(),200);assert.deepEqual((await copy.json()).scenes,timedLearningScenes(c).map(({narration,...s})=>s));const clip=await page.request.get(base+c.video+'?v=reading-music-2',{headers:{Range:'bytes=0-1023'}});assert.equal(clip.status(),206);assert.equal((await clip.body()).length,1024)}
 await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Tutorial de acceso e invitaciones',exact:true}).click();await page.getByRole('tab',{name:'Video con texto',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1&&document.querySelector('video track')?.readyState===2);
 const player=page.getByTestId('learning-video-player'),video=player.locator('video');assert.equal(await video.evaluate(v=>v.paused),true);assert.equal(await video.evaluate(v=>v.volume),0.35);
 await player.getByRole('button',{name:'Paso siguiente',exact:true}).click();const scene=timedLearningScenes(LEARNING_CHAPTERS[0])[1];assert.equal(await player.locator('.learning-video-copy').textContent(),scene.text);assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-scene.start)<0.1);
 await player.getByRole('button',{name:'Silenciar música',exact:true}).click();assert.equal(await video.evaluate(v=>v.muted),true);await video.evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('video').currentTime>1);await video.evaluate(v=>v.pause());
 await page.setViewportSize({width:390,height:844});await player.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:'qa/results/production-reading-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 await fs.writeFile('qa/results/production-reading.json',JSON.stringify({base,chapters:32,allLiveCopiesAndRanges:true,narration:false,publicPlayerAndCaptions:true,mute:true,mobile:true},null,2));console.log('PRODUCTION_READING_SMOKE_OK 32 chapters');
}finally{await browser.close()}
