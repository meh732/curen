@echo off
chcp 65001 >nul
title TarazBan - Tauri Windows App Builder
color 0b

echo ====================================================================
echo      TARAZBAN TAURI WINDOWS BUILDER - CMD AUTOMATION SCRIPT
echo ====================================================================
echo.

:: 1. Check Node.js
echo [1/4] Checking Node.js environment...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0c
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please download and install Node.js LTS from: https://nodejs.org
    pause
    exit /b 1
)
node -v
echo [OK] Node.js is available.
echo.

:: 2. Check Rust & Cargo
echo [2/4] Checking Rust and Cargo toolchain...
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0e
    echo [WARNING] Rust / Cargo is not found in PATH!
    echo To build with Tauri, Rust and C++ Build Tools are required.
    echo 1. Install Rust from: https://rustup.rs (or run: winget install Rustlang.Rustup)
    echo 2. Install Visual Studio C++ Build Tools.
    echo.
    echo [TIP] If you want an INSTANT Windows .EXE without installing Rust:
    echo Run: windows_dist\build_exe.bat
    echo (It uses Windows built-in csc.exe compiler and needs no extra software!)
    echo.
    choice /M "Do you want to continue attempting Tauri build anyway?"
    if %ERRORLEVEL% NEQ 1 exit /b 1
) else (
    cargo -v
    echo [OK] Rust/Cargo toolchain detected.
)
echo.

:: 3. Install NPM packages & build web assets
echo [3/4] Installing dependencies and building production frontend...
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [NOTICE] Retrying with clean npm cache...
    call npm cache clean --force >nul 2>&1
    if exist "package-lock.json" del /f /q package-lock.json >nul 2>&1
    call npm install --legacy-peer-deps
)
call npm run build
if %ERRORLEVEL% NEQ 0 (
    color 0c
    echo [ERROR] npm run build failed! Check errors above.
    pause
    exit /b 1
)
echo [OK] Frontend web assets built successfully into dist folder.
echo.

:: 4. Build Tauri Native Windows Application
echo [4/4] Compiling Native Windows Tauri App & Installer (.msi / .exe)...
echo Running: npx @tauri-apps/cli build
call npx @tauri-apps/cli build

if %ERRORLEVEL% EQU 0 (
    color 0a
    echo.
    echo ====================================================================
    echo   SUCCESS! Windows Native Tauri Application Built Successfully!
    echo ====================================================================
    echo.
    echo Your generated files are located at:
    echo   - Standalone EXE: src-tauri\target\release\TarazBan_Accounting.exe
    echo   - Full Installer: src-tauri\target\release\bundle\msi\
    echo.
    if exist "src-tauri\target\release\bundle\msi\" (
        explorer "src-tauri\target\release\bundle\msi\"
    ) else if exist "src-tauri\target\release\" (
        explorer "src-tauri\target\release\"
    )
) else (
    color 0c
    echo.
    echo [ERROR] Tauri build encountered an issue.
    echo Make sure you have installed:
    echo 1. Rust: https://rustup.rs
    echo 2. Visual Studio C++ Build Tools with "Desktop development with C++"
    echo 3. WebView2 (already installed on Windows 10/11)
)

echo.
pause
