export async function getSupabaseUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_ANON_KEY
    }
  });

  if (!res.ok) {
    console.warn("Supabase auth user error:", res.status);
    return null;
  }

  return res.json(); // { id, email, ... }
}
