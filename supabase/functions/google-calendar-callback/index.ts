import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async request => {
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const appUrl = (Deno.env.get('APP_PUBLIC_URL') || 'http://localhost:4173').replace(/\/$/, '');
  const redirect = (status: string, message = '') => Response.redirect(`${appUrl}/?calendar=${encodeURIComponent(status)}${message ? `&message=${encodeURIComponent(message)}` : ''}`, 302);
  try {
    if (!code || !state) return redirect('error', 'Google no devolvió código o estado.');
    const db = supabaseAdmin();
    const { data: stateRow, error: stateError } = await db.from('calendar_oauth_states').delete().eq('state', state).select('*').maybeSingle();
    if (stateError || !stateRow || new Date(stateRow.expires_at) < new Date()) return redirect('error', 'La autorización expiró. Intente de nuevo.');
    const {data:m}=await db.from('organization_members').select('role,active,permissions').eq('organization_id',stateRow.organization_id).eq('user_id',stateRow.user_id).maybeSingle();
    if(!m?.active||!(['owner','doctor','psychiatrist'].includes(m.role)||(m.role==='secretary'&&m.permissions?.appointmentsManage===true)))return redirect('error','Acceso revocado.');
    const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
    const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')?.trim();
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI')?.trim() || `${supabaseUrl}/functions/v1/google-calendar-callback`;
    if (!clientId || !clientSecret) return redirect('error', 'Credenciales Google incompletas.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal:AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.access_token) return redirect('error', tokens.error_description || tokens.error || 'Google rechazó la autorización.');
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json().catch(() => ({}));
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    const { data: previous } = await db.from('calendar_connections').select('refresh_token').eq('organization_id', stateRow.organization_id).eq('user_id', stateRow.user_id).eq('provider', 'google').maybeSingle();
    const { error: saveError } = await db.from('calendar_connections').upsert({
      organization_id: stateRow.organization_id,
      user_id: stateRow.user_id,
      provider: 'google',
      provider_account_email: profile.email || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || previous?.refresh_token || null,
      token_expires_at: expiresAt,
      scope: tokens.scope || null,
      calendar_id: 'primary',
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id,provider' });
    if (saveError) return redirect('error', 'No se pudo guardar la autorización.');
    await db.from('calendar_oauth_states').delete().eq('state', state);
    return redirect('connected');
  } catch (error) {
    return redirect('error', 'No se completó la conexión. Intente nuevamente.');
  }
});
