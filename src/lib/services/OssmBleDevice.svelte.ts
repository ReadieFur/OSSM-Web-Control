import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { type OssmProvider, SensationType, State, type Pattern, type PlayState, type ReactiveSetting } from "./OssmProvider.svelte";
import { CancellationTokenSource, type ICancellationToken, OssmBleClient, type OssmCommonPlayParameters, type OssmMotionSnapshot, type OssmStateSnapshot } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { isDevMode } from "$lib/utils/Helpers.svelte";
import { RadSurface } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { OssmMenu } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { OssmStateString } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { KnownPatterns } from "$lib/utils/KnownPatterns"

const disconnectTimeout = 5000;
const snapshotTimerInterval = 1000;

export class OssmBleDevice implements OssmProvider, Disposable {
    static initializeInstance(device: BluetoothDevice, ct: ICancellationToken): Promise<OssmBleDevice>;
    static initializeInstance(ct: ICancellationToken): Promise<OssmBleDevice>;
    static async initializeInstance(deviceOrCt: BluetoothDevice | ICancellationToken, ct?: ICancellationToken): Promise<OssmBleDevice> {
        let client: OssmBleClient;
        let cancellationToken: ICancellationToken;
        let forgetDevice: () => Promise<void> | undefined;

        // Determine path based on whether the first parameter is the cancellation token
        if ('isCancellationRequested' in deviceOrCt) {
            cancellationToken = deviceOrCt;
            client = await OssmBleClient.pairDevice();
        } else {
            cancellationToken = ct!;
            client = new OssmBleClient(deviceOrCt);
            forgetDevice = deviceOrCt.forget; // TODO: Move this forget into the dispose method on the OSSM BLE library
        }

        cancellationToken.throwIfCancellationRequested();

        const instance = new OssmBleDevice(client);
        // If we time out after this point we will need to clean up the connection, so register a timeout function with the cancellation token.
        const ctCb = cancellationToken.register(() => {
            client.disconnect();
            if (forgetDevice !== undefined) forgetDevice();
        });

        await instance.#begin(cancellationToken);

        ctCb.unregister();
        return instance;
    }

    #hasCalledBegin = false;
    readonly #client: OssmBleClient;
    readonly #onBleConnectSignature = this.#onBleConnect.bind(this);
    readonly #onBleDisconnectSignature = this.#onBleDisconnect.bind(this);
    readonly #onMotionSnapshotSnapshot = this.#onMotionSnapshot.bind(this);
    #disconnectTimeoutHandle?: number;
    #snapshotTimerHandle?: number;
    #playState: PlayState = $state({
        patternId: 0,
        depth: 0,
        stroke: 0,
        speed: 0,
        sensation: 0
    });

    state: State = $state(State.Disconnected);
    patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>();
    readonly maxUpdateRateHz = 3; // TODO: Make this dynamic based on how backed up the queue is
    readonly settings: SvelteSet<ReactiveSetting> = new SvelteSet([
        {
            friendlyName: "Home rail",
            type: "button",
            action: () => this.#recalibrate()
        }
    ]);
    get playState(): Readonly<PlayState> { return this.#playState; }
    set playState(playState: PlayState) { this.#updateFromUi(playState); }

    constructor(client: OssmBleClient) {
        this.#client = client;
        this.#client.debug = isDevMode;
        if (isDevMode) console.log("OssmBleClient:", this.#client);

        this.#client.onSurface[RadSurface.Motion].subscribe(this.#onMotionSnapshotSnapshot);
    }

    [Symbol.dispose](): void {
        this.disconnect();
        this.#client[Symbol.dispose]();
    }

    async #begin(ct?: ICancellationToken): Promise<void> {
        if (this.#hasCalledBegin) throw new DOMException("Begin can only be called once", "OperationError");
        this.#hasCalledBegin = true;

        this.state = State.Reconnecting;

        try {
            if (this.#snapshotTimerHandle)
                window.clearInterval(this.#snapshotTimerHandle);
    
            ct?.throwIfCancellationRequested();
            this.#client.autoReconnect = true;
            await this.#client.begin();
            await this.#client.waitForConnection(ct);
    
            ct?.throwIfCancellationRequested();
            await this.#client.acquireLease(true);
    
            ct?.throwIfCancellationRequested();
            for await (const pattern of this.#client.getPatterns()) {
                ct?.throwIfCancellationRequested();

                /* If the pattern is a known default one, set some custom overrides
                 * (since I know what the parameters do for the default patterns and I can provide better descriptions for them)
                 */
                const knownPattern = KnownPatterns.get(pattern.idx);
                if (knownPattern && knownPattern.name === pattern.name) {
                    this.patterns.set(pattern.idx, knownPattern);
                } else {
                    // Otherwise fall back to display the device descriptor & exposing a normal sensation control
                    this.patterns.set(pattern.idx, {
                        name: pattern.name,
                        description: pattern.description,
                        sensationType: SensationType.Normal
                    });
                }
            }

            // Manual trigger of the connect callback for the setup so things run in the right order
            await this.#onBleConnect();
            this.#client.disconnectedEvent.subscribe(this.#onBleDisconnectSignature);
            this.#client.connectedEvent.subscribe(this.#onBleConnectSignature);
    
            ct?.throwIfCancellationRequested();
            this.#snapshotTimerHandle = window.setInterval(this.#onSnapshotTimerTick.bind(this), snapshotTimerInterval);
        } catch (err) {
            this.state = State.Error;
            throw err;
        }
    }

    async emergencyStop(): Promise<void> {
        this.state = State.EmergencyStop;
        await this.#client.emergencyStop();
        await this.#client.getMotionSnapshot();
    }

    async #recalibrate(): Promise<void> {
        /* To recover from estop on the device we must navigate to strokeEngine which will cause a re-homing of the device
         * If you call homeRail from an estop state it will get stuck in homing.backward forever, and that state cannot be escaped via a navigateTo call
         */
        if (this.state === State.EmergencyStop) {
            this.state = State.Calibrating;
            await this.#client.navigateTo(OssmMenu.StrokeEngine);
            return;
        }

        this.state = State.Calibrating;
        await this.#client.homeRail();
    }

    async disconnect(): Promise<void> {
        this.#client.setSpeed(0);

        this.state = State.Disconnected;

        if (this.#disconnectTimeoutHandle) window.clearInterval(this.#disconnectTimeoutHandle);
        if (this.#snapshotTimerHandle) window.clearInterval(this.#snapshotTimerHandle);

        this.#client.connectedEvent.unsubscribe(this.#onBleConnectSignature);
        this.#client.disconnectedEvent.unsubscribe(this.#onBleDisconnectSignature);

        await this.#client.disconnect();
    }

    async #onBleConnect(): Promise<void> {
        // The state gets set by this function
        await this.#client.setSpeedKnobAsLimit(false);
        await this.#onStateSnapshot(await this.#client.getStateSnapshot());
        await this.#client.getMotionSnapshot();
    }

    #onBleDisconnect() {
        if (!this.#client.autoReconnect)
            return;

        this.state = State.Reconnecting;

        if (this.#disconnectTimeoutHandle)
            return;

        this.#disconnectTimeoutHandle = window.setTimeout(() => {
            if (!this.#client.isConnected) {
                this.state = State.Error; // Set once so its the first thing caught by any watchers
                this.disconnect(); // Dispose of this instance if we have timed out
                this.state = State.Error; // Set again to override disconnect (messy I know)
            }
        }, disconnectTimeout);
    }

    async #onSnapshotTimerTick(): Promise<void> {
        try {
            await Promise.all([
                // I forgot to wrap this one for OssmBleClient.onSurface so I will have to fetch the raw data stream here for now
                // The state telemetry is always streamed, so we don't need to waste time with calling via getStateSnapshot()
                this.#onStateSnapshot(await this.#client.getStateSnapshot()),
    
                // TODO: Periodically fetch motion snapshots from the machine to synchronize with any other external controllers
                // this.#client.getMotionSnapshot(),
    
                // TODO: Analytics
                // this.#client.getAnalogSnapshot()
            ]);
        } catch (err) {
            console.warn("Error on snapshot timer tick:", err);
        }
    }

    async #onStateSnapshot(snapshot: OssmStateSnapshot): Promise<void> {
        const [mainState, subState] = snapshot.state.split('.', 2);

        switch (snapshot.state) {
            case OssmStateString.Idle:
            case OssmStateString.Menu:
            case OssmStateString.MenuIdle:
            case OssmStateString.SimplePenetration:
            case OssmStateString.SimplePenetrationIdle:
            case OssmStateString.SimplePenetrationPreflight:
            case "streaming" as OssmStateString: // I forgot to add this one into the enum :/
            case "streaming.idle" as OssmStateString:
                // Known states we can transition from
                if (this.state === State.EmergencyStop)
                    break;
                await this.#client.navigateTo(OssmMenu.StrokeEngine);
                this.state = State.Calibrating;
                break;
            case OssmStateString.Homing:
            case OssmStateString.HomingForward:
            case OssmStateString.HomingBackward:
            case OssmStateString.StrokeEnginePattern:
                // Currently in calibration
                this.state = State.Calibrating;
                break;
            case OssmStateString.StrokeEngine:
            case OssmStateString.StrokeEngineIdle:
            case OssmStateString.StrokeEnginePreflight:
                // Desired state reached
                this.state = State.Ready;
                break;
            case OssmStateString.Error:
            case OssmStateString.ErrorIdle:
            case OssmStateString.ErrorHelp:
            case OssmStateString.Restart:
                // Invalid/unrecoverable states, dispose instance
                // TODO: Display error message
                this.state = State.Error;
                break;
            case OssmStateString.Update:
            case OssmStateString.UpdateChecking:
            case OssmStateString.UpdateUpdating:
            case OssmStateString.UpdateIdle:
            case OssmStateString.Wifi:
            case OssmStateString.WifiIdle:
            case OssmStateString.Help:
            case OssmStateString.HelpIdle:
                // These states I don't know what to do with since I can't test them myself, so I will leave it empty for now
                break;
        }
    }

    async #onMotionSnapshot(snapshot: OssmMotionSnapshot): Promise<void> {
        this.#playState = {
            patternId: snapshot.pattern,
            depth: snapshot.depth,
            stroke: snapshot.stroke,
            speed: snapshot.speed,
            sensation: snapshot.sensation
        };
    }

    async #updateFromUi(newPlayState: PlayState): Promise<void> {
        const libraryOldState = this.#uiToLibraryState(this.playState);
        const libraryNewState = this.#uiToLibraryState(newPlayState)

        // Optimistically update the UI
        this.#playState = newPlayState;

        // Don't let the request last more than 500ms
        const cts = CancellationTokenSource.createWithTimeout(500);

        /* Always send setSpeed(0) if the speed is 0
         * Due to how my setCommonPlayParameters works, if the values match, nothing will be sent, but for a speed value of 0 we will override this for safety reasons.
         */
        if (libraryOldState.speed === 0 && libraryNewState.speed === 0)
            await this.#client.setSpeed({ value: 0, ct: cts.token });

        try {
            // setCommonPlayParameters internally picks the safest order to apply changes and skips identical values
            this.#client.setCommonPlayParameters({
                newState: libraryNewState,
                oldState: libraryOldState,
                ct: cts.token
            });
        }
        catch (error) {
            console.warn("Failed to update device controls from UI:", error);
            // If the update failed, fetch the current state to refresh the UI
            this.#client.getMotionSnapshot(); // Don't await this call, state update is handled by the onMotionSnapshot callback
        } finally {
            cts.dispose();
        }
    }

    #uiToLibraryState(playState: PlayState): OssmCommonPlayParameters {
        return {
            speed: playState.speed,
            stroke: playState.stroke,
            depth: playState.depth,
            sensation: playState.sensation,
            pattern: playState.patternId,
        };
    }
}
