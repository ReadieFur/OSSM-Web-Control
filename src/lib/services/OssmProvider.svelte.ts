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
    /** The current state of the device (e.g. ready) */
    abstract get state(): State;

    /** The list of available patterns on the device */
    abstract get patterns(): SvelteMap<number, Pattern>;

    /** The maximum update rate in ms the device can handle. Updates sent at a frequency higher than this should be dropped */
    abstract get maxUpdateRateHz(): number;

    /** Internal properties set as readonly so updates are forced to come through as 'playState' and not 'playState.*'
     * This allows providers to use getters to intercept the data without having to use $effect in the code behind
     * The provider should expose back a $state(PlayState)
     */
    abstract playState: Readonly<PlayState>;

    /** Emergency stop function that should bypass all pending action queues and immediately stop the device */
    abstract emergencyStop(): Promise<void>;

    /** Function call to recalibrate the device actuator */
    abstract recalibrate(): Promise<void>;

    /** Called when the UI leaves the control screen, does not wait for return. All resources should be released here */
    abstract disconnect(): Promise<void>;
}
