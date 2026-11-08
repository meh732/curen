#!/usr/bin/env bash
# ==============================================================================
# Curen Multi-Currency Accounting & Exchange Management System
# Sanaei-Style Linux Terminal Installer & Manager (100% English)
# Repository: https://github.com/meh732/curen.git
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

# Check root permission
[[ $EUID -ne 0 ]] && echo -e "${red}Error: This script must be run as root (use: sudo -i or sudo bash).${plain}" && exit 1

# Detect Linux OS
detect_os() {
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
}

install_dependencies() {
    detect_os
    echo -e "${yellow}[1/5] Installing base system dependencies for ${OS}...${plain}"
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
    echo -e "${yellow}[2/5] Checking Node.js runtime environment...${plain}"
    if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]]; then
        echo -e "${cyan}Installing latest Node.js 22 LTS...${plain}"
        if command -v apt-get >/dev/null 2>&1; then
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y nodejs
        elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            dnf install -y nodejs || yum install -y nodejs
        fi
    fi
    echo -e "${green}Node.js $(node -v) and npm $(npm -v) verified successfully.${plain}"
}

create_cli_shortcut() {
    cat <<'EOF' > /usr/local/bin/curen
#!/usr/bin/env bash
red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'
cyan='\033[0;36m'
blue='\033[0;34m'

INSTALL_DIR="/usr/local/curen"
REPO_URL="https://github.com/meh732/curen.git"
BRANCH="main"

show_menu() {
    clear
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green}    Curen Multi-Currency Accounting System - Sanaei Linux Manager    ${plain}"
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green} 1.${plain} Install Curen (Fresh Installation from GitHub)"
    echo -e "${green} 2.${plain} Update Curen (Pull Latest Release from GitHub)"
    echo -e "${cyan}--------------------------------------------------------------------${plain}"
    echo -e "${green} 3.${plain} Start Service"
    echo -e "${green} 4.${plain} Stop Service"
    echo -e "${green} 5.${plain} Restart Service"
    echo -e "${green} 6.${plain} Check Service Status"
    echo -e "${green} 7.${plain} View Live Service Logs"
    echo -e "${cyan}--------------------------------------------------------------------${plain}"
    echo -e "${green} 8.${plain} Change Application Port"
    echo -e "${green} 9.${plain} Enable Nightly Auto-Update Cron Job"
    echo -e "${green}10.${plain} Manage Server License (Activate Server for All IP Clients)"
    echo -e "${green}11.${plain} View Access URLs & Server Info"
    echo -e "${red}12.${plain} Uninstall Curen Completely"
    echo -e "${cyan}--------------------------------------------------------------------${plain}"
    echo -e "${yellow} 0.${plain} Exit"
    echo -e "${cyan}====================================================================${plain}"
    read -p "Please choose an option [0-12]: " choice

    case "$choice" in
        1)
            bash <(curl -Ls https://raw.githubusercontent.com/meh732/curen/main/scripts/install.sh) fresh
            ;;
        2)
            echo -e "${yellow}Updating Curen from GitHub repository...${plain}"
            if [[ ! -d "$INSTALL_DIR" ]]; then
                echo -e "${red}Error: Installation directory not found. Please install first.${plain}"
                read -p "Press Enter to return..." && show_menu
                return
            fi
            cd "$INSTALL_DIR"
            cp -f "$INSTALL_DIR/server_db.json" /tmp/curen_server_db.json.bak 2>/dev/null || true
            cp -f "$INSTALL_DIR/server_license.json" /tmp/curen_server_license.json.bak 2>/dev/null || true
            cp -f "$INSTALL_DIR/public/server_license.json" /tmp/curen_pub_license.json.bak 2>/dev/null || true
            git fetch origin "$BRANCH"
            git reset --hard "origin/$BRANCH"
            cp -f /tmp/curen_server_db.json.bak "$INSTALL_DIR/server_db.json" 2>/dev/null || true
            cp -f /tmp/curen_server_license.json.bak "$INSTALL_DIR/server_license.json" 2>/dev/null || true
            mkdir -p "$INSTALL_DIR/public" "$INSTALL_DIR/dist"
            cp -f /tmp/curen_pub_license.json.bak "$INSTALL_DIR/public/server_license.json" 2>/dev/null || true
            npm install --legacy-peer-deps
            npm run build
            if [[ -f "$INSTALL_DIR/server_license.json" ]]; then
                cp -f "$INSTALL_DIR/server_license.json" "$INSTALL_DIR/dist/server_license.json" 2>/dev/null || true
                cp -f "$INSTALL_DIR/server_license.json" "$INSTALL_DIR/public/server_license.json" 2>/dev/null || true
            elif [[ -f "$INSTALL_DIR/public/server_license.json" ]]; then
                cp -f "$INSTALL_DIR/public/server_license.json" "$INSTALL_DIR/dist/server_license.json" 2>/dev/null || true
                cp -f "$INSTALL_DIR/public/server_license.json" "$INSTALL_DIR/server_license.json" 2>/dev/null || true
            fi
            sed -i 's|ExecStart=.*|ExecStart=/usr/bin/npm start|g' /etc/systemd/system/curen.service 2>/dev/null || true
            systemctl daemon-reload
            systemctl restart curen.service
            echo -e "${green}Successfully updated to the latest version from GitHub (Database & License preserved)!${plain}"
            read -p "Press Enter to continue..." && show_menu
            ;;
        3)
            systemctl start curen.service
            echo -e "${green}Curen service started.${plain}"
            sleep 2; show_menu ;;
        4)
            systemctl stop curen.service
            echo -e "${yellow}Curen service stopped.${plain}"
            sleep 2; show_menu ;;
        5)
            systemctl restart curen.service
            echo -e "${green}Curen service restarted successfully.${plain}"
            sleep 2; show_menu ;;
        6)
            systemctl status curen.service ;;
        7)
            journalctl -u curen.service -f -n 50 ;;
        8)
            read -p "Enter new port (e.g. 3000, 8080): " new_port
            if [[ -n "$new_port" ]]; then
                sed -i "s/--port [0-9]*/--port $new_port/g" /etc/systemd/system/curen.service
                sed -i "s/Environment=PORT=[0-9]*/Environment=PORT=$new_port/g" /etc/systemd/system/curen.service
                systemctl daemon-reload
                systemctl restart curen.service
                if command -v ufw >/dev/null 2>&1; then
                    ufw allow "${new_port}/tcp" >/dev/null 2>&1 || true
                fi
                echo -e "${green}Port successfully updated to ${new_port}.${plain}"
            fi
            sleep 2; show_menu ;;
        9)
            (crontab -l 2>/dev/null | grep -v 'curen'; echo "0 4 * * * cd $INSTALL_DIR && git pull origin main && npm run build && systemctl restart curen.service >/dev/null 2>&1") | crontab -
            echo -e "${green}Nightly auto-update cron job configured (runs daily at 4:00 AM).${plain}"
            sleep 2; show_menu ;;
        10)
            manage_server_license
            ;;
        11)
            IP=$(curl -s4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
            PORT=$(grep -oP '(?<=Environment=PORT=)\d+' /etc/systemd/system/curen.service 2>/dev/null || echo "3000")
            echo -e "\n${cyan}================ Server & Access Info ================${plain}"
            echo -e "Web App URL : ${green}http://${IP}:${PORT}${plain}"
            echo -e "Install Path: ${yellow}${INSTALL_DIR}${plain}"
            echo -e "Status      : $(systemctl is-active curen.service)"
            echo -e "Server Scope: ${green}One-Time Server Activation (All IP Clients Auto-Unlocked)${plain}"
            echo -e "${cyan}======================================================${plain}\n"
            read -p "Press Enter to return..." && show_menu ;;
        12)
            read -p "Are you sure you want to completely uninstall Curen? [y/N]: " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                systemctl stop curen.service >/dev/null 2>&1 || true
                systemctl disable curen.service >/dev/null 2>&1 || true
                rm -f /etc/systemd/system/curen.service
                rm -f /usr/local/bin/curen
                rm -rf "$INSTALL_DIR"
                systemctl daemon-reload
                echo -e "${green}Curen has been completely removed from this server.${plain}"
                exit 0
            fi
            show_menu ;;
        0)
            exit 0 ;;
        *)
            echo -e "${red}Invalid option. Please try again.${plain}"
            sleep 1; show_menu ;;
    esac
}

manage_server_license() {
    clear
    LIC_FILE="${INSTALL_DIR}/dist/server_license.json"
    PUB_LIC="${INSTALL_DIR}/public/server_license.json"
    ROOT_LIC="${INSTALL_DIR}/server_license.json"
    STATUS="ACTIVE (Unlocked for all IP clients)"
    if [[ -f "$ROOT_LIC" ]]; then
        if grep -q '"isActivated": false' "$ROOT_LIC"; then
            STATUS="INACTIVE (Server Locked)"
        fi
    elif [[ -f "$LIC_FILE" ]]; then
        if grep -q '"isActivated": false' "$LIC_FILE"; then
            STATUS="INACTIVE (Server Locked)"
        fi
    fi
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green}              Curen Server-Level License Manager                    ${plain}"
    echo -e "${cyan}====================================================================${plain}"
    echo -e " Current Server Status : ${green}${STATUS}${plain}"
    echo -e " Server Machine ID     : ${yellow}TB-SRV-LINUX-ENTERPRISE${plain}"
    echo -e " Active License Key    : ${cyan}8512-3519-4923-6788${plain}"
    echo -e " Scope                 : ${green}Activated Once on Server -> All IP Clients Auto-Unlocked${plain}"
    echo -e "${cyan}--------------------------------------------------------------------${plain}"
    echo -e "${green} 1.${plain} One-Click Instant Server Activation (Unlock All IP Clients)"
    echo -e "${green} 2.${plain} Enter Custom 16-Digit Server Activation Key"
    echo -e "${red} 3.${plain} Deactivate Server License"
    echo -e "${yellow} 0.${plain} Return to Main Menu"
    echo -e "${cyan}====================================================================${plain}"
    read -p "Select an option [0-3]: " lic_opt
    case "$lic_opt" in
        1)
            cat <<'LIC_EOF' > "$PUB_LIC"
{
  "isActivated": true,
  "serverEdition": "Linux Server Edition",
  "licenseType": "SERVER_WIDE_IP_UNLOCKED",
  "machineId": "TB-SRV-LINUX-ENTERPRISE",
  "activatedKey": "8512-3519-4923-6788",
  "activatedAt": "1405/01/01",
  "unlockedForAllIpClients": true
}
LIC_EOF
            mkdir -p "${INSTALL_DIR}/dist"
            cp "$PUB_LIC" "$LIC_FILE" 2>/dev/null || true
            cp "$PUB_LIC" "$ROOT_LIC" 2>/dev/null || true
            echo -e "${green}Server license is now ACTIVE! All IP clients have unlimited access.${plain}"
            sleep 2; manage_server_license ;;
        2)
            read -p "Enter 16-digit key (XXXX-XXXX-XXXX-XXXX): " user_key
            if [[ -n "$user_key" ]]; then
                cat <<LIC_EOF > "$PUB_LIC"
{
  "isActivated": true,
  "serverEdition": "Linux Server Edition",
  "licenseType": "SERVER_WIDE_IP_UNLOCKED",
  "machineId": "TB-SRV-LINUX-ENTERPRISE",
  "activatedKey": "${user_key}",
  "activatedAt": "1405/01/01",
  "unlockedForAllIpClients": true
}
LIC_EOF
                mkdir -p "${INSTALL_DIR}/dist"
                cp "$PUB_LIC" "$LIC_FILE" 2>/dev/null || true
                cp "$PUB_LIC" "$ROOT_LIC" 2>/dev/null || true
                echo -e "${green}Server license updated successfully!${plain}"
            fi
            sleep 2; manage_server_license ;;
        3)
            cat <<'LIC_EOF' > "$PUB_LIC"
{
  "isActivated": false,
  "serverEdition": "Linux Server Edition",
  "unlockedForAllIpClients": false
}
LIC_EOF
            mkdir -p "${INSTALL_DIR}/dist"
            cp "$PUB_LIC" "$LIC_FILE" 2>/dev/null || true
            cp "$PUB_LIC" "$ROOT_LIC" 2>/dev/null || true
            echo -e "${yellow}Server license has been DEACTIVATED.${plain}"
            sleep 2; manage_server_license ;;
        0)
            show_menu ;;
        *)
            echo -e "${red}Invalid option.${plain}"
            sleep 1; manage_server_license ;;
    esac
}

show_menu
EOF
    chmod +x /usr/local/bin/curen
}

do_install() {
    clear
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green}    Curen Multi-Currency Accounting System - Sanaei Installer      ${plain}"
    echo -e "${yellow}    Repository: ${REPO_URL}                                        ${plain}"
    echo -e "${green}    Status: Linux Edition is Unlocked (Zero Activation Required)   ${plain}"
    echo -e "${cyan}====================================================================${plain}"

    install_dependencies

    # Port configuration
    read -p "Enter application listening port [Default: 3000]: " custom_port
    APP_PORT="${custom_port:-$DEFAULT_PORT}"

    # Clone or Pull
    echo -e "${yellow}[3/5] Cloning latest project source from ${REPO_URL}...${plain}"
    mkdir -p "$INSTALL_DIR"
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        cd "$INSTALL_DIR"
        cp -f "$INSTALL_DIR/server_db.json" /tmp/curen_server_db.json.bak 2>/dev/null || true
        cp -f "$INSTALL_DIR/server_license.json" /tmp/curen_server_license.json.bak 2>/dev/null || true
        git fetch origin "$BRANCH"
        git reset --hard "origin/$BRANCH"
        cp -f /tmp/curen_server_db.json.bak "$INSTALL_DIR/server_db.json" 2>/dev/null || true
        cp -f /tmp/curen_server_license.json.bak "$INSTALL_DIR/server_license.json" 2>/dev/null || true
    else
        git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    # Build Project
    echo -e "${yellow}[4/5] Installing npm dependencies and building production assets...${plain}"
    cd "$INSTALL_DIR"
    npm install --legacy-peer-deps
    npm run build

    # Initialize Server-Wide License (One-Time Server Activation for All IP Clients)
    mkdir -p "$INSTALL_DIR/public" "$INSTALL_DIR/dist"
    if [[ ! -f "$INSTALL_DIR/server_license.json" ]]; then
        cat <<'LIC_EOF' > "$INSTALL_DIR/server_license.json"
{
  "isActivated": true,
  "serverEdition": "Linux Server Edition",
  "licenseType": "SERVER_WIDE_IP_UNLOCKED",
  "machineId": "TB-SRV-LINUX-ENTERPRISE",
  "activatedKey": "8512-3519-4923-6788",
  "activatedAt": "1405/01/01",
  "unlockedForAllIpClients": true,
  "description": "Server license is active. All incoming IP connections are authorized without client-side activation."
}
LIC_EOF
    fi
    cp -f "$INSTALL_DIR/server_license.json" "$INSTALL_DIR/public/server_license.json" 2>/dev/null || true
    cp -f "$INSTALL_DIR/server_license.json" "$INSTALL_DIR/dist/server_license.json" 2>/dev/null || true

    # Configure Systemd Service
    echo -e "${yellow}[5/5] Configuring systemd background daemon service (curen.service)...${plain}"
    cat <<EOF > /etc/systemd/system/curen.service
[Unit]
Description=Curen Multi-Currency Accounting Daemon Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/npm start
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

    # Install CLI shortcut
    create_cli_shortcut

    sleep 2
    SERVER_IP=$(curl -s4 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

    echo -e "\n${green}====================================================================${plain}"
    echo -e "${green}  SUCCESS! Curen Multi-Currency Accounting has been installed.      ${plain}"
    echo -e "${cyan}====================================================================${plain}"
    echo -e "  🌐 ${yellow}Web App URL   :${plain} ${green}http://${SERVER_IP}:${APP_PORT}${plain}"
    echo -e "  ⚙️  ${yellow}Management CLI:${plain} Type ${cyan}curen${plain} in your terminal anytime"
    echo -e "  🔒 ${yellow}License Status:${plain} ${green}Unlocked (No hardware activation required on Linux)${plain}"
    echo -e "${cyan}====================================================================${plain}\n"
}

# Top-level prompt menu when executed directly
show_installer_menu() {
    clear
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green}    Curen Multi-Currency Accounting System - Linux Installer        ${plain}"
    echo -e "${yellow}    Repository: https://github.com/meh732/curen.git                 ${plain}"
    echo -e "${cyan}====================================================================${plain}"
    echo -e "${green} 1.${plain} Install Curen"
    echo -e "${green} 2.${plain} Update Curen"
    echo -e "${green} 3.${plain} Launch Management Menu (curen)"
    echo -e "${yellow} 0.${plain} Exit"
    echo -e "${cyan}====================================================================${plain}"
    read -p "Please select an option [0-3]: " opt

    case "$opt" in
        1)
            do_install ;;
        2)
            if [[ -d "$INSTALL_DIR" ]]; then
                echo -e "${yellow}Updating Curen from GitHub repository...${plain}"
                cd "$INSTALL_DIR"
                cp -f "$INSTALL_DIR/server_db.json" /tmp/curen_server_db.json.bak 2>/dev/null || true
                cp -f "$INSTALL_DIR/server_license.json" /tmp/curen_server_license.json.bak 2>/dev/null || true
                git fetch origin "$BRANCH"
                git reset --hard "origin/$BRANCH"
                cp -f /tmp/curen_server_db.json.bak "$INSTALL_DIR/server_db.json" 2>/dev/null || true
                cp -f /tmp/curen_server_license.json.bak "$INSTALL_DIR/server_license.json" 2>/dev/null || true
                npm install --legacy-peer-deps
                npm run build
                if [[ -f "$INSTALL_DIR/server_license.json" ]]; then
                    cp -f "$INSTALL_DIR/server_license.json" "$INSTALL_DIR/dist/server_license.json" 2>/dev/null || true
                    cp -f "$INSTALL_DIR/server_license.json" "$INSTALL_DIR/public/server_license.json" 2>/dev/null || true
                fi
                sed -i 's|ExecStart=.*|ExecStart=/usr/bin/npm start|g' /etc/systemd/system/curen.service 2>/dev/null || true
                systemctl daemon-reload
                systemctl restart curen.service
                create_cli_shortcut
                echo -e "${green}Curen successfully updated to the latest GitHub version (Database & License preserved)!${plain}"
            else
                echo -e "${red}Error: Curen is not installed yet. Proceeding with fresh install...${plain}"
                sleep 2
                do_install
            fi
            ;;
        3)
            create_cli_shortcut
            /usr/local/bin/curen ;;
        0)
            exit 0 ;;
        *)
            echo -e "${red}Invalid choice.${plain}"
            sleep 1; show_installer_menu ;;
    esac
}

# If invoked with argument "fresh", perform direct installation; otherwise show interactive menu
if [[ "${1:-}" == "fresh" ]]; then
    do_install
else
    show_installer_menu
fi
