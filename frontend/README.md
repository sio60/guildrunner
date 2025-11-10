npm install
npx expo install expo-auth-session expo-constants react-native-url-polyfill expo-secure-store
npm i @supabase/supabase-js
npx expo prebuild -p android --clean
# PowerShell 또는 CMD 권장 (Git Bash는 PATH 꼬일 때 있음)
npm i -g eas-cli
eas --version         # 버전 나오면 OK
eas login             # 로그인
eas build:configure   # 프로젝트 연결
eas build -p android --profile preview
# 또는
npx eas-cli@latest build -p android --profile preview
