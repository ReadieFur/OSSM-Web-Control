import {
    OssmBle,
    OssmEventType,
    type OssmEventCallbackParameters,
} from "./ossm-ble/ossmBle.js";
import {
    StylesScript,
    InfoContainerState,
    TransitionDirection,
    InputRangeDouble,
} from "./styles.js";
import type {
    BeforeInstallPromptEvent
} from "./pwa.js"

const isDevMode = window.location.hostname === "localhost" || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname);
if (isDevMode) console.log("Dev mode:", isDevMode);

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
    relativeRangeSlider: HTMLDivElement,
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

class Helpers {
    static isMobileUI(): boolean {
        return window.getComputedStyle(document.documentElement).getPropertyValue("--is-mobile-ui") === "true";
    }

    static isPortrait(): boolean {
        return window.getComputedStyle(document.documentElement).getPropertyValue("--is-portrait") === "true";
    }

    static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class DualSliderComponent {
    static createFromExisting(container: HTMLElement): DualSliderComponent {
        const numberInputs = container.querySelectorAll("input[type='number']");
        if (numberInputs.length < 2)
            throw new Error("SliderComponent: Could not find required number input elements");

        const rangeContainer = container.querySelector(".input-container-range-double");
        if (!rangeContainer || !(rangeContainer instanceof HTMLElement))
            throw new Error("SliderComponent: Could not find required range input container element");

        return new DualSliderComponent(
            numberInputs[0] as HTMLInputElement,
            numberInputs[1] as HTMLInputElement,
            rangeContainer,
            InputRangeDouble.getOrCreateInstance(rangeContainer)
        );
    }

    private readonly externalCallbacks: Map<string, Array<(sender: any) => void>> = new Map();

    private constructor(
        private readonly numberInputA: HTMLInputElement,
        private readonly numberInputB: HTMLInputElement,
        private readonly rangeContainer: HTMLElement,
        private readonly rangeInput: InputRangeDouble,
    ){
        window.addEventListener("resize", this.onWindowResize.bind(this));

        rangeInput.addEventListener("input", (sender) => {
            this.refreshNumberInputs();
            this.dispatchEvent("input", sender);
        });

        rangeInput.addEventListener("change", (sender) => {
            // No need to refresh numbers as this will have been done when the input event fires which always comes first.
            this.dispatchEvent("change", sender);
        });

        numberInputA.addEventListener("change", () => {
            let from: number | undefined = undefined;
            let to: number | undefined = undefined;

            if (Helpers.isPortrait())
                to = parseFloat(numberInputA.value);
            else
                from = parseFloat(numberInputA.value);

            this.rangeInput.setValues({ from, to });

            // No need to dispatch event here as the rangeInput will do that when its value changes.
        });

        numberInputB.addEventListener("change", () => {
            let from: number | undefined = undefined;
            let to: number | undefined = undefined;

            if (Helpers.isPortrait())
                from = parseFloat(numberInputB.value);
            else
                to = parseFloat(numberInputB.value);

            this.rangeInput.setValues({ from, to });
        });

        this.refreshNumberInputs();
        this.onWindowResize();
    }

    private dispatchEvent(event: "input" | "change", sender?: any): void {
        const callbacks = this.externalCallbacks.get(event);
        if (!callbacks)
            return;
        for (const callback of callbacks)
            callback(sender);
    }

    private onWindowResize(): void {
        const wasPortrait = this.rangeContainer.getAttribute("orientation") === "vertical";
        const isPortrait = Helpers.isPortrait();

        if (wasPortrait === isPortrait)
            return;

        if (isPortrait)
            this.rangeContainer.setAttribute("orientation", "vertical");
        else
            this.rangeContainer.removeAttribute("orientation");

        this.refreshNumberInputs();
    }

    private refreshNumberInputs(): void {
        let minInput: HTMLInputElement, maxInput: HTMLInputElement;
        if (Helpers.isPortrait()) {
            minInput = this.numberInputB;
            maxInput = this.numberInputA;
        } else {
            minInput = this.numberInputA;
            maxInput = this.numberInputB;
        }

        const minMax = this.rangeInput.getMinMax();
        minInput.min = minMax.min.toString();
        minInput.max = minMax.max.toString();
        maxInput.min = minMax.min.toString();
        maxInput.max = minMax.max.toString();

        const values = this.rangeInput.getValues();
        minInput.value = values.from.toString();
        maxInput.value = values.to.toString();
    }

    getValues() {
        return this.rangeInput.getValues();
    }

    setValues(data: { from?: number, to?: number }): void {
        // InputRangeDouble already contains the logic for validating min/max values, if that fails then the inputs won't be updated.
        this.rangeInput.setValues(data);
        this.refreshNumberInputs();
    }

    getMinMax(): { min: number; max: number } {
        return this.rangeInput.getMinMax();
    }

    setMinMax(data: { min?: number, max?: number }): void {
        this.rangeInput.setMinMax(data);
        const { min, max } = this.rangeInput.getMinMax();
        this.numberInputA.min = min.toString();
        this.numberInputA.max = max.toString();
        this.numberInputB.min = min.toString();
        this.numberInputB.max = max.toString();
    }

    addEventListener(event: "input" | "change", callback: () => PromiseLike<void> | void): void {
        this.rangeInput.addEventListener(event, callback);
    }

    removeEventListener(event: "input" | "change", callback: () => PromiseLike<void> | void): void {
        this.rangeInput.removeEventListener(event, callback);
    }
}

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
    readonly relativeRangeSlider!: DualSliderComponent;
    ossmBle?: OssmBle;

    private constructor() {
        const constructorInfoContainerKey = "constructor";

        const startupAnimation = async () => {
            // Page load animation
            await Helpers.delay(250);
            this.elements.mainContent.style.opacity = "unset";
            StylesScript.transitionFade({
                element: this.elements.mainContent,
                direction: TransitionDirection.In,
                durationMs: 650
            });
        };

        try {
            this.elements = initializeComponent();
            this.relativeRangeSlider = DualSliderComponent.createFromExisting(this.elements.relativeRangeSlider);
        } catch (error) {
            this.elements = {
                // Try at the very least to get the main container and splash, if this fails then something is seriously wrong.
                mainContent: document.getElementById("main-content") as HTMLDivElement,
                pairScreen: document.getElementById("pair-screen") as HTMLElement,
            } as Partial<Elements> as Elements;
            console.error("Error initializing components:", error);
            this.setInfoContainer(
                constructorInfoContainerKey,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Initialization Error",
                    message: "An error occurred while initializing the application",
                }),
                this.elements.pairScreen
            );
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

                console.log("User Agent Platform:", userAgent);

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

                this.setInfoContainer(
                    constructorInfoContainerKey,
                    StylesScript.createInfoContainer({
                        state: InfoContainerState.Error,
                        title: "Unsupported Browser",
                        message: "Your browser does not support the required Bluetooth features",
                        // TODO: Change this message to detect client for specifics
                        extraContent: content
                    }),
                    this.elements.pairScreen
                );
                startupAnimation();
            };

            if (navigator.userAgentData){
                // Modern method
                navigator.userAgentData.getHighEntropyValues(["platform"]).then(ua => buildError(ua.platform));
            }
            else if (navigator.userAgent) {
                // Legacy method
                const ua = navigator.userAgent;
                let platform: string | undefined = undefined;
                if (ua.indexOf("Windows") !== -1)
                    platform = "Windows";
                else if (ua.indexOf("Linux") !== -1)
                    platform = "Linux";
                else if (ua.indexOf("Macintosh") !== -1)
                    platform = "Macintosh";
                else if (ua.indexOf("Android") !== -1)
                    platform = "Android";
                else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1 || ua.indexOf("iPod") !== -1)
                    platform = "iOS";
                buildError(platform);
            }
            else {
                buildError();
            }

            return;
        }

        this.elements.pairDeviceButton.addEventListener("click", this.onConnectButtonClicked.bind(this));
        this.elements.pairDeviceButton.classList.remove("hidden");

        // PWA install prompt handling
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
        // await Helpers.delay(500);
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
