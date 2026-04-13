// BLE UUIDs for CTP500 thermal printer
export const WRITE_CHAR_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';
export const NOTIFY_CHAR_UUID = '49535343-1e4d-4bd9-ba61-23c647249616';
export const SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';

// Supported printer names
export const PRINTER_NAME_RE = /S\s+(Pink|Blue|White|Black)\s+Printer/i;

// Battery voltage range
export const BATT_MIN_MV = 3300;
export const BATT_MAX_MV = 4200;

// Printer width in pixels
export const PRINTER_WIDTH = 384;