import { supabaseAdmin } from './supabase-admin.ts';
import { permissionAllowed } from './permissions.ts';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Kept as a separate helper because linkare-team uses a public Auth client
// only for password-reset/invite fallback. Authentication of protected
// requests continues to use the server-side admin client in requireUser().
export function publicKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (legacy) return legacy;

  const single = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim();
  if (single) return single;

  try {
    return String(
      JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')?.default || ''
    ).trim();
  } catch {
    return '';
  }
}

export async function requireUser(request: Request) {
  const token = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiError(401, 'Inicie sesión para continuar.');

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  const confirmedAt =
    (data.user as any)?.email_confirmed_at ||
    (data.user as any)?.confirmed_at;

  if (error || !data.user) {
    throw new ApiError(
      401,
      'Su sesión no es válida. Cierre sesión, vuelva a entrar y repita la operación.'
    );
  }

  if (!confirmedAt) {
    throw new ApiError(401, 'Su correo todavía no está confirmado.');
  }

  return data.user;
}

export async function requireMember(
  request: Request,
  organizationId: string,
  permission = 'member',
) {
  if (!/^[a-f\d-]{36}$/i.test(organizationId || '')) {
    throw new ApiError(400, 'Consultorio no válido.');
  }

  const user = await requireUser(request);
  const db = supabaseAdmin();

  const { data: member, error } = await db
    .from('organization_members')
    .select('id,role,active,permissions')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !member?.active) {
    throw new ApiError(403, 'No tiene acceso a este consultorio.');
  }

  const doctor = ['owner','psychiatrist','doctor'].includes(String(member.role));
  const allowed = permission === 'member'
    ? ['owner','psychiatrist','doctor','clinical_assistant','secretary'].includes(String(member.role))
    : permission === 'owner' ? member.role === 'owner' : permissionAllowed(member,permission);
  if (!allowed) throw new ApiError(403, 'Su cuenta no tiene este permiso.');

  return { user, member, doctor, db };
}

export async function limitAction(
  db: ReturnType<typeof supabaseAdmin>,
  scope: string,
  actor: string,
  limit: number,
) {
  const { data, error } = await db.rpc('linkare_rate_v3', {
    s: scope,
    a: actor,
    max_hits: limit,
  });

  if (error) {
    throw new ApiError(503, 'No se pudo validar el límite de solicitudes.');
  }

  if (data !== true) {
    throw new ApiError(429, 'Demasiadas solicitudes. Intente más tarde.');
  }
}

export function safeApiMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'No se pudo completar la operación. Revise los registros del servidor con la referencia indicada.';
}
