# OSSM Web Control
This is a web application that allows you to control your OSSM (Open Source Sex Machine) device over Bluetooth from your browser!  
It is accessible at [ossm-web.forestpuppy.pet](https://ossm-web.forestpuppy.pet/) and can be installed to your device from there for offline use! *(If your device supports it)*  

> [!WARNING]
> As per official OSSM notices, **use BLE controls at your own risk**.  
> The author is not liable for any personal injury, hardware damage, or malfunction that may occur. You choose to use this application entirely of your own accord.

> [Overview](#ossm-web-control) • [Previews](#preview) • [Features](#compatibility--features) • [Contributing](#contributing) • [Developer Quickstart](#developer-quickstart)  

<hr>
<a id="preview"></a>
<table align="center">
    <tr>
        <td align="center">
            <b>Speed & Range Control</b><br>
            <img src="docs/Live00000409_V1-0001.gif" width="400" alt="Desktop Speed & Range Control">
        </td>
        <td align="center">
            <b>Portrait UI</b><br>
            <img src="docs/iPhone_Portrait.gif" width="220" alt="Mobile Portrait UI">
        </td>
    </tr>
    <tr>
        <td align="center">
            <b>Pattern Support</b><br>
            <img src="docs/Live00001607_V1-0002.gif" width="400" alt="Desktop Pattern Control">
        </td>
        <td align="center">
            <b>Landscape UI</b><br>
            <img src="docs/iPhone_Landscape.gif" width="400" alt="Mobile Landscape UI">
        </td>
    </tr>
</table>

## Compatibility & Features  
A quick overview on what this application supports and what is to come!  

> **Legend:** ☑️ Working | ⬜ Planned | ➖ Broken / In Progress

- **Supported platforms:** Any BLE capable browser!  
  - [x] **Desktop:** Any Chromium-based browser (Chrome, Edge, Brave)
  - [x] **Android:** Google Chrome
  - [x] **iPhone:** [Bluefy Browser](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055)
- **Control Features:**
  - [x] Speed and range adjustments
  - [x] Custom patterns & sensation
  - [ ] Absolute positioning
- **Safety & Reliability:**
  - [x] **Emergency stop:** Immediately halts all movement
  - [x] **Recalibration:** Allows re-homing of the rail
  - [x] Automatic state handling
- **Extras:**
  - [x] **Offline mode:** Installable as an app (PWA) on supported devices
  - [ ] Remote session sharing
  - [ ] External app syncing *(e.g., VRChat integration)*

## Contributing

Contributions are welcomed and encouraged! If you run into any issues, have feedback, or want to suggest improvements, feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/ReadieFur/OSSM-Web-Control/).

> [!TIP]
> **Reporting Connection Issues:**  
> If you encounter bugs specifically related to Bluetooth/BLE connectivity, please report them on the [OSSM-BLE-Web repository](https://github.com/ReadieFur/OSSM-BLE-Web).

Finding and fixing bugs helps make the application safer and more reliable for everyone!

## Developer Quickstart  

> [!NOTE]
> **Architecture Overview:**  
> - **Architecture:** Single Page Application (SPA) with routing/state managed via `ViewManager`.
> - **Hardware Abstraction:** Devices implement the `OssmProvider` abstract class, which the UI interacts with to read/set state.
> - **BLE Core:** Low-level Bluetooth logic resides in the `OSSM-BLE-Web` submodule.

```sh
# Clone the repository along with all submodules
git clone --recurse-submodules https://github.com/ReadieFur/OSSM-Web-Control.git
cd OSSM-Web-Control

# Install dependencies and start local dev server
npm install
npm run dev -- --open
```
