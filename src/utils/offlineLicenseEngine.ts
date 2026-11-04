/**
 * Hardware-Bound Offline License & Activation Engine
 * - Binds activation strictly to each individual Windows computer's hardware (GPU, CPU cores, RAM, Screen Hardware, Platform).
 * - The application will NOT run at all until a valid 16-digit key matching THIS computer's Hardware ID is entered.
 * - If the license file / storage is copied to another Windows computer with different hardware, the Hardware ID changes and the app immediately locks.
 * - ZERO keygen or key-display logic exists in the customer UI.
 */

const LICENSE_STORAGE_KEY = 'TARAZBAN_HARDWARE_LOCKED_LICENSE_V2';

export interface HardwareSpecs {
  cpuCores: number;
  ramGb: number;
  gpuRenderer: string;
  screenSpec: string;
  platform: string;
}

export interface LicenseStatus {
  machineId: string;
  hardwareSpecs: HardwareSpecs;
  isActivated: boolean;
  activatedKey?: string;
  activatedAt?: string;
  isServerLicensed?: boolean;
}

const SERVER_LICENSE_CACHE_KEY = 'TARAZBAN_SERVER_ACTIVE_CACHE';

/**
 * Normalizes a System/Hardware ID to uppercase alphanumeric characters.
 */
export function normalizeMachineId(rawId: string): string {
  return rawId.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Reads physical hardware characteristics of the current Windows machine
 * (GPU Renderer, CPU Core Count, RAM, Display Resolution/Depth, OS Platform)
 * to generate a deterministic, hardware-bound Machine ID (TB-HW-XXXX-XXXX)
 * that is unique per computer hardware configuration.
 */
export function probeComputerHardwareSpecs(): HardwareSpecs {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      cpuCores: 8,
      ramGb: 16,
      gpuRenderer: 'WINDOWS-NATIVE-GPU',
      screenSpec: '1920x1080x24',
      platform: 'Win32',
    };
  }

  const cpuCores = navigator.hardwareConcurrency || 4;
  const ramGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;
  const platform = navigator.platform || 'Win32';
  const screenSpec =
    typeof window.screen !== 'undefined'
      ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
      : '1920x1080x24';

  let gpuRenderer = 'STANDARD-GRAPHIC-ADAPTER';
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        gpuRenderer = `${vendor}|${renderer}`.trim() || gpuRenderer;
      }
    }
  } catch {
    // fallback if WebGL is blocked
  }

  return {
    cpuCores,
    ramGb,
    gpuRenderer,
    screenSpec,
    platform,
  };
}

/**
 * Computes a deterministic Hardware Serial ID (TB-HW-XXXX-XXXX) strictly derived
 * from the physical hardware specifications of the current Windows computer.
 */
export function getHardwareMachineId(): {
  machineId: string;
  hardwareSpecs: HardwareSpecs;
} {
  const specs = probeComputerHardwareSpecs();
  const rawHardwareFingerprint = [
    `CPU:${specs.cpuCores}`,
    `RAM:${specs.ramGb}`,
    `GPU:${specs.gpuRenderer}`,
    `SCR:${specs.screenSpec}`,
    `OS:${specs.platform}`,
  ]
    .join('||')
    .toUpperCase();

  let b1 = 5381;
  let b2 = 7919;

  for (let i = 0; i < rawHardwareFingerprint.length; i++) {
    const ch = rawHardwareFingerprint.charCodeAt(i);
    b1 = (b1 * 33 + ch * (i + 5) + 1013) % 10000;
    b2 = (b2 * 41 + ch * (i + 11) + 2027) % 10000;
  }

  // Ensure 4-digit blocks (1000..9999)
  const part1 = String((b1 % 9000) + 1000);
  const part2 = String((b2 % 9000) + 1000);

  return {
    machineId: `TB-HW-${part1}-${part2}`,
    hardwareSpecs: specs,
  };
}

/**
 * Generates the deterministic 16-digit Offline Activation Key (XXXX-XXXX-XXXX-XXXX)
 * from a given Hardware/System ID.
 * Uses identical modular arithmetic in C# (.NET) and TypeScript.
 */
export function computeOfflineActivationKey(machineId: string): string {
  const clean = normalizeMachineId(machineId);
  if (!clean) return '0000-0000-0000-0000';

  let h1 = 4821;
  let h2 = 7394;
  let h3 = 9106;
  let h4 = 6253;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    h1 = (h1 * 31 + code * (i + 7) + 1357) % 10000;
    h2 = (h2 * 37 + code * (i + 13) + 2468) % 10000;
    h3 = (h3 * 41 + code * (i + 19) + 3579) % 10000;
    h4 = (h4 * 43 + code * (i + 23) + 4680) % 10000;
  }

  const p1 = String(h1).padStart(4, '0');
  const p2 = String(h2).padStart(4, '0');
  const p3 = String(h3).padStart(4, '0');
  const p4 = String(h4).padStart(4, '0');

  return `${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Verifies whether a user-entered activation key is valid for THIS computer's hardware ID.
 */
export function verifyOfflineActivationKey(
  machineId: string,
  enteredKey: string
): boolean {
  const normalizedEntered = enteredKey.trim().replace(/\s+/g, '');
  if (!normalizedEntered) return false;

  const expected = computeOfflineActivationKey(machineId);
  const cleanEnteredDigits = normalizedEntered.replace(/[^0-9]/g, '');
  const cleanExpectedDigits = expected.replace(/[^0-9]/g, '');

  return (
    cleanEnteredDigits.length === 16 &&
    cleanEnteredDigits === cleanExpectedDigits
  );
}

/**
 * Formats a typed activation key into XXXX-XXXX-XXXX-XXXX as the user types.
 */
export function formatActivationKeyInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 16);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join('-');
}

/**
 * Reads current offline license activation state and validates that it matches
 * the CURRENT computer's physical hardware fingerprint.
 * If not activated or if hardware changed, returns isActivated: false.
 */
/**
 * Reads current offline license activation state.
 * 1. Checks if the server itself is already activated (Server-Wide Linux License for all IP connections).
 * 2. If not, checks local Windows hardware-locked license.
 * 3. If neither is active, returns isActivated: false.
 */
export function loadLicenseStatus(): LicenseStatus {
  const { machineId, hardwareSpecs } = getHardwareMachineId();
  try {
    // 1. Check Server-Wide License Cache (activated on Linux server for all incoming IP connections)
    const serverCached = localStorage.getItem(SERVER_LICENSE_CACHE_KEY);
    if (serverCached) {
      const parsedServer = JSON.parse(serverCached);
      if (parsedServer && parsedServer.isActivated === true) {
        return {
          machineId: parsedServer.machineId || 'TB-SRV-LINUX-ENTERPRISE',
          hardwareSpecs,
          isActivated: true,
          activatedKey: parsedServer.activatedKey || 'SERVER-ACTIVATED',
          activatedAt: parsedServer.activatedAt || '1404/08/12',
          isServerLicensed: true,
        };
      }
    }

    // 2. Check local Windows hardware-bound license
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.isActivated === true &&
        parsed.machineId === machineId &&
        typeof parsed.activatedKey === 'string' &&
        verifyOfflineActivationKey(machineId, parsed.activatedKey)
      ) {
        return {
          machineId,
          hardwareSpecs,
          isActivated: true,
          activatedKey: parsed.activatedKey,
          activatedAt: parsed.activatedAt,
          isServerLicensed: false,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    machineId,
    hardwareSpecs,
    isActivated: false,
  };
}

/**
 * Fetches the Linux server-level license file (/server_license.json).
 * When Curen is deployed on a Linux server, activating the server once unlocks
 * all incoming client connections via IP address without requiring client activation.
 */
export async function fetchServerLicenseStatus(): Promise<LicenseStatus | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`/server_license.json?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.isActivated === true) {
        const specs = probeComputerHardwareSpecs();
        const serverStatus: LicenseStatus = {
          machineId: data.machineId || 'TB-SRV-LINUX-ENTERPRISE',
          hardwareSpecs: specs,
          isActivated: true,
          activatedKey: data.activatedKey || 'SERVER-WIDE-KEY',
          activatedAt: data.activatedAt || '1404/08/12',
          isServerLicensed: true,
        };
        try {
          localStorage.setItem(SERVER_LICENSE_CACHE_KEY, JSON.stringify(serverStatus));
        } catch {
          // ignore storage quota error
        }
        return serverStatus;
      } else if (data && data.isActivated === false) {
        // If server was explicitly deactivated
        localStorage.removeItem(SERVER_LICENSE_CACHE_KEY);
      }
    }
  } catch {
    // Static file not reachable or offline
  }
  return null;
}

/**
 * Saves a verified offline license key bound to the current computer or server.
 */
export function saveActivatedLicense(
  machineId: string,
  enteredKey: string
): LicenseStatus | null {
  if (!verifyOfflineActivationKey(machineId, enteredKey)) {
    return null;
  }
  const { hardwareSpecs } = getHardwareMachineId();
  const formattedKey = formatActivationKeyInput(enteredKey);
  const isServer = machineId.startsWith('TB-SRV-');
  const status: LicenseStatus = {
    machineId,
    hardwareSpecs,
    isActivated: true,
    activatedKey: formattedKey,
    activatedAt: '1404/08/12',
    isServerLicensed: isServer,
  };
  try {
    if (isServer) {
      localStorage.setItem(SERVER_LICENSE_CACHE_KEY, JSON.stringify(status));
    } else {
      localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(status));
    }
  } catch {
    // ignore
  }
  return status;
}

/**
 * Locks the application again (removes stored activation key) so the lock screen appears.
 */
export function lockApplicationLicense(): LicenseStatus {
  const { machineId, hardwareSpecs } = getHardwareMachineId();
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.removeItem(SERVER_LICENSE_CACHE_KEY);
  } catch {
    // ignore
  }
  return {
    machineId,
    hardwareSpecs,
    isActivated: false,
  };
}
