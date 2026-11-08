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

:: Preserve and propagate any existing hardware license lock across ProgramData and LocalAppData
if not exist "%ProgramData%\ARKA_Accounting" mkdir "%ProgramData%\ARKA_Accounting" >nul 2>&1
if exist "%LOCALAPPDATA%\com.tarazban.accounting\arka_master_license_v6.lock" (
    copy /Y "%LOCALAPPDATA%\com.tarazban.accounting\arka_master_license_v6.lock" "%ProgramData%\ARKA_Accounting\arka_master_license_v6.lock" >nul 2>&1
    if not exist "%LOCALAPPDATA%\com.arka.accounting" mkdir "%LOCALAPPDATA%\com.arka.accounting" >nul 2>&1
    copy /Y "%LOCALAPPDATA%\com.tarazban.accounting\arka_master_license_v6.lock" "%LOCALAPPDATA%\com.arka.accounting\arka_master_license_v6.lock" >nul 2>&1
)
if exist "%ProgramData%\ARKA_Accounting\arka_master_license_v6.lock" (
    if not exist "%LOCALAPPDATA%\com.arka.accounting" mkdir "%LOCALAPPDATA%\com.arka.accounting" >nul 2>&1
    copy /Y "%ProgramData%\ARKA_Accounting\arka_master_license_v6.lock" "%LOCALAPPDATA%\com.arka.accounting\arka_master_license_v6.lock" >nul 2>&1
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
    cargo clean -p arka-accounting >nul 2>&1
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
    
    :: Refresh Windows Icon Cache so the new ARKA logo displays immediately in taskbar
    if exist "%LOCALAPPDATA%\IconCache.db" (
        attrib -h "%LOCALAPPDATA%\IconCache.db" >nul 2>&1
        del /f /q "%LOCALAPPDATA%\IconCache.db" >nul 2>&1
    )
    ie4uinit.exe -show >nul 2>&1

    for %%E in (ARKA_Accounting.exe TarazBan_Accounting.exe) do (
        if exist "src-tauri\target\release\%%E" (
            if exist "%LOCALAPPDATA%\Programs\TarazBan_Accounting\" (
                copy /Y "src-tauri\target\release\%%E" "%LOCALAPPDATA%\Programs\TarazBan_Accounting\%%E" >nul 2>&1
                copy /Y "src-tauri\target\release\%%E" "%LOCALAPPDATA%\Programs\TarazBan_Accounting\TarazBan_Accounting.exe" >nul 2>&1
            )
            if exist "%LOCALAPPDATA%\Programs\ARKA_Accounting\" (
                copy /Y "src-tauri\target\release\%%E" "%LOCALAPPDATA%\Programs\ARKA_Accounting\%%E" >nul 2>&1
            )
            if exist "%LOCALAPPDATA%\TarazBan_Accounting\" (
                copy /Y "src-tauri\target\release\%%E" "%LOCALAPPDATA%\TarazBan_Accounting\%%E" >nul 2>&1
            )
        )
    )

    echo.
    echo Your generated files are located at:
    echo   - Standalone EXE: src-tauri\target\release\ARKA_Accounting.exe
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
    if exist "src-tauri\target\release\ARKA_Accounting.exe" (
        start "" "src-tauri\target\release\ARKA_Accounting.exe"
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
