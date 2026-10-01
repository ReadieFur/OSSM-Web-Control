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

export enum SensationType {
    /** Defines that the pattern has no sensation parameter */
    None,
    /** Defines that the pattern has a normal 0-100 sensation parameter */
    Normal,
    /** Defines that the pattern has a 0-50/50-100 sensation parameter (i.e. changing the value past a certain point inverts the pattern sensation) */
    Invertible
}

export interface Pattern {
    name: string;
    description: string;
    sensationType: SensationType;
}

/** For an example implementation, see {@link DummyProvider} */
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
