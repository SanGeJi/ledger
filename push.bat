@echo off
setlocal
cd /d "D:\Documents\New project\ledger"
echo ============================================
echo   Push Ledger to GitHub
echo ============================================
echo.
echo Step 1: create an EMPTY repo on github.com
echo         (do NOT add README / license / .gitignore)
echo Step 2: copy its URL, paste below, press Enter
echo.
set /p URL="GitHub repo URL: "
if "%URL%"=="" (
  echo No URL. Exit.
  pause
  exit /b
)
git remote remove origin 2>nul
git remote add origin "%URL%"
echo.
echo Pushing ... a login window may pop up.
git push -u origin HEAD
echo.
echo === Done (or see errors above) ===
pause