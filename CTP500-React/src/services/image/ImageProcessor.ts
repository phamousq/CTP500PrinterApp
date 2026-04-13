import { PRINTER_WIDTH } from '../bluetooth/constants';

export interface ProcessedImage {
  data: Uint8Array;
  width: number;
  height: number;
}

// Convert a File to a processed image ready for printing
export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Scale to fit printer width
  const scale = PRINTER_WIDTH / bitmap.width;
  const height = Math.round(bitmap.height * scale);
  canvas.width = PRINTER_WIDTH;
  canvas.height = height;

  // White background, draw image
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Convert to 1-bit (threshold at 128)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const output = new Uint8Array(Math.ceil(canvas.width / 8) * canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const gray = (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? 0 : 255;
      const byteIdx = y * Math.ceil(canvas.width / 8) + Math.floor(x / 8);
      const bit = 7 - (x % 8);
      if (gray === 0) {
        output[byteIdx] |= (1 << bit);
      }
    }
  }

  // Pad width to byte boundary
  const paddedWidth = Math.ceil(canvas.width / 8) * 8;
  if (paddedWidth !== canvas.width) {
    const padded = new Uint8Array(canvas.height * (paddedWidth / 8));
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const srcIdx = y * Math.ceil(canvas.width / 8) + Math.floor(x / 8);
        const dstIdx = y * (paddedWidth / 8) + Math.floor(x / 8);
        const srcBit = 7 - (x % 8);
        const dstBit = 7 - (x % paddedWidth);
        if (srcBit === dstBit) {
          padded[dstIdx] |= (output[srcIdx] & (1 << srcBit));
        }
      }
    }
    return { data: padded, width: paddedWidth, height: canvas.height };
  }

  return { data: output, width: canvas.width, height: canvas.height };
}

// Render text to image using canvas
export function renderTextToImage(text: string, fontSize = 28): Promise<ProcessedImage> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = PRINTER_WIDTH;
    canvas.height = 5000; // Large enough, will trim
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px Menlo, monospace`;

    // Word wrap
    const lines: string[] = [];
    for (const rawLine of text.split('\n')) {
      const words = rawLine.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= PRINTER_WIDTH) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
    }

    let y = fontSize;
    for (const line of lines) {
      ctx.fillText(line, 0, y);
      y += fontSize * 1.2;
    }

    // Trim whitespace
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minY = 0, maxY = canvas.height;
    outer: for (let y2 = 0; y2 < canvas.height; y2++) {
      for (let x = 0; x < canvas.width; x++) {
        if (imageData.data[(y2 * canvas.width + x) * 4] < 128) {
          minY = y2;
          break outer;
        }
      }
    }
    outer2: for (let y2 = canvas.height - 1; y2 >= 0; y2--) {
      for (let x = 0; x < canvas.width; x++) {
        if (imageData.data[(y2 * canvas.width + x) * 4] < 128) {
          maxY = y2;
          break outer2;
        }
      }
    }

    const trimmed = ctx.getImageData(0, minY, canvas.width, maxY - minY + 10);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = canvas.width;
    outCanvas.height = trimmed.height;
    outCanvas.getContext('2d')!.putImageData(trimmed, 0, 0);

    // Convert to 1-bit
    const result = new Uint8Array(Math.ceil(canvas.width / 8) * trimmed.height);
    for (let y2 = 0; y2 < trimmed.height; y2++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = y2 * canvas.width + x;
        const gray = trimmed.data[idx * 4] < 128 ? 0 : 255;
        const byteIdx = Math.floor(x / 8);
        const bit = 7 - (x % 8);
        if (gray === 0) {
          result[y2 * Math.ceil(canvas.width / 8) + byteIdx] |= (1 << bit);
        }
      }
    }

    resolve({ data: result, width: canvas.width, height: trimmed.height });
  });
}