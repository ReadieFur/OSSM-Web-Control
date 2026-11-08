import { SvelteMap } from "svelte/reactivity";
import { type OssmProvider, SensationType, State, type Pattern, type PlayState, OssmProviderHelpers } from "./OssmProvider.svelte";
import { CancellationTokenSource, OssmLiteClient, type ICancellationToken } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { isDevMode, type ResolveReject } from "$lib/utils/Helpers.svelte";
import { KnownPatterns } from "$lib/utils/KnownPatterns";

const disconnectTimeout = 5000;

export class OssmLite implements OssmProvider, Disposable {
    static initializeInstance(device: BluetoothDevice, ct: ICancellationToken): Promise<OssmLite>;
    static initializeInstance(ct: ICancellationToken): Promise<OssmLite>;
    static async initializeInstance(deviceOrCt: BluetoothDevice | ICancellationToken, ct?: ICancellationToken): Promise<OssmLite> {
        let client: OssmLiteClient;
        let cancellationToken: ICancellationToken;
        let forgetDevice: () => Promise<void> | undefined;

        if ('isCancellationRequested' in deviceOrCt) {
            cancellationToken = deviceOrCt;
            client = await OssmLiteClient.pairDevice();
        } else {
            cancellationToken = ct!;
            client = new OssmLiteClient(deviceOrCt);
            forgetDevice = deviceOrCt.forget;
        }

        cancellationToken.throwIfCancellationRequested();

        const instance = new OssmLite(client);
        const ctCb = cancellationToken.register(() => {
            client.disconnect();
            if (forgetDevice !== undefined) forgetDevice();
        });

        await instance.#begin(cancellationToken);

        ctCb.unregister();
        return instance;
    }

    readonly #client: OssmLiteClient;
    readonly #onBleConnectSignature = this.#onBleConnect.bind(this);
    readonly #onBleDisconnectSignature = this.#onBleDisconnect.bind(this);
    readonly #onBlePatternSignature = this.#onBlePattern.bind(this);
    readonly #onBleMinDepthSignature = this.#onBleMinDepth.bind(this);
    readonly #onBleMaxDepthSignature = this.#onBleMaxDepth.bind(this);
    readonly #onBleSpeedSignature = this.#onBleSpeed.bind(this);
    readonly #onBleSensationSignature = this.#onBleSensation.bind(this);
    #disconnectTimeoutHandle?: number;
    #playState: PlayState = $state({
        patternId: 0,
        depth: 0,
        stroke: 0,
        speed: 0,
        sensation: 0
    });

    state: State = $state(State.Disconnected);
    patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>();
    readonly maxUpdateRateHz = 8;
    get playState(): Readonly<PlayState> { return this.#playState; }
    set playState(playState: PlayState) { this.#updateFromUi(playState); }

    constructor(client: OssmLiteClient) {
        this.#client = client;
        this.#client.debug = isDevMode;
        if (isDevMode) console.log("OssmLiteClient:", this.#client);

        this.#client.on.pattern.subscribe(this.#onBlePatternSignature);
        this.#client.on.minDepth.subscribe(this.#onBleMinDepthSignature);
        this.#client.on.maxDepth.subscribe(this.#onBleMaxDepthSignature);
        this.#client.on.speed.subscribe(this.#onBleSpeedSignature);
        this.#client.on.sensation.subscribe(this.#onBleSensationSignature);
    }

    [Symbol.dispose](): void {
        this.disconnect();
        this.#client[Symbol.dispose]();
    }

    async #begin(ct?: ICancellationToken): Promise<void> {
        this.state = State.Reconnecting;

        try {
            ct?.throwIfCancellationRequested();
            this.#client.autoReconnect = true;
            await this.#client.begin();
            await this.#client.waitForConnection(ct);

            await this.#client.setHomeBetweenModes(false); // Stop the device from recalibrating between normal and AP mode

            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            const basePatternNames: Set<string> = new Set();
        
            ct?.throwIfCancellationRequested();
            for await (const pattern of this.#client.getPatterns()) {
                ct?.throwIfCancellationRequested();
        
                basePatternNames.add(pattern.name);
        
                const knownPattern = KnownPatterns.get(pattern.idx);
                if (knownPattern && knownPattern.name === pattern.name) {
                        this.patterns.set(pattern.idx, knownPattern);
                } else {
                    this.patterns.set(pattern.idx, {
                        name: pattern.name,
                        description: pattern.description,
                        sensationType: SensationType.Normal,
                    });
                }
            }

            /* Future
            ct?.throwIfCancellationRequested();
            let apPatternIndex = -1; // Sneaky way to assign indexes to the advanced penetration config patterns
            for (const patternName in await this.#client.getAdvancedPenetrationConfigNames()) {
                ct?.throwIfCancellationRequested();
        
                if (basePatternNames.has(patternName))
                    continue;
        
                this.patterns.set(apPatternIndex--, {
                    name: patternName,
                    description: "",
                    sensationType: SensationType.None
                });
            }*/

            await this.#onBleConnect();
            this.#client.connectedEvent.subscribe(this.#onBleConnectSignature);
            this.#client.disconnectedEvent.subscribe(this.#onBleDisconnectSignature);
        } catch (err) {
            this.state = State.Error;
            throw err;
        }
    }

    async disconnect(): Promise<void> {
        this.#client.setSpeed(0);

        this.state = State.Disconnected;

        if (this.#disconnectTimeoutHandle) window.clearInterval(this.#disconnectTimeoutHandle);

        this.#client.on.pattern.unsubscribe(this.#onBlePatternSignature);
        this.#client.on.minDepth.unsubscribe(this.#onBleMinDepthSignature);
        this.#client.on.maxDepth.unsubscribe(this.#onBleMaxDepthSignature);
        this.#client.on.speed.unsubscribe(this.#onBleSpeedSignature);
        this.#client.on.sensation.unsubscribe(this.#onBleSensationSignature);

        await this.#client.disconnect();
    }

    async #onBleConnect(): Promise<void> {
        // These calls trigger the notify callbacks
        // Force into stroke engine mode (weird quirk with reconnects it seems to get stuck unable to move unless pattern is read/set?)
        await this.#client.setPattern(await this.#client.getPattern());
        await this.#client.getMinDepth();
        await this.#client.getMaxDepth()
        await this.#client.getSpeed();
        await this.#client.getSensation();

        this.state = State.Ready;
    }

    #onBleDisconnect() {
        if (!this.#client.autoReconnect)
            return;

        this.state = State.Reconnecting;

        this.#disconnectTimeoutHandle = window.setTimeout(() => {
            if (!this.#client.isConnected) {
                this.state = State.Error;
                this.disconnect();
                this.state = State.Error;
            }
        }, disconnectTimeout);
    }

    emergencyStop(): Promise<void> {
        return this.#client.emergencyStop();
    }

    recalibrate(): Promise<void> {
        // OssmLite does not support recalibration
        return Promise.resolve();
    }

    async #updateFromUi(newPlayState: PlayState): Promise<void> {
        const diff = OssmProviderHelpers.getPlayStateChanges(this.playState, newPlayState);

        const oldRange = OssmProviderHelpers.depthAndStrokeToRange(this.playState.depth, this.playState.stroke);
        const newRange = OssmProviderHelpers.depthAndStrokeToRange(newPlayState.depth, newPlayState.stroke);
        const rangeDiff: Partial<{ from: number, to: number }> = {};
        for (const key of Object.keys(oldRange) as (keyof typeof oldRange)[])
            if (oldRange[key] !== newRange[key])
                rangeDiff[key] = newRange[key];

        if (Object.keys(diff).length === 0 && Object.keys(rangeDiff).length === 0) return;

        const oldState = { ...this.playState };

        // Optimistically update the UI
        this.#playState = newPlayState;

        // #region Safe apply settings
        /* Logic for this has been based on the setCommonPlayParameters method in my BLE library for the official firmware (Lite firmware doesn't have this safe apply feature at the moment) */
        const cts = CancellationTokenSource.createWithTimeout(500);
        const tasks: Promise<unknown>[] = [];

        const shouldWritePattern = diff?.patternId !== undefined;
        const shouldWriteSpeed = diff?.speed !== undefined;
        const shouldWriteRange = rangeDiff.from !== undefined || rangeDiff.to !== undefined;
        const shouldWriteSensation = diff?.sensation !== undefined;

        const applyPattern = () => {
            if (shouldWritePattern && diff.patternId !== undefined)
                tasks.push(this.#client.setPattern(diff.patternId, cts.token));
        };
        const applySpeed = () => {
            if (shouldWriteSpeed && diff.speed !== undefined)
                tasks.push(this.#client.setSpeed(diff.speed, cts.token));
        };
        const applyRange = () => {
            if (shouldWriteRange) {
                if (rangeDiff.from !== undefined) tasks.push(this.#client.setMinDepth(rangeDiff.from, cts.token));
                if (rangeDiff.to !== undefined) tasks.push(this.#client.setMaxDepth(rangeDiff.to, cts.token));
            }
        };
        const applySensation = () => {
            if (shouldWriteSensation && diff.sensation !== undefined)
                tasks.push(this.#client.setSensation(diff.sensation, cts.token));
        };

        const isDecreasingSpeed = newPlayState.speed < oldState.speed;
        const isExpandingRangeAtHigherSpeed = newPlayState.speed > oldState.speed && (newRange.from < oldRange.from || newRange.to > oldRange.to);

        applyPattern();
        if (isDecreasingSpeed) {
            // Drop speed first, then apply motion range changes
            applySpeed();
            applyRange();
        } else if (isExpandingRangeAtHigherSpeed) {
            // Expand motion range at current lower speed BEFORE accelerating
            applyRange();
            applySpeed();
        } else {
            // Neutral case
            applyRange();
            applySpeed();
        }
        applySensation();
        // #endregion

        try { await Promise.all(tasks); }
        catch (error) { 
            // TODO: Revert UI state here?
            console.warn("Failed to update device controls from UI:", error);
        }
        finally { cts.dispose(); }
    }

    async #onBlePattern(patternId: number): Promise<void> {
        if (this.#playState.patternId !== patternId)
            this.#playState = { ...this.#playState, patternId };

        /* Lite firmware uses sensation on basic stroke which creates randomness
         * for my UI I want consistency across firmwares so will disable that by setting sensation to 50 (neutral)
         */
        if (patternId === 0 && this.patterns.get(0)?.name === KnownPatterns.get(0)?.name)
            await this.#client.setSensation(50);
    }

    async #onBleMinDepth(minDepth: number): Promise<void> {
        const currentRange = OssmProviderHelpers.depthAndStrokeToRange(this.#playState.depth, this.playState.stroke);
        if (currentRange.from !== minDepth) {
            const newRange = OssmProviderHelpers.rangeToDepthAndStroke(minDepth, currentRange.to);
            this.#playState = {
                ...this.#playState,
                depth: newRange.depth,
                stroke: newRange.stroke
            };
        }
    }

    async #onBleMaxDepth(maxDepth: number): Promise<void> {
        const currentRange = OssmProviderHelpers.depthAndStrokeToRange(this.#playState.depth, this.playState.stroke);
        if (currentRange.to !== maxDepth) {
            const newRange = OssmProviderHelpers.rangeToDepthAndStroke(currentRange.from, maxDepth);
            this.#playState = {
                ...this.#playState,
                depth: newRange.depth,
                stroke: newRange.stroke
            };
        }
    }

    async #onBleSpeed(speed: number): Promise<void> {
        if (this.#playState.speed !== speed)
            this.#playState = { ...this.#playState, speed };
    }

    async #onBleSensation(sensation: number): Promise<void> {
        if (this.#playState.sensation !== sensation)
            this.#playState = { ...this.#playState, sensation };
    }
}
