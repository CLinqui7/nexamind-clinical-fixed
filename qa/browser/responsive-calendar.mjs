import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {chromium,webkit} from 'playwright';

const engine=process.env.LINKARE_BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch(engine===chromium?{channel:process.env.LINKARE_BROWSER||'msedge',headless:true}:{headless:true});
const screenshotDir=process.env.LINKARE_RESPONSIVE_SCREENSHOT_DIR;
if(screenshotDir)mkdirSync(screenshotDir,{recursive:true});
const cases=[['iphone-short',390,664],['iphone-small',320,568],['iphone-landscape',844,390],['samsung-portrait',800,1280],['samsung-landscape',1280,800]];
const checks=[];

try{
  for(const [label,width,height] of cases){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:width<=390?3:2,isMobile:width<=390,hasTouch:width<=800});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(16000);
    await page.goto('http://127.0.0.1:4173');
    await page.locator('input[type=email]').fill('owner@example.invalid');
    await page.locator('input[type=password]').fill('qa-password-123');
    await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();
    await page.locator('.topbar').waitFor();
    const compact=width<=880;
    if(compact){
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
      const nav=page.getByRole('navigation',{name:'Navegación principal'});
      await nav.getByRole('button',{name:'Configuración',exact:true}).waitFor();
      await nav.getByRole('button',{name:'Mi cuenta',exact:true}).waitFor();
      await nav.getByRole('button',{name:'Cerrar sesión',exact:true}).waitFor();
      assert.ok(await page.locator('.mobile-account').isVisible(),`${label}: account shortcut hidden`);
      if(label==='iphone-short'){
        await page.setViewportSize({width,height:480});
        const menuBottom=await nav.evaluate(element=>element.getBoundingClientRect().bottom);
        assert.ok(menuBottom<=481,`${label}: menu extends below Safari-sized viewport (${menuBottom})`);
        await nav.getByRole('button',{name:'Cerrar sesión',exact:true}).scrollIntoViewIfNeeded();
        await page.setViewportSize({width,height});
      }
      if(screenshotDir)await page.screenshot({path:join(screenshotDir,`${label}-menu.png`)});
      await nav.getByRole('button',{name:'Agenda',exact:true}).click();
    }else await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:'Agenda',exact:true}).click();
    await page.locator('.month-grid').waitFor();
    const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,month:document.querySelector('.month-grid').getBoundingClientRect().width,calendar:document.querySelector('.month-calendar').getBoundingClientRect().width}));
    assert.ok(dimensions.document<=dimensions.viewport+1,`${label}: horizontal page overflow ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.month<=dimensions.calendar+1,`${label}: month grid needs sideways scrolling ${JSON.stringify(dimensions)}`);
    if(screenshotDir)await page.screenshot({path:join(screenshotDir,`${label}-month.png`),fullPage:true});
    if(width<=700){
      await page.locator('.calendar-day:not(.outside) .day-number').first().click();
      await page.locator('.day-view').waitFor();
      assert.ok(await page.locator('.day-view').isVisible(),`${label}: day does not open from month`);
      await page.getByRole('button',{name:'Semana',exact:true}).click();
      await page.locator('.week-mobile-day').first().waitFor();
      assert.ok(await page.locator('.week-mobile').isVisible(),`${label}: mobile week list missing`);
      assert.ok(!(await page.locator('.week-calendar').isVisible()),`${label}: tiny desktop week grid still shown`);
      if(screenshotDir)await page.screenshot({path:join(screenshotDir,`${label}-week.png`),fullPage:true});
      await page.getByRole('button',{name:'Mes',exact:true}).click();
    }else if(width<=900){
      await page.getByRole('button',{name:'Semana',exact:true}).click();
      await page.locator('.week-mobile-day').first().waitFor();
      assert.ok(await page.locator('.week-mobile').isVisible(),`${label}: tablet week list missing`);
      assert.ok(!(await page.locator('.week-calendar').isVisible()),`${label}: week grid overflows portrait tablet`);
      if(screenshotDir)await page.screenshot({path:join(screenshotDir,`${label}-week.png`),fullPage:true});
      await page.getByRole('button',{name:'Mes',exact:true}).click();
    }
    if(compact){
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
      await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:'Configuración',exact:true}).click();
      await page.getByRole('heading',{name:'Configuración',exact:true}).waitFor();
      await page.locator('.mobile-account').click();
      await page.getByRole('heading',{name:'Mi cuenta',exact:true}).waitFor();
      await page.getByRole('button',{name:'Cerrar sesión',exact:true}).waitFor();
      await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
      await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).waitFor();
    }
    assert.deepEqual(errors,[],`${label}: browser errors`);
    checks.push(`${label} ${width}×${height}: navigation, calendar and account visible without horizontal overflow`);
    await page.close();
  }
  console.log(JSON.stringify({passed:true,engine:engine===webkit?'WebKit':'Chromium',checks,scope:'React/Vite and isolated PostgreSQL; synthetic identities only'},null,2));
}finally{await browser.close();}
