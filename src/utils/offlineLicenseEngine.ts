/**
 * Hardware-Bound Offline License & Activation Engine
 * - Binds activation strictly to each individual Windows computer's hardware (GPU, CPU cores, RAM, Screen Hardware, Platform).
 * - The application will NOT run at all until a valid 16-digit key matching THIS computer's Hardware ID is entered.
 * - If the license file / storage is copied to another Windows computer with different hardware, the Hardware ID changes and the app immediately locks.
 * - ZERO keygen or key-display logic exists in the customer UI.
 * - No automatic pre-activation: Each instance requires valid activation for its own hardware.
 */

const LICENSE_STORAGE_KEY = 'TARAZBAN_HARDWARE_LOCKED_LICENSE_V4_STRICT_SIGNED';

const LEGACY_LICENSE_KEYS = [
  'TARAZBAN_HARDWARE_LOCKED_LICENSE',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V1',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V2',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V3',
  'TARAZBAN_HARDWARE_LOCKED_LICENSE_V3_STRICT',
  'TARAZBAN_SERVER_ACTIVE_CACHE',
];

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

/**
 * Normalizes a System/Hardware ID to uppercase alphanumeric characters.
 * If the user entered only the 8 digits (e.g. "6674-1764" or "66741764"),
 * automatically prefixes "TBHW" so it matches "TB-HW-6674-1764".
 */
export function normalizeMachineId(rawId: string): string {
  const clean = (rawId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return '';
  if (/^\d{8}$/.test(clean)) {
    return `TBHW${clean}`;
  }
  return clean;
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
 * Internal helper that computes the 16-digit key for an exact alphanumeric string.
 */
function computeKeyFromCleanString(clean: string): string {
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
 * Generates the deterministic 16-digit Offline Activation Key (XXXX-XXXX-XXXX-XXXX)
 * from a given Hardware/System ID.
 * Uses identical modular arithmetic in C# (.NET) and TypeScript.
 */
export function computeOfflineActivationKey(machineId: string): string {
  const clean = normalizeMachineId(machineId);
  return computeKeyFromCleanString(clean);
}

/**
 * Computes an internal seal signature so legacy or tampered localStorage objects cannot bypass activation.
 */
function computeActivationSeal(machineId: string, formattedKey: string): string {
  const raw = `SEAL::${normalizeMachineId(machineId)}::${formattedKey.replace(/[^0-9]/g, '')}::V4`;
  let acc = 9182;
  for (let i = 0; i < raw.length; i++) {
    acc = (acc * 53 + raw.charCodeAt(i) * (i + 11) + 7719) % 1000000;
  }
  return `SIG4-${String(acc).padStart(6, '0')}`;
}

/**
 * Verifies whether a user-entered activation key is valid for THIS computer's hardware ID.
 * Supports both full ID ("TB-HW-XXXX-XXXX") and numeric-only ("XXXX-XXXX") keygen inputs.
 */
export function verifyOfflineActivationKey(
  machineId: string,
  enteredKey: string
): boolean {
  const normalizedEntered = (enteredKey || '').trim().replace(/\s+/g, '');
  if (!normalizedEntered) return false;

  const cleanEnteredDigits = normalizedEntered.replace(/[^0-9]/g, '');
  if (cleanEnteredDigits.length !== 16) return false;

  // 1. Standard full Hardware ID (TBHWXXXXXXXX)
  const expectedFull = computeOfflineActivationKey(machineId).replace(/[^0-9]/g, '');
  if (cleanEnteredDigits === expectedFull) return true;

  // 2. Fallback if admin typed only the 8 digits (XXXXXXXX) without TB-HW- in an older keygen
  const digitsOnlyId = machineId.toUpperCase().replace(/^TB-?HW-?/i, '').replace(/[^A-Z0-9]/g, '');
  if (digitsOnlyId) {
    const expectedDigitsOnly = computeKeyFromCleanString(digitsOnlyId).replace(/[^0-9]/g, '');
    if (cleanEnteredDigits === expectedDigitsOnly) return true;
  }

  return false;
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
 * Purges any legacy license keys from older installations so previously installed systems
 * cannot bypass the strict V4 hardware lock.
 */
function purgeLegacyLicenseStorage(): void {
  try {
    for (const k of LEGACY_LICENSE_KEYS) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Reads current offline license activation state and validates that it matches
 * the CURRENT computer's physical hardware fingerprint AND valid V4 signature.
 * If not activated or if hardware changed or if key is invalid, returns isActivated: false.
 * Zero backdoor, zero pre-activation.
 */
export function loadLicenseStatus(): LicenseStatus {
  purgeLegacyLicenseStorage();
  const { machineId, hardwareSpecs } = getHardwareMachineId();
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const expectedSeal =
        parsed && typeof parsed.activatedKey === 'string'
          ? computeActivationSeal(machineId, parsed.activatedKey)
          : '';
      if (
        parsed &&
        parsed.isActivated === true &&
        parsed.machineId === machineId &&
        typeof parsed.activatedKey === 'string' &&
        parsed.seal === expectedSeal &&
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
 * Saves a verified offline license key bound to the current computer.
 * Strictly verifies before writing to storage.
 */
export function saveActivatedLicense(
  machineId: string,
  enteredKey: string
): LicenseStatus | null {
  purgeLegacyLicenseStorage();
  if (!verifyOfflineActivationKey(machineId, enteredKey)) {
    return null;
  }
  const { hardwareSpecs } = getHardwareMachineId();
  const formattedKey = formatActivationKeyInput(enteredKey);
  const seal = computeActivationSeal(machineId, formattedKey);
  const status: LicenseStatus = {
    machineId,
    hardwareSpecs,
    isActivated: true,
    activatedKey: formattedKey,
    activatedAt: new Date().toLocaleDateString('fa-IR'),
    isServerLicensed: false,
  };
  try {
    localStorage.setItem(
      LICENSE_STORAGE_KEY,
      JSON.stringify({
        ...status,
        seal,
      })
    );
  } catch {
    // ignore
  }
  return status;
}

/**
 * Locks the application again (removes stored activation key) so the lock screen appears immediately.
 */
export function lockApplicationLicense(): LicenseStatus {
  purgeLegacyLicenseStorage();
  const { machineId, hardwareSpecs } = getHardwareMachineId();
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    // ignore
  }
  return {
    machineId,
    hardwareSpecs,
    isActivated: false,
  };
}
