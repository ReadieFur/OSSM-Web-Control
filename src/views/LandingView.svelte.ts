import { onMount } from 'svelte';
import { OssmBle } from 'ossm-ble-web';
import { DOMExceptionError } from '$lib/utils/Helpers.svelte.ts';
import { DeviceManager } from '$lib/services/DeviceManager.svelte.ts';

interface NavigatorUAData {
    userAgentData?: {
        getHighEntropyValues(hints: string[]): Promise<{ platform: string }>;
    };
}

export class LandingView {

    constructor() {
        onMount(this.checkCompatibility.bind(this));
        onMount(this.capturePwaPromptEvent.bind(this));
    }

    // #region Compatibility Checks
    isBleSupported = $state<boolean | null>(null);
    isSecureContext = $state<boolean>(true);
    platform = $state<string | undefined>(undefined);

    private parseLegacyUserAgent(): string | undefined {
        const ua = navigator.userAgent;
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Macintosh')) return 'Macintosh';
        if (ua.includes('Android')) return 'Android';
        if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
        return undefined;
    }

    private async checkCompatibility(): Promise<void> {
        this.isSecureContext = window.isSecureContext;

        if (!OssmBle.isClientSupported()) {
            console.error('Browser does not support required Bluetooth features');
            this.isBleSupported = false;

            const nav = navigator as Navigator & NavigatorUAData;

            if (nav.userAgentData?.getHighEntropyValues) {
                try { this.platform = (await nav.userAgentData.getHighEntropyValues(['platform'])).platform; }
                catch { this.platform = this.parseLegacyUserAgent(); }
            } else if (navigator.userAgent) {
                this.platform = this.parseLegacyUserAgent();
            }
        } else {
            this.isBleSupported = true;
        }
    }
    // #endregion

    // #region PWA
    isPwaInstalling = $state<boolean>(false);
    showInstallButton = $derived(this.pwaInstallContext !== null);
    
    #pwaInstallContext = $state<BeforeInstallPromptEvent | null>(null);
    public get pwaInstallContext(): BeforeInstallPromptEvent | null {
        return this.#pwaInstallContext;
    }
    private set pwaInstallContext(value: BeforeInstallPromptEvent | null) {
        this.#pwaInstallContext = window.pwaInstallContext = value;
    }

    private capturePwaPromptEvent(): () => void {
        if (!this.pwaInstallContext && window.pwaInstallContext)
            this.pwaInstallContext = window.pwaInstallContext;

        const handleInstallPrompt = (e: Event) => {
            const event = e as BeforeInstallPromptEvent;
            event.preventDefault();
            this.pwaInstallContext = event;
        };

        window.addEventListener('beforeinstallprompt', handleInstallPrompt);

        return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    }

    async installPWA(): Promise<void> {
        if (!this.pwaInstallContext || this.isPwaInstalling) return;
        this.isPwaInstalling = true;
        try {
            await this.pwaInstallContext.prompt();
            this.pwaInstallContext = null; // Context always gets made invalid after prompt()
        } catch (error) {
            console.error('[PWA] Prompt failed:', error);
        } finally {
            this.isPwaInstalling = false;
        }
    }
    // #endregion

    // #region Connection
    infoDialog: { state: 'info' | 'error'; title?: string; message?: string; } | null = $state(null);
    isConnecting = $state(false);

    async connectDevice(): Promise<void> {
        if (this.isConnecting) return;
        this.isConnecting = true;

        let device: OssmBle;
        try {
            device = await OssmBle.pairDevice();
        }
        catch (error) {
            const allowedErrors: string[] = [
                DOMExceptionError.NotFoundError, //Occurs when user cancels the pairing prompt
            ];

            if (error instanceof DOMException && !allowedErrors.includes(error.name)) {
                console.error('[BLE] Connection failed:', error);
                this.infoDialog = {
                    state: 'error',
                    title: 'Connection Error',
                    message: 'Failed to connect to device'
                };
            }
            return;
        }
        finally {
            this.isConnecting = false;
        }

        // TODO: Handoff connection to the main app view
        const deviceManager = new DeviceManager();
    }
    // #endregion
}
