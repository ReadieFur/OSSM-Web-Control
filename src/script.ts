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
    Helpers as StyleHelpers,
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

//#region Element wrappers
class ControlsDualSlider {
    static createFromExisting(container: HTMLElement): void {
        const rangeContainer = container.querySelector(".input-container-range-double");
        if (!rangeContainer || !(rangeContainer instanceof HTMLDivElement))
            throw new Error("SliderComponent: Could not find required range container element");

        const rangeInstance = InputRangeDouble.getOrCreateInstance(rangeContainer);

        const numberInputs = container.querySelectorAll("input[type='number']");
        if (numberInputs.length < 2)
            throw new Error("SliderComponent: Could not find required number input elements");

        const numberInputA = numberInputs[0] as HTMLInputElement;
        const numberInputB = numberInputs[1] as HTMLInputElement;

        const refreshNumberInputs = () => {
            let minInput: HTMLInputElement, maxInput: HTMLInputElement;
            if (StyleHelpers.isPortrait()) {
                minInput = numberInputB;
                maxInput = numberInputA;
            } else {
                minInput = numberInputA;
                maxInput = numberInputB;
            }

            const minMax = rangeInstance.getMinMax();
            const values = rangeInstance.getValues();

            minInput.min = minMax.min.toString();
            minInput.max = values.to.toString();
            maxInput.min = values.from.toString();
            maxInput.max = minMax.max.toString();

            minInput.value = values.from.toString();
            maxInput.value = values.to.toString();
        };

        const onWindowResize = () => {
            const wasPortrait = rangeContainer.getAttribute("orientation") === "vertical";
            const isPortrait = StyleHelpers.isPortrait();

            if (wasPortrait === isPortrait)
                return;

            if (isPortrait)
                rangeContainer.setAttribute("orientation", "vertical");
            else
                rangeContainer.removeAttribute("orientation");

            refreshNumberInputs();
        };

        window.addEventListener("resize", onWindowResize);

        rangeInstance.addEventListener("input", () => {
            refreshNumberInputs();
        });

        rangeInstance.addEventListener("change", () => {
            // No need to refresh numbers as this will have been done when the input event fires which always comes first.
            // this.refreshNumberInputs();
        });

        numberInputA.addEventListener("change", () => {
            let from: number | undefined = undefined;
            let to: number | undefined = undefined;

            if (StyleHelpers.isPortrait())
                to = parseFloat(numberInputA.value);
            else
                from = parseFloat(numberInputA.value);

            // Enforce gap
            const gap = rangeInstance.getMinGap();
            const values = rangeInstance.getValues();
            if (from !== undefined && values.to - from < gap) {
                from = values.to - gap;
                numberInputA.value = from.toString();
            }
            if (to !== undefined && to - values.from < gap) {
                to = values.from + gap;
                numberInputA.value = to.toString();
            }

            rangeInstance.setValues({ from, to });
        });

        numberInputB.addEventListener("change", () => {
            let from: number | undefined = undefined;
            let to: number | undefined = undefined;

            if (StyleHelpers.isPortrait())
                from = parseFloat(numberInputB.value);
            else
                to = parseFloat(numberInputB.value);

            const gap = rangeInstance.getMinGap();
            const values = rangeInstance.getValues();
            if (from !== undefined && values.to - from < gap) {
                from = values.to - gap;
                numberInputB.value = from.toString();
            }
            if (to !== undefined && to - values.from < gap) {
                to = values.from + gap;
                numberInputB.value = to.toString();
            }

            rangeInstance.setValues({ from, to });
        });

        refreshNumberInputs();
        onWindowResize();
    }
}

class ControlsSingleSlider {
    static createFromExisting(container: HTMLElement): void {
        if (container.children.length !== 3)
            throw new Error(`SliderComponent: Unexpected number of child elements in container` +
                ` (${container.children.length} found, 3 expected)`);
        const originalElementOrder = Array.from(container.children);

        const numberInput = container.querySelector("input[type='number']") as HTMLInputElement;
        if (!numberInput)
            throw new Error("SliderComponent: Could not find required number input element");
        const rangeInput = container.querySelector("input[type='range']") as HTMLInputElement;
        if (!rangeInput)
            throw new Error("SliderComponent: Could not find required range input element");

        numberInput.min = rangeInput.min;
        numberInput.max = rangeInput.max;
        numberInput.valueAsNumber = rangeInput.valueAsNumber;

        rangeInput.addEventListener("input", () => {
            numberInput.value = rangeInput.value;
        });
        rangeInput.addEventListener("change", () => {
            numberInput.value = rangeInput.value;
        });
        rangeInput.addEventListener("repaint", () => {
            numberInput.value = rangeInput.value;
        });
        numberInput.addEventListener("input", () => {
            const value = parseFloat(numberInput.value);
            rangeInput.valueAsNumber = value;
            rangeInput.dispatchEvent(new Event("input"));
        });
        numberInput.addEventListener("change", () => {
            const value = parseFloat(numberInput.value);
            rangeInput.valueAsNumber = value;
            // Do not bubbles event as range input is internal to this component (otherwise this would cause the event to fire twice)
            rangeInput.dispatchEvent(new Event("change"));
        });

        const onWindowResize = () => {
            const isPortrait = StyleHelpers.isPortrait();

            if (isPortrait) {
                /* Place items in this order:
                 * - Other element [0]
                 * - Range input (vertical) [1]
                 * - Number input [2]
                 */

                container.insertBefore(originalElementOrder[0], originalElementOrder[1]);
                rangeInput.setAttribute("orientation", "vertical");
                container.appendChild(originalElementOrder[2]);
            }
            else {
                /* Place items in this order:
                 * - Number input [2]
                 * - Range input (horizontal) [1]
                 * - Other element [0]
                 */
                container.insertBefore(originalElementOrder[2], originalElementOrder[1]);
                rangeInput.removeAttribute("orientation");
                container.appendChild(originalElementOrder[0]);
            }
        };
        window.addEventListener("resize", onWindowResize);
        onWindowResize();
    }
}
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
            ControlsDualSlider.createFromExisting(this.elements.relativeRangeContainer);
            ControlsSingleSlider.createFromExisting(this.elements.relativeSpeedContainer);
            ControlsSingleSlider.createFromExisting(this.elements.intensityContainer);
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
        this.elements.invertToggle.addEventListener("change", this.onInvertToggled.bind(this));

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

    private populatePatternList(patterns: OssmPattern[], selectedPatternId: number): void {
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
            if (selectedPatternId === pattern.idx)
                option.checked = true;
        }
    }

    private async endSessionNow(): Promise<void> {
        try {
            await this.ossmBle?.stop(); // Forcefully stop any movement
        } catch {}

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

        // Wait until one state update has been received (see onStateChanged for UI refresh)
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

        // If the device is in on the Menu page then transition to the StrokeEngine state since it is likely that the device has just started up.
        try {
            if (await this.ossmBle.getCurrentPage() === OssmPage.Menu) {
                debugLog("Device is on Menu page, navigating to Stroke Engine page");

                const navigationPromise = (async (instance: OssmBle) => {
                    // await instance.navigateTo(OssmPage.Menu);
                    // await instance.waitForStatus([
                    //     OssmStatus.Idle,
                    //     OssmStatus.Menu,
                    //     OssmStatus.MenuIdle
                    // ], 1_000);

                    await instance.navigateTo(OssmPage.StrokeEngine);
                    await instance.waitForStatus([
                        OssmStatus.StrokeEngine,
                        OssmStatus.StrokeEngineIdle,
                        OssmStatus.StrokeEnginePreflight,
                        OssmStatus.StrokeEnginePattern
                    ], 30_000);
                })(this.ossmBle);
                
                // Don't wait for the page (via status event) here
                // await navigationPromise;

                console.log(navigationPromise);
            }
        } catch (error) {
            console.error("Error navigating to Stroke Engine page:", error);
            this.setInfoContainer(
                this.infoKeyPairingScreen,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Connection Error",
                    message: `Failed to activate device controls`,
                }),
                this.elements.pairScreen
            );
        }
        //#endregion

        //#region Setup control screen
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

            this.ossmBle?.[Symbol.dispose]();
            this.ossmBle = undefined;
            this.restorePairScreenLayout();
            return;
        }

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

            this.ossmBle?.[Symbol.dispose]();
            this.ossmBle = undefined;
            this.restorePairScreenLayout();
            return;
        }
        this.populatePatternList(patterns, currentState.pattern);

        // Manually trigger an update of the UI
        this.ossmBle.addEventListener(OssmEventType.Connected, this.onConnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.Disconnected, this.onDisconnected.bind(this));
        this.ossmBle.addEventListener(OssmEventType.StateChanged, this.onStateChanged.bind(this));
        try {
            await this.onConnected({ event: OssmEventType.Connected });
            await this.onStateChanged({
                event: OssmEventType.StateChanged,
                [OssmEventType.StateChanged]: {
                    newState: await this.ossmBle.getState(500),
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
        await this.endSessionNow();
    }

    private async onRecalibrateButtonClicked(): Promise<void> {
        if (!this.ossmBle || this.elements.recalibrateButton.disabled)
            return;
        this.elements.recalibrateButton.disabled = true;

        debugLog("Starting recalibration process");

        // onStateChanged will handle the UI updates
        
        const endSession = (error?: any) => {
            console.error("Error during recalibration:", error);

            this.elements.recalibrateButton.disabled = false;

            this.setInfoContainer(
                this.infoKeyPairingScreen,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Recalibration Error",
                    message: `Failed to recalibrate`,
                    extraContent: `<p><small>Re-connect to reset</small></p>`
                }),
                this.elements.controlScreen
            );

            this.endSessionNow();
        };

        try {
            await this.ossmBle.navigateTo(OssmPage.Menu);
            await this.ossmBle.waitForStatus([
                OssmStatus.Idle,
                OssmStatus.Menu,
                OssmStatus.MenuIdle
            ], 1_000);
        } catch (error) {
            endSession(error);
            return;
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
            endSession(error);
            return;
        }

        // Additionally reset speed to 0 for safety
        try {
            await this.enterStableState();
        } catch (error) {
            endSession(error);
        }

        debugLog("Recalibration complete");

        this.elements.recalibrateButton.disabled = false;
    }

    private async onPatternSelected(event: Event): Promise<void> {
        // Stop event propagation, update should be handled by API callback.
        // event.stopImmediatePropagation();

        const target = event.target;
        if (!(target instanceof HTMLInputElement))
            return;

        const patternInfo = this.patternRadioButtons.values().find(p => p.element === target)!.pattern;

        try {
            await this.ossmBle?.setPattern(patternInfo.idx);
        } catch (error) {
            console.error("Error setting pattern on device:", error);
            
            this.setInfoContainer(
                this.infoKeyPairingScreen,
                StylesScript.createInfoContainer({
                    state: InfoContainerState.Error,
                    title: "Set Pattern Error",
                    message: `Failed to set pattern`,
                    extraContent: `<p><small>Re-connect to reset</small></p>`
                }),
                this.elements.controlScreen
            );

            await this.endSessionNow();
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

    private async onInvertToggled(): Promise<void> {
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
            // Shouldn't occur but just to be safe
            console.error("No pattern selected when updating play controls");

            // Pick first available pattern
            pattern = this.patternRadioButtons.values().next().value!.pattern;
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
            // State is invalid, silently fail
            return;
        }

        try {
            await this.ossmBle.runStrokeEnginePattern(playState);
        } catch (error) {
            console.error("Error sending play state to device:", error);

            // Silently fail, repaint UI with old device state
            try {
                await this.updateControlsState(await this.ossmBle.getState(500));
            } catch (error) {
                // Severe error, end session.
                console.error("Error retrieving device state after failed play control update:", error);

                this.setInfoContainer(
                    this.infoKeyPairingScreen,
                    StylesScript.createInfoContainer({
                        state: InfoContainerState.Error,
                        title: "Play Control Error",
                        message: `Application in a stale state`,
                        extraContent: `<p><small>Re-connect to reset</small></p>`
                    }),
                    this.elements.controlScreen
                );
                await this.endSessionNow();
            }

            return;
        }
    }
    //#endregion

    //#region API handlers
    private async onConnected(data: OssmEventCallbackParameters): Promise<void> {
        this.elements.stateIndicator.dataset.state = "ok";
        this.elements.stateIndicator.dataset.text = "Connected";
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

        this.elements.stateIndicator.dataset.state = willReconnect ? "warning" : "not-ready";
        this.elements.stateIndicator.dataset.text = willReconnect ? "Reconnecting" : "Disconnected";

        if (willReconnect) {
            // Stay on control screen and wait for reconnection
            this.elements.optionsAndControls.classList.add("scale-pulse");
        } else {
            await this.endSessionNow();
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
                await this.updateControlsState(data[OssmEventType.StateChanged].newState);
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

        this.elements.stateIndicator.dataset.state = "warning";
        this.elements.stateIndicator.dataset.text = "Waiting";
        this.elements.optionsAndControls.classList.add("scale-pulse");
        this.elements.recalibrateButton.classList.add("highlight"); //Use this to help indicate that it can be pressed to return to a known state

        this.elements.optionsAndControls.querySelectorAll("*").forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
                el.disabled = true;
            }
        });
    }

    private async stateHoming(): Promise<void> {
        debugLog("Homing in progress...");

        this.elements.stateIndicator.dataset.state = "processing";
        this.elements.stateIndicator.dataset.text = "Homing";
        this.elements.optionsAndControls.classList.add("scale-pulse");
        this.elements.recalibrateButton.disabled = true;
        this.elements.recalibrateButton.classList.remove("highlight");

        this.elements.optionsAndControls.querySelectorAll("*").forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
                el.disabled = true;
            }
        });
    }

    private async stateStrokeEngine(): Promise<void> {
        debugLog("Stroke Engine active");

        this.elements.stateIndicator.dataset.state = "ok";
        this.elements.stateIndicator.dataset.text = "Ready";
        this.elements.optionsAndControls.classList.remove("scale-pulse");
        this.elements.recalibrateButton.disabled = false;
        this.elements.recalibrateButton.classList.remove("highlight");

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
            await this.endSessionNow();
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
            await this.endSessionNow();
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

        // Force override UI elements
        this.relativeRangeControl.setValues({ from: 0, to: 10 });
        this.elements.relativeSpeedSlider.valueAsNumber = 0;
        this.elements.relativeSpeedSlider.dispatchEvent(new Event("repaint"));
        this.elements.intensitySlider.valueAsNumber = 10;
        this.elements.relativeSpeedSlider.dispatchEvent(new Event("repaint"));
        this.elements.invertToggle.checked = false;

        await this.ossmBle.batchSet([
            ["speed", 0],
            ["stroke", 10],
            ["depth", 10],
            ["sensation", 50]
        ]);

        this.isEnteringStableState = false;
    }

    private async updateControlsState(state: OssmState): Promise<void> {
        if (!this.ossmBle)
            return;
        
        debugLog("Updating controls from device");

        if (state.status === OssmStatus.StrokeEngine ||
            state.status === OssmStatus.StrokeEngineIdle ||
            state.status === OssmStatus.StrokeEnginePreflight ||
            state.status === OssmStatus.StrokeEnginePattern
        ) {
            this.elements.stateIndicator.dataset.text = state.speed > 0 ? "Active" : "Paused";
        }

        // Find selected pattern info

        const getPattern = () => {
            for (const [key, value] of this.patternRadioButtons) {
                if (value.pattern.idx === state.pattern) {
                    value.element.checked = true;
                    this.elements.descriptionText.textContent = value.pattern.description;
                    return value.pattern;
                }
            }
            return undefined;
        };

        let pattern = getPattern();
        
        if (!pattern) {
            console.error("Current pattern not found in pattern list:", state.pattern);

            try {
                const patterns = await this.ossmBle.getPatternList();
                this.populatePatternList(patterns, state.pattern);

                pattern = getPattern();
                if (pattern === undefined)
                    throw new Error("Pattern still not found after re-querying pattern list");
            } catch (error) {
                console.error("Error re-querying pattern list:", error);

                // Critical error, end session
                this.setInfoContainer(
                    this.infoKeyPairingScreen,
                    StylesScript.createInfoContainer({
                        state: InfoContainerState.Error,
                        title: "Data Error",
                        message: `Provided pattern data is invalid`,
                        extraContent: `<p><small>Re-connect to reset</small></p>`
                    }),
                    this.elements.controlScreen
                );
                await this.endSessionNow();
                return;
            }
        }

        let playState: PatternHelper;
        try {
            playState = PatternHelper.fromPlayData(state, pattern.hasIntensityControl, pattern.canInvert);
        } catch (error) {
            // TODO: Stop this error from occurring when inputs are made in rapid succession
            console.error("Error parsing play data from state:", error);
            // if (!this.isEnteringStableState)
            //     this.enterStableState();
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
            this.elements.relativeSpeedSlider.dispatchEvent(new Event("repaint"));
        }

        // Intensity
        if (!this.controlScreenSkipRepaintFor.intensity) {
            if (pattern.hasIntensityControl) {
                this.elements.intensitySlider.valueAsNumber = playState.intensity!;
                this.elements.invertToggle.checked = playState.invert!;
                this.elements.intensitySlider.dispatchEvent(new Event("repaint"));
            }
        }
    }
    //#endregion
    //#endregion
}

// Even though we load with defer, wait for DOMContentLoaded since styles.ts has some pre-processing to do
document.addEventListener("DOMContentLoaded", async () => await OssmWebControl.initialize());
