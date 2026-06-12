@echo off
set PATH=%CD%\portables\bun;%CD%\portables\postgres\bin;%PATH%
echo Booting up Local Development Portal Stack...
call bun --cwd src/frontend run dev
