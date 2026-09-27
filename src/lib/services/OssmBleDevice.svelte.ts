import { SvelteMap } from "svelte/reactivity";
import { OssmProvider, State, type Pattern, type PlayState } from "./OssmProvider.svelte";
import { CancellationTokenSource, type ICancellationToken, OssmBleClient, type OssmCommonPlayParameters, type OssmMotionSnapshot, type OssmStateSnapshot } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { isDevMode } from "$lib/utils/Helpers.svelte";
import { RadSurface } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { OssmMenu } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { OssmStateString } from "$lib/ossm-ble-web/dist/ossm-ble-web";

const snapshotTimerInterval = 1000;

export class OssmBleDevice extends OssmProvider implements Disposable {
    static async initializeInstance(ct: ICancellationToken): Promise<OssmBleDevice> {
        const client = await OssmBleClient.pairDevice();
        ct.throwIfCancellationRequested();

        const instance = new OssmBleDevice(client);
        // If we time out after this point we will need to clean up the connection, so register a timeout function with the cancellation token.
        const ctCb = ct.register(() => client.disconnect());

        await instance.#begin(ct);

        ctCb.unregister();
        return instance;
    }

    readonly #client: OssmBleClient;
    #snapshotTimerHandle?: number;
    #playState: PlayState = $state({
        patternId: 0,
        depth: 0,
        stroke: 0,
        speed: 0,
        sensation: 0
    });

    override state: State = $state(State.Disconnected);
    override patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>();
    get playState(): PlayState { return this.#playState; }
    set playState(playState: PlayState) { this.updateFromUi(playState); }

    constructor(client: OssmBleClient) {
        super();

        this.#client = client;
        this.#client.debug = isDevMode;

        this.#client.onSurface[RadSurface.Motion].subscribe(this.#onMotionSnapshot.bind(this));
    }

    [Symbol.dispose](): void {
    }

    async #begin(ct?: ICancellationToken): Promise<void> {
        this.state = State.Reconnecting;

        if (this.#snapshotTimerHandle)
            window.clearInterval(this.#snapshotTimerHandle);

        ct?.throwIfCancellationRequested();
        this.#client.autoReconnect = true;
        await this.#client.begin();

        ct?.throwIfCancellationRequested();
        await this.#client.acquireLease(true);

        ct?.throwIfCancellationRequested();
        for await (const pattern of this.#client.getPatterns()) {
            ct?.throwIfCancellationRequested();
            this.patterns.set(pattern.idx, {
                name: pattern.name,
                description: pattern.description,
                hasSensation: true,
                canSensationInvert: false
            });
        }

        await this.#onStateSnapshot(await this.#client.getStateSnapshot());

        ct?.throwIfCancellationRequested();
        await this.#client.getMotionSnapshot();

        ct?.throwIfCancellationRequested();
        this.#snapshotTimerHandle = window.setInterval(this.#onSnapshotTimerTick.bind(this), snapshotTimerInterval);

        this.state = State.Ready;
    }

    override async emergencyStop(): Promise<void> {
        await this.#client.emergencyStop();
    }

    override async recalibrate(): Promise<void> {
        await this.#client.homeRail();
    }

    override async disconnect(): Promise<void> {
        this.state = State.Disconnected;
        if (this.#snapshotTimerHandle) window.clearInterval(this.#snapshotTimerHandle);
        await this.#client.disconnect();
    }

    async #onSnapshotTimerTick(): Promise<void> {
        // I forgot to wrap this one for OssmBleClient.onSurface so I will have to fetch the raw data stream here for now
        // The state telemetry is always streamed, so we don't need to waste time with calling via getStateSnapshot()
        this.#onStateSnapshot(await this.#client.getStateSnapshot());

        // TODO: Periodically fetch motion snapshots from the machine to synchronize with any other external controllers
        // await this.#client.getMotionSnapshot();
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
        this.playState = {
            patternId: snapshot.pattern,
            depth: snapshot.depth,
            stroke: snapshot.stroke,
            speed: snapshot.speed,
            sensation: snapshot.sensation
        };
    }

    async updateFromUi(newPlayState: PlayState): Promise<void> {
        const libraryOldState = this.#uiToLibraryState(this.playState);
        const libraryNewState = this.#uiToLibraryState(newPlayState)

        // Optimistically update the UI
        this.#playState = newPlayState;

        // Don't let the request last more than 500ms
        const ct = CancellationTokenSource.createWithTimeout(500);
        try {
            // setCommonPlayParameters internally picks the safest order to apply changes and skips identical values
            this.#client.setCommonPlayParameters({
                newState: libraryNewState,
                oldState: libraryOldState,
                ct: ct.token
            });
        }
        catch (error) {
            console.warn("Failed to update device controls from UI:", error);
        } finally {
            ct.dispose();
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
