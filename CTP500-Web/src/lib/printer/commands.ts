// ESC/POS printer commands and utilities

// ESC/POS command constants
export const ESC = 0x1B;
export const GS = 0x1D;

// Initialize printer
export function initPrinter(): Uint8Array {
	return new Uint8Array([ESC, 0x40]);
}

// Print and feed line
export function feedLine(lines: number = 1): Uint8Array {
	const cmd = new Uint8Array(3);
	cmd[0] = ESC;
	cmd[1] = 0x64;
	cmd[2] = lines;
	return cmd;
}

// Print and carriage return
export function cr(): Uint8Array {
	return new Uint8Array([0x0D]);
}

// Full cut (GS v 0)
export function fullCut(): Uint8Array {
	return new Uint8Array([GS, 0x56, 0x00]);
}

// Partial cut (GS v 1)
export function partialCut(): Uint8Array {
	return new Uint8Array([GS, 0x56, 0x01]);
}

// Set alignment
export function setAlignment(align: 'left' | 'center' | 'right'): Uint8Array {
	const val = align === 'center' ? 1 : align === 'right' ? 2 : 0;
	return new Uint8Array([ESC, 0x61, val]);
}

// Set text size
export function setTextSize(width: number, height: number): Uint8Array {
	// Width and height 1-8 (0 = normal, 1 = 2x, etc.)
	const size = ((width - 1) << 4) | (height - 1);
	return new Uint8Array([GS, 0x21, size]);
}

// Set text bold
export function setBold(enabled: boolean): Uint8Array {
	return new Uint8Array([ESC, 0x45, enabled ? 0x01 : 0x00]);
}

// Set text underline
export function setUnderline(enabled: boolean): Uint8Array {
	return new Uint8Array([ESC, 0x2D, enabled ? 0x01 : 0x00]);
}

// Encode string as bytes (ASCII + support for basic Latin)
export function encodeText(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

// Generate raster image command
// width and height in pixels (must be divisible by 8 for bytes)
export function rasterImage(width: number, height: number, data: Uint8Array): Uint8Array {
	const bytesPerLine = Math.ceil(width / 8);
	const totalBytes = bytesPerLine * height;
	
	// GS v 0 - raster print
	// Format: GS v 0 m xL xH yL yH [data]
	// m = 0 (normal), xL xH = width bytes (low, high), yL yH = height bytes (low, high)
	const cmd = new Uint8Array(6 + totalBytes);
	cmd[0] = GS;
	cmd[1] = 0x76;
	cmd[2] = 0x30;
	cmd[3] = 0x00; // m = 0 (normal)
	cmd[4] = bytesPerLine & 0xFF; // xL (width in bytes)
	cmd[5] = (bytesPerLine >> 8) & 0xFF; // xH
	cmd[6] = height & 0xFF; // yL
	cmd[7] = (height >> 8) & 0xFF; // yH
	
	cmd.set(data, 8);
	return cmd;
}

// Combine multiple commands
export function combine(...commands: Uint8Array[]): Uint8Array {
	const totalLength = commands.reduce((sum, cmd) => sum + cmd.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const cmd of commands) {
		result.set(cmd, offset);
		offset += cmd.length;
	}
	return result;
}