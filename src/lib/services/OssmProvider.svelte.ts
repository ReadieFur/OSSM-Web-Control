import { isDevMode } from "$lib/utils/Helpers.svelte";
import { SvelteMap } from "svelte/reactivity";

export enum State {
    Disconnected = "disconnected",
    Reconnecting = "reconnecting",
    Calibrating = "calibrating",
    Ready = "ready",
    Error = "error",
    EmergencyStop = "estop"
}

export interface PlayState {
    patternId: number,
    depth: number,
    stroke: number,
    speed: number,
    sensation: number,
}

export interface Pattern {
    name: string;
    description: string;
    hasSensation: boolean;
    canSensationInvert: boolean;
}

export abstract class OssmProvider {
    abstract get state(): State;
    abstract get patterns(): SvelteMap<number, Pattern>;
    /** Internal properties set as readonly so updates are forced to come through as 'playState' and not 'playState.*'
     * This allows providers to use getters to intercept the data without having to use $effect in the code behind
     * The provider should expose back a $state(PlayState)
     */
    abstract playState: Readonly<PlayState>;
    abstract emergencyStop(): Promise<void>;
    abstract recalibrate(): Promise<void>;
    abstract disconnect(): Promise<void>;
}

export class DummyProvider extends OssmProvider {
    override state: State = $state(State.Ready);
    override patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>([
        [0, { name: "Pattern 1", description: "Lorem ipsum dolor sit amet", hasSensation: true, canSensationInvert: true }],
        [1, { name: "Pattern 2", description: "consectetur adipiscing elit", hasSensation: false, canSensationInvert: false }]
    ]);
    override playState: PlayState = $state({
        patternId: 0,
        depth: 45,
        stroke: 25,
        speed: 30,
        sensation: 55,
    });

    constructor(doDynamicUpdate: boolean = false) {
        super();

        if (isDevMode) {
            // eslint-disable-next-line svelte/no-inspect
            $inspect(this.playState).with((_, playState) => console.log("[DummyProvider] Play state changed: ", playState));
        }

        if (doDynamicUpdate) {
            setTimeout(() => {
                this.playState = {
                    patternId: 1,
                    depth: 20,
                    stroke: 5,
                    speed: 70,
                    sensation: 40,
                };
            }, 2000);
        }
    }

    override emergencyStop(): Promise<void> { return Promise.resolve(); }
    override recalibrate(): Promise<void> { return Promise.resolve(); }
    override disconnect(): Promise<void> { return Promise.resolve(); }
}
