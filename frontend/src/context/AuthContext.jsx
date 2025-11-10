// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import * as SecureStore from "expo-secure-store";
import { startKakaoAuth } from "../lib/kakaoAuth";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

const AuthCtx = createContext(null);
const KEY = "app_jwt";

export function AuthProvider({ children }) {
  const [jwt, setJwt] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 부팅시 토큰 로드
  useEffect(() => {
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(KEY);
        if (v) setJwt(v);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 내 정보 갱신
  const refreshMe = async (token) => {
    if (!token) return;
    const me = await api("/me", { token }); // Cloudflare Worker가 반환하는 유저
    setProfile(me);
    return me;
  };

  const loginWithKakao = async () => {
    // 1) 카카오 OAuth
    const { token, me: kakao } = await startKakaoAuth();

    // 2) 백엔드 세션 발급(Cloudflare Worker)
    //    백엔드에서는 kakao.access_token(또는 code) 검증 후 우리 앱 JWT 리턴하도록 구현되어 있어야 함.
    const sess = await api("/auth/kakao", {
      method: "POST",
      body: { access_token: token.access_token, kakao_id: kakao?.id },
    });

    // 기대 응답 예시: { jwt: '...', user: {...} }
    await SecureStore.setItemAsync(KEY, sess.jwt);
    setJwt(sess.jwt);
    setProfile(sess.user || null);

    // 3) (선택) Supabase 읽기/쓰기 테스트 (RLS열려있을 때)
    try {
      // 예: public.ranks 테이블에서 상위 10개 읽기
      await supabase.from("ranks").select("*").limit(10);
    } catch (e) {
      console.log("[supabase] optional test error:", e.message);
    }

    return sess;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(KEY);
    setJwt(null);
    setProfile(null);
  };

  const value = useMemo(
    () => ({
      jwt,
      profile,
      loading,
      loginWithKakao,
      logout,
      refreshMe,
    }),
    [jwt, profile, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
