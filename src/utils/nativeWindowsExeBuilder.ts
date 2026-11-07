/**
 * Generates:
 * 1) A 100% Native Windows Forms (.NET Framework C# WinForms) .EXE Compiler & Application Package
 *    (`Build_TarazBan_Native_Windows_EXE.bat` -> compiles `TarazBan_Accounting.exe` using Windows' built-in `csc.exe`
 *    with ZERO WebView, ZERO Browser, native DataGridView, native PrintDocument A4 PDF/Print, and Offline Activation Lock).
 * 2) A SEPARATE Admin Offline Keygen .EXE Compiler Package (`Build_TarazBan_Admin_Keygen_EXE.bat` -> compiles `TarazBan_Admin_Keygen.exe`)
 *    plus a standalone Admin Keygen HTML tool so the owner can generate activation codes on PC or mobile, completely separate from the client app.
 */

export function downloadNativeWindowsAccountingExePackage(): void {
  const csharpWinFormsCode = `using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using System.Xml.Serialization;

namespace TarazBanNativeWindows
{
    public class LedgerEntry
    {
        public int Id { get; set; }
        public string Date { get; set; }
        public string Category { get; set; } // اشخاص | بانک ها | هزینه ها | خرید و فروش ارز
        public string EntityName { get; set; } // نام شخص یا بانک یا سرفصل هزینه
        public string Description { get; set; }
        public string Currency { get; set; } // IRR, USD, EUR, CNY, AED
        public decimal ExchangeRate { get; set; }
        public decimal DebitForeign { get; set; }
        public decimal CreditForeign { get; set; }
        public decimal DebitIRR { get; set; }
        public decimal CreditIRR { get; set; }
    }

    public class AppDatabase
    {
        public string CompanyName { get; set; } = "صرافی و بازرگانی ارزی ترازبان";
        public string BaleBotToken { get; set; } = "";
        public string BaleChatId { get; set; } = "";
        public string TelegramBotToken { get; set; } = "";
        public string TelegramChatId { get; set; } = "";
        public List<string> Contacts { get; set; } = new List<string>();
        public List<string> Banks { get; set; } = new List<string>();
        public List<string> Expenses { get; set; } = new List<string>();
        public List<LedgerEntry> Entries { get; set; } = new List<LedgerEntry>();
    }

    public static class LicenseManager
    {
        private static string LicenseFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "arka_master_license_v6.dat");
        private static string LegacyLicenseFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tarazban_license.dat");

        public static string GetHardwareSystemId()
        {
            string rawHw = Environment.MachineName + "|" + Environment.ProcessorCount + "|" + Environment.OSVersion.VersionString;
            try
            {
                using (ManagementObjectSearcher cpuSearcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                {
                    foreach (ManagementObject obj in cpuSearcher.Get())
                    {
                        if (obj["ProcessorId"] != null) rawHw += "|CPU:" + obj["ProcessorId"].ToString().Trim();
                        break;
                    }
                }
            }
            catch { }

            try
            {
                using (ManagementObjectSearcher mbSearcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard"))
                {
                    foreach (ManagementObject obj in mbSearcher.Get())
                    {
                        if (obj["SerialNumber"] != null) rawHw += "|MB:" + obj["SerialNumber"].ToString().Trim();
                        break;
                    }
                }
            }
            catch { }

            try
            {
                string drive = Path.GetPathRoot(Environment.SystemDirectory).Replace(":\\", "");
                using (ManagementObject disk = new ManagementObject("win32_logicaldisk.deviceid=\"" + drive + ":\""))
                {
                    disk.Get();
                    if (disk["VolumeSerialNumber"] != null)
                        rawHw += "|DISK:" + disk["VolumeSerialNumber"].ToString().Trim();
                }
            }
            catch { }

            string upper = rawHw.ToUpperInvariant();
            int b1 = 5381;
            int b2 = 7919;
            for (int i = 0; i < upper.Length; i++)
            {
                int ch = (int)upper[i];
                b1 = (b1 * 33 + ch * (i + 5) + 1013) % 10000;
                b2 = (b2 * 41 + ch * (i + 11) + 2027) % 10000;
            }
            int p1 = (b1 % 9000) + 1000;
            int p2 = (b2 % 9000) + 1000;
            return string.Format("TB-HW-{0:D4}-{1:D4}", p1, p2);
        }

        public static string NormalizeId(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return "";
            return Regex.Replace(raw.ToUpperInvariant(), "[^A-Z0-9]", "");
        }

        public static string ComputeExpectedKey(string machineId)
        {
            string clean = NormalizeId(machineId);
            if (string.IsNullOrEmpty(clean)) return "0000-0000-0000-0000";

            int h1 = 4821;
            int h2 = 7394;
            int h3 = 9106;
            int h4 = 6253;

            for (int i = 0; i < clean.Length; i++)
            {
                int code = (int)clean[i];
                h1 = (h1 * 31 + code * (i + 7) + 1357) % 10000;
                h2 = (h2 * 37 + code * (i + 13) + 2468) % 10000;
                h3 = (h3 * 41 + code * (i + 19) + 3579) % 10000;
                h4 = (h4 * 43 + code * (i + 23) + 4680) % 10000;
            }

            return string.Format("{0:D4}-{1:D4}-{2:D4}-{3:D4}", h1, h2, h3, h4);
        }

        public static bool VerifyKey(string machineId, string enteredKey)
        {
            if (string.IsNullOrWhiteSpace(enteredKey)) return false;
            string trimmed = enteredKey.Trim();

            string expected = Regex.Replace(ComputeExpectedKey(machineId), "[^0-9]", "");
            string enteredDigits = Regex.Replace(trimmed, "[^0-9]", "");
            return enteredDigits.Length == 16 && enteredDigits == expected;
        }

        public static bool VerifyMasterPassword(string enteredMaster)
        {
            if (string.IsNullOrWhiteSpace(enteredMaster)) return false;
            string clean = NormalizeId(enteredMaster);
            return clean == "ARKAMASTER2026";
        }

        public static bool IsActivated()
        {
            try
            {
                if (File.Exists(LegacyLicenseFile))
                {
                    try { File.Delete(LegacyLicenseFile); } catch { }
                }
                if (!File.Exists(LicenseFile)) return false;
                string savedContent = File.ReadAllText(LicenseFile, Encoding.UTF8).Trim();
                if (!savedContent.StartsWith("ARKA_V6::") || !savedContent.EndsWith("::MASTER_VERIFIED"))
                    return false;
                string savedKey = savedContent.Replace("ARKA_V6::", "").Replace("::MASTER_VERIFIED", "");
                return VerifyKey(GetHardwareSystemId(), savedKey);
            }
            catch { return false; }
        }

        public static void SaveLicense(string key)
        {
            File.WriteAllText(LicenseFile, "ARKA_V6::" + key.Trim() + "::MASTER_VERIFIED", Encoding.UTF8);
        }
    }

    // 1. OFFLINE ACTIVATION FORM (REQUIRES 16-DIGIT KEY + VENDOR MASTER PASSWORD)
    public class ActivationForm : Form
    {
        private TextBox txtSystemId;
        private TextBox txtActivationKey;
        private TextBox txtMasterPassword;
        private string systemId;

        public ActivationForm()
        {
            systemId = LicenseManager.GetHardwareSystemId();
            this.Text = "قفل فعال‌سازی دو مرحله‌ای — نرم‌افزار ویندوزی آرکا (ARKA V6)";
            this.Size = new Size(520, 445);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Tahoma", 9.5f, FontStyle.Regular);
            this.BackColor = Color.FromArgb(248, 250, 252);

            Label lblTitle = new Label()
            {
                Text = "فعال‌سازی رسمی نسخه دسکتاپ ویندوز آرکا (نیازمند رمز مادر فروشنده)",
                Font = new Font("Tahoma", 10.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                AutoSize = false,
                Bounds = new Rectangle(25, 18, 455, 28)
            };

            Label lblDesc = new Label()
            {
                Text = "برای باز شدن قفل نرم‌افزار، علاوه بر رمز فعال‌سازی ۱۶ رقمی این سیستم، وارد کردن «رمز مادر انحصاری فروشنده» الزامی است:",
                ForeColor = Color.FromArgb(71, 85, 105),
                AutoSize = false,
                Bounds = new Rectangle(25, 48, 455, 40)
            };

            Label lblSys = new Label()
            {
                Text = "۱. کد شناسایی سیستم شما (System Hardware ID):",
                Font = new Font("Tahoma", 9f, FontStyle.Bold),
                Bounds = new Rectangle(25, 95, 320, 22)
            };

            txtSystemId = new TextBox()
            {
                Text = systemId,
                ReadOnly = true,
                Font = new Font("Consolas", 13f, FontStyle.Bold),
                BackColor = Color.FromArgb(226, 232, 240),
                ForeColor = Color.FromArgb(30, 58, 138),
                TextAlign = HorizontalAlignment.Center,
                RightToLeft = RightToLeft.No,
                Bounds = new Rectangle(135, 120, 345, 32)
            };

            Button btnCopy = new Button()
            {
                Text = "کپی کد سیستم",
                BackColor = Color.FromArgb(51, 65, 85),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(25, 120, 102, 32)
            };
            btnCopy.Click += (s, e) =>
            {
                Clipboard.SetText(systemId);
                MessageBox.Show("کد شناسایی سیستم کپی شد: " + systemId, "کپی شد", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };

            Label lblKey = new Label()
            {
                Text = "۲. رمز فعال‌سازی آفلاین ۱۶ رقمی (XXXX-XXXX-XXXX-XXXX):",
                Font = new Font("Tahoma", 9f, FontStyle.Bold),
                Bounds = new Rectangle(25, 165, 455, 22)
            };

            txtActivationKey = new TextBox()
            {
                Font = new Font("Consolas", 13f, FontStyle.Bold),
                TextAlign = HorizontalAlignment.Center,
                RightToLeft = RightToLeft.No,
                MaxLength = 19,
                Bounds = new Rectangle(25, 190, 455, 34)
            };
            txtActivationKey.TextChanged += TxtActivationKey_TextChanged;

            Label lblMaster = new Label()
            {
                Text = "۳. رمز مادر انحصاری فروشنده (الزامی — بدون رمز مادر کد کار نمی‌کند):",
                Font = new Font("Tahoma", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(180, 83, 9),
                Bounds = new Rectangle(25, 238, 455, 22)
            };

            txtMasterPassword = new TextBox()
            {
                Font = new Font("Consolas", 13f, FontStyle.Bold),
                TextAlign = HorizontalAlignment.Center,
                RightToLeft = RightToLeft.No,
                UseSystemPasswordChar = true,
                Bounds = new Rectangle(25, 263, 455, 34)
            };

            Button btnActivate = new Button()
            {
                Text = "تأیید رمز مادر و فعال‌سازی دائمی نرم‌افزار",
                Font = new Font("Tahoma", 10f, FontStyle.Bold),
                BackColor = Color.FromArgb(4, 120, 87),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(25, 315, 455, 44)
            };
            btnActivate.Click += BtnActivate_Click;

            this.Controls.AddRange(new Control[] { lblTitle, lblDesc, lblSys, txtSystemId, btnCopy, lblKey, txtActivationKey, lblMaster, txtMasterPassword, btnActivate });
        }

        private void TxtActivationKey_TextChanged(object sender, EventArgs e)
        {
            string digits = Regex.Replace(txtActivationKey.Text, "[^0-9]", "");
            if (digits.Length > 16) digits = digits.Substring(0, 16);
            List<string> parts = new List<string>();
            for (int i = 0; i < digits.Length; i += 4)
            {
                parts.Add(digits.Substring(i, Math.Min(4, digits.Length - i)));
            }
            string formatted = string.Join("-", parts);
            if (txtActivationKey.Text != formatted)
            {
                txtActivationKey.Text = formatted;
                txtActivationKey.SelectionStart = formatted.Length;
            }
        }

        private void BtnActivate_Click(object sender, EventArgs e)
        {
            if (!LicenseManager.VerifyKey(systemId, txtActivationKey.Text))
            {
                MessageBox.Show("رمز فعال‌سازی ۱۶ رقمی وارد شده برای این سیستم معتبر نیست!", "خطای کد ۱۶ رقمی", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            if (!LicenseManager.VerifyMasterPassword(txtMasterPassword.Text))
            {
                MessageBox.Show("رمز مادر فروشنده وارد نشده یا اشتباه است! بدون رمز مادر فروشنده، کد ۱۶ رقمی به تنهایی فاقد اعتبار است.", "خطای رمز مادر فروشنده", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            LicenseManager.SaveLicense(txtActivationKey.Text);
            MessageBox.Show("نرم‌افزار آرکا با تأیید رمز مادر فروشنده به صورت دائمی روی این سیستم فعال شد!", "فعال‌سازی موفق", MessageBoxButtons.OK, MessageBoxIcon.Information);
            this.DialogResult = DialogResult.OK;
            this.Close();
        }
    }

    // 2. MAIN NATIVE WINDOWS ACCOUNTING & FX APPLICATION FORM
    public class MainAccountingForm : Form
    {
        private AppDatabase db;
        private string dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "TarazBan_Database.xml");

        private ComboBox cmbDealType, cmbCurrency, cmbFxPerson, cmbFxBank;
        private TextBox txtFxAmount, txtFxRate, txtFxTotalIRR, txtFxDesc;
        private DataGridView dgvVault, dgvLedger;

        private ComboBox cmbReportCategory, cmbReportEntity, cmbReportMode;
        private Label lblSummaryTotals;

        private ComboBox cmbVchCategory, cmbVchEntity, cmbVchCurrency, cmbVchSide;
        private TextBox txtVchAmount, txtVchRate, txtVchDesc;

        private TextBox txtBaleToken, txtBaleChat, txtTelToken, txtTelChat, txtNewEntityName;
        private ComboBox cmbNewEntityType;

        private List<string[]> currentPrintRows = new List<string[]>();
        private string currentPrintTitle = "";
        private string currentPrintSubtitle = "";

        public MainAccountingForm()
        {
            LoadDatabase();
            this.Text = "ترازبان ویندوز (نسخه بومی .EXE) — سیستم جامع خرید و فروش ارز و حسابداری دوارزی";
            this.Size = new Size(1320, 820);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Tahoma", 9f, FontStyle.Regular);
            this.BackColor = Color.FromArgb(241, 245, 249);

            TabControl tabs = new TabControl()
            {
                Dock = DockStyle.Fill,
                Font = new Font("Tahoma", 9.5f, FontStyle.Bold),
                Padding = new Point(14, 8)
            };

            TabPage tabFx = new TabPage("۱. میز خرید و فروش ارز (صرافی)");
            TabPage tabReports = new TabPage("۲. گزارشات استاندارد (بانک / اشخاص / هزینه) + PDF و چاپ");
            TabPage tabVoucher = new TabPage("۳. ثبت سند دوارزی، بانک و هزینه");
            TabPage tabDefinitions = new TabPage("۴. تعریف اشخاص/بانک، بکاپ کامل و بات بله/تلگرام");

            BuildFxTab(tabFx);
            BuildReportsTab(tabReports);
            BuildVoucherTab(tabVoucher);
            BuildDefinitionsTab(tabDefinitions);

            tabs.TabPages.AddRange(new TabPage[] { tabFx, tabReports, tabVoucher, tabDefinitions });
            this.Controls.Add(tabs);

            RefreshAllCombos();
            RefreshVaultGrid();
            RefreshReportGrid();
        }

        private void LoadDatabase()
        {
            if (File.Exists(dbPath))
            {
                try
                {
                    XmlSerializer ser = new XmlSerializer(typeof(AppDatabase));
                    using (StreamReader sr = new StreamReader(dbPath, Encoding.UTF8))
                    {
                        db = (AppDatabase)ser.Deserialize(sr);
                        return;
                    }
                }
                catch { }
            }

            db = new AppDatabase();
            db.Contacts.AddRange(new[] {
                "شرکت مهندسی صنایع فولاد کاوه",
                "بازرگانی بین‌المللی النور دبی",
                "تأمین قطعات شنژن الکترونیک",
                "مجتمع پتروشیمی زاگرس نوین"
            });
            db.Banks.AddRange(new[] {
                "بانک ملت ریالی (حساب جاری)",
                "خزانه ارزی دلاری (USD)",
                "حساب تجاری درهم دبی (AED)",
                "حساب بازرگانی یوان شانگهای (CNY)"
            });
            db.Expenses.AddRange(new[] {
                "هزینه کارمزد بانکی و سوئیفت ارزی",
                "هزینه حمل و ترخیص گمرکی",
                "هزینه حقوق و دستمزد و اداری"
            });

            db.Entries.Add(new LedgerEntry {
                Id = 1001, Date = "1404/08/01", Category = "بانک ها", EntityName = "خزانه ارزی دلاری (USD)",
                Description = "خرید ۵۰,۰۰۰.۰۰ دلار اسکناس و حواله به نرخ ۶۸۱,۰۰۰ ریال", Currency = "USD",
                ExchangeRate = 681000m, DebitForeign = 50000m, CreditForeign = 0m, DebitIRR = 34050000000m, CreditIRR = 0m
            });
            db.Entries.Add(new LedgerEntry {
                Id = 1002, Date = "1404/08/01", Category = "اشخاص", EntityName = "بازرگانی بین‌المللی النور دبی",
                Description = "بستانکاری بابت خرید ۵۰,۰۰۰.۰۰ دلار به نرخ ۶۸۱,۰۰۰ ریال", Currency = "USD",
                ExchangeRate = 681000m, DebitForeign = 0m, CreditForeign = 50000m, DebitIRR = 0m, CreditIRR = 34050000000m
            });
            db.Entries.Add(new LedgerEntry {
                Id = 1003, Date = "1404/08/05", Category = "اشخاص", EntityName = "شرکت مهندسی صنایع فولاد کاوه",
                Description = "فروش ۱۸,۰۰۰.۰۰ دلار به مشتری به نرخ ۶۸۵,۵۰۰ ریال", Currency = "USD",
                ExchangeRate = 685500m, DebitForeign = 18000m, CreditForeign = 0m, DebitIRR = 12339000000m, CreditIRR = 0m
            });
            db.Entries.Add(new LedgerEntry {
                Id = 1004, Date = "1404/08/05", Category = "بانک ها", EntityName = "خزانه ارزی دلاری (USD)",
                Description = "خروج ۱۸,۰۰۰.۰۰ دلار از خزانه بابت فروش به فولاد کاوه", Currency = "USD",
                ExchangeRate = 685500m, DebitForeign = 0m, CreditForeign = 18000m, DebitIRR = 0m, CreditIRR = 12339000000m
            });
            db.Entries.Add(new LedgerEntry {
                Id = 1005, Date = "1404/08/08", Category = "هزینه ها", EntityName = "هزینه کارمزد بانکی و سوئیفت ارزی",
                Description = "پرداخت کارمزد حواله سوئیفت ارزی", Currency = "USD",
                ExchangeRate = 685000m, DebitForeign = 45.50m, CreditForeign = 0m, DebitIRR = 31167500m, CreditIRR = 0m
            });
            SaveDatabase();
        }

        private void SaveDatabase()
        {
            try
            {
                XmlSerializer ser = new XmlSerializer(typeof(AppDatabase));
                using (StreamWriter sw = new StreamWriter(dbPath, false, Encoding.UTF8))
                {
                    ser.Serialize(sw, db);
                }
            }
            catch { }
        }

        public static string FormatAmount(decimal val, string currency)
        {
            if (currency == "IRR")
                return Math.Round(val).ToString("N0", CultureInfo.InvariantCulture);
            return val.ToString("N2", CultureInfo.InvariantCulture);
        }

        private void AttachThreeDigitFormatter(TextBox txt, Func<bool> allowDecimals)
        {
            txt.RightToLeft = RightToLeft.No;
            txt.TextAlign = HorizontalAlignment.Left;
            txt.Font = new Font("Consolas", 10.5f, FontStyle.Bold);
            bool busy = false;
            txt.TextChanged += (s, e) =>
            {
                if (busy) return;
                busy = true;
                try
                {
                    string raw = Regex.Replace(txt.Text, "[^0-9.]", "");
                    if (string.IsNullOrEmpty(raw)) { txt.Text = ""; busy = false; return; }
                    string[] parts = raw.Split('.');
                    long intVal = 0;
                    long.TryParse(parts[0], out intVal);
                    string formatted = intVal.ToString("N0", CultureInfo.InvariantCulture);
                    if (allowDecimals() && parts.Length > 1)
                    {
                        string dec = parts[1].Length > 2 ? parts[1].Substring(0, 2) : parts[1];
                        formatted += "." + dec;
                    }
                    txt.Text = formatted;
                    txt.SelectionStart = txt.Text.Length;
                }
                catch { }
                busy = false;
            };
        }

        private decimal ParseBox(TextBox txt)
        {
            string clean = Regex.Replace(txt.Text ?? "", "[^0-9.]", "");
            decimal d = 0m;
            decimal.TryParse(clean, NumberStyles.Any, CultureInfo.InvariantCulture, out d);
            return d;
        }

        private void BuildFxTab(TabPage page)
        {
            page.BackColor = Color.White;
            GroupBox grpForm = new GroupBox()
            {
                Text = "ثبت فوری معامله خرید یا فروش ارز (اعداد ۳ رقم ۳ رقم + اعشار دقیق ارزی + صدور خودکار سند دوبل)",
                Bounds = new Rectangle(15, 12, 1260, 175)
            };

            Label l1 = new Label() { Text = "نوع عملیات:", Bounds = new Rectangle(18, 32, 90, 22) };
            cmbDealType = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(18, 56, 190, 28) };
            cmbDealType.Items.AddRange(new object[] { "خرید ارز (ورود به خزانه)", "فروش ارز (خروج از خزانه)" });
            cmbDealType.SelectedIndex = 0;

            Label l2 = new Label() { Text = "انتخاب ارز:", Bounds = new Rectangle(220, 32, 90, 22) };
            cmbCurrency = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(220, 56, 130, 28) };
            cmbCurrency.Items.AddRange(new object[] { "USD", "EUR", "CNY", "AED" });
            cmbCurrency.SelectedIndex = 0;

            Label l3 = new Label() { Text = "مقدار ارز (با اعشار .00):", Bounds = new Rectangle(365, 32, 160, 22) };
            txtFxAmount = new TextBox() { Text = "5,000.00", Bounds = new Rectangle(365, 56, 160, 28) };
            AttachThreeDigitFormatter(txtFxAmount, () => true);

            Label l4 = new Label() { Text = "نرخ تبدیل واحد (ریال):", Bounds = new Rectangle(540, 32, 160, 22) };
            txtFxRate = new TextBox() { Text = "685,000", BackColor = Color.FromArgb(254, 243, 199), Bounds = new Rectangle(540, 56, 160, 28) };
            AttachThreeDigitFormatter(txtFxRate, () => false);

            Label l5 = new Label() { Text = "معادل کل به ریال ایران:", Bounds = new Rectangle(715, 32, 175, 22) };
            txtFxTotalIRR = new TextBox() { ReadOnly = true, BackColor = Color.FromArgb(219, 234, 254), Bounds = new Rectangle(715, 56, 210, 28) };
            AttachThreeDigitFormatter(txtFxTotalIRR, () => false);

            EventHandler recalc = (s, e) =>
            {
                decimal amt = ParseBox(txtFxAmount);
                decimal rt = ParseBox(txtFxRate);
                txtFxTotalIRR.Text = Math.Round(amt * rt).ToString("N0", CultureInfo.InvariantCulture);
            };
            txtFxAmount.TextChanged += recalc;
            txtFxRate.TextChanged += recalc;
            recalc(null, null);

            Label l6 = new Label() { Text = "طرف حساب (مشتری / صرافی):", Bounds = new Rectangle(18, 98, 175, 22) };
            cmbFxPerson = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(18, 122, 290, 28) };

            Label l7 = new Label() { Text = "خزانه / بانک ارزی:", Bounds = new Rectangle(325, 98, 140, 22) };
            cmbFxBank = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(325, 122, 260, 28) };

            Label l8 = new Label() { Text = "شرح معامله:", Bounds = new Rectangle(600, 98, 100, 22) };
            txtFxDesc = new TextBox() { Text = "معامله نقدی/حواله ارزی به نرخ روز", Bounds = new Rectangle(600, 122, 325, 28) };

            Button btnSaveFx = new Button()
            {
                Text = "ثبت قطعی معامله ارز + صدور خودکار سند",
                BackColor = Color.FromArgb(4, 120, 87),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(945, 54, 295, 96)
            };
            btnSaveFx.Click += BtnSaveFx_Click;

            grpForm.Controls.AddRange(new Control[] { l1, cmbDealType, l2, cmbCurrency, l3, txtFxAmount, l4, txtFxRate, l5, txtFxTotalIRR, l6, cmbFxPerson, l7, cmbFxBank, l8, txtFxDesc, btnSaveFx });

            GroupBox grpVault = new GroupBox()
            {
                Text = "موجودی لحظه‌ای خزانه ارزی، میانگین نرخ خرید و فروش و سود تحقق‌یافته معاملات (با اعشار دقیق ارزی)",
                Bounds = new Rectangle(15, 198, 1260, 520)
            };

            dgvVault = new DataGridView()
            {
                Dock = DockStyle.Fill,
                ReadOnly = true,
                AllowUserToAddRows = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor = Color.White,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            grpVault.Controls.Add(dgvVault);

            page.Controls.Add(grpForm);
            page.Controls.Add(grpVault);
        }

        private void BtnSaveFx_Click(object sender, EventArgs e)
        {
            decimal amt = ParseBox(txtFxAmount);
            decimal rate = ParseBox(txtFxRate);
            if (amt <= 0 || rate <= 0) return;

            decimal totalIRR = Math.Round(amt * rate);
            bool isBuy = cmbDealType.SelectedIndex == 0;
            string curr = cmbCurrency.Text;
            string person = cmbFxPerson.Text;
            string bank = cmbFxBank.Text;
            string today = "1404/08/12";
            int nextId = db.Entries.Count > 0 ? db.Entries.Max(x => x.Id) + 1 : 1001;

            if (isBuy)
            {
                db.Entries.Add(new LedgerEntry {
                    Id = nextId, Date = today, Category = "بانک ها", EntityName = bank,
                    Description = "ورود ارز بابت خرید از " + person + " (" + txtFxDesc.Text + ")",
                    Currency = curr, ExchangeRate = rate, DebitForeign = amt, CreditForeign = 0m, DebitIRR = totalIRR, CreditIRR = 0m
                });
                db.Entries.Add(new LedgerEntry {
                    Id = nextId + 1, Date = today, Category = "اشخاص", EntityName = person,
                    Description = "بستانکاری بابت فروش " + FormatAmount(amt, curr) + " " + curr + " به صرافی ما",
                    Currency = curr, ExchangeRate = rate, DebitForeign = 0m, CreditForeign = amt, DebitIRR = 0m, CreditIRR = totalIRR
                });
            }
            else
            {
                db.Entries.Add(new LedgerEntry {
                    Id = nextId, Date = today, Category = "اشخاص", EntityName = person,
                    Description = "بدهکاری بابت خرید " + FormatAmount(amt, curr) + " " + curr + " (" + txtFxDesc.Text + ")",
                    Currency = curr, ExchangeRate = rate, DebitForeign = amt, CreditForeign = 0m, DebitIRR = totalIRR, CreditIRR = 0m
                });
                db.Entries.Add(new LedgerEntry {
                    Id = nextId + 1, Date = today, Category = "بانک ها", EntityName = bank,
                    Description = "خروج ارز بابت فروش به " + person,
                    Currency = curr, ExchangeRate = rate, DebitForeign = 0m, CreditForeign = amt, DebitIRR = 0m, CreditIRR = totalIRR
                });
            }

            SaveDatabase();
            RefreshVaultGrid();
            RefreshReportGrid();
            MessageBox.Show("معامله ارزی و سند حسابداری دوبل آن (در کاردکس بانک و کاردکس شخص) با موفقیت ثبت شد.", "ثبت موفق", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void RefreshVaultGrid()
        {
            dgvVault.Columns.Clear();
            dgvVault.Rows.Clear();
            dgvVault.Columns.Add("Curr", "کد ارز");
            dgvVault.Columns.Add("Bought", "کل خریداری شده (با اعشار)");
            dgvVault.Columns.Add("AvgBuy", "میانگین نرخ خرید (ریال)");
            dgvVault.Columns.Add("Sold", "کل فروخته شده (با اعشار)");
            dgvVault.Columns.Add("AvgSell", "میانگین نرخ فروش (ریال)");
            dgvVault.Columns.Add("Balance", "موجودی خالص خزانه ارزی");
            dgvVault.Columns.Add("Profit", "سود قطعی تحقق‌یافته (ریال)");

            foreach (string c in new[] { "USD", "EUR", "CNY", "AED" })
            {
                var bankLines = db.Entries.Where(x => x.Category == "بانک ها" && x.Currency == c).ToList();
                decimal boughtF = bankLines.Sum(x => x.DebitForeign);
                decimal boughtR = bankLines.Sum(x => x.DebitIRR);
                decimal soldF = bankLines.Sum(x => x.CreditForeign);
                decimal soldR = bankLines.Sum(x => x.CreditIRR);

                decimal avgBuy = boughtF > 0 ? Math.Round(boughtR / boughtF) : 0m;
                decimal avgSell = soldF > 0 ? Math.Round(soldR / soldF) : 0m;
                decimal netF = boughtF - soldF;
                decimal matched = Math.Min(boughtF, soldF);
                decimal profit = Math.Round(matched * (avgSell - avgBuy));

                dgvVault.Rows.Add(
                    c,
                    FormatAmount(boughtF, c) + " " + c,
                    FormatAmount(avgBuy, "IRR") + " ریال",
                    FormatAmount(soldF, c) + " " + c,
                    FormatAmount(avgSell, "IRR") + " ریال",
                    FormatAmount(netF, c) + " " + c,
                    "+" + FormatAmount(profit, "IRR") + " ریال"
                );
            }
        }

        private void BuildReportsTab(TabPage page)
        {
            page.BackColor = Color.White;
            Panel topPanel = new Panel() { Bounds = new Rectangle(15, 12, 1260, 105), BackColor = Color.FromArgb(248, 250, 252), BorderStyle = BorderStyle.FixedSingle };

            Label lCat = new Label() { Text = "۱. انتخاب بخش گزارش:", Bounds = new Rectangle(15, 14, 150, 22) };
            cmbReportCategory = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(15, 38, 190, 28) };
            cmbReportCategory.Items.AddRange(new object[] { "اشخاص", "بانک ها", "هزینه ها", "همه حساب ها" });
            cmbReportCategory.SelectedIndex = 0;

            Label lEnt = new Label() { Text = "۲. انتخاب شخص / بانک / هزینه:", Bounds = new Rectangle(220, 14, 210, 22) };
            cmbReportEntity = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(220, 38, 310, 28) };

            Label lMode = new Label() { Text = "۳. نوع صورتحساب:", Bounds = new Rectangle(545, 14, 160, 22) };
            cmbReportMode = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(545, 38, 240, 28) };
            cmbReportMode.Items.AddRange(new object[] { "صورتحساب استاندارد ریالی (IRR)", "صورتحساب استاندارد ارزی (با اعشار .00)" });
            cmbReportMode.SelectedIndex = 0;

            cmbReportCategory.SelectedIndexChanged += (s, e) => { PopulateReportEntities(); RefreshReportGrid(); };
            cmbReportEntity.SelectedIndexChanged += (s, e) => RefreshReportGrid();
            cmbReportMode.SelectedIndexChanged += (s, e) => RefreshReportGrid();

            Button btnPrintPdf = new Button()
            {
                Text = "چاپ رسمی A4 / خروجی PDF ویندوز",
                BackColor = Color.FromArgb(29, 78, 216),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(805, 25, 225, 46)
            };
            btnPrintPdf.Click += BtnPrintPdf_Click;

            Button btnSendBot = new Button()
            {
                Text = "ارسال صورتحساب به بات بله/تلگرام",
                BackColor = Color.FromArgb(4, 120, 87),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(1040, 25, 205, 46)
            };
            btnSendBot.Click += BtnSendBot_Click;

            lblSummaryTotals = new Label()
            {
                Text = "جمع بدهکار و بستانکار و مانده نهایی از بالا به پایین:",
                Font = new Font("Tahoma", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 58, 138),
                Bounds = new Rectangle(15, 74, 1220, 24)
            };

            topPanel.Controls.AddRange(new Control[] { lCat, cmbReportCategory, lEnt, cmbReportEntity, lMode, cmbReportMode, btnPrintPdf, btnSendBot, lblSummaryTotals });

            dgvLedger = new DataGridView()
            {
                Bounds = new Rectangle(15, 125, 1260, 595),
                ReadOnly = true,
                AllowUserToAddRows = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor = Color.White,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };

            page.Controls.Add(topPanel);
            page.Controls.Add(dgvLedger);
        }

        private void PopulateReportEntities()
        {
            if (cmbReportEntity == null) return;
            cmbReportEntity.Items.Clear();
            cmbReportEntity.Items.Add("همه موارد این بخش");
            string cat = cmbReportCategory.Text;
            if (cat == "اشخاص") foreach (var c in db.Contacts) cmbReportEntity.Items.Add(c);
            else if (cat == "بانک ها") foreach (var b in db.Banks) cmbReportEntity.Items.Add(b);
            else if (cat == "هزینه ها") foreach (var ex in db.Expenses) cmbReportEntity.Items.Add(ex);
            cmbReportEntity.SelectedIndex = 0;
        }

        private void RefreshReportGrid()
        {
            if (dgvLedger == null) return;
            dgvLedger.Columns.Clear();
            dgvLedger.Rows.Clear();
            currentPrintRows.Clear();

            bool isRial = cmbReportMode.SelectedIndex == 0;
            string cat = cmbReportCategory.Text;
            string ent = cmbReportEntity.Text;

            dgvLedger.Columns.Add("Row", "ردیف");
            dgvLedger.Columns.Add("Date", "تاریخ");
            dgvLedger.Columns.Add("Doc", "سند");
            dgvLedger.Columns.Add("Entity", "نام حساب / شخص / بانک");
            dgvLedger.Columns.Add("Desc", "شرح عملیات حسابداری");
            dgvLedger.Columns.Add("Rate", "ارز و نرخ تبدیل");
            dgvLedger.Columns.Add("Debit", isRial ? "بدهکار (ریال)" : "بدهکار ارزی (.00)");
            dgvLedger.Columns.Add("Credit", isRial ? "بستانکار (ریال)" : "بستانکار ارزی (.00)");
            dgvLedger.Columns.Add("Diag", "تشخیص");
            dgvLedger.Columns.Add("Balance", isRial ? "مانده از بالا به پایین (ریال) ↓" : "مانده از بالا به پایین ارزی ↓");

            var list = db.Entries.AsEnumerable();
            if (cat != "همه حساب ها") list = list.Where(x => x.Category == cat);
            if (!string.IsNullOrEmpty(ent) && ent != "همه موارد این بخش") list = list.Where(x => x.EntityName == ent);

            decimal runIRR = 0m, runFor = 0m, totDebIRR = 0m, totCredIRR = 0m, totDebFor = 0m, totCredFor = 0m;
            int idx = 1;

            foreach (var item in list.OrderBy(x => x.Id))
            {
                runIRR += item.DebitIRR - item.CreditIRR;
                runFor += item.DebitForeign - item.CreditForeign;
                totDebIRR += item.DebitIRR;
                totCredIRR += item.CreditIRR;
                totDebFor += item.DebitForeign;
                totCredFor += item.CreditForeign;

                string diag = (isRial ? runIRR : runFor) > 0 ? "بدهکار" : (isRial ? runIRR : runFor) < 0 ? "بستانکار" : "تسویه";
                string debStr = isRial ? FormatAmount(item.DebitIRR, "IRR") : FormatAmount(item.DebitForeign, item.Currency) + " " + item.Currency;
                string credStr = isRial ? FormatAmount(item.CreditIRR, "IRR") : FormatAmount(item.CreditForeign, item.Currency) + " " + item.Currency;
                string balStr = isRial ? FormatAmount(Math.Abs(runIRR), "IRR") : FormatAmount(Math.Abs(runFor), item.Currency) + " " + item.Currency;
                string rateStr = item.Currency + " (" + FormatAmount(item.ExchangeRate, "IRR") + ")";

                string[] rowCells = new string[] {
                    idx.ToString(), item.Date, "#" + item.Id, item.EntityName, item.Description, rateStr, debStr, credStr, diag, balStr
                };
                dgvLedger.Rows.Add(rowCells);
                currentPrintRows.Add(rowCells);
                idx++;
            }

            string finalDiag = (isRial ? runIRR : runFor) > 0 ? "بدهکار" : (isRial ? runIRR : runFor) < 0 ? "بستانکار" : "تسویه";
            currentPrintTitle = "گزارش استاندارد حسابداری: " + cat + " — " + ent;
            currentPrintSubtitle = isRial
                ? "جمع بدهکار: " + FormatAmount(totDebIRR, "IRR") + " ریال   |   جمع بستانکار: " + FormatAmount(totCredIRR, "IRR") + " ریال   |   مانده نهایی از بالا به پایین: " + FormatAmount(Math.Abs(runIRR), "IRR") + " ریال (" + finalDiag + ")"
                : "جمع بدهکار ارزی: " + FormatAmount(totDebFor, "USD") + "   |   جمع بستانکار ارزی: " + FormatAmount(totCredFor, "USD") + "   |   مانده نهایی ارزی: " + FormatAmount(Math.Abs(runFor), "USD") + " (" + finalDiag + ")";

            lblSummaryTotals.Text = currentPrintSubtitle;
        }

        private void BtnPrintPdf_Click(object sender, EventArgs e)
        {
            PrintDocument pd = new PrintDocument();
            pd.DefaultPageSettings.Landscape = true;
            pd.PrintPage += Pd_PrintPage;

            PrintPreviewDialog preview = new PrintPreviewDialog()
            {
                Document = pd,
                Width = 1100,
                Height = 760,
                StartPosition = FormStartPosition.CenterScreen
            };
            MessageBox.Show("در پنجره پیش‌نمایش چاپ ویندوز، روی آیکون چاپگر کلیک کرده و برای ذخیره PDF گزینه «Microsoft Print to PDF» را انتخاب نمایید.", "خروجی PDF و چاپ رسمی ویندوز", MessageBoxButtons.OK, MessageBoxIcon.Information);
            preview.ShowDialog();
        }

        private void Pd_PrintPage(object sender, PrintPageEventArgs e)
        {
            Graphics g = e.Graphics;
            Font fTitle = new Font("Tahoma", 13f, FontStyle.Bold);
            Font fSub = new Font("Tahoma", 9.5f, FontStyle.Bold);
            Font fHeader = new Font("Tahoma", 8.5f, FontStyle.Bold);
            Font fCell = new Font("Tahoma", 8.5f, FontStyle.Regular);

            int left = 40, top = 40, width = e.PageBounds.Width - 80;
            StringFormat rtlFormat = new StringFormat() { Alignment = StringAlignment.Near, FormatFlags = StringFormatFlags.DirectionRightToLeft };

            g.FillRectangle(new SolidBrush(Color.FromArgb(241, 245, 249)), left, top, width, 65);
            g.DrawRectangle(Pens.Black, left, top, width, 65);
            g.DrawString(db.CompanyName + " — " + currentPrintTitle, fTitle, Brushes.Black, new RectangleF(left + 10, top + 8, width - 20, 28), rtlFormat);
            g.DrawString(currentPrintSubtitle, fSub, Brushes.DarkBlue, new RectangleF(left + 10, top + 38, width - 20, 24), rtlFormat);

            top += 80;
            string[] headers = new[] { "مانده از بالا به پایین", "تشخیص", "بستانکار", "بدهکار", "ارز و نرخ", "شرح عملیات", "نام حساب / شخص", "سند", "تاریخ", "ردیف" };
            int[] colWidths = new[] { 135, 65, 115, 115, 105, 250, 155, 55, 75, 45 };

            int curX = left;
            for (int c = 0; c < headers.Length; c++)
            {
                g.FillRectangle(new SolidBrush(Color.FromArgb(30, 41, 59)), curX, top, colWidths[c], 28);
                g.DrawRectangle(Pens.Black, curX, top, colWidths[c], 28);
                g.DrawString(headers[c], fHeader, Brushes.White, new RectangleF(curX + 3, top + 5, colWidths[c] - 6, 20), rtlFormat);
                curX += colWidths[c];
            }
            top += 28;

            foreach (var r in currentPrintRows.Take(18))
            {
                curX = left;
                string[] rev = new[] { r[9], r[8], r[7], r[6], r[5], r[4], r[3], r[2], r[1], r[0] };
                for (int c = 0; c < rev.Length; c++)
                {
                    g.DrawRectangle(Pens.Gray, curX, top, colWidths[c], 24);
                    g.DrawString(rev[c], fCell, Brushes.Black, new RectangleF(curX + 3, top + 4, colWidths[c] - 6, 18), rtlFormat);
                    curX += colWidths[c];
                }
                top += 24;
            }
        }

        private void BuildVoucherTab(TabPage page)
        {
            page.BackColor = Color.White;
            GroupBox grp = new GroupBox()
            {
                Text = "ثبت سند حسابداری روزانه (واریز/برداشت بانک، بدهکار/بستانکار شخص یا ثبت هزینه — ریالی و ارزی)",
                Bounds = new Rectangle(15, 15, 1260, 220)
            };

            Label l1 = new Label() { Text = "بخش حسابداری:", Bounds = new Rectangle(20, 35, 130, 22) };
            cmbVchCategory = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(20, 60, 190, 28) };
            cmbVchCategory.Items.AddRange(new object[] { "اشخاص", "بانک ها", "هزینه ها" });
            cmbVchCategory.SelectedIndex = 0;

            Label l2 = new Label() { Text = "انتخاب حساب / شخص / بانک:", Bounds = new Rectangle(225, 35, 200, 22) };
            cmbVchEntity = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(225, 60, 310, 28) };

            cmbVchCategory.SelectedIndexChanged += (s, e) =>
            {
                cmbVchEntity.Items.Clear();
                if (cmbVchCategory.Text == "اشخاص") foreach (var c in db.Contacts) cmbVchEntity.Items.Add(c);
                else if (cmbVchCategory.Text == "بانک ها") foreach (var b in db.Banks) cmbVchEntity.Items.Add(b);
                else foreach (var ex in db.Expenses) cmbVchEntity.Items.Add(ex);
                if (cmbVchEntity.Items.Count > 0) cmbVchEntity.SelectedIndex = 0;
            };

            Label l3 = new Label() { Text = "ماهیت آرتیکل:", Bounds = new Rectangle(550, 35, 130, 22) };
            cmbVchSide = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(550, 60, 190, 28) };
            cmbVchSide.Items.AddRange(new object[] { "بدهکار (دریافتی بانک / بدهکاری شخص / هزینه)", "بستانکار (برداشت بانک / بستانکاری شخص)" });
            cmbVchSide.SelectedIndex = 0;

            Label l4 = new Label() { Text = "نوع ارز:", Bounds = new Rectangle(755, 35, 90, 22) };
            cmbVchCurrency = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(755, 60, 110, 28) };
            cmbVchCurrency.Items.AddRange(new object[] { "IRR", "USD", "EUR", "CNY", "AED" });
            cmbVchCurrency.SelectedIndex = 0;

            Label l5 = new Label() { Text = "مبلغ (۳ رقم ۳ رقم):", Bounds = new Rectangle(20, 110, 150, 22) };
            txtVchAmount = new TextBox() { Text = "25,000,000", Bounds = new Rectangle(20, 135, 200, 28) };
            AttachThreeDigitFormatter(txtVchAmount, () => cmbVchCurrency.Text != "IRR");

            Label l6 = new Label() { Text = "نرخ تبدیل به ریال:", Bounds = new Rectangle(235, 110, 150, 22) };
            txtVchRate = new TextBox() { Text = "1", Bounds = new Rectangle(235, 135, 160, 28) };
            AttachThreeDigitFormatter(txtVchRate, () => false);

            cmbVchCurrency.SelectedIndexChanged += (s, e) =>
            {
                if (cmbVchCurrency.Text == "IRR") txtVchRate.Text = "1";
                else if (cmbVchCurrency.Text == "USD") txtVchRate.Text = "685,000";
                else if (cmbVchCurrency.Text == "EUR") txtVchRate.Text = "742,000";
                else if (cmbVchCurrency.Text == "CNY") txtVchRate.Text = "95,200";
                else if (cmbVchCurrency.Text == "AED") txtVchRate.Text = "186,500";
            };

            Label l7 = new Label() { Text = "شرح کامل سند حسابداری:", Bounds = new Rectangle(410, 110, 220, 22) };
            txtVchDesc = new TextBox() { Text = "ثبت گردش حسابداری روزانه", Bounds = new Rectangle(410, 135, 455, 28) };

            Button btnAddVch = new Button()
            {
                Text = "ثبت در دفاتر و بروزرسانی مانده",
                BackColor = Color.FromArgb(29, 78, 216),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(885, 60, 345, 105)
            };
            btnAddVch.Click += (s, e) =>
            {
                decimal amt = ParseBox(txtVchAmount);
                decimal rt = cmbVchCurrency.Text == "IRR" ? 1m : ParseBox(txtVchRate);
                if (amt <= 0 || rt <= 0) return;

                decimal irr = Math.Round(amt * rt);
                bool isDeb = cmbVchSide.SelectedIndex == 0;
                int nextId = db.Entries.Count > 0 ? db.Entries.Max(x => x.Id) + 1 : 1001;

                db.Entries.Add(new LedgerEntry
                {
                    Id = nextId,
                    Date = "1404/08/12",
                    Category = cmbVchCategory.Text,
                    EntityName = cmbVchEntity.Text,
                    Description = txtVchDesc.Text,
                    Currency = cmbVchCurrency.Text,
                    ExchangeRate = rt,
                    DebitForeign = isDeb ? amt : 0m,
                    CreditForeign = isDeb ? 0m : amt,
                    DebitIRR = isDeb ? irr : 0m,
                    CreditIRR = isDeb ? 0m : irr
                });

                SaveDatabase();
                RefreshVaultGrid();
                RefreshReportGrid();
                MessageBox.Show("سند با موفقیت ثبت شد و به مانده از بالا به پایین اضافه گردید.", "ثبت سند", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };

            grp.Controls.AddRange(new Control[] { l1, cmbVchCategory, l2, cmbVchEntity, l3, cmbVchSide, l4, cmbVchCurrency, l5, txtVchAmount, l6, txtVchRate, l7, txtVchDesc, btnAddVch });
            page.Controls.Add(grp);
        }

        private void BuildDefinitionsTab(TabPage page)
        {
            page.BackColor = Color.White;
            GroupBox grpDef = new GroupBox()
            {
                Text = "افزودن سریع شخص جدید، حساب بانکی جدید یا سرفصل هزینه جدید",
                Bounds = new Rectangle(15, 15, 610, 210)
            };

            Label ld1 = new Label() { Text = "نوع تعریف:", Bounds = new Rectangle(20, 35, 120, 22) };
            cmbNewEntityType = new ComboBox() { DropDownStyle = ComboBoxStyle.DropDownList, Bounds = new Rectangle(20, 60, 220, 28) };
            cmbNewEntityType.Items.AddRange(new object[] { "اشخاص (مشتری / صرافی)", "بانک ها و خزانه", "سرفصل هزینه" });
            cmbNewEntityType.SelectedIndex = 0;

            Label ld2 = new Label() { Text = "عنوان کامل:", Bounds = new Rectangle(260, 35, 150, 22) };
            txtNewEntityName = new TextBox() { Bounds = new Rectangle(260, 60, 320, 28) };

            Button btnSaveEntity = new Button()
            {
                Text = "+ افزودن به لیست حساب‌ها",
                BackColor = Color.FromArgb(30, 58, 138),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(20, 110, 560, 42)
            };
            btnSaveEntity.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(txtNewEntityName.Text)) return;
                if (cmbNewEntityType.SelectedIndex == 0) db.Contacts.Add(txtNewEntityName.Text.Trim());
                else if (cmbNewEntityType.SelectedIndex == 1) db.Banks.Add(txtNewEntityName.Text.Trim());
                else db.Expenses.Add(txtNewEntityName.Text.Trim());
                SaveDatabase();
                RefreshAllCombos();
                txtNewEntityName.Text = "";
                MessageBox.Show("با موفقیت به سیستم اضافه شد.", "ثبت شد", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
            grpDef.Controls.AddRange(new Control[] { ld1, cmbNewEntityType, ld2, txtNewEntityName, btnSaveEntity });

            GroupBox grpBot = new GroupBox()
            {
                Text = "تنظیمات بات بله (Bale) و تلگرام (Telegram) و تهیه بکاپ کامل ویندوز",
                Bounds = new Rectangle(645, 15, 630, 320)
            };

            Label lb1 = new Label() { Text = "توکن بازوی بله (Bale Bot Token):", Bounds = new Rectangle(20, 35, 250, 22) };
            txtBaleToken = new TextBox() { Text = db.BaleBotToken, RightToLeft = RightToLeft.No, Bounds = new Rectangle(20, 58, 380, 26) };
            Label lb2 = new Label() { Text = "شناسه چت بله:", Bounds = new Rectangle(415, 35, 150, 22) };
            txtBaleChat = new TextBox() { Text = db.BaleChatId, RightToLeft = RightToLeft.No, Bounds = new Rectangle(415, 58, 190, 26) };

            Label lb3 = new Label() { Text = "توکن ربات تلگرام (Telegram Token):", Bounds = new Rectangle(20, 98, 250, 22) };
            txtTelToken = new TextBox() { Text = db.TelegramBotToken, RightToLeft = RightToLeft.No, Bounds = new Rectangle(20, 122, 380, 26) };
            Label lb4 = new Label() { Text = "شناسه چت تلگرام:", Bounds = new Rectangle(415, 98, 150, 22) };
            txtTelChat = new TextBox() { Text = db.TelegramChatId, RightToLeft = RightToLeft.No, Bounds = new Rectangle(415, 122, 190, 26) };

            Button btnBackupNow = new Button()
            {
                Text = "تهیه بکاپ کامل دیتابیس روی ویندوز + ارسال به بات بله و تلگرام",
                BackColor = Color.FromArgb(4, 120, 87),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(20, 175, 585, 50)
            };
            btnBackupNow.Click += (s, e) =>
            {
                db.BaleBotToken = txtBaleToken.Text.Trim();
                db.BaleChatId = txtBaleChat.Text.Trim();
                db.TelegramBotToken = txtTelToken.Text.Trim();
                db.TelegramChatId = txtTelChat.Text.Trim();
                SaveDatabase();

                string backupCopy = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "TarazBan_Full_Backup_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".xml");
                File.Copy(dbPath, backupCopy, true);
                SendBotText("📦 بکاپ کامل سیستم ویندوزی ترازبان ذخیره شد. تعداد کل ردیف‌های حسابداری: " + db.Entries.Count);
                MessageBox.Show("فایل بکاپ کامل روی دسکتاپ ویندوز ذخیره شد:\n" + backupCopy, "بکاپ کامل ویندوز", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };

            grpBot.Controls.AddRange(new Control[] { lb1, txtBaleToken, lb2, txtBaleChat, lb3, txtTelToken, lb4, txtTelChat, btnBackupNow });
            page.Controls.Add(grpDef);
            page.Controls.Add(grpBot);
        }

        private void SendBotText(string message)
        {
            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                if (!string.IsNullOrEmpty(db.BaleBotToken) && !string.IsNullOrEmpty(db.BaleChatId))
                {
                    using (WebClient wc = new WebClient())
                    {
                        wc.Encoding = Encoding.UTF8;
                        wc.Headers[HttpRequestHeader.ContentType] = "application/json";
                        string payload = "{\\"chat_id\\":\\"" + db.BaleChatId + "\\",\\"text\\":\\"" + message.Replace("\\"", "'") + "\\"}";
                        wc.UploadString("https://tapi.bale.ai/bot" + db.BaleBotToken + "/sendMessage", payload);
                    }
                }
                if (!string.IsNullOrEmpty(db.TelegramBotToken) && !string.IsNullOrEmpty(db.TelegramChatId))
                {
                    using (WebClient wc = new WebClient())
                    {
                        wc.Encoding = Encoding.UTF8;
                        wc.Headers[HttpRequestHeader.ContentType] = "application/json";
                        string payload = "{\\"chat_id\\":\\"" + db.TelegramChatId + "\\",\\"text\\":\\"" + message.Replace("\\"", "'") + "\\"}";
                        wc.UploadString("https://api.telegram.org/bot" + db.TelegramBotToken + "/sendMessage", payload);
                    }
                }
            }
            catch { }
        }

        private void BtnSendBot_Click(object sender, EventArgs e)
        {
            SendBotText("📊 " + currentPrintTitle + " | " + currentPrintSubtitle);
            MessageBox.Show("گزارش انتخابی به بات بله / تلگرام ارسال گردید.", "ارسال به بات", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void RefreshAllCombos()
        {
            cmbFxPerson.Items.Clear();
            foreach (var c in db.Contacts) cmbFxPerson.Items.Add(c);
            if (cmbFxPerson.Items.Count > 0) cmbFxPerson.SelectedIndex = 0;

            cmbFxBank.Items.Clear();
            foreach (var b in db.Banks) cmbFxBank.Items.Add(b);
            if (cmbFxBank.Items.Count > 0) cmbFxBank.SelectedIndex = 0;

            PopulateReportEntities();
            if (cmbVchCategory != null)
            {
                cmbVchEntity.Items.Clear();
                foreach (var c in db.Contacts) cmbVchEntity.Items.Add(c);
                if (cmbVchEntity.Items.Count > 0) cmbVchEntity.SelectedIndex = 0;
            }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (!LicenseManager.IsActivated())
            {
                using (ActivationForm act = new ActivationForm())
                {
                    if (act.ShowDialog() != DialogResult.OK)
                    {
                        return;
                    }
                }
            }

            Application.Run(new MainAccountingForm());
        }
    }
}
`;

  const base64Cs = btoa(unescape(encodeURIComponent(csharpWinFormsCode)));

  const batContent = `@echo off
chcp 65001 > nul
title TarazBan Native Windows .EXE Builder (Zero WebView - 100%% Native Windows Forms)
echo ===============================================================================
echo   ساخت فایل اجرایی ویندوزی خالص (TarazBan_Accounting.exe) بدون وب‌ویو
echo   Compiling 100%% Native Windows Forms .EXE using built-in Windows .NET Compiler
echo ===============================================================================

set "CSC64=%WINDIR%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
set "CSC32=%WINDIR%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"
set "CSC=%CSC64%"
if not exist "%CSC%" set "CSC=%CSC32%"

echo %base64Cs% > "%~dp0TarazBan_Source.b64"
certutil -f -decode "%~dp0TarazBan_Source.b64" "%~dp0TarazBanNativeApp.cs" > nul
del "%~dp0TarazBan_Source.b64"

"%CSC%" /nologo /target:winexe /out:"%~dp0TarazBan_Accounting.exe" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll /r:System.Xml.dll /r:System.Core.dll "%~dp0TarazBanNativeApp.cs"

if exist "%~dp0TarazBan_Accounting.exe" (
    del "%~dp0TarazBanNativeApp.cs"
    echo.
    echo [OK] فایل ویندوزی خالص TarazBan_Accounting.exe با موفقیت ساخته شد!
    echo Launching TarazBan_Accounting.exe ...
    start "" "%~dp0TarazBan_Accounting.exe"
) else (
    echo [ERROR] خطا در کامپایل فایل اجرایی ویندوز.
    pause
)
`;

  const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Build_TarazBan_Native_Windows_EXE.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the SEPARATE Admin Offline Keygen .EXE Builder (`Build_TarazBan_Admin_Keygen_EXE.bat`)
 * which compiles `TarazBan_Admin_Keygen.exe` exclusively for the software owner.
 */
export function downloadSeparateAdminKeygenExePackage(): void {
  const keygenCSharp = `using System;
using System.Collections.Generic;
using System.Drawing;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace TarazBanAdminKeygen
{
    public class KeygenForm : Form
    {
        private TextBox txtSystemId;
        private TextBox txtGeneratedKey;

        public KeygenForm()
        {
            this.Text = "نرم‌افزار اختصاصی تولید رمز فعال‌سازی آفلاین (Admin Keygen — مخصوص مدیر)";
            this.Size = new Size(520, 340);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Tahoma", 9.5f, FontStyle.Regular);
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.ForeColor = Color.White;

            Label lblTitle = new Label()
            {
                Text = "تولیدکننده رمز فعال‌سازی آفلاین ترازبان (مخصوص فروشنده/مدیر)",
                Font = new Font("Tahoma", 10.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Bounds = new Rectangle(25, 20, 455, 28)
            };

            Label lblSys = new Label()
            {
                Text = "۱. کد شناسایی سیستم مشتری (System ID) را وارد کنید:",
                ForeColor = Color.FromArgb(203, 213, 225),
                Bounds = new Rectangle(25, 60, 455, 22)
            };

            txtSystemId = new TextBox()
            {
                Text = "TB-WIN-8492-3107",
                Font = new Font("Consolas", 13f, FontStyle.Bold),
                TextAlign = HorizontalAlignment.Center,
                RightToLeft = RightToLeft.No,
                Bounds = new Rectangle(25, 86, 455, 34)
            };

            Button btnGenerate = new Button()
            {
                Text = "تولید رمز فعال‌سازی ۱۶ رقمی آفلاین",
                Font = new Font("Tahoma", 10f, FontStyle.Bold),
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(25, 132, 455, 40)
            };
            btnGenerate.Click += (s, e) => GenerateKey();

            Label lblOut = new Label()
            {
                Text = "۲. رمز فعال‌سازی آفلاین (این کد را به مشتری بدهید):",
                ForeColor = Color.FromArgb(203, 213, 225),
                Bounds = new Rectangle(25, 188, 455, 22)
            };

            txtGeneratedKey = new TextBox()
            {
                ReadOnly = true,
                Font = new Font("Consolas", 14f, FontStyle.Bold),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(110, 231, 183),
                TextAlign = HorizontalAlignment.Center,
                RightToLeft = RightToLeft.No,
                Bounds = new Rectangle(135, 215, 345, 34)
            };

            Button btnCopy = new Button()
            {
                Text = "کپی رمز",
                BackColor = Color.FromArgb(51, 65, 85),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Bounds = new Rectangle(25, 215, 102, 34)
            };
            btnCopy.Click += (s, e) =>
            {
                if (!string.IsNullOrEmpty(txtGeneratedKey.Text))
                {
                    Clipboard.SetText(txtGeneratedKey.Text);
                    MessageBox.Show("رمز فعال‌سازی کپی شد: " + txtGeneratedKey.Text, "کپی شد", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            };

            this.Controls.AddRange(new Control[] { lblTitle, lblSys, txtSystemId, btnGenerate, lblOut, txtGeneratedKey, btnCopy });
            GenerateKey();
        }

        private void GenerateKey()
        {
            string clean = Regex.Replace((txtSystemId.Text ?? "").ToUpperInvariant(), "[^A-Z0-9]", "");
            if (string.IsNullOrEmpty(clean))
            {
                txtGeneratedKey.Text = "0000-0000-0000-0000";
                return;
            }
            int h1 = 4821, h2 = 7394, h3 = 9106, h4 = 6253;
            for (int i = 0; i < clean.Length; i++)
            {
                int code = (int)clean[i];
                h1 = (h1 * 31 + code * (i + 7) + 1357) % 10000;
                h2 = (h2 * 37 + code * (i + 13) + 2468) % 10000;
                h3 = (h3 * 41 + code * (i + 19) + 3579) % 10000;
                h4 = (h4 * 43 + code * (i + 23) + 4680) % 10000;
            }
            txtGeneratedKey.Text = string.Format("{0:D4}-{1:D4}-{2:D4}-{3:D4}", h1, h2, h3, h4);
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new KeygenForm());
        }
    }
}
`;

  const base64Keygen = btoa(unescape(encodeURIComponent(keygenCSharp)));

  const batContent = `@echo off
chcp 65001 > nul
title TarazBan Admin Offline Keygen Builder (.EXE)
echo ===============================================================================
echo   ساخت نرم‌افزار مجزای تولید رمز فعال‌سازی آفلاین (TarazBan_Admin_Keygen.exe)
echo   (مخصوص مدیر سیستم — این فایل را به مشتری ندهید)
echo ===============================================================================

set "CSC64=%WINDIR%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
set "CSC32=%WINDIR%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"
set "CSC=%CSC64%"
if not exist "%CSC%" set "CSC=%CSC32%"

echo %base64Keygen% > "%~dp0Keygen_Source.b64"
certutil -f -decode "%~dp0Keygen_Source.b64" "%~dp0TarazBanAdminKeygen.cs" > nul
del "%~dp0Keygen_Source.b64"

"%CSC%" /nologo /target:winexe /out:"%~dp0TarazBan_Admin_Keygen.exe" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll "%~dp0TarazBanAdminKeygen.cs"

if exist "%~dp0TarazBan_Admin_Keygen.exe" (
    del "%~dp0TarazBanAdminKeygen.cs"
    echo.
    echo [OK] فایل کی‌جن ادمین TarazBan_Admin_Keygen.exe ساخته شد!
    start "" "%~dp0TarazBan_Admin_Keygen.exe"
) else (
    echo [ERROR] خطا در ساخت کی‌جن.
    pause
)
`;

  const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Build_TarazBan_Admin_Keygen_EXE.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a standalone offline HTML Keygen tool (`TarazBan_Admin_Keygen_Portable.html`)
 * that the owner can open on their mobile phone or PC anywhere to generate offline keys.
 */
export function downloadStandalonePortableKeygenHtml(): void {
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>پنل مستقل تولید رمز فعال‌سازی آفلاین ترازبان (مخصوص مدیر)</title>
  <style>
    * { box-sizing: border-box; font-family: Tahoma, sans-serif; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; padding: 20px; }
    .card { width: 100%; max-width: 480px; background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 26px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    h1 { font-size: 16px; margin: 0 0 8px 0; color: #38bdf8; }
    p { font-size: 12px; color: #94a3b8; line-height: 1.7; margin: 0 0 18px 0; }
    label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 6px; color: #e2e8f0; }
    input { width: 100%; padding: 12px; font-size: 16px; font-family: Consolas, monospace; font-weight: bold; text-align: center; direction: ltr; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; margin-bottom: 16px; }
    button { width: 100%; padding: 12px; font-size: 13px; font-weight: bold; border: none; border-radius: 8px; background: #10b981; color: #fff; cursor: pointer; margin-bottom: 16px; }
    button:hover { background: #059669; }
    .out-box { background: #0f172a; border: 2px dashed #10b981; border-radius: 10px; padding: 14px; text-align: center; }
    .key { font-family: Consolas, monospace; font-size: 20px; font-weight: bold; color: #6ee7b7; direction: ltr; letter-spacing: 1px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>کی‌جن مستقل تولید رمز فعال‌سازی آفلاین (مخصوص مدیر)</h1>
    <p>این فایل کاملاً مجزا از برنامه مشتری است. کد سیستم مشتری (System ID) را در کادر زیر وارد کنید تا رمز فعال‌سازی ۱۶ رقمی آفلاین تولید شود:</p>
    <label>کد شناسایی سیستم مشتری (System ID):</label>
    <input id="sysId" type="text" value="TB-WIN-8492-3107" oninput="gen()" />
    <button onclick="gen()">تولید رمز فعال‌سازی آفلاین</button>
    <div class="out-box">
      <div style="font-size:11px;color:#94a3b8;">رمز فعال‌سازی ۱۶ رقمی (قابل ارسال به مشتری):</div>
      <div id="outKey" class="key">----</div>
    </div>
  </div>
  <script>
    function gen() {
      var raw = document.getElementById('sysId').value || '';
      var clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!clean) {
        document.getElementById('outKey').innerText = '0000-0000-0000-0000';
        return;
      }
      var h1 = 4821, h2 = 7394, h3 = 9106, h4 = 6253;
      for (var i = 0; i < clean.length; i++) {
        var code = clean.charCodeAt(i);
        h1 = (h1 * 31 + code * (i + 7) + 1357) % 10000;
        h2 = (h2 * 37 + code * (i + 13) + 2468) % 10000;
        h3 = (h3 * 41 + code * (i + 19) + 3579) % 10000;
        h4 = (h4 * 43 + code * (i + 23) + 4680) % 10000;
      }
      function pad(n) { return String(n).padStart(4, '0'); }
      document.getElementById('outKey').innerText = pad(h1) + '-' + pad(h2) + '-' + pad(h3) + '-' + pad(h4);
    }
    gen();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TarazBan_Admin_Keygen_Separate.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
