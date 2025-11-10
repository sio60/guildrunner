import { getSupabaseUserFromToken } from "./supabase.js";
import { json } from "./json.js";

// 토큰 필수 + Supabase에 검증 → 실패 시 Response, 성공 시 { user, accessToken }
export async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return json({ message: "Unauthorized: missing token" }, { status: 401 });
  }

  const supabaseUser = await getSupabaseUserFromToken(env, token);
  if (!supabaseUser) {
    return json({ message: "Invalid or expired token" }, { status: 401 });
  }

  return {
    user: {
      id: supabaseUser.id,
      email: typeof supabaseUser.email === "string" ? supabaseUser.email : undefined,
      ...supabaseUser
    },
    accessToken: token
  };
}
