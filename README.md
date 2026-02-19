# CTP500 Printer App

A macOS desktop application for printing text and images over Bluetooth LE to the Core Innovations CTP500 thermal printer (and compatible devices sold as "S Blue/Pink/White/Black Printer").

Original reverse-engineering and protocol research by Mel at [ThirtyThreeDown Studio](https://thirtythreedown.com/2025/11/02/pc-app-for-walmart-thermal-printer/), Bitflip, Tsathoggualware, Reid, and others.

---

## Requirements

- macOS (Apple Silicon or Intel)
- [Homebrew](https://brew.sh)
- [uv](https://docs.astral.sh/uv/)
- Homebrew Python 3.13 with Tk support:

```bash
brew install python-tk@3.13
```

---

## Installation

```bash
git clone <repo-url>
cd CTP500PrinterApp
uv sync
```

`uv sync` will use Homebrew's Python 3.13 (configured via `python-preference = "only-system"` in `pyproject.toml`) and install all dependencies automatically.

---

## Running

```bash
uv run main.py
```

---

## Features

### Bluetooth Connection
- **Auto-scan** — click "Scan & Connect" to scan for nearby compatible printers. No manual address entry required.
- Supports any device advertising as `S Blue Printer`, `S Pink Printer`, `S White Printer`, or `S Black Printer`.
- **Connection status indicator** — color-coded dot shows current state (scanning / connected / disconnected).
- **Battery level** — displayed on connect, derived from the printer's reported voltage (`VOLT=XXXXmv`), color-coded green / orange / red.
- Connect and Disconnect buttons toggle visibility based on connection state — only the relevant action is shown at any time.
- BLE connection is cleanly terminated on window close to prevent the printer being left in a stale-connected state.

### Text Printing
- Type directly into the text field or load a `.txt` file.
- Text is rendered to a bitmap image using macOS's built-in Menlo monospace font and sent to the printer.
- Automatic word-wrapping to the printer's 384-pixel paper width.

### Image Printing
- Load PNG, JPG, JPEG, or BMP files via the image picker.
- A preview thumbnail is shown in the app before printing.
- Images are automatically scaled or padded to the printer's 384px width and converted to 1-bit monochrome for printing.

### Activity Log
- All actions are timestamped and shown in a dark terminal-style log panel.
- Logs connection events, printer status responses, every command sent, byte counts, and errors.
- Progress updates shown during large image transfers.

---

## How Printing Works

The app communicates with the printer over BLE using the ISSC Transparent UART service:

| Role | UUID |
|---|---|
| Service | `49535343-fe7d-4ae5-8fa9-9fafd205e455` |
| Write (TX) | `49535343-8841-43f4-a8d4-ecbe34729bb3` |
| Notify (RX) | `49535343-1e4d-4bd9-ba61-23c647249616` |

Print data is sent as ESC/POS raster commands (`GS v 0`) chunked to the negotiated BLE MTU size (typically 182 bytes on macOS), using write-with-response for reliable delivery.

Battery voltage is read from the printer's status notification response:
```
HV=V1.0A,SV=V1.01,VOLT=4000mv,DPI=384
```
Voltage is converted to a percentage using the LiPo range (3300 mv = 0%, 4200 mv = 100%).

---

## Session Changes (Feb 2026)

This session upgraded the application from a non-functional prototype to a working macOS BLE printer client. Key changes:

- **Replaced `socket.AF_BLUETOOTH` (Linux-only) with `bleak`** — the original code used RFCOMM sockets which are unavailable on macOS. The app now uses Bluetooth LE via bleak with full async support.
- **Replaced `pyserial`** (intermediate fix) with BLE after confirming the CTP500 is a BLE-only device.
- **BLE auto-discovery** — integrated device scanning directly into the app. The hardcoded MAC address is gone; the app scans for printers by name pattern at connect time.
- **Async architecture** — BLE operations run in a dedicated background event loop so the UI never freezes during connect, disconnect, or print.
- **Reliable BLE writes** — switched from write-without-response to write-with-response to prevent packet loss on large image payloads. Data is dynamically chunked to the negotiated MTU.
- **Battery indicator** — subscribed to the printer's notify characteristic to read and display battery level on connect.
- **Connection status UI** — added colored status label, battery label, and connect/disconnect button toggling (only the relevant button is visible).
- **Activity log** — added a timestamped dark-mode log panel showing all printer commands, byte counts, and events.
- **Fixed font** — replaced Windows-only `Lucon.ttf` with macOS built-in `Menlo.ttc`.
- **Fixed Tcl/Tk on macOS 26** — system Tcl/Tk 8.5 crashes on macOS Tahoe. Configured the project to use Homebrew's `python-tk@3.13` which bundles Tcl/Tk 8.6.
- **uv project setup** — updated `pyproject.toml` with all dependencies (`pillow`, `bleak`) and configured `python-preference = "only-system"` so uv uses the Tk-capable Homebrew Python.
- **Clean disconnect on exit** — `on_closing()` now blocks briefly to ensure the BLE connection is fully terminated before the window closes.

---

## Sample Images

The following test images are included in the repo:

| File | Description |
|---|---|
| `CTP500_8BitToDo.png` / `.jpg` | 8-bit style to-do list |
| `CTP500_Hardsmartkind.png` | Logo/graphic test |
| `CTP500_shoppinglist.png` | Shopping list template |
