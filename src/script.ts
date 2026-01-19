import {
    KnownPattern,
    OssmBle,
    OssmEventType,
    OssmPage,
    OssmStatus,
    PatternHelper,
    type OssmEventCallbackParameters,
    type OssmPattern,
    type OssmState,
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

const isDevMode =
    window.location.hostname === "localhost" ||
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname) ||
    new URLSearchParams(window.location.search).has("dev");
if (isDevMode)
    console.log("Dev mode:", isDevMode);

const __elements = {
    mainContent: HTMLDivElement,

    //#region Pair Screen
    pairScreen: HTMLElement,
    pairDeviceButton: HTMLButtonElement,
    installPwaButton: HTMLButtonElement,
    //#endregion
    
    //#region Control Screen
    controlScreen: HTMLElement,

    stateIndicator: HTMLParagraphElement,
    // shareSessionButton: HTMLButtonElement,
    recalibrateButton: HTMLButtonElement,
    disconnectButton: HTMLButtonElement,
    stopButton: HTMLButtonElement,

    //#region Options and Controls
    optionsAndControls: HTMLDivElement,
    patternSelect: HTMLDivElement,
    descriptionText: HTMLParagraphElement,
    invertToggle: HTMLInputElement,
    // applyPatternButton: HTMLButtonElement,

    relativeRangeSlider: HTMLDivElement,
    relativeSpeedSlider: HTMLDivElement,
    intensitySlider: HTMLDivElement,
    //#endregion
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

type PatternInfo = {
    idx: number;
    name: string;
    description: string;
    hasIntensityControl: boolean;
    canInvert: boolean;
};

// I find that some of the descriptions for the built-in patterns aren't very explanatory, so I've re-written them here.
const KNOWN_PATTERNS = {
    [KnownPattern.SimpleStroke]: {
        name: "Simple Stroke",
        description: "Smooth acceleration and deceleration simulating a basic stroking motion.",
        hasIntensityControl: false,
        canInvert: false,
    },
    [KnownPattern.TeasingPounding]: {
        name: "Teasing Pounding",
        description: "The actuator moves steadily in one direction and quickly in the other.",
        hasIntensityControl: true,
        canInvert: true,
    },
    [KnownPattern.RoboStroke]: {
        name: "Robo Stroke",
        description: "A mechanical stroking motion with abrupt starts and stops.",
        hasIntensityControl: true,
        canInvert: false,
    },
    [KnownPattern.HalfNHalf]: {
        name: "Half'n'Half",
        description: "Full and half depth strokes alternating with each cycle.",
        hasIntensityControl: true,
        canInvert: true,
    },
    [KnownPattern.Deeper]: {
        name: "Deeper",
        description: "Gradually deepens the stroke over a set number of cycles.",
        hasIntensityControl: true,
        canInvert: false,
    },
    [KnownPattern.StopNGo]: {
        name: "Stop'n'Go",
        description: "Pauses briefly between strokes at random intervals.",
        hasIntensityControl: true,
        canInvert: false,
    }
} as const satisfies Record<number, Partial<PatternInfo>>;

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

class SingleSliderComponent {
    static createFromExisting(container: HTMLElement): SingleSliderComponent {
        const numberInputs = container.querySelectorAll("input[type='number']");
        if (numberInputs.length < 2)
            throw new Error("SliderComponent: Could not find required number input elements");
        const rangeInput = container.querySelector("input[type='range']");
        if (!rangeInput || !(rangeInput instanceof HTMLInputElement))
            throw new Error("SliderComponent: Could not find required range input element");
        return new SingleSliderComponent(
            numberInputs[0] as HTMLInputElement,
            numberInputs[1] as HTMLInputElement,
            rangeInput
        );
    }

    private readonly externalCallbacks: Map<string, Array<(sender: any) => void>> = new Map();

    private constructor(
        private readonly numberInputA: HTMLInputElement,
        private readonly numberInputB: HTMLInputElement,
        private readonly rangeInput: HTMLInputElement,
    ){
        window.addEventListener("resize", this.onWindowResize.bind(this));

        this.setMinMax({
            min: this.rangeInput.min ? parseFloat(this.rangeInput.min) : undefined,
            max: this.rangeInput.max ? parseFloat(this.rangeInput.max) : undefined,
        })
        this.setValue(this.rangeInput.valueAsNumber);

        rangeInput.addEventListener("input", (sender) => {
            this.numberInputA.value = this.rangeInput.value;
            this.numberInputB.value = this.rangeInput.value;
            this.dispatchEvent("input", sender);
        });
        rangeInput.addEventListener("change", (sender) => {
            this.numberInputA.value = this.rangeInput.value;
            this.numberInputB.value = this.rangeInput.value;
            this.dispatchEvent("change", sender);
        });
        numberInputA.addEventListener("change", () => {
            const value = parseFloat(this.numberInputA.value);
            this.rangeInput.valueAsNumber = value;
            this.numberInputB.value = value.toString();
            this.rangeInput.dispatchEvent(new Event("input"));
            this.rangeInput.dispatchEvent(new Event("change"));
        });
        numberInputB.addEventListener("change", () => {
            const value = parseFloat(this.numberInputB.value);
            this.rangeInput.valueAsNumber = value;
            this.numberInputA.value = value.toString();
            this.rangeInput.dispatchEvent(new Event("input"));
            this.rangeInput.dispatchEvent(new Event("change"));
        });

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
        const isPortrait = Helpers.isPortrait();

        if (isPortrait) {
            this.rangeInput.setAttribute("orientation", "vertical");
            this.numberInputA.classList.add("hidden");
            this.numberInputB.classList.remove("hidden");
        }
        else {
            this.rangeInput.removeAttribute("orientation");
            this.numberInputA.classList.remove("hidden");
            this.numberInputB.classList.add("hidden");
        }
    }

    private onNumberInput(value: number): void {
        this.rangeInput.valueAsNumber = value;
        this.numberInputA.value = value.toString();
        this.numberInputB.value = value.toString();
    }

    getValue(): number {
        return this.rangeInput.valueAsNumber;
    }

    setValue(value: number): void {
        const min = this.rangeInput.min ? parseFloat(this.rangeInput.min) : Number.NEGATIVE_INFINITY;
        const max = this.rangeInput.max ? parseFloat(this.rangeInput.max) : Number.POSITIVE_INFINITY;
        if (value < min || value > max)
            throw new Error("Value is out of range");
        
        this.rangeInput.valueAsNumber = value;
        this.numberInputA.value = value.toString();
        this.numberInputB.value = value.toString();

        this.dispatchEvent("input", this);
        this.dispatchEvent("change", this);
    }

    getMinMax(): { min: number; max: number } {
        const min = this.rangeInput.min ? parseFloat(this.rangeInput.min) : Number.NEGATIVE_INFINITY;
        const max = this.rangeInput.max ? parseFloat(this.rangeInput.max) : Number.POSITIVE_INFINITY;
        return { min, max };
    }

    setMinMax(data: { min?: number, max?: number }): void {
        this.rangeInput.min = data.min?.toString() ?? this.rangeInput.min;
        this.rangeInput.max = data.max?.toString() ?? this.rangeInput.max;
        const { min, max } = this.getMinMax();
        this.numberInputA.min = min.toString();
        this.numberInputA.max = max.toString();
        this.numberInputB.min = min.toString();
        this.numberInputB.max = max.toString();

        const value = this.getValue();
        if (value > max)
            this.setValue(max);
        else if (value < min)
            this.setValue(min);

        if (value != this.getValue()) {
            this.dispatchEvent("input", this);
            this.dispatchEvent("change", this);
        }
    }

    addEventListener(event: "input" | "change", callback: () => PromiseLike<void> | void): void {
        this.rangeInput.addEventListener(event, callback);
    }

    removeEventListener(event: "input" | "change", callback: () => PromiseLike<void> | void): void {
        this.rangeInput.removeEventListener(event, callback);
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
    private static instance?: OssmWebControl;

    public static async initialize(): Promise<void> {
        if (OssmWebControl.instance)
            return;
        OssmWebControl.instance = new OssmWebControl();
    }

    private readonly elements: Elements;
    private readonly infoContainers: Map<string, HTMLElement> = new Map();
    private readonly relativeRangeSlider!: DualSliderComponent;
    private readonly relativeSpeedSlider!: SingleSliderComponent;
    private readonly intensitySlider!: SingleSliderComponent;
    private readonly patternRadioButtons: Map<HTMLInputElement, PatternInfo> = new Map();
    private pwaInstallContext?: BeforeInstallPromptEvent;
    private ossmBle?: OssmBle;
    private isTransitioningPage: boolean = false;
    private isRecalibrating: boolean = false;

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
            this.relativeSpeedSlider = SingleSliderComponent.createFromExisting(this.elements.relativeSpeedSlider);
            this.intensitySlider = SingleSliderComponent.createFromExisting(this.elements.intensitySlider);
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

        this.elements.stopButton.addEventListener("click", this.onStopButtonClicked.bind(this));
        this.elements.disconnectButton.addEventListener("click", this.onDisconnectButtonClicked.bind(this));
        this.elements.recalibrateButton.addEventListener("click", this.onRecalibrateButtonClicked.bind(this));

        this.elements.pairDeviceButton.addEventListener("click", this.onConnectButtonClicked.bind(this));
        this.elements.pairDeviceButton.classList.remove("hidden");

        // PWA install prompt handling
        window.addEventListener("beforeinstallprompt", async (e) => {
            this.pwaInstallContext = e as BeforeInstallPromptEvent;
            this.pwaInstallContext.preventDefault();

            this.elements.installPwaButton.addEventListener("click", async () => {
                this.elements.installPwaButton.disabled = true;
                const result = await this.pwaInstallContext!.prompt();
                if (result.outcome === "accepted") {
                    await StylesScript.transitionFade({
                        element: this.elements.installPwaButton,
                        direction: TransitionDirection.Out,
                        durationMs: 300
                    });
                    this.elements.installPwaButton.classList.add("hidden");
                }
                this.pwaInstallContext = undefined;
                this.elements.installPwaButton.disabled = false;
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
        const pairingInfoContainerKey = "pairing-info";

        //#region Pre-run
        // Remove any old connection related info containers
        this.deleteInfoContainer(pairingInfoContainerKey);

        // Should already be disposed here, but extra cleanup just in case.
        this.ossmBle?.[Symbol.dispose]();
        this.ossmBle = undefined;
        
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
        this.elements.pairScreen.classList.add("scale-pulse");

        this.ossmBle.debug = isDevMode;
        if (isDevMode)
            console.log("OssmBle instance created:", this.ossmBle);

        this.ossmBle.addEventListener(OssmEventType.Connected, this.onConnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.Disconnected, this.onDisconnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.StateChanged, this.onStateChanged.bind(this));

        this.elements.pairDeviceButton.classList.add("hidden");
        this.elements.installPwaButton.classList.add("hidden");

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
            await this.ossmBle.setSpeedKnobConfig(false);
            if (isDevMode)
                console.log("Device is ready");
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
        //#endregion

        //#region Setup control screen
        if (isDevMode) {
            console.log("Fetching initial device state...");
            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    message: "Fetching device information..."
                }),
                this.elements.pairScreen
            );
        }

        // Wait until one state update has been received (see onStateChanged for UI refresh)
        let currentState: OssmState;
        try {
            currentState = await this.ossmBle.getState(5_000);
        } catch (error) {
            console.error("Error retrieving initial device state:", error);
            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Connection Error",
                    message: `Failed to retrieve device state`,
                }),
                this.elements.pairScreen
            );

            await this.ossmBle.end();
            this.ossmBle?.[Symbol.dispose]();
            this.ossmBle = undefined;
            this.restorePairScreenLayout();
            return;
        }

        /* Upon first startup of thee device the state of the depth/stroke can be invalid (as far as what I consider that to be)
         * See this thread: https://discord.com/channels/559409652425687041/1462645505287917730
         * For now manually set the device into a known valid state
         */
        if (currentState.depth - currentState.stroke < 0) {
            currentState.stroke = currentState.depth;
            try {
                await this.ossmBle.setStroke(currentState.stroke);
            } catch (error) {
                console.error("Error setting initial stroke value:", error);
                this.setInfoContainer(
                    pairingInfoContainerKey,
                    StylesScript.createInfoContainer({
                        state: InfoContainerState.Error,
                        title: "Connection Error",
                        message: `Failed to set initial device state`,
                    }),
                    this.elements.pairScreen
                );
            }
        }

        if (isDevMode) {
            console.log("Fetching pattern list...");
            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    message: "Loading patterns..."
                }),
                this.elements.pairScreen
            );
        }

        let patterns: OssmPattern[];
        try {
            patterns = await this.ossmBle.getPatternList();
        } catch (error) {
            console.error("Error retrieving pattern list:", error);
            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Connection Error",
                    message: `Failed to retrieve pattern list from device`,
                }),
                this.elements.pairScreen
            );

            await this.ossmBle.end();
            this.ossmBle?.[Symbol.dispose]();
            this.ossmBle = undefined;
            this.restorePairScreenLayout();
            return;
        }
        this.elements.patternSelect.innerHTML = "";
        for (const pattern of patterns) {
            const option = document.createElement("input");
            option.type = "radio";
            option.id = `pattern-idx-${pattern.idx}`;
            option.value = pattern.idx.toString();
            option.name = "pattern-select";
            option.addEventListener("change", this.onPatternSelected.bind(this));

            let patternInfo: PatternInfo = {
                idx: pattern.idx,
                name: pattern.name,
                description: pattern.description,
                hasIntensityControl: true,
                canInvert: false,
            };

            // Check if there is override information to use instead.
            for (const knownPatternInfo of Object.values(KNOWN_PATTERNS) as Partial<PatternInfo>[]) {
                if (pattern.name === undefined || pattern.name !== knownPatternInfo.name)
                    continue;
                patternInfo = {
                    idx: pattern.idx,
                    name: knownPatternInfo.name,
                    description: knownPatternInfo?.description ?? pattern.description,
                    hasIntensityControl: knownPatternInfo?.hasIntensityControl ?? patternInfo.hasIntensityControl,
                    canInvert: knownPatternInfo?.canInvert ?? patternInfo.canInvert,
                };
                break;
            }
            
            const label = document.createElement("label");
            label.htmlFor = option.id;
            label.textContent = patternInfo.name;

            this.elements.patternSelect.appendChild(option);
            this.elements.patternSelect.appendChild(label);

            this.patternRadioButtons.set(option, patternInfo);

            // Do first initial selection
            if (currentState.pattern === pattern.idx) {
                option.checked = true;

                // UI Description
                this.elements.descriptionText.textContent = patternInfo.description;

                // UI invert toggle
                // this.elements.invertToggle.checked = false; // Will be set by onStateChanged
                if (patternInfo.canInvert)
                    this.elements.invertToggle.classList.remove("hidden");
                else
                    this.elements.invertToggle.classList.add("hidden");

                // UI intensity slider
                if (patternInfo.hasIntensityControl)
                    this.elements.intensitySlider.classList.remove("hidden");
                else
                    this.elements.intensitySlider.classList.add("hidden");
            }
        }

        // Manually trigger an update of the UI
        try {
            this.updateControlsState(currentState);
        } catch (error) {
            console.error("Error updating control screen UI:", error);
            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Connection Error",
                    message: `Failed to read device state`,
                }),
                this.elements.pairScreen
            );
            await this.ossmBle.end();
            this.ossmBle?.[Symbol.dispose]();
            this.ossmBle = undefined;
            this.restorePairScreenLayout();
            return;
        }
        //#endregion

        //#region Switch screens
        if (isDevMode) {
            console.log("Setup complete");
            this.setInfoContainer(
                pairingInfoContainerKey,
                StylesScript.createInfoContainer({
                    // state: InfoContainerState.Success,
                    // message: "Setup complete!"
                    message: "Connection successful"
                }),
                this.elements.pairScreen
            );
        }

        await StylesScript.transitionFade({
            element: this.elements.mainContent,
            direction: TransitionDirection.Out,
            durationMs: 500
        });
        this.elements.pairScreen.classList.add("hidden");
        this.elements.mainContent.classList.add("fill-page");
        this.elements.controlScreen.classList.remove("hidden");
        await StylesScript.transitionFade({
            element: this.elements.mainContent,
            direction: TransitionDirection.In,
            durationMs: 500
        });

        this.deleteInfoContainer(pairingInfoContainerKey);
        this.elements.pairScreen.classList.remove("scale-pulse");
        // this.restorePairScreenLayout();
        //#endregion
    }

    private restorePairScreenLayout(): void {
        this.elements.pairScreen.classList.remove("scale-pulse");

        this.elements.pairDeviceButton.disabled = false;
        this.elements.pairDeviceButton.classList.remove("hidden");
        
        if (this.pwaInstallContext) {
            this.elements.installPwaButton.disabled = false;
            this.elements.installPwaButton.classList.remove("hidden");
        }
    }

    private async onStopButtonClicked(): Promise<void> {
        if (isDevMode)
            console.log("Emergency stop button clicked");
        await this.ossmBle?.stop();
    }

    private async onDisconnectButtonClicked(): Promise<void> {
        await this.ossmBle?.stop(); // Forcefully stop any movement
        this.ossmBle?.end();
        // See onDisconnected for UI handling
    }

    private async onRecalibrateButtonClicked(): Promise<void> {
        if (!this.ossmBle || this.isRecalibrating)
            return;
        this.isRecalibrating = true;

        // onStateChanged will handle the UI updates
        
        try {
            await this.ossmBle.navigateTo(OssmPage.Menu);
            await this.ossmBle.waitForStatus([
                OssmStatus.Idle,
                OssmStatus.Menu,
                OssmStatus.MenuIdle
            ], 1_000);
        } catch (error) {
            // TODO: Error
            this.isRecalibrating = false;
            throw error;
        }

        try {
            await this.ossmBle.navigateTo(OssmPage.StrokeEngine);
            // This can take a while...
            await this.ossmBle.waitForStatus([
                OssmStatus.StrokeEngine,
                OssmStatus.StrokeEngineIdle,
                OssmStatus.StrokeEnginePreflight,
                OssmStatus.StrokeEnginePattern
            ], 30_000);
        } catch (error) {
            // TODO: Error
            this.isRecalibrating = false;
            throw error;
        }

        // Additionally reset speed to 0 for safety
        try {
            await this.ossmBle.setSpeed(0);
        } catch (error) {
            // TODO: Error
            this.isRecalibrating = false;
            throw error;
        }

        this.isRecalibrating = false;

        if (isDevMode)
            console.log("Recalibration complete");
    }

    private async onPatternSelected(event: Event): Promise<void> {
        const target = event.target;
        if (!(target instanceof HTMLInputElement))
            return;

        const patternInfo = this.patternRadioButtons.get(target);
        if (!patternInfo)
            return;

        // Description
        this.elements.descriptionText.textContent = patternInfo.description;

        // Invert toggle
        if (!patternInfo.canInvert) {
            // Can't invert, hide toggle
            this.elements.invertToggle.classList.add("hidden");
        }
        else if (this.elements.invertToggle.classList.contains("hidden")) {
            // Was already hidden, reset toggle and show
            this.elements.invertToggle.checked = false;
            this.elements.invertToggle.classList.remove("hidden");
        } else {
            // Was already visible, --keep current state--
            this.elements.invertToggle.checked = false;
        }

        // Intensity slider
        if (patternInfo.hasIntensityControl)
            this.elements.intensitySlider.classList.remove("hidden");
        else
            this.elements.intensitySlider.classList.add("hidden");

        // TODO: Change pattern on device
    }

    private async onConnected(data: OssmEventCallbackParameters): Promise<void> {
        this.elements.stateIndicator.dataset.state = "ready";
        this.elements.optionsAndControls.classList.remove("scale-pulse");
    }

    private async onDisconnected(data: OssmEventCallbackParameters): Promise<void> {
        const willReconnect = this.ossmBle?.willAutoReconnect() ?? false;
        this.elements.stateIndicator.dataset.state = willReconnect ? "connecting" : "disconnected";

        if (willReconnect) {
            // Stay on control screen and wait for reconnection
            this.elements.optionsAndControls.classList.add("scale-pulse");
        } else {
            // Return to pair screen
            this.ossmBle?.removeEventListener(OssmEventType.Connected, this.onConnected.bind(this));
            this.ossmBle?.removeEventListener(OssmEventType.Disconnected, this.onDisconnected.bind(this));
            this.ossmBle?.removeEventListener(OssmEventType.StateChanged, this.onStateChanged.bind(this));

            this.ossmBle?.[Symbol.dispose]();
            this.ossmBle = undefined;
            if (isDevMode)
                console.log("OssmBle instance disposed");

            await StylesScript.transitionFade({
                element: this.elements.mainContent,
                direction: TransitionDirection.Out,
                durationMs: 500
            });
            this.restorePairScreenLayout();
            this.elements.controlScreen.classList.add("hidden");
            this.elements.mainContent.classList.remove("fill-page");
            this.elements.pairScreen.classList.remove("hidden");
            await StylesScript.transitionFade({
                element: this.elements.mainContent,
                direction: TransitionDirection.In,
                durationMs: 500
            });

            this.elements.optionsAndControls.classList.remove("scale-pulse");
        }
    }

    private async onStateChanged(data: OssmEventCallbackParameters): Promise<void> {
        if (!data[OssmEventType.StateChanged])
            return;

        if (data[OssmEventType.StateChanged].oldState?.status !== data[OssmEventType.StateChanged].newState.status) {
            if (isDevMode)
                console.log("Device status changed:", data[OssmEventType.StateChanged].newState.status);
    
            // Process new state change
            switch (data[OssmEventType.StateChanged].newState.status) {
                // Transition to stroke engine when in these states:
                case OssmStatus.Idle:
                case OssmStatus.Menu:
                case OssmStatus.MenuIdle:
                case OssmStatus.SimplePenetration:
                case OssmStatus.SimplePenetrationIdle:
                case OssmStatus.SimplePenetrationPreflight:
                    /* For now don't auto-transition, as the user with a physical remote may be controlling the device.
                     * We do however transition the state upon the initial connection in onConnectButtonClicked as there may not be a physical remote.
                     * If that is the case then the state shouldn't ever have any reason to change (unless we are recalibrating).
                     */
                    // await this.stateTransition();
                    await this.stateExternal();
                    break;
                // Wait for external event when in these states:
                case OssmStatus.Update:
                case OssmStatus.UpdateChecking:
                case OssmStatus.UpdateUpdating:
                case OssmStatus.UpdateIdle:
                case OssmStatus.Wifi:
                case OssmStatus.WifiIdle:
                case OssmStatus.Help:
                case OssmStatus.HelpIdle:
                    await this.stateExternal();
                    break;
                // Wait in these states:
                case OssmStatus.Homing:
                case OssmStatus.HomingForward:
                case OssmStatus.HomingBackward:
                    await this.stateHoming();
                    break;
                // Activate controls in these states:
                case OssmStatus.StrokeEngine:
                case OssmStatus.StrokeEngineIdle:
                case OssmStatus.StrokeEnginePreflight:
                case OssmStatus.StrokeEnginePattern:
                    await this.stateStrokeEngine();
                    break;
                // Signal catastrophic device error in these states:
                case OssmStatus.Error:
                case OssmStatus.ErrorIdle:
                case OssmStatus.ErrorHelp:
                case OssmStatus.Restart:
                    await this.stateDeviceError();
                    break;
                // Unknown state
                default:
                    await this.stateUnknown();
                    break;
            }
        }

        // Always send new state to controls
        this.updateControlsState(data[OssmEventType.StateChanged].newState);
    }

    private async stateTransition(): Promise<void> {
        if (!this.ossmBle || this.isTransitioningPage || await this.ossmBle.getCurrentPage() === OssmPage.StrokeEngine)
            return;
        this.isTransitioningPage = true;

        if (isDevMode)
            console.log("Transitioning to Stroke Engine page");
        
        await this.ossmBle.navigateTo(OssmPage.StrokeEngine);

        this.isTransitioningPage = false;
    }

    private async stateExternal(): Promise<void> {
        if (!this.ossmBle)
            return;

        // Ignore showing warning message here if we are in the middle of a scheduled process.
        if (this.isTransitioningPage || this.isRecalibrating)
            return;

        if (isDevMode)
            console.log("Waiting for external interaction");
    }

    private async stateHoming(): Promise<void> {
        if (isDevMode)
            console.log("Homing in progress...");

        this.elements.stateIndicator.dataset.state = "calibrating";
        this.elements.optionsAndControls.classList.add("scale-pulse");
        this.elements.recalibrateButton.disabled = true;
        this.elements.optionsAndControls.querySelectorAll("*").forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
                el.disabled = true;
            }
        });
    }

    private async stateStrokeEngine(): Promise<void> {
        if (isDevMode)
            console.log("Stroke Engine active");

        this.elements.stateIndicator.dataset.state = "ready";
        this.elements.optionsAndControls.classList.remove("scale-pulse");
        this.elements.recalibrateButton.disabled = false;
        this.elements.optionsAndControls.querySelectorAll("*").forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
                el.disabled = false;
            }
        });
    }

    private async stateDeviceError(): Promise<void> {
        if (isDevMode)
            console.log("Device is in error state");
    }

    private async stateUnknown(): Promise<void> {
        if (isDevMode)
            console.log("Device is in unknown state");
    }

    private updateControlsState(state: OssmState): void {
        // Find selected pattern info
        let pattern: PatternInfo | undefined = undefined;
        for (const [radioButton, patternInfo] of this.patternRadioButtons) {
            if (patternInfo.idx === state.pattern) {
                radioButton.checked = true;
                pattern = patternInfo;
                this.elements.descriptionText.textContent = patternInfo.description;
            }
        }
        if (!pattern) {
            console.error("Current pattern not found in pattern list:", state.pattern);
            // TODO: Error
            return;
        }

        let playState: PatternHelper;
        try {
            playState = PatternHelper.fromPlayData(state, pattern.hasIntensityControl, pattern.canInvert);
        } catch (error) {
            console.error("Error parsing play data from state:", error);
            // TODO: Error
            throw error;
        }

        // Update relative range
        this.relativeRangeSlider.setValues({
            from: playState.minDepth,
            to: playState.maxDepth
        });

        // Update relative speed
        this.relativeSpeedSlider.setValue(playState.speed);

        // Update intensity
        if (pattern.hasIntensityControl)
            this.intensitySlider.setValue(playState.intensity!);

        // Update invert button
        if (pattern.canInvert)
            this.elements.invertToggle.checked = playState.invert!;

        if (isDevMode)
            console.log("Controls updated successfully");
    }
}

document.addEventListener("DOMContentLoaded", async () => await OssmWebControl.initialize());
