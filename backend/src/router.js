import { json } from "./lib/json.js";
import { requireAuth } from "./lib/auth.js";

export async function route(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  // 헬스 체크
  if (pathname === "/health") {
    return withCors(
      json({
        ok: true,
        service: "guildrunner-backend",
        timestamp: new Date().toISOString()
      })
    );
  }

  // 로그인 확인용 엔드포인트
  // 프론트에서 Supabase access_token을 Bearer로 보내면,
  // 여기서 Supabase에 검증 요청 → 유효하면 user 정보 리턴
  if (pathname === "/auth/check" && method === "GET") {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) {
      // requireAuth가 에러 Response를 리턴한 경우
      return withCors(auth);
    }

    const { user } = auth;
    return withCors(
      json({
        user: {
          id: user.id,
          email: user.email || null
        }
      })
    );
  }

  return withCors(json({ message: "Not Found" }, { status: 404 }));
}

function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*"); // 필요하면 프론트 도메인으로 한정 가능
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return h;
}

function withCors(res) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
}
