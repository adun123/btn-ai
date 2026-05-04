const { createClient } = require('@supabase/supabase-js');
const { createHttpError } = require('../utils/httpError');

let supabaseClient;

function getEnv(name) {
  return process.env[name] ? String(process.env[name]).trim() : '';
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

  throw createHttpError(500, `Supabase ${action} failed`, {
    code: result.error.code || null,
    message: result.error.message,
    details: result.error.details || null,
    hint: result.error.hint || null,
  });
}

module.exports = {
  getSupabase,
  unwrapSupabase,
};
