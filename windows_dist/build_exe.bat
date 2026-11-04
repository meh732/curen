@echo off
chcp 65001 > nul
title TarazBan Windows App Compiler (.EXE)
echo ===============================================================================
echo   Compiling 100%% Native Windows (.NET Framework WinForms .EXE)
echo ===============================================================================

set "CSC64=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
set "CSC32=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
set "CSC=%CSC64%"
if not exist "%CSC%" set "CSC=%CSC32%"

if not exist "%CSC%" (
    echo [ERROR] Microsoft .NET Framework C# Compiler (csc.exe) not found!
    echo Please install .NET Framework 4.5+ on your Windows PC.
    pause
    exit /b 1
)

echo Compiling TarazBan_Accounting.exe ...
"%CSC%" /nologo /target:winexe /out:"%~dp0TarazBan_Accounting.exe" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll /r:System.Xml.dll /r:System.Core.dll "%~dp0TarazBanNativeApp.cs"

if exist "%~dp0TarazBan_Accounting.exe" (
    echo.
    echo ===============================================================================
    echo [OK] TarazBan_Accounting.exe successfully built!
    echo ===============================================================================
    echo Starting TarazBan_Accounting.exe ...
    start "" "%~dp0TarazBan_Accounting.exe"
) else (
    echo.
    echo [ERROR] Compilation failed. Check syntax or compiler errors above.
    pause
)
