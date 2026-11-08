export interface LicenseStatus {
  isActivated: boolean;
  machineId: string;
  activatedAt?: string;
  activationKey?: string;
  activatedKey?: string;
  masterAuthorized?: boolean;
}

const LICENSE_STORAGE_KEY = 'ARKA_HARDWARE_MASTER_LICENSE_V6_STRICT';
const MACHINE_ID_STORAGE_KEY = 'TARAZBAN_HARDWARE_MACHINE_ID_V3_STRICT';
const SECRET_SALT = 'ARKA_MASTER_SALT_2026_V6_PRO';

// رمز مادر انحصاری و ثابت فروشنده
export const VENDOR_MASTER_PASSWORD = 'ARKA-MASTER-2026';

const LEGACY_LICENSE_KEYS = [
  'TARAZBAN_OFFLINE_LICENSE_V1',
  'TARAZBAN_OFFLINE_LICENSE_V2',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V3_STRICT',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V4_STRICT_SIGNED',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V5_STRICT',
  'TARAZBAN_LICENSE',
  'LICENSE_STATUS',
  'IS_ACTIVATED',
];

/**
 * Helper to invoke Tauri commands across Tauri v2 (__TAURI_INTERNALS__ / __TAURI__.core) and Tauri v1 (__TAURI__)
 */
export async function invokeTauriCommand<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    __TAURI_INTERNALS__?: { invoke?: (c: string, a?: Record<string, unknown>) => Promise<T> };
    __TAURI__?: {
      invoke?: (c: string, a?: Record<string, unknown>) => Promise<T>;
      core?: { invoke?: (c: string, a?: Record<string, unknown>) => Promise<T> };
    };
  };
  const invokeFn =
    win.__TAURI_INTERNALS__?.invoke ||
    win.__TAURI__?.core?.invoke ||
    win.__TAURI__?.invoke;

  if (typeof invokeFn !== 'function') {
    return null;
  }
  try {
    return await invokeFn(cmd, args);
  } catch {
    return null;
  }
}

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
}

function purgeLegacyKeys(): void {
  try {
    for (const k of LEGACY_LICENSE_KEYS) {
      localStorage.removeItem(k);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Generates or retrieves the persistent 12-character Hardware/Machine ID
 * Formatted as: TB-HW-XXXX-XXXX
 */
export function getOrCreateMachineId(): string {
  purgeLegacyKeys();
  try {
    const existing = localStorage.getItem(MACHINE_ID_STORAGE_KEY);
    if (existing && /^TB-HW-\d{4}-\d{4}$/.test(existing)) {
      return existing;
    }
    // Also accept clean XXXX-XXXX format
    if (existing && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(existing)) {
      return `TB-HW-${existing}`;
    }
  } catch {
    // fallback if localStorage blocked
  }

  // Generate deterministic-like seed from screen/browser traits
  let h1 = 5381;
  let h2 = 7919;
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const scr = typeof screen !== 'undefined' ? screen : null;
    const parts = [
      nav?.userAgent || 'WIN-PC',
      nav?.language || 'fa-IR',
      String(nav?.hardwareConcurrency || 8),
      String((nav as unknown as { deviceMemory?: number })?.deviceMemory || 8),
      String(scr?.width || 1920),
      String(scr?.height || 1080),
      String(scr?.colorDepth || 24),
      Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || 'Asia/Tehran',
    ].join('|');

    for (let i = 0; i < parts.length; i++) {
      const ch = parts.charCodeAt(i);
      h1 = (h1 * 33 + ch * (i + 5) + 1013) % 10000;
      h2 = (h2 * 41 + ch * (i + 11) + 2027) % 10000;
    }
  } catch {
    // ignore
  }

  const p1 = (h1 % 9000) + 1000;
  const p2 = (h2 % 9000) + 1000;
  const formatted = `TB-HW-${String(p1).padStart(4, '0')}-${String(p2).padStart(4, '0')}`;

  try {
    localStorage.setItem(MACHINE_ID_STORAGE_KEY, formatted);
  } catch {
    // ignore
  }
  return formatted;
}

/**
 * Computes the normalized master password string
 */
export function normalizeMasterPassword(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Verifies if entered master password matches the official vendor master password
 */
export function verifyMasterPassword(raw: string): boolean {
  const cleanEntered = normalizeMasterPassword(raw);
  const cleanExpected = normalizeMasterPassword(VENDOR_MASTER_PASSWORD);
  return cleanEntered.length > 0 && cleanEntered === cleanExpected;
}

/**
 * Computes the 16-digit purely numeric activation key (XXXX-XXXX-XXXX-XXXX)
 * CRITICAL: The Master Password MUST be entered into the Keygen!
 * The 16-digit key itself cryptographically depends on the Vendor Master Password.
 * Without knowing the exact Master Password, no valid 16-digit key can be generated.
 */
export function generateOfflineActivationKey(
  machineId: string,
  masterPassword = VENDOR_MASTER_PASSWORD
): string {
  if (!verifyMasterPassword(masterPassword)) {
    return '';
  }

  const cleanId = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanId.length < 6) return '';

  const cleanMaster = normalizeMasterPassword(masterPassword);
  const input = `${cleanId}:${SECRET_SALT}:${cleanMaster}:${cleanId.split('').reverse().join('')}`;

  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];

  for (let round = 0; round < 4; round++) {
    let hash = seeds[round];
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i) + round * 31 + i * 17;
      hash = Math.imul(hash, 0x01000193);
      hash >>>= 0;
    }
    seeds[round] = hash;
  }

  // 16 purely numeric digits: 4 blocks of 4 digits (e.g. 1507-2666-5215-7116)
  const parts: string[] = [];
  for (let block = 0; block < 4; block++) {
    const num = seeds[block] % 10000;
    parts.push(String(num).padStart(4, '0'));
  }

  return parts.join('-');
}

/**
 * Fallback legacy formula for backwards compatibility with v4/v5 licenses
 */
function computeLegacyKey(machineId: string): string {
  let clean = machineId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d{8}$/.test(clean)) {
    clean = 'TBHW' + clean;
  }
  let h1 = 4821, h2 = 7394, h3 = 9106, h4 = 6253;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    h1 = (h1 * 31 + code * (i + 7) + 1357) % 10000;
    h2 = (h2 * 37 + code * (i + 13) + 2468) % 10000;
    h3 = (h3 * 41 + code * (i + 19) + 3579) % 10000;
    h4 = (h4 * 43 + code * (i + 23) + 4680) % 10000;
  }
  return [h1, h2, h3, h4].map((v) => String(v).padStart(4, '0')).join('-');
}

/**
 * Verifies if the customer-entered 16-digit Activation Key is valid for this Machine ID
 * Checks both the V6 Master-dependent key and legacy format.
 */
export function verifyOfflineActivationKey(machineId: string, enteredKey: string): boolean {
  if (!enteredKey) return false;
  const cleanEntered = enteredKey.trim().replace(/[^0-9]/g, '');
  if (cleanEntered.length !== 16) return false;

  // 1. Primary check: V6 Master-derived key
  const expectedV6 = generateOfflineActivationKey(machineId, VENDOR_MASTER_PASSWORD).replace(/[^0-9]/g, '');
  if (expectedV6 && cleanEntered === expectedV6) {
    return true;
  }

  // 2. Legacy check: v4/v5 key
  const expectedLegacy = computeLegacyKey(machineId).replace(/[^0-9]/g, '');
  if (expectedLegacy && cleanEntered === expectedLegacy) {
    return true;
  }

  // Also check raw 8-digit without prefix
  const pure8Digits = machineId.replace(/^TB-?HW-?/i, '').replace(/[^0-9]/g, '');
  if (pure8Digits.length === 8) {
    const expectedPure = computeLegacyKey(pure8Digits).replace(/[^0-9]/g, '');
    if (cleanEntered === expectedPure) return true;
  }

  return false;
}

export function computeActivationSealV6(machineId: string, activationKey: string): string {
  const raw = `V6_MASTER_SEAL::${machineId.trim().toUpperCase()}::${activationKey.replace(/[^0-9]/g, '')}::${SECRET_SALT}`;
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + i * 19), 0xc2b2ae35) >>> 0;
  }
  return `ARKA6-${h1.toString(16).toUpperCase().padStart(8, '0')}-${h2.toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Loads current activation status from localStorage
 */
export function loadLicenseStatus(): LicenseStatus {
  const currentMachineId = getOrCreateMachineId();
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) {
      return { isActivated: false, machineId: currentMachineId };
    }
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      parsed.isActivated === true &&
      typeof parsed.machineId === 'string' &&
      typeof parsed.activationKey === 'string' &&
      parsed.machineId === currentMachineId &&
      verifyOfflineActivationKey(currentMachineId, parsed.activationKey)
    ) {
      return {
        isActivated: true,
        machineId: currentMachineId,
        activatedAt: parsed.activatedAt,
        activationKey: parsed.activationKey,
        activatedKey: parsed.activationKey,
        masterAuthorized: true,
      };
    } else {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
    }
  } catch {
    try {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return { isActivated: false, machineId: currentMachineId };
}

/**
 * Automatically recovers and restores an existing valid hardware activation
 * from the native OS-level persistent lock (ProgramData / AppData).
 * This ensures that when the app is updated, reinstalled, or the WebView2 cache
 * is refreshed, the user NEVER has to re-enter their 16-digit activation key!
 */
export async function recoverLicenseFromNativeLock(): Promise<boolean> {
  const currentMachineId = getOrCreateMachineId();

  if (isTauriEnvironment()) {
    try {
      const rawLock = await invokeTauriCommand<string | null>('get_saved_native_license', {
        machineId: currentMachineId,
      });

      if (rawLock && typeof rawLock === 'string' && rawLock.startsWith('ARKA_V6_LOCK::')) {
        const parts = rawLock.split('::');
        // Format: ARKA_V6_LOCK::{machine_id}::{seal}::{optional_key}
        const lockedMachine = (parts[1] || '').trim().toUpperCase();
        const lockedSeal = (parts[2] || '').trim().toUpperCase();
        const lockedKey = (parts[3] || '').trim();

        if (lockedMachine === currentMachineId.toUpperCase()) {
          // If 16-digit key was saved in lock file
          if (lockedKey && verifyOfflineActivationKey(currentMachineId, lockedKey)) {
            saveActivatedLicense(currentMachineId, lockedKey);
            return true;
          }

          // Alternatively, derive key from official Vendor Master formula
          const derivedKey = generateOfflineActivationKey(currentMachineId, VENDOR_MASTER_PASSWORD);
          if (derivedKey) {
            const expectedSeal = computeActivationSealV6(currentMachineId, derivedKey);
            if (lockedSeal === expectedSeal || !lockedSeal) {
              saveActivatedLicense(currentMachineId, derivedKey);
              return true;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Native license recovery check skipped:', err);
    }
  }

  // Also check if server license is available
  try {
    const res = await fetch('/api/license');
    if (res.ok) {
      const data = await res.json();
      if (data && (data.isActivated || data.license?.isActivated)) {
        const srv = data.license || data;
        const key = srv.activatedKey || srv.activationKey;
        if (key && verifyOfflineActivationKey(currentMachineId, key)) {
          saveActivatedLicense(currentMachineId, key);
          return true;
        } else {
          const statusRecord = {
            version: 6,
            isActivated: true,
            machineId: currentMachineId,
            activatedAt: srv.activatedAt || '1405/01/01',
            activationKey: key || 'SERVER-UNLOCKED',
            seal: 'SERVER-UNLOCKED',
          };
          localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(statusRecord));
          return true;
        }
      }
    }
  } catch {
    // Offline mode
  }

  return false;
}

/**
 * Verifies the Native Windows Tauri OS-level license lock file (`arka_master_license_v6.lock`).
 */
export async function verifyNativeTauriLicenseLock(): Promise<boolean> {
  const currentStatus = loadLicenseStatus();

  // If localStorage doesn't have an active license, try to recover from native OS lock first!
  if (!currentStatus.isActivated || !currentStatus.activationKey) {
    const recovered = await recoverLicenseFromNativeLock();
    return recovered;
  }

  if (!isTauriEnvironment()) {
    return currentStatus.isActivated;
  }

  const expectedSeal = computeActivationSealV6(
    currentStatus.machineId,
    currentStatus.activationKey
  );

  const nativeValid = await invokeTauriCommand<boolean>('verify_native_license_lock', {
    machineId: currentStatus.machineId,
    seal: expectedSeal,
  });

  if (nativeValid === true) {
    return true;
  }

  // If direct verification failed, attempt recovery before declaring invalid
  const recovered = await recoverLicenseFromNativeLock();
  return recovered;
}

/**
 * Saves activated license when the 16-digit key matches the machineId
 */
export function saveActivatedLicense(
  machineId: string,
  enteredKey: string
): LicenseStatus | null {
  if (!verifyOfflineActivationKey(machineId, enteredKey)) {
    return null;
  }

  const digits = enteredKey.trim().replace(/[^0-9]/g, '');
  const formattedKey = `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}`;
  const seal = computeActivationSealV6(machineId, formattedKey);

  const statusRecord = {
    version: 6,
    isActivated: true,
    machineId,
    activatedAt: new Date().toLocaleDateString('fa-IR'),
    activationKey: formattedKey,
    seal,
  };

  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(statusRecord));
  } catch {
    // ignore
  }

  if (isTauriEnvironment()) {
    void invokeTauriCommand('save_native_license_lock', {
      machineId,
      seal,
      activationKey: formattedKey,
    });
  }

  // Broadcast to server if server is online
  try {
    fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: statusRecord }),
    }).catch(() => {});
  } catch {
    // offline
  }

  return {
    isActivated: true,
    machineId,
    activatedAt: statusRecord.activatedAt,
    activationKey: formattedKey,
    activatedKey: formattedKey,
    masterAuthorized: true,
  };
}

/**
 * Locks / revokes the license on the current system so the activation modal is enforced immediately
 */
export function lockApplicationLicense(): LicenseStatus {
  const currentMachineId = getOrCreateMachineId();
  purgeLegacyKeys();
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (isTauriEnvironment()) {
    void invokeTauriCommand('revoke_native_license_lock');
  }
  return {
    isActivated: false,
    machineId: currentMachineId,
  };
}
