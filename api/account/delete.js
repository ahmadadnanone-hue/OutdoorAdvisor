/**
 * POST /api/account/delete
 *
 * Permanently deletes the authenticated user's Supabase account.
 * Required for Apple App Store Guideline 5.1.1(v) — any app that supports
 * account creation must also support in-app account deletion.
 *
 * Request:
 *   Authorization: Bearer <supabase_access_token>
 *   (No body required.)
 *
 * Response:
 *   200 { success: true }
 *   401 { error: 'unauthorized' }
 *   500 { error: '...' }
 *
 * Required Vercel env vars:
 *   EXPO_PUBLIC_SUPABASE_URL          (already configured)
 *   SUPABASE_SERVICE_ROLE_KEY         (NEW — must be added in Vercel project settings)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin credentials are not configured on the server.');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  // Allow POST + DELETE so the client can use either.
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing bearer token.' });
  }

  try {
    const admin = adminClient();

    // Verify the token by asking Supabase who the caller is.
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ error: 'unauthorized', message: 'Token is invalid or expired.' });
    }

    const userId = userData.user.id;

    // Best-effort cleanup of any push records keyed by this user, if you store them.
    // (Safe to ignore failures; auth deletion is the gating action.)
    try {
      // If you have a `push_tokens` table keyed by user_id, this clears it.
      await admin.from('push_tokens').delete().eq('user_id', userId);
    } catch {
      // Ignore — table may not exist in this project.
    }

    // Permanently delete the auth user. This cascades to any FK references
    // configured with `ON DELETE CASCADE`.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return res.status(500).json({ error: 'delete_failed', message: deleteErr.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err?.message || String(err) });
  }
}
