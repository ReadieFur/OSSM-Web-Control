import { OssmBle } from "./ossm-ble/ossmBle.js";
import { StylesScript } from "./styles.js";

class OssmWebControl {
    static instance?: OssmWebControl;

    public static async initialize(): Promise<void> {
        if (OssmWebControl.instance)
            return;
        OssmWebControl.instance = new OssmWebControl();
    }

    readonly isDevMode = window.location.hostname === "localhost"
        || window.location.hostname === "127.0.0.1"
        || new URLSearchParams(window.location.search).has("dev");
    readonly mainContentElement = document.getElementById("main-content") as HTMLDivElement;
    readonly pairScreenElement = document.getElementById("pair-screen") as HTMLDivElement;
    readonly pairDeviceButton = document.getElementById("pair-device-button") as HTMLButtonElement;
    readonly controlScreenElement = document.getElementById("control-screen") as HTMLDivElement;
    ossmBle?: OssmBle;

    private constructor() {
        this.pairDeviceButton.addEventListener("click", this.onConnectButtonClicked.bind(this));
    }

    private async onConnectButtonClicked(): Promise<void> {
        this.pairDeviceButton.disabled = true;

        try {
            this.ossmBle = await OssmBle.pairDevice();
            this.ossmBle.debug = this.isDevMode;
        } catch (error) {
            console.error("Error during device pairing:", error);
        }

        this.pairDeviceButton.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", async () => await OssmWebControl.initialize());
