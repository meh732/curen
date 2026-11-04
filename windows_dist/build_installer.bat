@echo off
chcp 65001 > nul
title TarazBan Windows Installer Creator
echo ===============================================================================
echo   TarazBan Windows Installer Setup Script
echo ===============================================================================

call "%~dp0build_exe.bat"

if not exist "%~dp0TarazBan_Accounting.exe" (
    echo [ERROR] Cannot create installer because TarazBan_Accounting.exe was not created.
    pause
    exit /b 1
)

set "SETUP_DIR=%~dp0TarazBan_Windows_Setup"
if exist "%SETUP_DIR%" rd /s /q "%SETUP_DIR%"
mkdir "%SETUP_DIR%"

copy "%~dp0TarazBan_Accounting.exe" "%SETUP_DIR%\" > nul

:: Create Desktop Shortcut Script (VBS)
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = oWS.SpecialFolders^("Desktop"^) ^& "\TarazBan Accounting.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "%SETUP_DIR%\TarazBan_Accounting.exe"
echo oLink.WorkingDirectory = "%SETUP_DIR%"
echo oLink.Description = "TarazBan Multi-Currency Accounting System"
echo oLink.Save
) > "%SETUP_DIR%\create_shortcut.vbs"

cscript //nologo "%SETUP_DIR%\create_shortcut.vbs" > nul
del "%SETUP_DIR%\create_shortcut.vbs"

echo.
echo ===============================================================================
echo [OK] Windows Application Installed successfully!
echo Target folder: %SETUP_DIR%
echo Desktop shortcut created: "TarazBan Accounting"
echo ===============================================================================
pause
