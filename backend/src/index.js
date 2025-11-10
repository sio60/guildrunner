import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const encoder = new TextEncoder();

function toBase64Url(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Base64Url(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(msg));
  return toBase64Url(sig);
}

function corsHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders()
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // 헬스 체크
    if (pathname === "/health") {
      return json({
        ok: true,
        service: "kakao-worker",
        ts: new Date().toISOString()
      });
    }

    // 1) authorizeUrl 생성
    if (pathname === "/oauth/kakao/start" && request.method === "GET") {
      const redirectUri = url.searchParams.get("redirectUri");
      if (!redirectUri) {
        return json({ error: "missing_redirectUri" }, 400);
      }

      if (!env.KAKAO_REST_API_KEY) {
        return json({ error: "missing_kakao_rest_api_key" }, 500);
      }
      if (!env.JWT_SECRET) {
        return json({ error: "missing_jwt_secret" }, 500);
      }

      const nonce = crypto.randomUUID().replace(/-/g, "");
      const sig = await hmacSha256Base64Url(env.JWT_SECRET, `${nonce}|${redirectUri}`);
      const state = `${nonce}.${sig}`;

      const authorizeUrl =
        "https://kauth.kakao.com/oauth/authorize" +
        `?client_id=${encodeURIComponent(env.KAKAO_REST_API_KEY)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        "&response_type=code" +
        `&state=${encodeURIComponent(state)}`;

      return json({ authorizeUrl });
    }

    // 2) 코드 교환 + 카카오 유저 조회 + Supabase upsert + 우리 JWT 발급
    if (pathname === "/oauth/kakao/callback" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const code = body.code;
        const state = body.state;
        const redirectUri = body.redirectUri;

        if (!code || !redirectUri) {
          return json({ error: "missing_code_or_redirectUri" }, 400);
        }
        if (!env.KAKAO_REST_API_KEY) {
          return json({ error: "missing_kakao_rest_api_key" }, 500);
        }
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
          return json({ error: "missing_supabase_config" }, 500);
        }
        if (!env.JWT_SECRET) {
          return json({ error: "missing_jwt_secret" }, 500);
        }

        // state 검증
        const [nonce, sig] = String(state || "").split(".");
        if (!nonce || !sig) {
          return json({ error: "invalid_state" }, 400);
        }
        const expect = await hmacSha256Base64Url(env.JWT_SECRET, `${nonce}|${redirectUri}`);
        if (sig !== expect) {
          return json({ error: "state_mismatch" }, 400);
        }

        // 카카오 토큰 교환
        const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded;charset=utf-8"
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: env.KAKAO_REST_API_KEY,
            redirect_uri: redirectUri,
            code,
            ...(env.KAKAO_CLIENT_SECRET ? { client_secret: env.KAKAO_CLIENT_SECRET } : {})
          }).toString()
        });

        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok) {
          console.error("kakao token error", tokenRes.status, tokenJson);
          return json({ error: "kakao_token_error", detail: tokenJson }, tokenRes.status);
        }

        const accessToken = tokenJson.access_token;
        if (!accessToken) {
          return json({ error: "missing_access_token", detail: tokenJson }, 500);
        }

        // 카카오 유저 조회
        const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const me = await meRes.json();
        if (!meRes.ok) {
          console.error("kakao me error", meRes.status, me);
          return json({ error: "kakao_me_error", detail: me }, meRes.status);
        }

        const kakaoId = me.id;
        const account = me.kakao_account || {};
        const email = account.email ?? null;
        const profile = account.profile || {};
        const nickname = profile.nickname ?? null;
        const avatar = profile.profile_image_url ?? null;

        // 이메일은 Supabase auth.users 생성 시 필요하다고 가정
        if (!email) {
          return json({ error: "email_required", detail: "카카오에서 이메일이 제공되지 않았습니다." }, 400);
        }

        // Supabase 클라이언트 (service_role)
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
          auth: { persistSession: false }
        });

        // 1) auth.users 찾거나 생성
        let authUser = null;

        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
          email
        });

        if (listErr) {
          console.error("supabase listUsers error", listErr);
          return json({ error: "supabase_list_users_error", detail: listErr.message }, 500);
        }

        if (listData?.users?.length) {
          authUser = listData.users[0];
        } else {
          const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              kakao_id: kakaoId,
              nickname,
              avatar
            }
          });
          if (createErr) {
            console.error("supabase createUser error", createErr);
            return json({ error: "supabase_create_user_error", detail: createErr.message }, 500);
          }
          authUser = createData.user;
        }

        const userId = authUser.id;

        // 2) profiles 테이블 upsert (id = auth.users.id)
        const { data: profileRow, error: profileErr } = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              email,
              nickname,
              profile_image_url: avatar,
              updated_at: new Date().toISOString()
            },
            { onConflict: "id" }
          )
          .select()
          .single();

        if (profileErr) {
          console.error("profiles upsert error", profileErr);
          return json({ error: "supabase_profiles_upsert_error", detail: profileErr.message }, 500);
        }

        // 3) 우리 JWT 발급 (앱 세션용)
        const jwtSecret = encoder.encode(env.JWT_SECRET);
        const token = await new SignJWT({
          sub: userId,
          email,
          provider: "kakao"
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuer("guildrunner")
          .setAudience("guildrunner-app")
          .setIssuedAt()
          .setExpirationTime("7d")
          .sign(jwtSecret);

        return json({
          token,
          profile: {
            id: userId,
            email,
            nickname,
            avatar,
            kakaoId
          }
        });
      } catch (e) {
        console.error("unexpected error in /oauth/kakao/callback", e);
        return json({ error: "unexpected", detail: String(e) }, 500);
      }
    }

    // 그 외
    return json({ error: "not_found" }, 404);
  }
};
