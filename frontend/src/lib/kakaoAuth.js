// src/lib/kakaoAuth.js
import 'react-native-url-polyfill/auto';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';

const REST_KEY  = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
const APP_SCHEME =
  process.env.EXPO_PUBLIC_APP_SCHEME ||
  Constants.expoConfig?.scheme ||
  'guildrunner';

const AUTH_URL   = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_URL  = 'https://kauth.kakao.com/oauth/token';
const USER_URL   = 'https://kapi.kakao.com/v2/user/me';

const USE_PROXY_ALWAYS = true;

export function getRedirectUri() {
  const uri = AuthSession.makeRedirectUri({
    scheme: APP_SCHEME,
    path: 'auth-callback',
    useProxy: USE_PROXY_ALWAYS
  });
  if (__DEV__) console.log('[kakao] redirectUri:', uri);
  return uri;
}

async function parseJsonOrThrow(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} → HTTP ${res.status}\n${text}`);
  }
}

export async function startKakaoAuth() {
  if (!REST_KEY) throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY 누락');

  const redirectUri = getRedirectUri();
  const authUrl = `${AUTH_URL}?client_id=${encodeURIComponent(
    REST_KEY
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  const result = await AuthSession.startAsync({
    authUrl,
    returnUrl: redirectUri
  });

  if (__DEV__) console.log('[kakao] auth result:', result);

  if (result.type !== 'success' || !result.params?.code) {
    const reason = result.type === 'dismiss' ? '사용자 취소' : '인가 코드 없음';
    throw new Error(`로그인 실패: ${reason}`);
  }

  // 토큰 교환
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: REST_KEY,
    redirect_uri: redirectUri,
    code: result.params.code
  }).toString();

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: form
  });

  const token = await parseJsonOrThrow(res, '토큰 교환 실패');
  if (!res.ok) throw new Error(`토큰 교환 실패: ${JSON.stringify(token)}`);

  // 프로필 조회
  const meRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const me = await parseJsonOrThrow(meRes, '프로필 조회 실패');
  if (!meRes.ok) throw new Error(`프로필 조회 실패: ${JSON.stringify(me)}`);

  return { token, me }; // token: {access_token,...}, me: kakao profile
}
