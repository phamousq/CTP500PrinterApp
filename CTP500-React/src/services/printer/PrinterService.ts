// High-level printer service - placeholder for React migration
// BLE operations are now managed by useBluetooth hook
// This service will be updated when UI components are built

import * as cmd from './commands';
import { processImage } from '../image/ImageProcessor';

// Placeholder - will be connected to useBluetooth hook when UI is built
export async function printText(text: string, writeFn: (data: Uint8Array) => Promise<void>): Promise<void> {
  // Initialize, print text, feed, cut
  const encoded = cmd.encodeText(text);
  const init = cmd.initPrinter();
  const feed = cmd.feedLine(3);
  const cut = cmd.fullCut();

  const data = cmd.combine(init, encoded, feed, cut);
  await writeFn(data);
}

// Placeholder - will be connected to useBluetooth hook when UI is built
export async function printImage(file: File, writeFn: (data: Uint8Array) => Promise<void>): Promise<void> {
  const processed = await processImage(file);

  // Initialize, print raster, cut
  const init = cmd.initPrinter();
  const raster = cmd.rasterImage(processed.width, processed.height, processed.data);
  const cut = cmd.fullCut();

  const data = cmd.combine(init, raster, cut);
  await writeFn(data);
}

// Word wrap text to fit printer width
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}
