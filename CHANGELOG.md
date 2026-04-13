# Changelog

## 26.04.01 - 2026-04-13

### Added
-   **Svelte Web App Port:** Initial release of the CTP500 Web App, replacing the legacy Python desktop application.
    -   Full Web Bluetooth API integration for printer control.
    -   Text and image printing with in-browser processing.
    -   Real-time connection status and battery level display.
    -   Activity log for debugging and user feedback.
    -   Responsive dark-mode UI.
-   **HTTPS for Development:** Configured Vite dev server to use HTTPS for Web Bluetooth compatibility.

### Changed
-   Moved legacy Python application to `legacy/python` branch.
-   `main` branch now hosts the Svelte web application.

### Fixed
-   Improved Web Bluetooth availability checks and error handling for better user experience across compatible browsers.
