import * as QRCode from 'qrcode';

// Renders the signed credential token as a scannable QR PNG. The Module 3
// /scan gate reads this token and verifies its signature (offline-tolerant).
export function qrPng(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: 'png', width: 360, margin: 2 });
}
