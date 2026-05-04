const { createClient } = require('@supabase/supabase-js');
const { createHttpError } = require('../utils/httpError');

let supabaseClient;

function getEnv(name) {
  return process.env[name] ? String(process.env[name]).trim() : '';
}

/** Decode Supabase JWT `role` claim (anon | authenticated | service_role). */
function getJwtRoleClaim(key) {
  try {
    const parts = String(key).trim().split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (b64.length % 4)) % 4;
    b64 += '='.repeat(pad);
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function isSupabaseConfigured() {
  return Boolean(getEnv('SUPABASE_URL') && getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * Safe diagnostics for GET /health (no secrets). Helps verify Vercel env names and key type.
 */
function getSupabaseEnvDiagnostics() {
  const url = getEnv('SUPABASE_URL');
  const keyRaw = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const urlPresent = Boolean(url);
  const keyPresent = Boolean(keyRaw);
  const jwtRole = keyPresent ? getJwtRoleClaim(keyRaw) : null;

  let keyDiagnosis = 'missing';
  if (keyPresent) {
    if (jwtRole === 'service_role') keyDiagnosis = 'service_role_ok';
    else if (jwtRole === 'anon') {
      keyDiagnosis = 'anon_key_in_service_role_slot';
    } else if (jwtRole) keyDiagnosis = `unexpected_jwt_role_${jwtRole}`;
    else keyDiagnosis = 'unparseable_jwt';
  }

  const ready = urlPresent && keyPresent && jwtRole === 'service_role';

  return {
    urlPresent,
    keyPresent,
    jwtRole,
    keyDiagnosis,
    ready,
    /** Exact names this server reads (set these in Vercel → Project → Settings → Environment Variables). */
    expectedEnvNames: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  };
}

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw createHttpError(503, 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const role = getJwtRoleClaim(key);
  if (role && role !== 'service_role') {
    throw createHttpError(
      503,
      'Invalid Supabase key: SUPABASE_SERVICE_ROLE_KEY must be the service_role secret from Supabase Dashboard → Project Settings → API. Do not use the anon public key for the backend.',
    );
  }

  supabaseClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

function unwrapSupabase(result, action) {
  if (!result.error) {
    return result.data;
  }

  const e = result.error;
  const pg = e.message || 'Unknown error';
  let suffix = '';
  if (e.code === '42501' || /row-level security|RLS/i.test(pg)) {
    suffix =
      ' (RLS: use SUPABASE_SERVICE_ROLE_KEY from Supabase → Settings → API, or add SQL policies for your key.)';
  }
  if (/relation|does not exist|schema cache/i.test(pg)) {
    suffix += ' (Run repo SQL migrations on this Supabase project, e.g. backend/supabase/migrations.)';
  }

  throw createHttpError(500, `Supabase ${action} failed: ${pg}${suffix}`, {
    code: e.code || null,
    message: pg,
    details: e.details || null,
    hint: e.hint || null,
  });
}

module.exports = {
  getSupabase,
  unwrapSupabase,
  isSupabaseConfigured,
  getSupabaseEnvDiagnostics,
};
