import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.LINKARE_QA_URL||'http://127.0.0.1:4173',browser=await chromium.launch({channel:process.env.LINKARE_BROWSER||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
const login=async role=>{await page.locator('input[type=email]').fill(`${role}@example.invalid`);await page.locator('input[type=password]').fill('qa-password-123');await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).click();await page.getByRole('button',{name:'Pacientes',exact:true}).waitFor();};
const openHistorical=async()=>{await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('button',{name:'Todos',exact:true}).click();await page.locator('[data-tour="patients-search"]').fill('Paciente histórico QA');await page.waitForTimeout(450);await page.getByText('Paciente histórico QA',{exact:true}).click();};
const logout=async()=>{await page.locator('.profile-chip-button').click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Ingresar a Linkare',exact:true}).waitFor();};
try{
 const seeded=await page.request.post(`${base}/__qa`,{data:{control:true,seedLegacy:true}});assert.equal(seeded.ok(),true);
 await page.goto(base);await login('owner');await openHistorical();await page.getByText('Los datos de contacto y medicamentos históricos están conservados',{exact:true}).waitFor();await page.getByRole('button',{name:'Abrir datos e historia de FoxPro',exact:true}).click();
 await page.getByText('Contenido clínico sintético de sistema anterior',{exact:false}).waitFor();await page.getByText('Movimiento histórico QA',{exact:true}).waitFor();assert.equal(await page.getByText('0 años',{exact:true}).count(),0);await page.getByText(/Edad no registrada/).first().waitFor();
 await page.getByText('2 registro(s) visibles',{exact:true}).waitFor();
 await page.reload();await openHistorical();await page.getByRole('tab',{name:'Sistema anterior',exact:true}).click();await page.getByText('Contenido clínico sintético de sistema anterior',{exact:false}).waitFor();
 await page.getByText('Movimientos marcados como consulta',{exact:true}).waitFor();await page.getByText('Último movimiento marcado como consulta',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Medicamentos',exact:true}).click();await page.getByText('Medicamentos históricos importados',{exact:true}).waitFor();await page.getByRole('heading',{name:'SyntheticMed'}).waitFor();await page.getByText('Menciones de medicamentos en FoxPro',{exact:true}).waitFor();
 await page.getByText('Sin tratamientos actuales registrados',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Verificar medicamento'}).first().click();
 await page.getByText('Esto no prueba que el paciente lo use hoy.',{exact:false}).waitFor();
 assert.equal(await page.getByLabel('Dosis actual').inputValue(),'');
 await page.getByLabel('Dosis actual').fill('1-0-1');
 await page.getByLabel('Unidad').selectOption('tableta(s)');
 await page.getByLabel('Frecuencia actual').selectOption('dos veces al día');
 await page.getByLabel('Vía actual').selectOption('oral');
 await page.getByLabel(/Sí, verifiqué con el paciente/).check();
 await page.getByRole('button',{name:'Sí, incorporar medicamento'}).click();
 await page.getByText('Medicamento confirmado e incorporado',{exact:false}).waitFor();
 await page.reload();await openHistorical();await page.getByRole('tab',{name:'Medicamentos',exact:true}).click();
 await page.getByText('1-0-1 tableta(s)',{exact:true}).first().waitFor();
 await logout();await login('secretary');await openHistorical();await page.getByText('Ficha administrativa histórica',{exact:true}).waitFor();await page.getByText('Movimiento histórico QA',{exact:true}).waitFor();assert.equal(await page.getByText('Contenido clínico sintético de sistema anterior',{exact:false}).count(),0);assert.equal(await page.getByRole('tab',{name:'Sistema anterior',exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:13,checks:['historical patient appears in patient list','historical data shortcut is visible from overview','unknown age renders explicitly','owner opens clinical and administrative legacy history','history remains accessible after reload','source-labelled visit summary appears','historical medication mention is displayed without inventing current treatment','doctor explicitly confirms current dose and route','confirmed medicine survives browser reload','secretary opens administrative history','secretary cannot see clinical legacy text','secretary cannot review historical medicine','browser emitted no runtime errors'],scope:'Playwright + isolated PostgreSQL; synthetic history only; no production writes'},null,2));
}finally{await browser.close();}
