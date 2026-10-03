import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:4173',browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
const login=async role=>{await page.locator('input[type=email]').fill(`${role}@example.invalid`);await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Pacientes',exact:true}).waitFor();};
const openHistorical=async()=>{await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('button',{name:'Todos',exact:true}).click();await page.locator('[data-tour="patients-search"]').fill('Paciente histórico QA');await page.waitForTimeout(450);await page.getByText('Paciente histórico QA',{exact:true}).click();};
const logout=async()=>{await page.locator('.profile-chip-button').click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).waitFor();};
try{
 const seeded=await page.request.post(`${base}/__qa`,{data:{control:true,seedLegacy:true}});assert.equal(seeded.ok(),true);
 await page.goto(base);await login('owner');await openHistorical();await page.getByRole('tab',{name:'Sistema anterior',exact:true}).click();
 await page.getByText('Contenido clínico sintético de sistema anterior',{exact:true}).waitFor();await page.getByText('Movimiento histórico QA',{exact:true}).waitFor();assert.equal(await page.getByText('0 años',{exact:true}).count(),0);await page.getByText(/Edad no registrada/).first().waitFor();
 await page.reload();await openHistorical();await page.getByRole('tab',{name:'Sistema anterior',exact:true}).click();await page.getByText('Contenido clínico sintético de sistema anterior',{exact:true}).waitFor();
 await logout();await login('secretary');await openHistorical();await page.getByText('Ficha administrativa histórica',{exact:true}).waitFor();await page.getByText('Movimiento histórico QA',{exact:true}).waitFor();assert.equal(await page.getByText('Contenido clínico sintético de sistema anterior',{exact:true}).count(),0);assert.equal(await page.getByRole('tab',{name:'Sistema anterior',exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:7,checks:['historical patient appears in patient list','unknown age renders explicitly','owner opens clinical and administrative legacy history','history remains accessible after reload','secretary opens administrative history','secretary cannot see clinical legacy text','browser emitted no runtime errors'],scope:'Playwright + isolated PostgreSQL; synthetic history only; no production writes'},null,2));
}finally{await browser.close();}
