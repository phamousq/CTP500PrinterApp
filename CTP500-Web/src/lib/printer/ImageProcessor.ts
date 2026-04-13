// Image processing using Canvas API - convert to 1-bit mono for thermal printer

const PRINTER_WIDTH = 384; // pixels

export interface ProcessedImage {
	width: number;
	height: number;
	data: Uint8Array;
}

// Convert image file to 1-bit mono for printing
export async function processImage(file: File): Promise<ProcessedImage> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			try {
				// Scale to fit printer width
				const scale = PRINTER_WIDTH / img.width;
				const width = PRINTER_WIDTH;
				const height = Math.round(img.height * scale);

				// Create canvas
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d')!;

				// Draw image (grayscale helps with mono conversion)
				ctx.fillStyle = 'white';
				ctx.fillRect(0, 0, width, height);
				ctx.drawImage(img, 0, 0, width, height);

				// Get image data
				const imageData = ctx.getImageData(0, 0, width, height);
				const mono = imageDataToMono(imageData, width, height);

				URL.revokeObjectURL(url);
				resolve({ width, height, data: mono });
			} catch (err) {
				URL.revokeObjectURL(url);
				reject(err);
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

// Convert image data to 1-bit mono (dithering pattern)
function imageDataToMono(imageData: ImageData, width: number, height: number): Uint8Array {
	const bytesPerLine = Math.ceil(width / 8);
	const data = new Uint8Array(bytesPerLine * height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			const r = imageData.data[idx];
			const g = imageData.data[idx + 1];
			const b = imageData.data[idx + 2];

			// Simple threshold for black/white
			// Use luminance: Y = 0.299R + 0.587G + 0.114B
			const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
			const isBlack = luminance < 128;

			if (isBlack) {
				const byteIdx = y * bytesPerLine + Math.floor(x / 8);
				data[byteIdx] |= (0x80 >> (x % 8));
			}
		}
	}

	return data;
}

// Generate thumbnail for preview
export function generateThumbnail(file: File, maxSize: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
			const w = Math.round(img.width * scale);
			const h = Math.round(img.height * scale);

			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, w, h);

			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL('image/png'));
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}