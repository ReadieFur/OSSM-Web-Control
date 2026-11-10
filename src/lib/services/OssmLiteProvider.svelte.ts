import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { type OssmProvider, SensationType, State, type Pattern, type PlayState, OssmProviderHelpers, type ReactiveSetting } from "./OssmProvider.svelte";
import { CancellationTokenSource, LiteHomingType, OssmLiteClient, type ICancellationToken, type SingleEvent } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { isDevMode } from "$lib/utils/Helpers.svelte";
import { KnownPatterns } from "$lib/utils/KnownPatterns";

const disconnectTimeout = 5000;

export class OssmLiteProvider implements OssmProvider, Disposable {
    static initializeInstance(device: BluetoothDevice, ct: ICancellationToken): Promise<OssmLiteProvider>;
    static initializeInstance(ct: ICancellationToken): Promise<OssmLiteProvider>;
    static async initializeInstance(deviceOrCt: BluetoothDevice | ICancellationToken, ct?: ICancellationToken): Promise<OssmLiteProvider> {
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

        const instance = new OssmLiteProvider(client);
        const ctCb = cancellationToken.register(() => {
            client.disconnect();
            if (forgetDevice !== undefined) forgetDevice();
        });

        await instance.#begin(cancellationToken);

        ctCb.unregister();
        return instance;
    }

    #hasCalledBegin = false;
    readonly #client: OssmLiteClient;
    readonly maxUpdateRateHz = 8;
    patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>();
    #disconnectTimeoutHandle?: number;

    #eventSubscriptions: { event: SingleEvent, signature: Parameters<SingleEvent['subscribe']>[0] }[] = [];

    #playState: PlayState = $state({
        patternId: 0,
        depth: 0,
        stroke: 0,
        speed: 0,
        sensation: 0
    });

    // These cannot be marked as #private as Svelte cannot watch real private values
    private _railDirectionInverted = $state(false);
    private _maxAcceleration = $state(0);
    private _maxMotorRpm = $state(0);
    private _stepsPerRevolution = $state(0);
    private _pulleyTeeth = $state(0);
    private _beltPitch = $state(0);
    private _speedCurve = $state(0);
    private _homingSpeed = $state(0);
    private _currentSensorLimit = $state(0);
    /* TODO: Make these settings dynamically generated from the reported API config properties (this is supported by Fray-d's API and is the intended way for it to be used)
     * The reason I have not done it that way just yet is because of how I keep my library type-strict. But I do intend to add a .discovered property onto the class for this exact purpose
     */
    readonly settings: SvelteSet<ReactiveSetting> = new SvelteSet([
        {
            type: "label",
            friendlyName: "Changing any of these settings pauses motion",
            italic: true,
            bold: false
        },
        {
            type: "label",
            friendlyName: "Motor presets"
        },
        {
            friendlyName: "57AIM30",
            type: "button",
            action: () => this.#setCommonOptions(1500, 800).finally(() => this.#refreshStrokeEngine()).catch(console.error)
        },
        {
            friendlyName: "60AIM40",
            type: "button",
            action: () => this.#setCommonOptions(1500, 800).finally(() => this.#refreshStrokeEngine()).catch(console.error)
        },
        {
            friendlyName: "IHSV",
            type: "button",
            action: () => this.#setCommonOptions(3500, 2000).finally(() => this.#refreshStrokeEngine()).catch(console.error)
        },
        {
            type: "label",
            friendlyName: "Advanced"
        },
        {
            friendlyName: "Max motor RPM",
            type: "number",
            get: () => this._maxMotorRpm,
            set: v => this.#uiUpdateSettingCommon(
                () => this._maxMotorRpm = v,
                () => this.#client.getMaxMotorRpm,
                () => this.#client.setMaxMotorRpm
            )
        },
        {
            friendlyName: "Steps per revolution",
            type: "number",
            get: () => this._stepsPerRevolution,
            set: v => this.#uiUpdateSettingCommon(
                () => this._stepsPerRevolution = v,
                () => this.#client.getStepsPerRevolution,
                () => this.#client.setStepsPerRevolution
            )
        },
        {
            friendlyName: "Max acceleration",
            type: "number",
            get: () => this._maxAcceleration,
            set: v => this.#uiUpdateSettingCommon(
                () => this._maxAcceleration = v,
                () => this.#client.getMaxAcceleration,
                () => this.#client.setMaxAcceleration
            )
        },
        {
            friendlyName: "Pulley teeth #",
            type: "number",
            get: () => this._pulleyTeeth,
            set: v => this.#uiUpdateSettingCommon(
                () => this._pulleyTeeth = v,
                () => this.#client.getPulleyTeeth,
                () => this.#client.setPulleyTeeth
            )
        },
        {
            friendlyName: "Belt pitch",
            type: "number",
            get: () => this._beltPitch,
            set: v => this.#uiUpdateSettingCommon(
                () => this._beltPitch = v,
                () => this.#client.getBeltPitch,
                () => this.#client.setBeltPitch
            )
        },
        {
            friendlyName: "Speed curve",
            type: "number",
            get: () => this._speedCurve,
            set: v => this.#uiUpdateSettingCommon(
                () => this._speedCurve = v,
                () => this.#client.getSpeedCurve,
                () => this.#client.setSpeedCurve
            )
        },
        {
            friendlyName: "Homing speed",
            type: "number",
            get: () => this._homingSpeed,
            set: v => this.#uiUpdateSettingCommon(
                () => this._homingSpeed = v,
                () => this.#client.getHomingSpeed,
                () => this.#client.setHomingSpeed
            )
        },
        {
            friendlyName: "Current sensor limit",
            type: "number",
            get: () => this._currentSensorLimit,
            set: v => this.#uiUpdateSettingCommon(
                () => this._currentSensorLimit = v,
                () => this.#client.getCurrentPosition,
                () => this.#client.setCurrentSensorLimit
            )
        },
        {
            friendlyName: "Invert rail direction (re-homes & restarts device)",
            type: "boolean",
            get: () => this._railDirectionInverted,
            set: async v => {
                try { await this.#client.setInvertRailDirection(v); }
                catch (err) {
                    console.error("Failed to change rail direction", err);
                    await this.#client.getInvertRailDirection().catch(console.error);
                    return;
                }

                try { this.disconnect(); }
                catch (err) {
                    console.log(err);
                    this.state = State.Error;
                }
            }
        },
        // TODO: Use create a recalibrate button by switching modes and reading off of the legacy API to check while it is in the homing state
    ]);

    state: State = $state(State.Disconnected);
    get playState(): Readonly<PlayState> { return this.#playState; }
    set playState(playState: PlayState) { this.#updateFromUi(playState); }

    constructor(client: OssmLiteClient) {
        this.#client = client;
        this.#client.debug = isDevMode;
        if (isDevMode) console.log("OssmLiteClient:", this.#client);

        this.#setupSubscription(this.#client.on.pattern, this.#onBlePattern.bind(this));
        this.#setupSubscription(this.#client.on.minDepth, this.#onBleMinDepth.bind(this));
        this.#setupSubscription(this.#client.on.maxDepth, this.#onBleMaxDepth.bind(this));
        this.#setupSubscription(this.#client.on.speed, this.#onBleSpeed.bind(this));
        this.#setupSubscription(this.#client.on.sensation, this.#onBleSensation.bind(this));
        this.#setupSubscription(this.#client.on.invertRailDirection, v => this._railDirectionInverted = v);
        this.#setupSubscription(this.#client.on.maxAcceleration, v => this._maxAcceleration = v);
        this.#setupSubscription(this.#client.on.maxMotorRpm, v => this._maxMotorRpm = v);
        this.#setupSubscription(this.#client.on.stepsPerRevolution, v => this._stepsPerRevolution = v);
        this.#setupSubscription(this.#client.on.pulleyTeeth, v => this._pulleyTeeth = v);
        this.#setupSubscription(this.#client.on.beltPitch, v => this._beltPitch = v);
        this.#setupSubscription(this.#client.on.speedCurve, v => this._speedCurve = v);
        this.#setupSubscription(this.#client.on.homingSpeed, v => this._homingSpeed = v);
        this.#setupSubscription(this.#client.on.currentSensorLimit, v => this._currentSensorLimit = v);
    }

    [Symbol.dispose](): void {
        this.disconnect();
        this.#client[Symbol.dispose]();
    }

    #setupSubscription<T extends unknown[]>(event: SingleEvent<T>, callback: Parameters<SingleEvent<T>['subscribe']>[0]): void {
        event.subscribe(callback);
        this.#eventSubscriptions.push({
            event,
            signature: callback
        });
    }

    async #begin(ct?: ICancellationToken): Promise<void> {
        if (this.#hasCalledBegin) throw new DOMException("Begin can only be called once", "OperationError");
        this.#hasCalledBegin = true;

        this.state = State.Reconnecting;

        try {
            ct?.throwIfCancellationRequested();
            this.#client.autoReconnect = true;
            await this.#client.begin();
            await this.#client.waitForConnection(ct);

            await this.#client.setHomingType(LiteHomingType.Default); // Configure automatic homing which means we don't need to manually specify the rail length
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

            await this.#onBleConnect(ct);
            this.#setupSubscription(this.#client.connectedEvent, this.#onBleConnect.bind(this));
            this.#setupSubscription(this.#client.disconnectedEvent, this.#onBleDisconnect.bind(this));
        } catch (err) {
            this.state = State.Error;
            throw err;
        }
    }

    async disconnect(): Promise<void> {
        this.#client.setSpeed(0);

        this.state = State.Disconnected;

        if (this.#disconnectTimeoutHandle) window.clearInterval(this.#disconnectTimeoutHandle);

        for (const subscription of this.#eventSubscriptions)
            subscription.event.unsubscribe(subscription.signature);
        this.#eventSubscriptions = [];

        await this.#client.disconnect();
    }

    async #onBleConnect(ct?: ICancellationToken): Promise<void> {
        /* Let all of these operations run in parallel and wait for all to complete/fail
         * Backend lib queues them but from a consumer standpoint they should be run like this
         */
        const results = await Promise.allSettled([
            // These calls trigger the notify callbacks where the client-side values are then set
            this.#client.getPattern(ct).then(r => this.#client.setPattern(r, ct)), // Force into stroke engine mode (weird quirk with reconnects it seems to get stuck unable to move unless pattern is read/set?)
            this.#client.getMinDepth(ct),
            this.#client.getMaxDepth(ct),
            this.#client.getSpeed(ct),
            this.#client.getSensation(ct),
            this.#client.getInvertRailDirection(ct),
            this.#client.getMaxAcceleration(ct),
            this.#client.getMaxMotorRpm(ct),
            this.#client.getStepsPerRevolution(ct),
            this.#client.getPulleyTeeth(ct),
            this.#client.getBeltPitch(ct),
            this.#client.getSpeedCurve(ct),
            this.#client.getHomingSpeed(ct)
        ]);

        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === "rejected")
            .map(r => r.reason?.message || String(r.reason));

        if (errors.length > 0)
            throw new DOMException(`One or more fetch operations failed: ${errors.join("; ")}`, "OperationError");

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

    async #uiUpdateSettingCommon<T>(
        localSetter: () => T,
        liteGetter: () => ((ct?: ICancellationToken) => Promise<T>),
        liteSetter: () => ((value: T, ct?: ICancellationToken) => Promise<void>)
    ): Promise<void> {
        /* The device will only notify listeners if the value written made a change (i.e. was valid and different from the stored one)
         * For this reason we call the getter again to refresh the UI with the value stored on device in-case what was written was invalid
         * As the device only does fast writes and does not report back if the set value was invalid
         * We must set the local state first so that when the remote state is fetched it forces a UI update (since this isn't two-way binding, it could be if I was able to reference 'this' inside a real get/set function)
         * It's a mess yes I know, but for now it's all I can really be arsed to deal with (I don't like UI work ><)
         */

        const value = localSetter();

        const cts = CancellationTokenSource.createWithTimeout(1000);
        try {
            let setterSuccessful = false;
            try {
                await liteSetter()(value, cts.token);
                setterSuccessful = true;
            } catch (err) {
                console.warn("Failed to update setting from UI", err);
            }
    
            if (setterSuccessful) {
                try {
                    await this.#refreshStrokeEngine(cts.token);
                } catch (err) {
                    console.error("Failed to reload StrokeEngine state", err);
                    this.state = State.Error; // UI disposes after this is set
                    return;
                }
            }

            try {
                await liteGetter()(cts.token);
            } catch (err) {
                console.warn("Failed to fetch device setting", err);
            }
        } finally {
            cts.dispose();
        }
    }

    async #setCommonOptions(
        maxMotorRpm: number,
        stepsPerRevolution: number,
        maxAcceleration = 50000,
        pulleyTeeth = 20,
        beltPitch = 2
    ): Promise<void> {
        const results = await Promise.allSettled([
            this.#client.setMaxMotorRpm(maxMotorRpm),
            this.#client.setStepsPerRevolution(stepsPerRevolution),
            this.#client.setMaxAcceleration(maxAcceleration),
            this.#client.setPulleyTeeth(pulleyTeeth),
            this.#client.setBeltPitch(beltPitch)
        ]);

        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === "rejected")
            .map(r => r.reason?.message || String(r.reason));

        if (errors.length > 0)
            throw new DOMException(`One or more set operations failed: ${errors.join("; ")}`, "OperationError");
    }

    async #refreshStrokeEngine(ct?: ICancellationToken): Promise<void> {
        // Get a snapshot of the current StrokeEngine state
        const snapshot = { ...this.playState };

        // Force the device to be paused at this point
        await this.#client.setSpeed(0, ct);

        /* Trigger a state switch into AP mode (if already in AP mode this stops the device)
         * This is a workaround to: send go:menu to the legacy endpoint 522b443a-4f53-534d-1000-420badbabe69 to exit the current mode and re-apply any changed settings
         */
        await this.#client.writeAdvancedPenetrationConfig({ speed: { value: 0 } }, ct);

        // Go back to StrokeEngine mode
        await this.#client.setPattern(snapshot.patternId, ct);

        // Re-write settings from the snapshot
        // Ignore restoring speed right now (switching modes causes the device to stop and jump so for safety we will not restore speed)
        // this.#client.setSpeed(snapshot.speed);
        const range = OssmProviderHelpers.depthAndStrokeToRange(snapshot.depth, snapshot.stroke);
        await this.#client.setMinDepth(range.from, ct);
        await this.#client.setMaxDepth(range.to, ct);
        await this.#client.setSensation(snapshot.sensation, ct);
    }
}
