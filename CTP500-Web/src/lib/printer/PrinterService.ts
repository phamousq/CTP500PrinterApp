// High-level printer service - combines BLE with ESC/POS commands

import { write as bleWrite } from '../bluetooth/BLEService';
import { activityLogStore } from '../stores/activityLog';
import * as cmd from './commands';
import { processImage, type ProcessedImage } from './ImageProcessor';

const PRINTER_WIDTH = 384; // pixels

// Print text string
export async function printText(text: string): Promise<void> {
	activityLogStore.add('info', 'Printing text...');

	// Initialize, print text, feed, cut
	const encoded = cmd.encodeText(text);
	const init = cmd.initPrinter();
	const feed = cmd.feedLine(3);
	const cut = cmd.fullCut();

	const data = cmd.combine(init, encoded, feed, cut);
	await bleWrite(data);
}

// Print image from file
export async function printImage(file: File): Promise<void> {
	activityLogStore.add('info', `Processing image: ${file.name}`);
	
	let processed: ProcessedImage;
	try {
		processed = await processImage(file);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		activityLogStore.add('error', `Image processing failed: ${msg}`);
		throw err;
	}

	activityLogStore.add('info', `Image: ${processed.width}x${processed.height} pixels`);

	// Initialize, print raster, cut
	const init = cmd.initPrinter();
	const raster = cmd.rasterImage(processed.width, processed.height, processed.data);
	const cut = cmd.fullCut();

	const data = cmd.combine(init, raster, cut);
	await bleWrite(data);
}

// Print text from file content
export async function printTextFromFile(content: string): Promise<void> {
	// Simple word wrap to 32 characters (384 pixels / 12pt font ~ 32 chars)
	const lines = wrapText(content, 32);
	
	activityLogStore.add('info', `Printing ${lines.length} lines...`);

	const init = cmd.initPrinter();
	const textData = cmd.encodeText(lines.join('\n'));
	const feed = cmd.feedLine(3);
	const cut = cmd.fullCut();

	const data = cmd.combine(init, textData, feed, cut);
	await bleWrite(data);
}

// Word wrap text to fit printer width
function wrapText(text: string, maxChars: number): string[] {
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