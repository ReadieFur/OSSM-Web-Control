import { onMount } from "svelte";
import type { ViewManager, ViewManagerProps } from "$lib/services/ViewManager.svelte";
import MainControlView from "./MainControlView.svelte";
import { CancellationTokenSource, isClientBleCapable } from "ossm-ble-web";
import { OssmBleDevice } from "$lib/services/OssmBleDevice.svelte";

interface NavigatorUAData {
    userAgentData?: {
        getHighEntropyValues(hints: string[]): Promise<{ platform: string }>;
    };
}

export interface LandingViewProps extends ViewManagerProps {
    readonly viewManager: ViewManager;
}

const defaultConnectionTimeout = 15_000;

export class LandingView {
    isPwaInstalling = $state<boolean>(false);
    showInstallButton = $derived(this._pwaInstallContext !== null);
    isBleSupported = $state<boolean | null>(null);
    isSecureContext = $state<boolean>(true);
    platform = $state<string | undefined>(undefined);

    get viewManager() { return this.getProps().viewManager; }

    #pwaInstallContext = $state<BeforeInstallPromptEvent | null>(null);
    private get _pwaInstallContext() { return this.#pwaInstallContext; }
    private set _pwaInstallContext(value: BeforeInstallPromptEvent | null) { this.#pwaInstallContext = window.pwaInstallContext = value; }

    constructor(private getProps: () => LandingViewProps) {
        onMount(this.#checkCompatibility.bind(this));
        onMount(this.#capturePwaPromptEvent.bind(this));
    }

    // #region Compatibility Checks
    #parseLegacyUserAgent(): string | undefined {
        const ua = navigator.userAgent;
        if (ua.includes("Windows")) return "Windows";
        if (ua.includes("Linux")) return "Linux";
        if (ua.includes("Macintosh")) return "Macintosh";
        if (ua.includes("Android")) return "Android";
        if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
        return undefined;
    }

    async #checkCompatibility(): Promise<void> {
        this.isSecureContext = window.isSecureContext;

        if (!isClientBleCapable()) {
            console.error("Browser does not support required Bluetooth features");
            this.isBleSupported = false;

            const nav = navigator as Navigator & NavigatorUAData;

            if (nav.userAgentData?.getHighEntropyValues) {
                try { this.platform = (await nav.userAgentData.getHighEntropyValues(["platform"])).platform; }
                catch { this.platform = this.#parseLegacyUserAgent(); }
            } else if (navigator.userAgent) {
                this.platform = this.#parseLegacyUserAgent();
            }
        } else {
            this.isBleSupported = true;
        }
    }
    // #endregion

    // #region PWA
    #capturePwaPromptEvent(): () => void {
        if (!this._pwaInstallContext && window.pwaInstallContext)
            this._pwaInstallContext = window.pwaInstallContext;

        const handleInstallPrompt = (e: Event) => {
            const event = e as BeforeInstallPromptEvent;
            event.preventDefault();
            this._pwaInstallContext = event;
        };

        window.addEventListener("beforeinstallprompt", handleInstallPrompt);

        return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    }

    async installPWA(): Promise<void> {
        if (!this._pwaInstallContext || this.isPwaInstalling) return;
        this.isPwaInstalling = true;
        try {
            await this._pwaInstallContext.prompt();
            this._pwaInstallContext = null; // Context always gets made invalid after prompt()
        } catch (error) {
            console.error("[PWA] Prompt failed:", error);
        } finally {
            this.isPwaInstalling = false;
        }
    }
    // #endregion

    // #region Connection
    infoDialog: {
        state: "info" | "error";
        title?: string;
        message?: string;
        extra?: string;
    } | null = $state(null);
    isConnecting = $state(false);

    async connectBleDevice(): Promise<void> {
        if (this.isConnecting) return;
        this.isConnecting = true;

        // 'using' keyword cat be used here :c so I will have to handle cleanup of it manually
        // TODO: Make it so that this cts only starts after a device has been selected
        const cts = CancellationTokenSource.createWithTimeout(defaultConnectionTimeout, "Connection timed out");

        try {
            this.infoDialog = {
                state: "info",
                message: "Connecting to BLE device..."
            };

            const provider = await OssmBleDevice.initializeInstance(cts.token);

            this.viewManager.setViewAndProps(MainControlView, { viewManager: this.viewManager, ossmProvider: provider });
        } catch (error) {
            const allowedErrors: string[] = [
                "NotFoundError", //Occurs when user cancels the pairing prompt
            ];
            if (error instanceof DOMException && allowedErrors.includes(error.name))
                return;

            console.error("[BLE] Connection failed:", error);
            this.infoDialog = {
                state: "error",
                title: "Failed to connect to device",
            };

            if (error instanceof Error) {
                this.infoDialog.extra = error.message;
            }
        } finally {
            cts.dispose();
            this.isConnecting = false;
            if (this.infoDialog?.state !== "error")
                this.infoDialog = null;
        }
    }
    // #endregion
}
