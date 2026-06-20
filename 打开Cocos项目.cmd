@echo off
set "CREATOR=E:\Cocos Dashboard\CocosCreator-v2.4.13-20240123-win\CocosCreator.exe"
set "PROJECT=%~dp0ShouBaYiCocos"

if not exist "%CREATOR%" (
  echo Cocos Creator not found:
  echo %CREATOR%
  pause
  exit /b 1
)

if not exist "%PROJECT%\project.json" (
  echo Cocos project not found:
  echo %PROJECT%
  pause
  exit /b 1
)

start "" "%CREATOR%"
start "" "%PROJECT%"
