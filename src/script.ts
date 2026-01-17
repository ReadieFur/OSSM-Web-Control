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
import type {
    BeforeInstallPromptEvent
} from "./pwa.js"

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

const __elements = {
    mainContent: HTMLDivElement,

    //#region Pair Screen
    pairScreen: HTMLElement,
    pairDeviceButton: HTMLButtonElement,
    installPwaButton: HTMLButtonElement,
    //#endregion
    
    //#region Control Screen
    controlScreen: HTMLElement,
    //#endregion
} as const satisfies Record<string, typeof HTMLElement>;
type Elements = {
    [K in keyof typeof __elements]: InstanceType<typeof __elements[K]>;
};
const initializeComponent = () => {
    const elements = {} as any;
    for (const key in __elements) {
        const k = key as keyof typeof __elements; 

        const kebabCaseId = k.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
        const element = document.getElementById(kebabCaseId);
        if (!element)
            throw new Error(`Missing required element: ${kebabCaseId}`);

        const ExpectedConstructor = __elements[k];
        if (!(element instanceof ExpectedConstructor)) {
            // Some components may extend HTMLElement directly, in this case check known type names and pass if they match.
            const genericTags: string[] = [
                "section",
                "article",
                "nav",
                "main",
                "aside",
            ];
            if (ExpectedConstructor !== HTMLElement || !genericTags.includes(element.tagName.toLowerCase()))
                throw new Error(`Element ${k} is not of expected type ${ExpectedConstructor.name}`);
        }

        elements[k] = element;
    }
    return elements as Elements;
};

// TODO: Add UI support for connecting multiple devices.
class OssmWebControl {
    static instance?: OssmWebControl;

    public static async initialize(): Promise<void> {
        if (OssmWebControl.instance)
            return;
        OssmWebControl.instance = new OssmWebControl();
    }

    readonly elements: Elements;
    readonly infoContainers: Map<string, HTMLElement> = new Map();
    ossmBle?: OssmBle;

    private constructor() {
        const startupAnimation = () => {
            // Page load animation
            new Promise(resolve => setTimeout(resolve, 250)).then(() =>
            {
                this.elements.mainContent.style.opacity = "unset";
                StylesScript.transitionFade({
                    element: this.elements.mainContent,
                    direction: TransitionDirection.In,
                    durationMs: 650
                });
            });
        };

        try {
            this.elements = initializeComponent();
        } catch (error) {
            this.elements = {
                // Try at the very least to get the main container, if this fails then something is seriously wrong.
                mainContent: document.getElementById("main-content") as HTMLDivElement,
            } as Partial<Elements> as Elements;
            console.error("Error initializing components:", error);
            const errorContainer = StylesScript.createInfoContainer({
                state: InfoContainerState.Error,
                title: "Initialization Error",
                message: "An error occurred while initializing the application",
            });
            this.elements.mainContent.appendChild(errorContainer);
            startupAnimation();
            return;
        }

        if (isDevMode && new URLSearchParams(window.location.search).has("control-screen")) {
            this.elements.mainContent.style.opacity = "unset";
            // Disable connection functionality and show control screen directly (for development of the UI)
            this.elements.pairScreen.classList.add("hidden");
            this.elements.controlScreen.classList.remove("hidden");
            this.elements.mainContent.classList.add("fill-page");
            return;
        }

        if (!OssmBle.isClientSupported()) {
            console.error("Browser does not support required Bluetooth features");

            const buildError = (userAgent?: string) => {
                const secureContextContent = `<p><small>This application requires a secure context (HTTPS)</small></p>`;
                const contentChrome = `<p><small>Please use a compatible browser such as Chrome</small></p>`;
                const contentIOS = `<p><small>iOS devices must use the Bluefy browser <a href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener noreferrer">(App Store)</a></small></p>`;

                let content = "";

                if (!window.isSecureContext) {
                    // Also true when served from localhost or flag #unsafely-treat-insecure-origin-as-secure is set for this site
                    content += secureContextContent;
                }

                switch (userAgent) {
                    case "Windows":
                    case "Linux":
                    case "Macintosh":
                    case "Android":
                        content += contentChrome;
                        break;
                    case "iOS":
                        content += contentIOS;
                        break;
                    default:
                        content += contentChrome;
                        content += contentIOS;
                        break;
                }

                const errorContainer = StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Unsupported Browser",
                    message: "Your browser does not support the required Bluetooth features",
                    // TODO: Change this message to detect client for specifics
                    extraContent: content
                });

                this.elements.pairScreen.appendChild(errorContainer);
                startupAnimation();
            };

            if (navigator.userAgentData)
                navigator.userAgentData.getHighEntropyValues(["platform"]).then(ua => buildError(ua.platform));
            else
                buildError();

            return;
        }

        this.elements.pairDeviceButton.addEventListener("click", this.onConnectButtonClicked.bind(this));
        this.elements.pairDeviceButton.classList.remove("hidden");

        window.addEventListener("beforeinstallprompt", async (e) => {
            const event = e as BeforeInstallPromptEvent;
            event.preventDefault();

            this.elements.installPwaButton.addEventListener("click", async () => {
                const result = await event.prompt();
                if (result.outcome === "accepted") {
                    await StylesScript.transitionFade({
                        element: this.elements.installPwaButton,
                        direction: TransitionDirection.Out,
                        durationMs: 300
                    });
                    this.elements.installPwaButton.classList.add("hidden");
                }
            }, { once: true });

            if (this.elements.installPwaButton.classList.contains("hidden")) {
                this.elements.installPwaButton.classList.remove("hidden");
                this.elements.pairScreen.offsetHeight; // Force reflow to ensure transition works
                StylesScript.transitionFade({
                    element: this.elements.installPwaButton,
                    direction: TransitionDirection.In,
                    durationMs: 300
                });
            }
        });

        startupAnimation();
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
        
        this.elements.pairDeviceButton.disabled = true;
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
                    this.elements.pairScreen
                );
            }

            this.elements.pairDeviceButton.disabled = false;
            return;
        }
        //#endregion

        //#region Initialization
        this.ossmBle.debug = isDevMode;

        this.elements.pairDeviceButton.classList.add("hidden");

        this.setInfoContainer(
            pairingInfoContainerKey,
            StylesScript.createInfoContainer({
                message: "Initializing..."
            }),
            this.elements.pairScreen
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
                this.elements.pairScreen
            );

            this.elements.pairDeviceButton.disabled = false;
            this.elements.pairDeviceButton.classList.remove("hidden");
            return;
        }

        // this.setInfoContainer(
        //     pairingInfoContainerKey,
        //     StylesScript.createInfoContainer({
        //         state: InfoContainerState.Success,
        //         title: "Connected",
        //         message: "Loading control interface...",
        //     }),
        //     this.pairScreenElement
        // );

        this.ossmBle.addEventListener(OssmEventType.Connected, this.onConnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.Disconnected, this.onDisconnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.StateChanged, this.onStateChanged.bind(this));
        //#endregion

        //#region Setup control screen
        //#endregion

        //#region Switch screens
        // await new Promise(resolve => setTimeout(resolve, 500));
        await StylesScript.transitionFade({
            element: this.elements.mainContent,
            direction: TransitionDirection.Out,
            durationMs: 500
        });
        this.elements.pairScreen.classList.add("hidden");
        this.elements.controlScreen.classList.remove("hidden");
        this.elements.mainContent.classList.add("fill-page");
        await StylesScript.transitionFade({
            element: this.elements.mainContent,
            direction: TransitionDirection.In,
            durationMs: 500
        });

        this.deleteInfoContainer(pairingInfoContainerKey);
        this.elements.pairDeviceButton.disabled = false;
        this.elements.pairDeviceButton.classList.remove("hidden");
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
