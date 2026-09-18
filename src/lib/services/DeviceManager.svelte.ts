import { OssmBle, OssmEventType, OssmPage, OssmStatus, type OssmEventCallbackParameters, type OssmPattern, type OssmState } from 'ossm-ble-web';
import { isDevMode } from '$lib/utils/helpers';
import { EmptyOssmState, OssmDevice, type ConnectionState, type LifecycleState } from './OssmDevice.svelte';

export class DeviceManager extends OssmDevice implements Disposable {
    lifecycleState = $state<LifecycleState>('initializing');
    statusMessage = $state<string | null>(null);
    errorMessage = $state<string | null>(null);

    connectionState = $state<ConnectionState>('disconnected');
    currentState = $state<OssmState>(EmptyOssmState);
    patterns = $state<OssmPattern[]>([]);

    private ossmBle: OssmBle;
    private wakeLock: WakeLockSentinel | null = null;

    // Require an instance of OssmBle here instead of at initialize to ensure any created instance has an associated OssmBle instance
    constructor(bleInstance: OssmBle) {
        super();
        if (!bleInstance)
            throw new Error('DeviceManager requires a valid OssmBle instance');
        this.ossmBle = bleInstance;
    }

    async initialize(): Promise<boolean> {
        if (this.lifecycleState !== 'uninitialized') {
            console.warn('[DeviceManager] Invalid lifecycle state for initialization:', this.lifecycleState);
            return false;
        }
        this.lifecycleState = 'initializing';

        try {
            this.statusMessage = 'Initializing...';
            this.ossmBle.debug = isDevMode;

            await this.ossmBle.begin();
            await this.ossmBle.waitForReady(5000);

            this.statusMessage = 'Fetching device information...';
            await this.enterStableState();

            if (await this.ossmBle.getCurrentPage() === OssmPage.Menu) {
                await this.ossmBle.navigateTo(OssmPage.StrokeEngine);
                this.ossmBle.waitForStatus([
                    OssmStatus.StrokeEngine,
                    OssmStatus.StrokeEngineIdle,
                    OssmStatus.StrokeEnginePreflight,
                    OssmStatus.StrokeEnginePattern
                ], 30_000).catch((err) => console.warn('[BLE] Page navigation timeout:', err));
            }

            this.statusMessage = 'Loading patterns...';
            this.currentState = await this.ossmBle.getState(5000);
            this.patterns = await this.ossmBle.getPatternList();

            this.attachEventListeners();
            await this.requestWakeLock();

            // this.connectionState = 'connected';
            this.statusMessage = 'Connection successful';
            this.lifecycleState = 'ready';
            return true;

        } catch (error) {
            console.error('[DeviceManager] Initialization failed:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to initialize device';
            this[Symbol.dispose]();
            return false;
        }
    }

    private attachEventListeners(): void {
        if (!this.ossmBle) return;

        this.ossmBle.addEventListener(OssmEventType.Connected, () => {
            this.connectionState = 'connected';
        });

        this.ossmBle.addEventListener(OssmEventType.Disconnected, () => {
            if (this.ossmBle.willAutoReconnect()) {
                this.connectionState = 'reconnecting';
                this.statusMessage = 'Reconnecting...';
            } else {
                this.connectionState = 'disconnected';
                this.errorMessage = 'Device disconnected';
                this[Symbol.dispose]();
            }
        });

        this.ossmBle.addEventListener(OssmEventType.StateChanged, (e: OssmEventCallbackParameters) => {
            if (!e[OssmEventType.StateChanged]) return;
            this.currentState = e[OssmEventType.StateChanged].newState;
        });
    }

    private async enterStableState(): Promise<void> {
        if (!this.ossmBle) return;
        
        this.ossmBle.batchSet([
            ["speed", 0],
            ["stroke", 10],
            ["depth", 10],
            ["sensation", 50]
        ]);
    }

    private async requestWakeLock(): Promise<void> {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.warn('[BLE] Wake lock request failed:', err);
            }
        }
    }

    private resetState(): void {
        this.statusMessage = null;
        this.errorMessage = null;
        this.currentState = EmptyOssmState;
        this.patterns = [];
    }

    [Symbol.dispose](): void {
        if (this.wakeLock) {
            this.wakeLock.release().catch(() => {});
            this.wakeLock = null;
        }

        if (this.ossmBle) {
            try { this.ossmBle[Symbol.dispose]?.(); }
            catch { /* empty */ }
        }

        this.resetState();

        this.lifecycleState = 'disposed';
    }
}
