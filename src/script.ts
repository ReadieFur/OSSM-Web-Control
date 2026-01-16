import {
    OssmBle,
    OssmEventType,
    type OssmEventCallbackParameters,
} from "./ossm-ble/ossmBle.js";
import {
    StylesScript,
    InfoContainerState,
    TransitionDirection,
} from "./styles.js";

const isDevMode = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || new URLSearchParams(window.location.search).has("dev");
console.log("Dev Mode:", isDevMode);

enum DOMExceptionError {
    InvalidState = "InvalidStateError",
    NetworkError = "NetworkError",
    Timeout = "TimeoutError",
    TypeError = "TypeError",
    OperationError = "OperationError",
    DataError = "DataError",
    AbortError = "AbortError",
    NotFoundError = "NotFoundError",
}

// TODO: Add UI support for connecting multiple devices.
class OssmWebControl {
    static instance?: OssmWebControl;

    public static async initialize(): Promise<void> {
        if (OssmWebControl.instance)
            return;
        OssmWebControl.instance = new OssmWebControl();
    }

    readonly mainContentElement = document.getElementById("main-content") as HTMLDivElement;
    readonly pairScreenElement = document.getElementById("pair-screen") as HTMLDivElement;
    readonly pairDeviceButton = document.getElementById("pair-device-button") as HTMLButtonElement;
    readonly controlScreenElement = document.getElementById("control-screen") as HTMLDivElement;
    readonly infoContainers: Map<string, HTMLElement> = new Map();
    ossmBle?: OssmBle;

    private constructor() {
        if (isDevMode && new URLSearchParams(window.location.search).has("control-screen")) {
            // Disable connection functionality and show control screen directly (for development of the UI)
            this.pairScreenElement.classList.add("hidden");
            this.controlScreenElement.classList.remove("hidden");
            this.mainContentElement.classList.add("fill-page");
            return;
        }

        if (!OssmBle.isClientSupported()) {
            const errorContainer = StylesScript.createInfoContainer({
                state: InfoContainerState.Error,
                title: "Unsupported Browser",
                message: "Your browser does not support the required Bluetooth features",
                extraContent: `
                    <p><small>Please use a compatible browser such as Chrome</small></p>
                    <p><small>iOS devices must use the Bluefy browser <a href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener noreferrer">(App Store)</a></small></p>
                `
            });
            this.pairScreenElement.appendChild(errorContainer);
            return;
        }

        this.pairDeviceButton.classList.remove("hidden");
        this.pairDeviceButton.addEventListener("click", this.onConnectButtonClicked.bind(this));
    }

    private deleteInfoContainer(key: string): void {
        const container = this.infoContainers.get(key);
        if (container) {
            container.remove();
            this.infoContainers.delete(key);
        }
    }

    private setInfoContainer(key: string, container: HTMLElement, parent: HTMLElement): void {
        this.deleteInfoContainer(key);
        this.infoContainers.set(key, container);
        parent.appendChild(container);
    }

    private async onConnectButtonClicked(): Promise<void> {
        //#region Pre-run
        // Remove any old connection related info containers
        const pairingInfoContainerKey = "pairing-info";
        this.deleteInfoContainer(pairingInfoContainerKey);

        this.ossmBle?.[Symbol.dispose]();
        
        this.pairDeviceButton.disabled = true;
        //#endregion

        //#region Pairing
        try {
            this.ossmBle = await OssmBle.pairDevice();
        } catch (error) {
            const allowedErrors: string[] = [
                DOMExceptionError.NotFoundError, //Occurs when user cancels the pairing prompt
            ]
            if (error instanceof DOMException && !allowedErrors.includes(error.name)) {
                console.error("Error during device pairing:", error);
                this.setInfoContainer(
                    pairingInfoContainerKey,
                    StylesScript.createInfoContainer({
                        state: InfoContainerState.Error,
                        title: "Connection Error",
                        message: `Failed to connect to device`,
                    }),
                    this.pairScreenElement
                );
            }

            this.pairDeviceButton.disabled = false;
            return;
        }
        //#endregion

        //#region Initialization
        this.ossmBle.debug = isDevMode;

        this.pairDeviceButton.classList.add("hidden");

        this.setInfoContainer(
            pairingInfoContainerKey,
            StylesScript.createInfoContainer({
                message: "Initializing device..."
            }),
            this.pairScreenElement
        );

        try {
            await this.ossmBle.begin();
            await this.ossmBle.waitForReady(5_000);
        } catch (error) {
            console.error("Error waiting for device to become ready:", error);

            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Connection Error",
                    message: `Device initialization failed`,
                }),
                this.pairScreenElement
            );

            this.pairDeviceButton.disabled = false;
            this.pairDeviceButton.classList.remove("hidden");
            return;
        }

        this.setInfoContainer(
            pairingInfoContainerKey,
            StylesScript.createInfoContainer({
                state: InfoContainerState.Success,
                title: "Connected",
                message: "Loading control interface...",
            }),
            this.pairScreenElement
        );

        this.ossmBle.addEventListener(OssmEventType.Connected, this.onConnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.Disconnected, this.onDisconnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.StateChanged, this.onStateChanged.bind(this));
        //#endregion

        //#region Setup control screen
        //#endregion

        //#region Switch screens
        await StylesScript.transitionFade({
            element: this.mainContentElement,
            direction: TransitionDirection.Out,
            durationMs: 500,
        });
        this.pairScreenElement.classList.add("hidden");
        this.controlScreenElement.classList.remove("hidden");
        await StylesScript.transitionFade({
            element: this.mainContentElement,
            direction: TransitionDirection.In,
            durationMs: 500,
            addedClasses: ["fill-page"],
        });

        this.deleteInfoContainer(pairingInfoContainerKey);
        this.pairDeviceButton.disabled = false;
        this.pairDeviceButton.classList.remove("hidden");
        //#endregion
    }

    private async onConnected(data: OssmEventCallbackParameters): Promise<void> {
    }

    private async onDisconnected(data: OssmEventCallbackParameters): Promise<void> {
    }

    private async onStateChanged(data: OssmEventCallbackParameters): Promise<void> {
    }
}

document.addEventListener("DOMContentLoaded", async () => await OssmWebControl.initialize());
