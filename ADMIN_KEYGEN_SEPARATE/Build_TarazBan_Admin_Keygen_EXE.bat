@echo off
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

(
echo using System;
echo using System.Drawing;
echo using System.Text.RegularExpressions;
echo using System.Windows.Forms;
echo namespace TarazBanKeygen {
echo   public class KeygenForm : Form {
echo     TextBox txtHw, txtKey;
echo     public KeygenForm() {
echo       Text = "TarazBan Hardware Keygen (Admin Only)";
echo       Size = new Size(480, 280);
echo       StartPosition = FormStartPosition.CenterScreen;
echo       FormBorderStyle = FormBorderStyle.FixedDialog;
echo       MaximizeBox = false;
echo       Font = new Font("Tahoma", 9.5f);
echo       RightToLeft = RightToLeft.Yes;
echo       RightToLeftLayout = true;
echo       Label l1 = new Label() { Text = "شناسه سخت‌افزاری کامپیوتر مشتری (TB-HW-XXXX-XXXX):", Location = new Point(25, 20), Size = new Size(410, 24) };
echo       txtHw = new TextBox() { Text = "TB-HW-", Location = new Point(25, 48), Size = new Size(410, 32), Font = new Font("Consolas", 13f, FontStyle.Bold), RightToLeft = RightToLeft.No, TextAlign = HorizontalAlignment.Center };
echo       Button btn = new Button() { Text = "تولید رمز فعال‌سازی ۱۶ رقمی این سخت‌افزار", Location = new Point(25, 90), Size = new Size(410, 38), BackColor = Color.FromArgb(29, 78, 216), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
echo       txtKey = new TextBox() { ReadOnly = true, Location = new Point(25, 145), Size = new Size(410, 36), Font = new Font("Consolas", 15f, FontStyle.Bold), BackColor = Color.FromArgb(236, 253, 245), RightToLeft = RightToLeft.No, TextAlign = HorizontalAlignment.Center };
echo       btn.Click += (s, e) =^> { txtKey.Text = MakeKey(txtHw.Text); };
echo       Controls.AddRange(new Control[] { l1, txtHw, btn, txtKey });
echo     }
echo     static string MakeKey(string raw) {
echo       string clean = Regex.Replace((raw ?? "").ToUpperInvariant(), "[^A-Z0-9]", "");
echo       if (clean.Length == 0) return "";
echo       int h1 = 4821, h2 = 7394, h3 = 9106, h4 = 6253;
echo       for (int i = 0; i ^< clean.Length; i++) {
echo         int c = (int)clean[i];
echo         h1 = (h1 * 31 + c * (i + 7) + 1357) %% 10000;
echo         h2 = (h2 * 37 + c * (i + 13) + 2468) %% 10000;
echo         h3 = (h3 * 41 + c * (i + 19) + 3579) %% 10000;
echo         h4 = (h4 * 43 + c * (i + 23) + 4680) %% 10000;
echo       }
echo       return string.Format("{0:D4}-{1:D4}-{2:D4}-{3:D4}", h1, h2, h3, h4);
echo     }
echo     [STAThread] static void Main() { Application.EnableVisualStyles(); Application.Run(new KeygenForm()); }
echo   }
echo }
) > "%TEMP%\tb_kg.cs"

"%CSC%" /target:winexe /out:"%~dp0TarazBan_Admin_Keygen.exe" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll "%TEMP%\tb_kg.cs"
del "%TEMP%\tb_kg.cs" >nul 2>&1
start "" "%~dp0TarazBan_Admin_Keygen.exe"
