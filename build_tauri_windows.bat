@echo off
chcp 65001 >nul
title ARKA v6.0.0 - Tauri Windows App Builder & In-Place Updater
color 0b

echo ====================================================================
echo    ARKA (v6.0.0) TAURI WINDOWS BUILDER & IN-PLACE UPDATER SCRIPT
echo ====================================================================
echo.

:: 0. Close any running instance so files and installer can overwrite in-place
echo [0/5] Closing any running instance of the application...
taskkill /F /IM TarazBan_Accounting.exe >nul 2>&1
taskkill /F /IM ARKA_Accounting.exe >nul 2>&1

:: Purge stale WebView2 Service Worker & HTTP Cache (while keeping Local Storage database intact!)
if exist "%LOCALAPPDATA%\com.tarazban.accounting\EBWebView\Default\Service Worker" (
    echo Cleaning old WebView2 Service Worker cache...
    rmdir /s /q "%LOCALAPPDATA%\com.tarazban.accounting\EBWebView\Default\Service Worker" >nul 2>&1
)
if exist "%LOCALAPPDATA%\com.tarazban.accounting\EBWebView\Default\Cache" (
    rmdir /s /q "%LOCALAPPDATA%\com.tarazban.accounting\EBWebView\Default\Cache" >nul 2>&1
)
if exist "%LOCALAPPDATA%\com.tarazban.accounting\EBWebView\Default\Code Cache" (
    rmdir /s /q "%LOCALAPPDATA%\com.tarazban.accounting\EBWebView\Default\Code Cache" >nul 2>&1
)
echo [OK] Ready for clean build and in-place upgrade.
echo.

:: 1. Check Node.js
echo [1/5] Checking Node.js environment...
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
echo [2/5] Checking Rust and Cargo toolchain...
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0e
    echo [WARNING] Rust / Cargo is not found in PATH!
    echo To build with Tauri, Rust and C++ Build Tools are required.
    echo 1. Install Rust from: https://rustup.rs (or run: winget install Rustlang.Rustup)
    echo 2. Install Visual Studio C++ Build Tools.
    echo.
    choice /M "Do you want to continue attempting Tauri build anyway?"
    if %ERRORLEVEL% NEQ 1 exit /b 1
) else (
    cargo -v
    echo [OK] Rust/Cargo toolchain detected.
)
echo.

:: 3. Install NPM packages & build fresh web assets
echo [3/5] Building fresh production frontend (ARKA v6.0.0)...
if exist "dist" rmdir /s /q "dist" >nul 2>&1
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
echo [OK] Fresh frontend web assets built into dist folder.
echo.

:: 4. Force Cargo to re-embed the new dist/ assets into the Tauri binary
echo [4/5] Compiling Native Windows Tauri App & Installer (v6.0.0)...
if exist "src-tauri\Cargo.toml" (
    pushd src-tauri
    cargo clean -p tarazban-accounting >nul 2>&1
    popd
)
echo Running: npx @tauri-apps/cli build
call npx @tauri-apps/cli build

if %ERRORLEVEL% EQU 0 (
    color 0a
    echo.
    echo ====================================================================
    echo   SUCCESS! ARKA v6.0.0 Windows Tauri App Built Successfully!
    echo ====================================================================
    echo.
    :: 5. Automatically overwrite existing installed binary in-place if found
    echo [5/5] Updating existing installation on this computer in-place...
    if exist "%LOCALAPPDATA%\Programs\TarazBan_Accounting\TarazBan_Accounting.exe" (
        copy /Y "src-tauri\target\release\TarazBan_Accounting.exe" "%LOCALAPPDATA%\Programs\TarazBan_Accounting\TarazBan_Accounting.exe" >nul 2>&1
        echo [UPDATED] Replaced existing binary in %LOCALAPPDATA%\Programs\TarazBan_Accounting\
    )
    if exist "%LOCALAPPDATA%\TarazBan_Accounting\TarazBan_Accounting.exe" (
        copy /Y "src-tauri\target\release\TarazBan_Accounting.exe" "%LOCALAPPDATA%\TarazBan_Accounting\TarazBan_Accounting.exe" >nul 2>&1
        echo [UPDATED] Replaced existing binary in %LOCALAPPDATA%\TarazBan_Accounting\
    )
    if exist "%ProgramFiles%\TarazBan_Accounting\TarazBan_Accounting.exe" (
        copy /Y "src-tauri\target\release\TarazBan_Accounting.exe" "%ProgramFiles%\TarazBan_Accounting\TarazBan_Accounting.exe" >nul 2>&1
        echo [UPDATED] Replaced existing binary in %ProgramFiles%\TarazBan_Accounting\
    )
    echo.
    echo Your generated files are located at:
    echo   - Standalone EXE: src-tauri\target\release\TarazBan_Accounting.exe
    echo   - NSIS / MSI Upgrader: src-tauri\target\release\bundle\
    echo.
    echo Launching the new installer to complete in-place Windows upgrade...
    for %%f in ("src-tauri\target\release\bundle\nsis\*.exe") do (
        start "" "%%~ff"
        goto :done_launch
    )
    for %%f in ("src-tauri\target\release\bundle\msi\*.msi") do (
        start "" msiexec /i "%%~ff"
        goto :done_launch
    )
    if exist "src-tauri\target\release\TarazBan_Accounting.exe" (
        start "" "src-tauri\target\release\TarazBan_Accounting.exe"
    )
    :done_launch
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
