@echo off
setlocal
cd /d "%~dp0"
title BAPS Rajkot Rasoi Seva Setup

if exist .env goto start

echo.
echo BAPS Rajkot Rasoi Seva - one-time Supabase setup
echo.
echo In the Supabase API Keys page, copy the Project URL.
set /p "SUPABASE_URL=Paste the full Project URL line here, then press Enter: "
echo.
echo Now copy the Publishable key (or legacy anon key).
echo Never use a service_role or secret key.
set /p "SUPABASE_KEY=Paste the full Publishable-key line here, then press Enter: "

rem Accept either the value alone or the entire line copied from Supabase.
set "SUPABASE_URL=%SUPABASE_URL:NEXT_PUBLIC_SUPABASE_URL=%"
set "SUPABASE_URL=%SUPABASE_URL:EXPO_PUBLIC_SUPABASE_URL=%"
set "SUPABASE_KEY=%SUPABASE_KEY:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%"
set "SUPABASE_KEY=%SUPABASE_KEY:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%"
if "%SUPABASE_URL:~0,1%"=="=" set "SUPABASE_URL=%SUPABASE_URL:~1%"
if "%SUPABASE_KEY:~0,1%"=="=" set "SUPABASE_KEY=%SUPABASE_KEY:~1%"

if "%SUPABASE_URL%"=="" goto missing
if "%SUPABASE_KEY%"=="" goto missing

(
  echo EXPO_PUBLIC_SUPABASE_URL=%SUPABASE_URL%
  echo EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%SUPABASE_KEY%
) > .env

:start
echo.
echo Preparing the app. This may take a few minutes the first time.
call npm.cmd install --cache .npm-cache
if errorlevel 1 goto installfailed

echo.
echo Starting the app now...
call npx.cmd expo start --clear
goto end

:missing
echo.
echo Both values are needed. Close this window and run START_APP again.
pause
goto end


:installfailed
echo.
echo The app could not be prepared. Please take a photo of this window and send it.
pause

:end
endlocal
