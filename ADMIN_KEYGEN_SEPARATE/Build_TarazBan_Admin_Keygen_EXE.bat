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
echo     TextBox txtHw, txtMaster, txtKey;
echo     public KeygenForm() {
echo       Text = "Arka V6 Hardware Keygen (Vendor Admin Only)";
echo       Size = new Size(520, 360);
echo       StartPosition = FormStartPosition.CenterScreen;
echo       FormBorderStyle = FormBorderStyle.FixedDialog;
echo       MaximizeBox = false;
echo       Font = new Font("Tahoma", 9.5f);
echo       RightToLeft = RightToLeft.Yes;
echo       RightToLeftLayout = true;
echo       Label l1 = new Label() { Text = "۱. شناسه سخت‌افزاری کامپیوتر مشتری (TB-HW-XXXX-XXXX):", Location = new Point(25, 18), Size = new Size(450, 22) };
echo       txtHw = new TextBox() { Text = "TB-HW-9632-6874", Location = new Point(25, 42), Size = new Size(450, 30), Font = new Font("Consolas", 12f, FontStyle.Bold), RightToLeft = RightToLeft.No, TextAlign = HorizontalAlignment.Center };
echo       Label l2 = new Label() { Text = "۲. رمز مادر انحصاری فروشنده (Vendor Master Password):", Location = new Point(25, 80), Size = new Size(450, 22), ForeColor = Color.FromArgb(180, 83, 9) };
echo       txtMaster = new TextBox() { Text = "ARKA-MASTER-2026", Location = new Point(25, 104), Size = new Size(450, 30), Font = new Font("Consolas", 12f, FontStyle.Bold), ForeColor = Color.FromArgb(180, 83, 9), RightToLeft = RightToLeft.No, TextAlign = HorizontalAlignment.Center };
echo       Button btn = new Button() { Text = "محاسبه رمز فعال‌سازی ۱۶ رقمی اختصاصی", Location = new Point(25, 145), Size = new Size(450, 38), BackColor = Color.FromArgb(5, 150, 105), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
echo       txtKey = new TextBox() { ReadOnly = true, Location = new Point(25, 195), Size = new Size(450, 36), Font = new Font("Consolas", 16f, FontStyle.Bold), BackColor = Color.FromArgb(236, 253, 245), ForeColor = Color.FromArgb(4, 120, 87), RightToLeft = RightToLeft.No, TextAlign = HorizontalAlignment.Center };
echo       btn.Click += (s, e) =^> { txtKey.Text = MakeKey(txtHw.Text, txtMaster.Text); };
echo       Controls.AddRange(new Control[] { l1, txtHw, l2, txtMaster, btn, txtKey });
echo     }
echo     static string MakeKey(string rawHw, string rawMaster) {
echo       string cleanHw = Regex.Replace((rawHw ?? "").ToUpperInvariant(), "[^A-Z0-9]", "");
echo       string cleanMaster = Regex.Replace((rawMaster ?? "").ToUpperInvariant(), "[^A-Z0-9]", "");
echo       if (cleanHw.Length ^< 6 ^|^| cleanMaster != "ARKAMASTER2026") return "خطا: رمز مادر یا شناسه نامعتبر";
echo       char[] rev = cleanHw.ToCharArray(); Array.Reverse(rev);
echo       string input = cleanHw + ":ARKA_MASTER_SALT_2026_V6_PRO:" + cleanMaster + ":" + new string(rev);
echo       uint[] seeds = new uint[] { 0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35 };
echo       for (int round = 0; round ^< 4; round++) {
echo         uint hash = seeds[round];
echo         for (int i = 0; i ^< input.Length; i++) {
echo           hash ^= (uint)((int)input[i] + round * 31 + i * 17);
echo           hash *= 0x01000193;
echo         }
echo         seeds[round] = hash;
echo       }
echo       return string.Format("{0:D4}-{1:D4}-{2:D4}-{3:D4}", seeds[0] %% 10000, seeds[1] %% 10000, seeds[2] %% 10000, seeds[3] %% 10000);
echo     }
echo     [STAThread] static void Main() { Application.EnableVisualStyles(); Application.Run(new KeygenForm()); }
echo   }
echo }
) > "%TEMP%\tb_kg.cs"

"%CSC%" /target:winexe /out:"%~dp0Arka_Admin_Keygen_V6.exe" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll "%TEMP%\tb_kg.cs"
del "%TEMP%\tb_kg.cs" >nul 2>&1
start "" "%~dp0Arka_Admin_Keygen_V6.exe"
