import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {LEARNING_CHAPTERS} from '../../src/learning-content.js';
import {timedLearningScenes} from '../../src/domain/learning-scenes.js';
const base='http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('/__qa')&&r.method()==='POST'&&r.postDataJSON()?.name?.includes('save'))writes.push(r.postDataJSON().name)});
const ready=async()=>page.waitForFunction(()=>{const v=document.querySelector('video.training-video');return v?.readyState>=1&&v.querySelector('track')?.readyState===2});
const check=async(c)=>{
 await ready();const player=page.getByTestId('learning-video-player'),video=player.locator('video'),copy=player.locator('.learning-video-copy'),scenes=timedLearningScenes(c);
 assert.equal(await player.getByLabel('Elegir paso del video').locator('option').count(),scenes.length);
 assert.equal(await video.evaluate(v=>v.paused),true,'Never autoplay');
 assert.ok(Math.abs(await video.evaluate(v=>v.volume)-0.35)<0.01);
 assert.equal(await copy.textContent(),scenes[0].text);
 await player.getByRole('button',{name:'Silenciar música',exact:true}).click();assert.equal(await video.evaluate(v=>v.muted),true);
 await player.getByRole('button',{name:'Activar música',exact:true}).click();assert.equal(await video.evaluate(v=>v.muted),false);
 await video.evaluate(v=>{v.volume=0});await player.getByRole('button',{name:'Activar música',exact:true}).click();assert.ok(await video.evaluate(v=>v.volume)>0);assert.equal(await video.evaluate(v=>v.muted),false);
 for(const i of [2,scenes.length-2,scenes.length-1]){
  await player.getByLabel('Elegir paso del video').selectOption(String(i));
  await page.waitForFunction(({start})=>Math.abs(document.querySelector('video').currentTime-start)<0.1,{start:scenes[i].start});
  assert.equal(await copy.textContent(),scenes[i].text);assert.equal(await video.evaluate(v=>v.paused),true);
 }
 await player.getByRole('button',{name:'Paso anterior',exact:true}).click();assert.equal(await copy.textContent(),scenes.at(-2).text);
 await player.getByRole('button',{name:'Paso siguiente',exact:true}).click();assert.equal(await copy.textContent(),scenes.at(-1).text);
 assert.equal(await player.getByRole('button',{name:'Paso siguiente',exact:true}).isDisabled(),true);
 // Native seeking and normal playback across a boundary must also update text.
 await video.evaluate((v,t)=>{v.currentTime=t;},scenes[2].start-0.6);
 await page.waitForFunction(()=>!document.querySelector('video').seeking);
 await video.evaluate(v=>v.play());
 await page.waitForFunction(text=>document.querySelector('.learning-video-copy').textContent===text,scenes[2].text);
 await video.evaluate(v=>v.pause());
};
try{
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Tutorial de acceso e invitaciones',exact:true}).click();
 await page.getByRole('tab',{name:'Video con texto',exact:true}).click();await check(LEARNING_CHAPTERS.find(c=>c.id==='acceso'));
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByLabel('Correo',{exact:true}).fill('owner@example.invalid');await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Ayuda',exact:true}).click();
 for(const c of LEARNING_CHAPTERS){await page.locator(`[data-chapter-id="${c.id}"]`).click();await page.getByRole('tab',{name:'Video con texto',exact:true}).click();await check(c);console.log('READING_PLAYER_OK '+c.id)}
 await page.getByRole('tab',{name:'Video de esta pantalla',exact:true}).click();await ready();
 for(const width of [1440,800,390]){
  await page.setViewportSize({width,height:1000});const player=page.getByTestId('learning-video-player');await player.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  const boxes=await player.evaluate(p=>{const a=p.querySelector('video').getBoundingClientRect(),b=p.querySelector('.learning-video-reading').getBoundingClientRect();return {side:b.left>=a.right,below:b.top>=a.bottom}});
  assert.equal(width>760?boxes.side:boxes.below,true);await page.screenshot({path:`qa/results/reading-video-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 await fs.writeFile('qa/results/reading-video.json',JSON.stringify({chapters:32,publicAccess:true,textMatchesControls:true,selectionAndPlaybackSync:true,quietMusicAndMute:true,desktopTabletMobile:true,noPatientWrites:true},null,2));
 console.log('READING_VIDEO_ALL_OK');
}finally{await browser.close()}
