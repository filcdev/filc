@echo off
setlocal
cd /d "%~dp0"

echo === Filc privacy policy javitas ===

if not exist "apps\iris\src\routes\_public\policy.tsx" (
  echo HIBA: apps\iris\src\routes\_public\policy.tsx nem talalhato.
  exit /b 1
)

if not exist "apps\iris\public\locales\hu\policy.json" (
  echo HIBA: apps\iris\public\locales\hu\policy.json nem talalhato.
  exit /b 1
)

if not exist "apps\iris\public\locales\en\policy.json" (
  echo HIBA: apps\iris\public\locales\en\policy.json nem talalhato.
  exit /b 1
)

bun -e "import { readFileSync, writeFileSync } from 'node:fs'; const p='apps/iris/src/routes/auth/login.tsx'; let s=readFileSync(p,'utf8'); if (s.includes('/legal/privacy')) { s=s.replace('/legal/privacy','/policy'); writeFileSync(p,s,'utf8'); console.log('Modositva: '+p); } else if (s.includes('/policy')) { console.log('A privacy link mar /policy.'); } else { console.error('HIBA: Nem talalom a privacy linket a login.tsx-ben.'); process.exit(2); }"

if errorlevel 1 goto :error

echo.
echo === Git status ===
git status --short

echo.
echo Kesz.
echo Kovetkezo parancsok:
echo   bun lint
echo   bun typecheck
echo   bun run build
echo.
goto :eof

:error
echo.
echo HIBA tortent.
exit /b 1
