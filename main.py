"""
Bluetooth LE CTP500 thermal printer client by Mel at ThirtyThreeDown Studio
See https://thirtythreedown.com/2025/11/02/pc-app-for-walmart-thermal-printer/ for process and details!
Shout out to Bitflip, Tsathoggualware, Reid and all the mad lasses and lads whose research made this possible!

"""

# System imports
import asyncio
import re
import struct
import threading
from datetime import datetime

# BLE import
from bleak import BleakClient

# Tkinter imports
import tkinter as tk
from tkinter import Button, Frame, Label, Radiobutton, messagebox, scrolledtext
from tkinter import filedialog as fd
from tkinter.messagebox import showinfo

# PILLOW imports
import PIL.Image
import PIL.ImageChops
import PIL.ImageDraw
import PIL.ImageFont
import PIL.ImageOps
import PIL.ImageTk

# BLE CONFIGURATION
WRITE_CHAR_UUID  = "49535343-8841-43f4-a8d4-ecbe34729bb3"
NOTIFY_CHAR_UUID = "49535343-1e4d-4bd9-ba61-23c647249616"

# Matches "S Blue Printer", "S Pink Printer", "S White Printer", "S Black Printer"
PRINTER_NAME_RE = re.compile(r"S\s+(Pink|Blue|White|Black)\s+Printer", re.IGNORECASE)

# LiPo voltage range for the CTP500 battery
BATT_MIN_MV = 3300  # 0%
BATT_MAX_MV = 4200  # 100%

# BACKGROUND BLE EVENT LOOP
# bleak is async; we run a dedicated event loop in a background thread so BLE
# operations never block the tkinter UI thread.
_ble_loop = asyncio.new_event_loop()
threading.Thread(target=_ble_loop.run_forever, daemon=True).start()


def _run_ble(coro):
    """Submit a coroutine to the background BLE event loop."""
    return asyncio.run_coroutine_threadsafe(coro, _ble_loop)


def _safe_log(message):
    """Thread-safe log: callable from the BLE background thread."""
    try:
        root.after(0, lambda: log(message))
    except NameError:
        print(message)  # root not built yet, fall back to console


def _safe_update_status(connected):
    """Thread-safe status update: callable from the BLE background thread."""
    try:
        root.after(0, lambda: update_status(connected))
    except NameError:
        pass


def _safe_set_scanning():
    """Thread-safe scanning state: disables the connect button while scanning."""
    try:
        def _do():
            status_label.configure(text="⟳ Scanning...", fg="#0066cc")
            connect_btn.configure(text="Scanning...", state="disabled")
        root.after(0, _do)
    except NameError:
        pass


def _safe_update_battery(pct):
    """Thread-safe battery update: callable from the BLE background thread."""
    try:
        root.after(0, lambda: update_battery(pct))
    except NameError:
        pass


def _parse_battery(data: bytearray):
    """Extract battery percentage from the printer's status response.
    Response format: 'HV=V1.0A,SV=V1.01,VOLT=4000mv,DPI=384,'
    Returns 0-100 int, or None if not found."""
    try:
        text = data.decode("ascii", errors="ignore")
        match = re.search(r"VOLT=(\d+)mv", text)
        if match:
            mv = int(match.group(1))
            pct = int((mv - BATT_MIN_MV) / (BATT_MAX_MV - BATT_MIN_MV) * 100)
            return max(0, min(100, pct))
    except Exception:
        pass
    return None


# PRINTER CONNECTION CLASS
class PrinterConnect:
    def __init__(self):
        self.client = None
        self.connected = False

    # --- Public synchronous interface (called from tkinter buttons) ---

    def scan_and_connect(self):
        _safe_set_scanning()
        _run_ble(self._scan_and_connect())

    def disconnect(self):
        _run_ble(self._disconnect())

    # --- Async internals ---

    async def _scan_and_connect(self):
        from bleak import BleakScanner
        _safe_log("Scanning for compatible printers (10s)...")
        try:
            results = await BleakScanner.discover(timeout=10.0, return_adv=True)
            for address, (device, adv) in results.items():
                if device.name and PRINTER_NAME_RE.match(device.name):
                    _safe_log(f"Found: {device.name}")
                    await self._connect(device.address)
                    return
            _safe_log("No compatible printer found nearby")
            _safe_update_status(False)
            root.after(0, lambda: messagebox.showwarning(
                "Not Found",
                "No compatible printer was found.\n"
                "Make sure the printer is powered on and in pairing mode."
            ))
        except Exception as e:
            _safe_log(f"Scan error: {e}")
            _safe_update_status(False)

    async def _connect(self, address):
        try:
            _safe_log(f"Connecting to {address}...")
            self.client = BleakClient(address)
            await self.client.connect()
            if self.client.is_connected:
                self.connected = True
                _safe_log(f"Connected  (MTU: {self.client.mtu_size} bytes)")
                _safe_update_status(True)
                # Subscribe to notifications then request printer status (battery etc.)
                await self.client.start_notify(NOTIFY_CHAR_UUID, self._on_notify)
                await self.client.write_gatt_char(
                    WRITE_CHAR_UUID, bytearray(b"\x1e\x47\x03"), response=True
                )
            else:
                _safe_log("Connection failed: device did not respond")
        except Exception as e:
            _safe_log(f"Connection error: {e}")
            err = str(e)
            root.after(0, lambda: messagebox.showerror("Connection Error", err))

    def _on_notify(self, sender, data: bytearray):
        """Handle incoming notifications from the printer."""
        text = data.decode("ascii", errors="ignore").strip().rstrip(",")
        _safe_log(f"Printer status: {text}")
        pct = _parse_battery(data)
        if pct is not None:
            _safe_update_battery(pct)

    async def _disconnect(self):
        try:
            if self.client and self.client.is_connected:
                _safe_log("Disconnecting...")
                try:
                    await self.client.stop_notify(NOTIFY_CHAR_UUID)
                except Exception:
                    pass
                await self.client.disconnect()
            self.connected = False
            _safe_log("Disconnected")
            _safe_update_status(False)
            _safe_update_battery(None)
        except Exception as e:
            _safe_log(f"Disconnection error: {e}")
            self.connected = False
            _safe_update_status(False)
            _safe_update_battery(None)

    async def _write_bytes(self, data):
        """Write data in BLE-MTU-sized chunks using write-with-response.
        response=True waits for ACK before sending the next chunk, preventing
        the printer's receive buffer from being overwhelmed on large payloads."""
        chunk_size = max(20, self.client.mtu_size - 3)
        total_chunks = (len(data) + chunk_size - 1) // chunk_size
        for i, offset in enumerate(range(0, len(data), chunk_size)):
            chunk = data[offset:offset + chunk_size]
            await self.client.write_gatt_char(
                WRITE_CHAR_UUID, bytearray(chunk), response=True
            )
            if total_chunks > 10 and i % 10 == 0:
                _safe_log(f"  Sending... {min(offset + chunk_size, len(data))}/{len(data)} bytes")

    async def print_image(self, im):
        """Full print sequence: init → start → image data → end."""
        try:
            buf = _image_to_bytes(im)

            _safe_log("Sent: initialize printer (ESC @)")
            await self._write_bytes(b"\x1b\x40")
            await asyncio.sleep(0.5)

            _safe_log("Sent: start print sequence")
            await self._write_bytes(b"\x1d\x49\xf0\x19")
            await asyncio.sleep(0.5)

            _safe_log(f"Sent: image data ({len(buf)} bytes, {im.size[0]}x{im.size[1]}px)")
            await self._write_bytes(buf)
            await asyncio.sleep(max(0.5, len(buf) / 5000))

            _safe_log("Sent: end print sequence")
            await self._write_bytes(b"\x0a\x0a\x0a\x9a")
            await asyncio.sleep(1.0)

            _safe_log("Print complete")
        except Exception as e:
            _safe_log(f"Print error: {e}")
            err = str(e)
            root.after(0, lambda: messagebox.showerror("Print error", err))


printer = PrinterConnect()
printerWidth = 384  # For CTP500

# IMAGE DATA STORAGE
current_image = None   # Full resolution image
image_thumbnail = None  # Thumbnail for preview
image_preview = None    # PhotoImage for canvas display

# UI WIDGET REFERENCES (assigned after GUI is built)
log_widget = None
status_label = None
battery_label = None
connect_btn = None
disconnect_btn = None


def log(message):
    if log_widget is None:
        return
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_widget.configure(state="normal")
    log_widget.insert(tk.END, f"[{timestamp}] {message}\n")
    log_widget.see(tk.END)
    log_widget.configure(state="disabled")


def update_status(connected):
    if status_label is None:
        return
    if connected:
        status_label.configure(text="● Connected", fg="#00aa00")
        connect_btn.pack_forget()
        disconnect_btn.pack(side="left", expand=1)
    else:
        status_label.configure(text="● Disconnected", fg="#cc0000")
        disconnect_btn.pack_forget()
        connect_btn.configure(text="Scan & Connect", state="normal")
        connect_btn.pack(side="left", expand=1)


def update_battery(pct):
    if battery_label is None:
        return
    if pct is None:
        battery_label.configure(text="")
        return
    if pct > 50:
        color = "#00aa00"
    elif pct > 20:
        color = "#cc7700"
    else:
        color = "#cc0000"
    battery_label.configure(text=f"Battery: {pct}%", fg=color)


# TEXT FILE MANAGEMENT
def selectTextFile():
    textFilePath = fd.askopenfilename(title="Open a text file", initialdir="/")
    showinfo(title="Selected file: ", message=textFilePath)
    if textFilePath:
        try:
            with open(textFilePath, "r", encoding="utf-8") as textFile:
                textFileContent = textFile.read()
                textInputField.delete("1.0", tk.END)
                textInputField.insert(tk.END, textFileContent)
        except Exception:
            print("Woops, something went wrong.")


# TEXT AND IMAGE RENDERING
def create_text(text, font_name="/System/Library/Fonts/Menlo.ttc", font_size=28):
    img = PIL.Image.new("RGB", (printerWidth, 5000), color=(255, 255, 255))
    font = PIL.ImageFont.truetype(font_name, font_size)
    d = PIL.ImageDraw.Draw(img)
    lines = []
    for line in text.splitlines():
        lines.append(get_wrapped_text(line, font, printerWidth))
    lines = "\n".join(lines)
    d.text((0, 0), lines, fill=(0, 0, 0), font=font)
    return trimImage(img)


def get_wrapped_text(text: str, font: PIL.ImageFont.ImageFont, line_length: int):
    lines = [""]
    for word in text.split():
        line = f"{lines[-1]} {word}".strip()
        if font.getlength(line) <= line_length:
            lines[-1] = line
        else:
            lines.append(word)
    return "\n".join(lines)


def print_from_entry():
    log("Print text requested")
    txt = textInputField.get("1.0", tk.END).strip()
    if not txt:
        messagebox.showwarning("No text", "Please type or load some text.")
        return

    try:
        log("Rendering text to image...")
        img = create_text(txt)
        log(f"Text rendered ({img.size[0]}x{img.size[1]}px)")
    except Exception as e:
        log(f"Text render error: {e}")
        messagebox.showerror("Render error", str(e))
        return

    if not (printer.connected and printer.client):
        log("Print aborted: not connected")
        messagebox.showwarning("Not connected", "Please connect to the printer first.")
        return

    _run_ble(printer.print_image(img))


def print_from_image():
    """Send the currently loaded image to the printer."""
    if not current_image:
        messagebox.showwarning("No image", "Please load an image first.")
        return
    if not (printer.connected and printer.client):
        log("Print aborted: not connected")
        messagebox.showwarning("Not connected", "Please connect to the printer first.")
        return
    _run_ble(printer.print_image(current_image))


# IMAGE FILE SECTION
def selectImageFile():
    global current_image, image_thumbnail, image_preview
    imageFilepath = fd.askopenfilename(
        title="Open an image file",
        initialdir="/",
        filetypes=(
            ("PNG files", "*.png"),
            ("JPG files", "*.jpg"),
            ("jpeg files", "*.jpeg"),
            ("BMP files", "*.bmp"),
            ("SVG files", "*.svg"),
            ("all files", "*.*"),
        ),
    )
    showinfo(title="Selected file: ", message=imageFilepath)
    if imageFilepath:
        try:
            print("Opening image file")
            current_image = PIL.Image.open(imageFilepath, "r")
            image_thumbnail = current_image.copy()
            image_thumbnail.thumbnail((300, 100))

            imageCanvas_width = imageCanvas.winfo_width()
            imageCanvas_height = imageCanvas.winfo_height()
            imageCanvas_x_center = imageCanvas_width // 2
            imageCanvas_y_center = imageCanvas_height // 2

            image_preview = PIL.ImageTk.PhotoImage(image_thumbnail)
            imageCanvas.delete("all")
            imageCanvas.create_image(
                imageCanvas_x_center,
                imageCanvas_y_center,
                anchor="center",
                image=image_preview,
            )
        except Exception as e:
            print(f"Woops, something went wrong: {e}")


def _image_to_bytes(im):
    """Convert a PIL image to the ESC/POS raster byte sequence for the CTP500."""
    if im.width > printerWidth:
        height = int(im.height * (printerWidth / im.width))
        im = im.resize((printerWidth, height))

    if im.width < printerWidth:
        padded = PIL.Image.new("1", (printerWidth, im.height), 1)
        padded.paste(im)
        im = padded

    if im.mode != "1":
        im = im.convert("1")

    if im.size[0] % 8:
        im2 = PIL.Image.new("1", (im.size[0] + 8 - im.size[0] % 8, im.size[1]), "white")
        im2.paste(im, (0, 0))
        im = im2

    im = PIL.ImageOps.invert(im.convert("L"))
    im = im.convert("1")

    return b"".join((
        bytearray(b"\x1d\x76\x30\x00"),
        struct.pack("2B", int(im.size[0] / 8 % 256), int(im.size[0] / 8 / 256)),
        struct.pack("2B", int(im.size[1] % 256), int(im.size[1] / 256)),
        im.tobytes(),
    ))


def trimImage(im):
    bg = PIL.Image.new(im.mode, im.size, (255, 255, 255))
    diff = PIL.ImageChops.difference(im, bg)
    diff = PIL.ImageChops.add(diff, diff, 2.0)
    bbox = diff.getbbox()
    if bbox:
        return im.crop((bbox[0], bbox[1], bbox[2], bbox[3] + 10))


# GUI SETUP
root = tk.Tk()
frame = Frame(root)
frame.pack()

root.title("CTP500 Printer Control")
root.configure()
root.minsize(520, 820)
root.geometry("520x820")

# BLUETOOTH TOOLS SECTION
bluetoothFrame = Frame(root, borderwidth=1, padx=5, pady=5)
Label(bluetoothFrame, text="Bluetooth tools").pack(fill="x")

btnRow = Frame(bluetoothFrame)
btnRow.pack()

connect_btn = tk.Button(
    btnRow, text="Scan & Connect",
    command=lambda: printer.scan_and_connect(),
    padx=15, pady=15,
)
connect_btn.pack(side="left", expand=1)  # Visible by default

disconnect_btn = tk.Button(
    btnRow, text="Disconnect",
    command=lambda: printer.disconnect(),
    padx=15, pady=15,
)
# disconnect_btn is hidden until connected; shown by update_status()

status_label = Label(bluetoothFrame, text="● Disconnected", fg="#cc0000", font=("", 11))
status_label.pack(pady=(4, 0))

battery_label = Label(bluetoothFrame, text="", font=("", 10))
battery_label.pack()

bluetoothFrame.pack()

# TEXT TOOLS SECTION
textFrame = Frame(root)
radioButtonsFrame = Frame(textFrame)

justification_options = ["left", "center", "right"]
radioJustification_status = tk.IntVar()

Label(textFrame, text="Text tools").pack(fill="x")

for index in range(len(justification_options)):
    Radiobutton(
        radioButtonsFrame,
        text=justification_options[index],
        variable=radioJustification_status,
        value=index,
        padx=5,
    ).pack(side="left", expand=True)

radioButtonsFrame.pack(fill="x", pady=(0, 5))

textInputField = scrolledtext.ScrolledText(textFrame, height=5, width=40)
textInputField.pack(fill="both")

Button(textFrame, text="Select a text file", padx=10, pady=15, command=selectTextFile).pack(expand=1, fill="x")
textFrame.pack(fill="both")

Button(textFrame, text="Print your text!", padx=10, pady=15, command=print_from_entry).pack(fill="x", pady=(5, 0))

# IMAGE TOOLS SECTION
imageFrame = Frame(root)
Label(imageFrame, text="Image tools").pack(fill="x", pady=(0, 5))

imageCanvas = tk.Canvas(imageFrame, width=300, height=100, bg="white")
imageCanvas.pack(pady=(0, 5))

Frame(imageFrame).pack(fill="both")

Button(imageFrame, text="Select an image file", padx=10, pady=15, command=selectImageFile).pack(fill="x")

Button(imageFrame, text="Print your image!", padx=10, pady=15, command=print_from_image).pack(fill="x", pady=(5, 0))

imageFrame.pack(fill="both", expand=True, padx=10, pady=5)

# LOGGER SECTION
logFrame = Frame(root, padx=5, pady=5)
Label(logFrame, text="Activity log").pack(fill="x")
log_widget = scrolledtext.ScrolledText(
    logFrame, height=7, width=40, state="disabled",
    bg="#1e1e1e", fg="#d4d4d4", font=("Courier", 10)
)
log_widget.pack(fill="both", expand=True)
logFrame.pack(fill="both", padx=10, pady=(0, 5))


def on_closing():
    # Wait for the BLE disconnect to complete before destroying the window
    # so the printer doesn't get left in a stale-connected state.
    future = _run_ble(printer._disconnect())
    try:
        future.result(timeout=3)
    except Exception:
        pass
    root.destroy()


root.protocol("WM_DELETE_WINDOW", on_closing)
root.mainloop()
