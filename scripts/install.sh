#!/usr/bin/env bash
# ==============================================================================
# TarazBan / Curen Multi-Currency Accounting - Linux Sanaei-Style Installer
# Repository: https://github.com/meh732/curen.git
# Command: bash <(curl -Ls https://raw.githubusercontent.com/meh732/curen/main/scripts/install.sh)
# ==============================================================================

# ANSI Color Codes
red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'
cyan='\033[0;36m'
blue='\033[0;34m'

REPO_URL="https://github.com/meh732/curen.git"
BRANCH="main"
INSTALL_DIR="/usr/local/curen"
DEFAULT_PORT="3000"

clear
echo -e "${cyan}====================================================================${plain}"
echo -e "${green}   سیستم جامع حسابداری دوارزی و صرافی ترازبان (Curen Linux Edition)${plain}"
echo -e "${yellow}   نصب خودکار از گیت‌هاب: ${REPO_URL}${plain}"
echo -e "${green}   وضعیت: نسخه لینوکس کاملاً آزاد و بدون نیاز به فعال‌سازی است${plain}"
echo -e "${cyan}====================================================================${plain}"

# Check root permission
[[ $EUID -ne 0 ]] && echo -e "${red}خطا: لطفاً این اسکریپت را با دسترسی root اجرا نمایید (sudo -i).${plain}" && exit 1

# Detect Linux Distribution
if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    OS="${ID}"
elif [[ -f /etc/debian_version ]]; then
    OS="debian"
elif [[ -f /etc/redhat-release ]]; then
    OS="centos"
else
    OS="$(uname -s)"
fi

echo -e "${yellow}[1/6] در حال نصب ابزارهای پایه سیستم (${OS})...${plain}"
if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y curl git build-essential ufw systemd
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y curl git make gcc-c++ systemd
elif command -v yum >/dev/null 2>&1; then
    yum install -y curl git make gcc-c++ systemd
elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm curl git base-devel systemd
fi

# Install Node.js 22 LTS if not present
echo -e "${yellow}[2/6] بررسی موتور جاوااسکریپت Node.js...${plain}"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]]; then
    echo -e "${cyan}در حال نصب جدیدترین نسخه Node.js 22 LTS...${plain}"
    if command -v apt-get >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y nodejs
    elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
        dnf install -y nodejs || yum install -y nodejs
    fi
fi
echo -e "${green}Node.js نسخه $(node -v) و npm نسخه $(npm -v) آماده است.${plain}"

# Port configuration
read -p "لطفاً پورت اجرایی را وارد نمایید (پیش‌فرض: 3000): " custom_port
APP_PORT="${custom_port:-$DEFAULT_PORT}"

# Clone or Update from GitHub
echo -e "${yellow}[3/6] دریافت کدهای پروژه از ${REPO_URL}...${plain}"
mkdir -p "$INSTALL_DIR"
if [[ -d "$INSTALL_DIR/.git" ]]; then
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Build Project
echo -e "${yellow}[4/6] نصب پکیج‌ها و ساخت نسخه پروداکشن (npm install & build)...${plain}"
cd "$INSTALL_DIR"
npm install --legacy-peer-deps
npm run build

# Configure Systemd Service
echo -e "${yellow}[5/6] ایجاد سرویس دائمی خودکار curen.service در لینوکس...${plain}"
cat <<EOF > /etc/systemd/system/curen.service
[Unit]
Description=Curen Multi-Currency Accounting Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/npm run preview -- --port ${APP_PORT} --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable curen.service
systemctl restart curen.service

# Open firewall port if ufw exists
if command -v ufw >/dev/null 2>&1; then
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
fi

# Create Sanaei-style CLI management shortcut: 'curen'
echo -e "${yellow}[6/6] ایجاد دستور میانبر ترمینال 'curen'...${plain}"
cat <<'EOF' > /usr/local/bin/curen
#!/usr/bin/env bash
red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'
cyan='\033[0;36m'
blue='\033[0;34m'

INSTALL_DIR="/usr/local/curen"

show_menu() {
    clear
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green}       مدیریت سیستم حسابداری دوارزی و صرافی ترازبان (Curen)${plain}"
    echo -e "${yellow}       طراحی شده به سبک اسکریپت‌های حرفه‌ای لینوکس (Sanaei Style)${plain}"
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green}1.${plain} راه‌اندازی مجدد سرویس (Restart)"
    echo -e "${green}2.${plain} متوقف کردن سرویس (Stop)"
    echo -e "${green}3.${plain} روشن کردن سرویس (Start)"
    echo -e "${green}4.${plain} بررسی وضعیت اجرای سرویس (Status)"
    echo -e "${green}5.${plain} مشاهده لاگ‌های زنده سیستم (Live Logs)"
    echo -e "${cyan}--------------------------------------------------------------------${plain}"
    echo -e "${green}6.${plain} به‌روزرسانی سریع به آخرین نسخه گیت‌هاب (Update from GitHub)"
    echo -e "${green}7.${plain} تغییر پورت برنامه (Change Port)"
    echo -e "${green}8.${plain} تنظیم آپدیت خودکار شبانه با کرون‌جاب (Cron Job)"
    echo -e "${green}9.${plain} اطلاعات دسترسی به پنل و مشخصات سرور (Server Info)"
    echo -e "${red}10.${plain} حذف کامل نرم‌افزار از سرور (Uninstall)"
    echo -e "${cyan}--------------------------------------------------------------------${plain}"
    echo -e "${yellow}0.${plain} خروج از منو (Exit)"
    echo -e "${cyan}====================================================================${plain}"
    read -p "لطفاً یک شماره را انتخاب نمایید [0-10]: " num

    case "$num" in
        1)
            systemctl restart curen.service
            echo -e "${green}سرویس curen با موفقیت ری‌استارت شد.${plain}"
            sleep 2; show_menu ;;
        2)
            systemctl stop curen.service
            echo -e "${yellow}سرویس curen متوقف گردید.${plain}"
            sleep 2; show_menu ;;
        3)
            systemctl start curen.service
            echo -e "${green}سرویس curen روشن شد.${plain}"
            sleep 2; show_menu ;;
        4)
            systemctl status curen.service ;;
        5)
            journalctl -u curen.service -f -n 50 ;;
        6)
            echo -e "${yellow}در حال دریافت جدیدترین تغییرات از GitHub...${plain}"
            cd "$INSTALL_DIR"
            git fetch origin main
            git reset --hard origin/main
            npm install --legacy-peer-deps
            npm run build
            systemctl restart curen.service
            echo -e "${green}سیستم با موفقیت به آخرین نسخه گیت‌هاب آپدیت شد!${plain}"
            read -p "برای ادامه Enter بزنید..." && show_menu ;;
        7)
            read -p "پورت جدید را وارد نمایید: " new_port
            if [[ -n "$new_port" ]]; then
                sed -i "s/--port [0-9]*/--port $new_port/g" /etc/systemd/system/curen.service
                systemctl daemon-reload
                systemctl restart curen.service
                echo -e "${green}پورت با موفقیت به $new_port تغییر کرد.${plain}"
            fi
            sleep 2; show_menu ;;
        8)
            (crontab -l 2>/dev/null; echo "0 4 * * * cd $INSTALL_DIR && git pull && npm run build && systemctl restart curen >/dev/null 2>&1") | crontab -
            echo -e "${green}کرون‌جاب آپدیت خودکار روزانه (هر شب ساعت ۴ صبح) تنظیم گردید.${plain}"
            sleep 2; show_menu ;;
        9)
            IP=$(curl -s4 ifconfig.me || hostname -I | awk '{print $1}')
            echo -e "${cyan}آدرس ورود به پنل حسابداری: ${green}http://${IP}:3000${plain}"
            echo -e "${yellow}وضعیت فعال‌سازی: سیستم‌عامل لینوکس کاملاً آزاد و بدون نیاز به قفل سخت‌افزاری است.${plain}"
            read -p "برای ادامه Enter بزنید..." && show_menu ;;
        10)
            read -p "آیا از حذف کامل curen اطمینان دارید؟ [y/N]: " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                systemctl stop curen.service >/dev/null 2>&1 || true
                systemctl disable curen.service >/dev/null 2>&1 || true
                rm -f /etc/systemd/system/curen.service
                rm -f /usr/local/bin/curen
                rm -rf "$INSTALL_DIR"
                systemctl daemon-reload
                echo -e "${green}نرم‌افزار curen با موفقیت به‌طور کامل حذف شد.${plain}"
                exit 0
            fi
            show_menu ;;
        0)
            exit 0 ;;
        *)
            echo -e "${red}گزینه نامعتبر است!${plain}"
            sleep 1; show_menu ;;
    esac
}

show_menu
EOF

chmod +x /usr/local/bin/curen

# Final Message
sleep 2
SERVER_IP=$(curl -s4 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo -e "\n${green}====================================================================${plain}"
echo -e "${green}  ✅ تبریک! سیستم حسابداری دوارزی و صرافی ترازبان (Curen) با موفقیت نصب شد.${plain}"
echo -e "${cyan}====================================================================${plain}"
echo -e "  🌐 ${yellow}آدرس پنل حسابداری در مرورگر:${plain} ${green}http://${SERVER_IP}:${APP_PORT}${plain}"
echo -e "  ⚙️  ${yellow}دستور مدیریت آسان سرور:${plain} در هر لحظه در ترمینال بنویسید: ${cyan}curen${plain}"
echo -e "  🔒 ${yellow}وضعیت لایسنس:${plain} ${green}نسخه لینوکس آزاد است و نیاز به هیچ‌گونه فعال‌سازی ندارد.${plain}"
echo -e "${cyan}====================================================================${plain}\n"
