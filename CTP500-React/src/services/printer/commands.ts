// ESC/POS commands for CTP500 thermal printer

// Initialize printer
export const initPrinter = () => new Uint8Array([0x1b, 0x40]); // ESC @

// Feed n lines
export const feedLine = (n: number) => new Uint8Array([0x1b, 0x64, n]); // ESC d n

// Full cut
export const fullCut = () => new Uint8Array([0x1d, 0x56, 0x00]); // GS V 0

// Partial cut
export const partialCut = () => new Uint8Array([0x1d, 0x56, 0x01]); // GS V 1

// Start raster print sequence
export const startRaster = () => new Uint8Array([0x1d, 0x49, 0xf0, 0x19]); // GS I 0xF0 0x19

// End raster print sequence
export const endRaster = () => new Uint8Array([0x0a, 0x0a, 0x0a, 0x9a]);

// Encode text to bytes (simple ASCII for now)
export const encodeText = (text: string): Uint8Array => {
  return new TextEncoder().encode(text);
};

// Combine multiple byte arrays
export const combine = (...arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};

// Build raster image command
export const rasterImage = (width: number, height: number, data: Uint8Array): Uint8Array => {
  // GS v 0 - Print raster bit image
  // m = 0 (normal mode)
  // xL, xH = width in bytes (little endian)
  // yL, yH = height in dots (little endian)
  const widthBytes = Math.ceil(width / 8);
  return combine(
    new Uint8Array([0x1d, 0x76, 0x30, 0x00]),
    new Uint8Array([widthBytes & 0xff, (widthBytes >> 8) & 0xff]),
    new Uint8Array([height & 0xff, (height >> 8) & 0xff]),
    data
  );
};