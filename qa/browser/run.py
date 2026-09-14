"""Real Chromium UI checks with real React/HTM, synthetic test data and mocked Supabase.
No credentials, network calls, invitations or charges are sent to external systems.
"""
from pathlib import Path
import os,runpy,json,traceback
from playwright.sync_api import sync_playwright,expect
BASE=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('LINKARE_QA_OUTPUT','qa-results'));OUT.mkdir(exist_ok=True,parents=True)
markup=runpy.run_path(str(Path(__file__).with_name('inline-harness.py')))['html']()
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox'])
 def page(role=None,width=1440):
  p=browser.new_page(viewport={'width':width,'height':1000 if width>600 else 812});p.set_default_timeout(5000);p.errors=[];p.on('pageerror',lambda e:p.errors.append(str(e)));p.set_content(markup);expect(p.get_by_role('button',name='Ingresar a Linkare')).to_be_visible()
  if role:
   p.locator('input[type=email]').fill(role+'@example.invalid');p.locator('input[type=password]').fill('Strong-Password-123!');p.get_by_role('button',name='Ingresar a Linkare').click();expect(p.locator('.topbar')).to_be_visible();p.wait_for_timeout(100)
  return p
 def run(name,fn):
  try:fn();results.append({'test':name,'passed':True});print('PASS',name,flush=True)
  except Exception as e:results.append({'test':name,'passed':False,'error':str(e)[:1200]});print('FAIL',name,str(e)[:300],flush=True)
 def login_screen():
  p=page();text=p.locator('body').inner_text().lower();assert all(x not in text for x in ['demo','nexamind2026','agenda2026','doctora@nexamind']);p.screenshot(path=str(OUT/'login.png'),full_page=True);assert not p.errors;p.close()
 run('login sin cuentas públicas o credenciales de prueba',login_screen)
 def password_recovery():
  p=page();p.get_by_role('button',name='Olvidé mi contraseña').click();p.locator('input[type=email]').fill('doctor@example.invalid');p.get_by_role('button',name='Enviar enlace').click();expect(p.get_by_text('Si el correo tiene cuenta',exact=False)).to_be_visible();assert p.evaluate("__QA.calls.some(c=>c.auth==='recover')");assert not p.errors;p.close()
 run('recuperación de contraseña por correo',password_recovery)
 def registration():
  p=page();p.get_by_role('button',name='Crear consultorio').click();d=p.locator('.registration-form, .login-form').last
  inputs=p.locator('input');print('registration inputs',inputs.count(),flush=True)
  # Use explicit labels from the real registration form.
  p.get_by_label('Nombre completo',exact=False).fill('Doctor QA');p.get_by_label('Clínica o consultorio',exact=False).fill('Consultorio QA')
  p.get_by_label('Correo',exact=True).fill('new@example.invalid');p.get_by_label('Contraseña',exact=True).fill('Strong-Password-123!');p.get_by_label('Confirmar contraseña',exact=True).fill('Strong-Password-123!')
  p.locator('button[type=submit]').click();expect(p.get_by_text('Revise su correo',exact=False)).to_be_visible();assert p.evaluate("__QA.calls.some(c=>c.auth==='signup'&&c.metadata.clinic_name==='Consultorio QA'&&!c.metadata.role)");assert not p.errors;p.close()
 run('registro real llama a Auth sin elegir privilegios',registration)
 def doctor_views():
  p=page('doctor');
  for label in ['Pacientes','Agenda','Mi plan','Resultados','Alertas','Inicio']:
   p.locator('.nav-pill').get_by_role('button',name=label,exact=(label!='Alertas')).click();p.wait_for_timeout(80);assert 'No pudimos mostrar esta pantalla' not in p.locator('body').inner_text()
  assert not p.errors;p.screenshot(path=str(OUT/'doctor.png'),full_page=True);p.close()
 run('navegación completa del médico',doctor_views)
 def secretary():
  p=page('secretary');nav=p.locator('.nav-pill').inner_text();assert all(x not in nav for x in ['Mi plan','Resultados','Alertas']);p.locator('.nav-pill').get_by_role('button',name='Pacientes',exact=True).click();p.locator('.patient-card').first.click();body=p.locator('body').inner_text();assert 'ficha administrativa' in body.lower()
  assert all(x not in body for x in ['Sertralina','Trastorno depresivo','Contenido completo protegido','Registrar evolución']);p.screenshot(path=str(OUT/'secretary.png'),full_page=True);assert not p.errors;p.close()
 run('vista de secretaría sin información clínica ni pagos',secretary)
 def signed_note():
  p=page('doctor');p.locator('.nav-pill').get_by_role('button',name='Pacientes',exact=True).click();p.locator('.patient-card').first.click();p.get_by_role('tab',name='Consultas',exact=True).click();p.get_by_role('button',name='Ver nota',exact=True).click();expect(p.get_by_text('Contenido completo protegido de la nota firmada',exact=True)).to_be_visible();assert p.locator('.notebook-paper textarea').count()==0;assert not p.errors;p.screenshot(path=str(OUT/'signed-note.png'),full_page=True);p.close()
 run('lectura íntegra de nota firmada sin editarla',signed_note)
 def note_save():
  p=page('doctor');p.locator('.nav-pill').get_by_role('button',name='Pacientes',exact=True).click();p.locator('.patient-card').first.click();p.get_by_role('button',name='Iniciar consulta',exact=True).first.click();p.get_by_label('Notas libres',exact=True).fill('Nueva anotación durante la consulta');p.wait_for_timeout(1400)
  assert p.evaluate("__QA.calls.some(c=>c.rpc==='linkare_save_changes_v3'&&JSON.stringify(c.args).includes('Nueva anotación'))")
  p.get_by_role('button',name='Firmar y finalizar').click();p.wait_for_timeout(300);expect(p.get_by_role('button',name='Ver nota',exact=True).first).to_be_visible();assert not p.errors;p.close()
 run('borrador guardado y firma sincronizada',note_save)
 def conflict():
  p=page('doctor');p.locator('.nav-pill').get_by_role('button',name='Pacientes',exact=True).click();p.locator('.patient-card').first.click();p.get_by_role('button',name='Iniciar consulta',exact=True).first.click();p.evaluate('__QA.failSave=true');p.get_by_label('Notas libres',exact=True).fill('Texto que no se debe perder');p.wait_for_timeout(1400)
  expect(p.locator('.sync-banner.error')).to_be_visible();assert p.get_by_label('Notas libres',exact=True).input_value()=='Texto que no se debe perder';p.evaluate('__QA.failSave=false');p.locator('.sync-banner.error').get_by_role('button',name='Reintentar').click();p.wait_for_timeout(200);expect(p.locator('.sync-banner.error')).to_have_count(0);assert not p.errors;p.close()
 run('conflicto de guardado conserva texto y muestra reintento',conflict)
 def invitation():
  p=page('doctor');p.get_by_role('button',name='Configuración',exact=True).click();p.get_by_role('button',name='Invitar a secretaría',exact=True).click();modal=p.get_by_role('dialog');modal.get_by_label('Nombre',exact=False).first.fill('Secretaría nueva');modal.get_by_label('Correo',exact=False).fill('secretaria2@example.invalid');assert modal.locator('input[type=password]').count()==0;modal.locator('button[type=submit]').click();p.wait_for_timeout(250)
  assert p.evaluate("__QA.calls.some(c=>c.fn==='linkare-team'&&c.body.action==='invite'&&c.body.email==='secretaria2@example.invalid'&&!c.body.password)");assert not p.errors;p.screenshot(path=str(OUT/'team.png'),full_page=True);p.close()
 run('invitación de secretaría sin contraseñas compartidas',invitation)
 def plans():
  p=page('doctor');p.locator('.nav-pill').get_by_role('button',name='Mi plan',exact=True).click();expect(p.locator('.plan-option')).to_have_count(3);texts=p.locator('.plans-grid').inner_text();assert all(x in texts for x in ['$40.00','$220.00','$400.00']);p.screenshot(path=str(OUT/'plans.png'),full_page=True)
  p.locator('.plan-option').nth(1).get_by_role('button').click();p.get_by_role('button',name='Generar enlace Wompi',exact=True).click();expect(p.get_by_role('button',name='Abrir checkout de Wompi')).to_be_visible();assert p.evaluate("__QA.calls.some(c=>c.fn==='wompi-create-link'&&c.body.planCode==='semiannual'&&!Object.hasOwn(c.body,'amount'))");assert not p.errors;p.close()
 run('planes 40/220/400 y checkout envía código, no precio',plans)
 def mobile():
  p=page('doctor',375);p.get_by_role('button',name='Abrir menú').click();p.locator('.nav-pill').get_by_role('button',name='Mi plan',exact=True).click();expect(p.locator('.plan-option')).to_have_count(3);p.screenshot(path=str(OUT/'mobile.png'),full_page=True);dims=p.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');assert dims['scroll']<=dims['w']+1,dims;assert not p.errors;p.close()
 run('planes y navegación en móvil sin desbordamiento',mobile)
 def logout():
  p=page('doctor');p.locator('.profile-chip-button').click();p.get_by_role('button',name='Cerrar sesión',exact=True).click();expect(p.get_by_role('button',name='Ingresar a Linkare')).to_be_visible();assert 'Valeria Moreno' not in p.locator('body').inner_text();assert not p.errors;p.close()
 run('cierre de sesión retira los datos de la pantalla',logout)
 browser.close()
(OUT/'browser-report.json').write_text(json.dumps({'mode':'React/HTM source, Supabase mocked, no external network','results':results},ensure_ascii=False,indent=2))
print(json.dumps({'passed':sum(r['passed'] for r in results),'total':len(results)}))
raise SystemExit(0 if all(r['passed'] for r in results) else 1)
