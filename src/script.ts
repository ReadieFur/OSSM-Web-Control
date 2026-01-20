//#region Imports
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
    SliderWithNumber,
    DualSliderWithNumber,
} from "./styles.js";
import type {
    BeforeInstallPromptEvent
} from "./pwa.js"
//#endregion

//#region Utilities
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

    relativeRangeContainer: HTMLDivElement,
    relativeSpeedContainer: HTMLDivElement,
    relativeSpeedSlider: HTMLInputElement,
    intensityContainer: HTMLDivElement,
    intensitySlider: HTMLInputElement,
    //#endregion
    //#endregion
} as const satisfies Record<string, typeof HTMLElement>;

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
//#endregion

//#region Helpers
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

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const isDevMode =
    window.location.hostname === "localhost" ||
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname) ||
    new URLSearchParams(window.location.search).has("dev");

function debugLog(...args: any[]): void {
    if (isDevMode)
        console.log(...args);
}

debugLog("Dev mode:", isDevMode);
//#endregion

//#region Generators
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
//#endregion

// TODO: Add UI support for connecting multiple devices.
class OssmWebControl {
    //#region Static (singleton) members
    private static instance?: OssmWebControl;

    public static async initialize(): Promise<void> {
        if (OssmWebControl.instance)
            return;
        OssmWebControl.instance = new OssmWebControl();
    }
    //#endregion

    //#region General instance members
    private readonly elements: Elements;
    private readonly infoContainers: Map<string, HTMLElement> = new Map();
    private ossmBle?: OssmBle;

    private constructor() {
        const startupAnimation = async () => {
            // Page load animation
            await delay(250);
            this.elements.mainContent.style.opacity = "unset";
            StylesScript.transitionFade({
                element: this.elements.mainContent,
                direction: TransitionDirection.In,
                durationMs: 650
            });
        };

        try {
            this.elements = initializeComponent();
            this.relativeRangeControl = InputRangeDouble.getOrCreateInstance(
                this.elements.relativeRangeContainer.querySelector(".input-container-range-double") as HTMLDivElement);
            this.relativeRangeControl.setMinGap(1); // Ensure at least a gap of 1 between from and to
            DualSliderWithNumber.createFromExisting(this.elements.relativeRangeContainer);
            SliderWithNumber.createFromExisting(this.elements.relativeSpeedContainer);
            SliderWithNumber.createFromExisting(this.elements.intensityContainer);
        } catch (error) {
            this.elements = {
                // Try at the very least to get the main container and splash, if this fails then something is seriously wrong.
                mainContent: document.getElementById("main-content") as HTMLDivElement,
                pairScreen: document.getElementById("pair-screen") as HTMLElement,
            } as Partial<Elements> as Elements;
            console.error("Error initializing components:", error);
            this.setInfoContainer(
                this.infoKeyPairingScreen,
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
                    this.infoKeyPairingScreen,
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

        this.elements.stopButton.addEventListener("click", this.onStopButtonClicked.bind(this));
        this.elements.disconnectButton.addEventListener("click", this.onDisconnectButtonClicked.bind(this));
        this.elements.recalibrateButton.addEventListener("click", this.onRecalibrateButtonClicked.bind(this));

        this.relativeRangeControl.addEventListener("change", this.onRelativeRangeChanged.bind(this));
        this.elements.relativeSpeedSlider.addEventListener("change", this.onRelativeSpeedChanged.bind(this));
        this.elements.intensitySlider.addEventListener("change", this.onIntensityChanged.bind(this));

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
    //#endregion

    //#region Pairing screen
    private readonly infoKeyPairingScreen = "pairing-screen";
    private pwaInstallContext?: BeforeInstallPromptEvent;

    private async onConnectButtonClicked(): Promise<void> {
        //#region Pre-run
        // Remove any old connection related info containers
        this.deleteInfoContainer(this.infoKeyPairingScreen);

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
                    this.infoKeyPairingScreen,
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
        debugLog("OssmBle instance created:", this.ossmBle);

        this.elements.pairDeviceButton.classList.add("hidden");
        this.elements.installPwaButton.classList.add("hidden");

        this.setInfoContainer(
            this.infoKeyPairingScreen,
            StylesScript.createInfoContainer({
                message: "Initializing..."
            }),
            this.elements.pairScreen
        );

        try {
            await this.ossmBle.begin();
            await this.ossmBle.waitForReady(5_000);
            debugLog("Device is ready");
        } catch (error) {
            console.error("Error waiting for device to become ready:", error);

            this.setInfoContainer(
                this.infoKeyPairingScreen,
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

        //#region Initial device state
        if (isDevMode) {
            console.log("Fetching initial device state...");
            this.setInfoContainer(
                this.infoKeyPairingScreen,
                StylesScript.createInfoContainer({
                    message: "Fetching device information..."
                }),
                this.elements.pairScreen
            );
        }

        /* Upon first startup of the device the state of the depth/stroke can be invalid (as far as what I consider that to be)
         * See this thread: https://discord.com/channels/559409652425687041/1462645505287917730
         * For now manually set the device into a known valid state
         */
        // if (currentState.depth - currentState.stroke < 0) {
        //     try {
        //         await this.ossmBle.setStroke(currentState.depth);
        //         // await this.ossmBle.runStrokeEnginePattern(new PatternHelper(0, 0, 10, 0));
        //         currentState = await this.ossmBle.getState(1_000);
        //     } catch (error) {
        //         console.error("Error setting initial stroke value:", error);
        //         this.setInfoContainer(
        //             this.infoKeyPairingScreen,
        //             StylesScript.createInfoContainer({
        //                 state: InfoContainerState.Error,
        //                 title: "Connection Error",
        //                 message: `Failed to set initial device state`,
        //             }),
        //             this.elements.pairScreen
        //         );
        //     }
        // }
        // For now always set initial play settings
        try {
            await this.enterStableState();
        } catch (error) {
            console.error("Error setting initial play settings:", error);
            this.setInfoContainer(
                this.infoKeyPairingScreen,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Connection Error",
                    message: `Failed to set initial device state`,
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
                this.infoKeyPairingScreen,
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
        //#endregion

        //#region Setup control screen
        if (isDevMode) {
            console.log("Fetching pattern list...");
            this.setInfoContainer(
                this.infoKeyPairingScreen,
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
                this.infoKeyPairingScreen,
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
            option.autocomplete = "off";
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

            this.patternRadioButtons.set(pattern.idx, { element: option, pattern: patternInfo });

            // Do first initial selection
            if (currentState.pattern === pattern.idx)
                option.checked = true;
        }

        // Manually trigger an update of the UI
        this.ossmBle.addEventListener(OssmEventType.Connected, this.onConnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.Disconnected, this.onDisconnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.StateChanged, this.onStateChanged.bind(this));
        try {
            this.onConnected({ event: OssmEventType.Connected });
            this.onStateChanged({
                event: OssmEventType.StateChanged,
                [OssmEventType.StateChanged]: {
                    newState: currentState
                }
            });
        } catch (error) {
            console.error("Error updating control screen UI:", error);
            this.setInfoContainer(
                this.infoKeyPairingScreen,
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
                this.infoKeyPairingScreen,
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

        this.deleteInfoContainer(this.infoKeyPairingScreen);
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
    //#endregion

    //#region Control screen
    private lastOssmStatus?: OssmStatus;
    private readonly relativeRangeControl!: InputRangeDouble;
    private readonly patternRadioButtons: Map<number, { element: HTMLInputElement, pattern: PatternInfo }> = new Map();
    private readonly controlScreenSkipRepaintFor = {
        patterns: false,
        range: false,
        speed: false,
        intensity: false,
    };
    private isTransitioningPage = false;
    private isRecalibrating = false;
    private isEnteringStableState = false;

    //#region UI handlers
    private async onStopButtonClicked(): Promise<void> {
        debugLog("Emergency stop button clicked");
        await this.ossmBle?.stop();
    }

    private async onDisconnectButtonClicked(): Promise<void> {
        await this.ossmBle?.stop(); // Forcefully stop any movement
        this.ossmBle?.end();
        // See onDisconnected for UI handling
    }

    private async onRecalibrateButtonClicked(): Promise<void> {
        if (!this.ossmBle || this.elements.recalibrateButton.disabled)
            return;
        this.elements.recalibrateButton.disabled = true;

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
            this.elements.recalibrateButton.disabled = false;
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
            this.elements.recalibrateButton.disabled = false;
            throw error;
        }

        // Additionally reset speed to 0 for safety
        try {
            await this.ossmBle.setSpeed(0);
        } catch (error) {
            // TODO: Error
            this.elements.recalibrateButton.disabled = false;
            throw error;
        }
        debugLog("Recalibration complete");

        this.elements.recalibrateButton.disabled = false;
    }

    private async onPatternSelected(event: Event): Promise<void> {
        // Stop event propagation as update should be handled by API callback.
        // event.stopImmediatePropagation();

        const target = event.target;
        if (!(target instanceof HTMLInputElement))
            return;

        const patternInfo = this.patternRadioButtons.values().find(p => p.element === target)?.pattern;
        if (!patternInfo) {
            console.error("No pattern info found for selected pattern");
            // TODO: Error
            return;
        }

        try {
            await this.ossmBle?.setPattern(patternInfo.idx);
        } catch (error) {
            console.error("Error setting pattern on device:", error);
            // TODO: Error
            throw error;
        }
    }

    private async onRelativeRangeChanged(): Promise<void> {
        this.controlScreenSkipRepaintFor.range = true;
        await this.onPlayControlChanged();
        this.controlScreenSkipRepaintFor.range = false;
    }

    private async onRelativeSpeedChanged(): Promise<void> {
        this.controlScreenSkipRepaintFor.speed = true;
        await this.onPlayControlChanged();
        this.controlScreenSkipRepaintFor.speed = false;
    }

    private async onIntensityChanged(): Promise<void> {
        this.controlScreenSkipRepaintFor.intensity = true;
        await this.onPlayControlChanged();
        this.controlScreenSkipRepaintFor.intensity = false;
    }

    private async onPlayControlChanged(): Promise<void> {
        if (!this.ossmBle)
            return;

        debugLog("Updating device from controls");

        const range = this.relativeRangeControl.getValues();
        const speed = this.elements.relativeSpeedSlider.valueAsNumber;
        const intensity = this.elements.intensitySlider.valueAsNumber;
        const invert = this.elements.invertToggle.checked;

        // Find selected pattern info
        let pattern: PatternInfo | undefined = undefined;
        for (const [key, value] of this.patternRadioButtons) {
            if (value.element.checked) {
                pattern = value.pattern;
                break;
            }
        }
        if (!pattern) {
            console.error("No pattern selected when updating play controls");
            // TODO: Error
            return;
        }

        let playState: PatternHelper;
        try {
            playState = new PatternHelper(
                pattern.idx,
                range.from,
                range.to,
                speed,
                pattern.hasIntensityControl ? intensity : undefined,
                pattern.canInvert ? invert : undefined
            );
        } catch (error) {
            console.error("Error creating play state from control values:", error);
            // TODO: Error
            return;
        }

        try {
            await this.ossmBle.runStrokeEnginePattern(playState);
        } catch (error) {
            console.error("Error sending play state to device:", error);
            return;
        }
    }
    //#endregion

    //#region API handlers
    private async onConnected(data: OssmEventCallbackParameters): Promise<void> {
        this.elements.stateIndicator.dataset.state = "ready";
        this.elements.optionsAndControls.classList.remove("scale-pulse");
        try {
            if (await this.ossmBle?.getSpeedKnobConfig())
                await this.ossmBle?.setSpeedKnobConfig(false);
        } catch (error) {
            console.error("Error setting speed knob config on reconnection:", error);
        }
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
            this.lastOssmStatus = undefined;
            debugLog("OssmBle instance disposed");

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

        if (this.lastOssmStatus !== data[OssmEventType.StateChanged].newState.status) {
            debugLog("Device status changed:", data[OssmEventType.StateChanged].newState.status);
    
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

        switch (data[OssmEventType.StateChanged].newState.status) {
            case OssmStatus.StrokeEngine:
            case OssmStatus.StrokeEngineIdle:
            case OssmStatus.StrokeEnginePreflight:
            case OssmStatus.StrokeEnginePattern:
                // Always send new state to controls
                this.updateControlsState(data[OssmEventType.StateChanged].newState);
                break;
            default:
                break;
        }

        this.lastOssmStatus = data[OssmEventType.StateChanged].newState.status;
    }

    private async stateTransition(): Promise<void> {
        if (!this.ossmBle || this.isTransitioningPage || await this.ossmBle.getCurrentPage() === OssmPage.StrokeEngine)
            return;
        this.isTransitioningPage = true;

        debugLog("Transitioning to Stroke Engine page");
        
        await this.ossmBle.navigateTo(OssmPage.StrokeEngine);

        this.isTransitioningPage = false;
    }

    private async stateExternal(): Promise<void> {
        if (!this.ossmBle)
            return;

        // Ignore showing warning message here if we are in the middle of a scheduled process.
        if (this.isTransitioningPage || this.isRecalibrating)
            return;

        debugLog("Waiting for external interaction");

        this.elements.stateIndicator.dataset.state = "waiting";
        this.elements.optionsAndControls.classList.add("scale-pulse");

        // TODO: Show info box here
        this.elements.optionsAndControls.querySelectorAll("*").forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
                el.disabled = true;
            }
        });
    }

    private async stateHoming(): Promise<void> {
        debugLog("Homing in progress...");

        this.elements.stateIndicator.dataset.state = "calibrating";
        this.elements.optionsAndControls.classList.add("scale-pulse");
        this.elements.recalibrateButton.disabled = true;

        // TODO: Show info box here
        this.elements.optionsAndControls.querySelectorAll("*").forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
                el.disabled = true;
            }
        });
    }

    private async stateStrokeEngine(): Promise<void> {
        debugLog("Stroke Engine active");

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
        debugLog("Device is in error state");

        // Disconnect and return to pair screen with error
        try {
            await this.ossmBle?.stop();
            await this.ossmBle?.end();
            // Disposal handled by onDisconnected
        } catch (error) {
            console.error("Error stopping/ending connection during device error handling:", error);
        }

        this.setInfoContainer(
            this.infoKeyPairingScreen,
            StylesScript.createInfoContainer({
                state: InfoContainerState.Error,
                title: "Device Error",
                message: `The device has encountered an error and must be restarted manually`,
            }),
            this.elements.pairScreen
        );
    }

    private async stateUnknown(): Promise<void> {
        debugLog("Device is in unknown state");

        try {
            await this.ossmBle?.stop();
            await this.ossmBle?.end();
        } catch (error) {
            console.error("Error stopping/ending connection during unknown state handling:", error);
        }

        this.setInfoContainer(
            this.infoKeyPairingScreen,
            StylesScript.createInfoContainer({
                state: InfoContainerState.Error,
                title: "State Error",
                message: `The device has entered a state that the application cannot handle`,
            }),
            this.elements.pairScreen
        );
    }

    private async enterStableState(): Promise<void> {
        if (!this.ossmBle || this.isEnteringStableState)
            return;
        this.isEnteringStableState = true;

        debugLog("Entering stable state...");

        await this.ossmBle.setSpeed(0);
        await this.ossmBle.setStroke(10);
        await this.ossmBle.setDepth(10);

        this.isEnteringStableState = false;
    }

    private updateControlsState(state: OssmState): void {
        if (!this.ossmBle || this.isTransitioningPage || this.isRecalibrating)
            return;
        
        debugLog("Updating controls from device");

        // Find selected pattern info
        let pattern: PatternInfo | undefined = undefined;
        for (const [key, value] of this.patternRadioButtons) {
            if (value.pattern.idx === state.pattern) {
                value.element.checked = true;
                pattern = value.pattern;
                this.elements.descriptionText.textContent = value.pattern.description;
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
            if (!this.isEnteringStableState)
                this.enterStableState();
            return;
        }

        // Pattern
        if (!this.controlScreenSkipRepaintFor.patterns) {
            this.elements.descriptionText.textContent = pattern.description;

            if (pattern.canInvert) {
                this.elements.invertToggle.checked = playState.invert!;
                this.elements.invertToggle.classList.remove("hidden");
            } else {
                this.elements.invertToggle.classList.add("hidden");
            }

            if (pattern.hasIntensityControl)
                this.elements.intensityContainer.classList.remove("hidden");
            else
                this.elements.intensityContainer.classList.add("hidden");
        }

        // Range
        if (!this.controlScreenSkipRepaintFor.range) {
            this.relativeRangeControl.setValues({
                from: playState.minDepth,
                to: playState.maxDepth
            });
        }

        // Speed
        if (!this.controlScreenSkipRepaintFor.speed) {
            this.elements.relativeSpeedSlider.valueAsNumber = playState.speed;
        }

        // Intensity
        if (!this.controlScreenSkipRepaintFor.intensity) {
            if (pattern.hasIntensityControl)
                this.elements.intensitySlider.valueAsNumber = playState.intensity!;
        }
    }
    //#endregion
    //#endregion
}

// Even though we load with defer, wait for DOMContentLoaded since styles.ts has some pre-processing to do
document.addEventListener("DOMContentLoaded", async () => await OssmWebControl.initialize());
