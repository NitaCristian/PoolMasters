@echo off
title PoolMasters
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)
node scripts\live.js %*
echo.
pause
