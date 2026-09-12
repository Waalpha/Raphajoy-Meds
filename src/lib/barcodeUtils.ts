// Professional Barcode Generation, Validation, and Audio Feedback Utilities
import JsBarcode from 'jsbarcode';

export type BarcodeFormat = 'CODE128' | 'EAN13' | 'UPC';

/**
 * Calculates EAN-13 check digit for a 12-digit string
 */
export function calculateEAN13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(twelveDigits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Validates whether an EAN-13 string is valid (13 digits with correct check digit)
 */
export function isValidEAN13(code: string | number | null | undefined): boolean {
  const str = code != null ? String(code).trim() : '';
  if (!/^\d{13}$/.test(str)) return false;
  const body = str.slice(0, 12);
  const expectedCheck = calculateEAN13CheckDigit(body);
  return parseInt(str[12], 10) === expectedCheck;
}

/**
 * Calculates UPC-A check digit for an 11-digit string
 */
export function calculateUPCACheckDigit(elevenDigits: string | number): number {
  const str = elevenDigits != null ? String(elevenDigits).trim() : '';
  if (!/^\d{11}$/.test(str)) return 0;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(str[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Validates whether a UPC-A string is valid (12 digits with correct check digit)
 */
export function isValidUPC(code: string | number | null | undefined): boolean {
  const str = code != null ? String(code).trim() : '';
  if (!/^\d{12}$/.test(str)) return false;
  const body = str.slice(0, 11);
  const expectedCheck = calculateUPCACheckDigit(body);
  return parseInt(str[11], 10) === expectedCheck;
}

/**
 * Validates barcode according to chosen format
 */
export function validateBarcode(
  code: string | number | null | undefined,
  format: BarcodeFormat = 'CODE128'
): { valid: boolean; error?: string } {
  const trimmed = code != null ? String(code).trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Barcode cannot be empty' };
  }

  if (format === 'EAN13') {
    if (!/^\d{13}$/.test(trimmed)) {
      return { valid: false, error: 'EAN-13 must be exactly 13 digits' };
    }
    if (!isValidEAN13(trimmed)) {
      return { valid: false, error: 'Invalid EAN-13 checksum digit' };
    }
    return { valid: true };
  }

  if (format === 'UPC') {
    if (!/^\d{12}$/.test(trimmed)) {
      return { valid: false, error: 'UPC-A must be exactly 12 digits' };
    }
    if (!isValidUPC(trimmed)) {
      return { valid: false, error: 'Invalid UPC-A checksum digit' };
    }
    return { valid: true };
  }

  // CODE128 accepts alphanumeric standard ASCII characters (1-80 chars)
  if (!/^[\x20-\x7E]{1,80}$/.test(trimmed)) {
    return { valid: false, error: 'Code 128 must contain valid standard alphanumeric ASCII characters' };
  }
  return { valid: true };
}

/**
 * Generates an automatic unique barcode according to format:
 * - EAN13: Uses standard GS1 prefix '200' (in-store/restricted distribution) + 9 random digits + valid check digit
 * - UPC: Uses prefix '0' + 10 random digits + valid check digit
 * - CODE128: 12-digit clean internal product barcode e.g. 890123456789
 * If existingBarcodes is provided, ensures the generated barcode does not collide.
 */
export function generateAutoBarcode(format: BarcodeFormat = 'CODE128', existingBarcodes?: string[]): string {
  const existingSet = new Set(existingBarcodes || []);
  let attempts = 0;
  let candidate = '';

  do {
    if (format === 'EAN13') {
      // 200 prefix + 9 random digits
      let body = '200';
      for (let i = 0; i < 9; i++) {
        body += Math.floor(Math.random() * 10).toString();
      }
      const check = calculateEAN13CheckDigit(body);
      candidate = `${body}${check}`;
    } else if (format === 'UPC') {
      // 0 prefix + 10 random digits
      let body = '0';
      for (let i = 0; i < 10; i++) {
        body += Math.floor(Math.random() * 10).toString();
      }
      const check = calculateUPCACheckDigit(body);
      candidate = `${body}${check}`;
    } else {
      // CODE128: Clean, universally scannable 12-digit numeric identifier
      const timestampPart = Date.now().toString().slice(-7);
      const randomPart = Math.floor(10000 + Math.random() * 90000).toString();
      candidate = `${timestampPart}${randomPart}`;
    }
    attempts++;
  } while (existingSet.has(candidate) && attempts < 50);

  return candidate;
}

/**
 * Plays a quick POS scanner beep sound using Web Audio API
 */
export function playScanBeep(type: boolean | 'success' | 'error' | 'warning' = true): void {
  try {
    const isSuccess = type === true || type === 'success';
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (isSuccess) {
      // High crisp retail scanner beep (1760Hz, 80ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      // Double low error beep (250Hz, 150ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // Audio might be muted or blocked by browser autoplay policy until user gesture
  }
}

/**
 * Render barcode onto an SVG element via JsBarcode safely
 */
export function renderBarcodeSvg(
  svgElement: SVGSVGElement | null,
  text: string | number | null | undefined,
  format: BarcodeFormat = 'CODE128',
  options?: { height?: number; displayValue?: boolean; fontSize?: number; width?: number }
): boolean {
  if (!svgElement) return false;
  const safeText = text != null ? String(text).trim() : '';
  if (!safeText) return false;

  try {
    let jsFormat = 'CODE128';
    if (format === 'EAN13' && isValidEAN13(safeText)) {
      jsFormat = 'EAN13';
    } else if (format === 'UPC' && isValidUPC(safeText)) {
      jsFormat = 'UPC';
    }

    JsBarcode(svgElement, safeText, {
      format: jsFormat,
      width: options?.width ?? 2,
      height: options?.height ?? 50,
      displayValue: options?.displayValue ?? true,
      fontSize: options?.fontSize ?? 13,
      font: 'monospace',
      textAlign: 'center',
      textPosition: 'bottom',
      textMargin: 3,
      background: '#ffffff',
      lineColor: '#000000',
      margin: 4,
    });
    return true;
  } catch (err) {
    console.warn('JsBarcode rendering fallback to CODE128:', err);
    try {
      JsBarcode(svgElement, safeText, {
        format: 'CODE128',
        width: options?.width ?? 2,
        height: options?.height ?? 50,
        displayValue: options?.displayValue ?? true,
        fontSize: options?.fontSize ?? 13,
        font: 'monospace',
        textAlign: 'center',
        margin: 4,
      });
      return true;
    } catch (e2) {
      console.error('Barcode render failed completely:', e2);
      return false;
    }
  }
}

// Backward-compatible aliases
export const generateUniqueBarcode = generateAutoBarcode;
export const playAudioBeep = playScanBeep;

