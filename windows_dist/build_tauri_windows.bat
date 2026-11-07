@echo off
chcp 65001 >nul
title ARKA v6.0.0 - Tauri Windows App Builder & In-Place Updater
color 0b

:: Always run from project root even if launched from windows_dist\
if exist "..\src-tauri\Cargo.toml" (
    cd /d "%~dp0\.."
)

call build_tauri_windows.bat
