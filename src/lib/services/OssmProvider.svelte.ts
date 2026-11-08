import { clamp } from "$lib/utils/Helpers.svelte";
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
export interface OssmProvider {
    /** The current state of the device (e.g. ready) */
    get state(): State;

    /** The list of available patterns on the device */
    get patterns(): SvelteMap<number, Pattern>;

    /** The maximum update rate in ms the device can handle. Updates sent at a frequency higher than this should be dropped */
    get maxUpdateRateHz(): number;

    /** Internal properties set as readonly so updates are forced to come through as 'playState' and not 'playState.*'
     * This allows providers to use getters to intercept the data without having to use $effect in the code behind
     * The provider should expose back a $state(PlayState)
     */
    playState: Readonly<PlayState>;

    /** Emergency stop function that should bypass all pending action queues and immediately stop the device */
    emergencyStop(): Promise<void>;

    /** Function call to recalibrate the device actuator */
    recalibrate(): Promise<void>;

    /** Called when the UI leaves the control screen, does not wait for return. All resources should be released here */
    disconnect(): Promise<void>;
}

export class OssmProviderHelpers {
    static getPlayStateChanges(oldState: PlayState, newState: PlayState): Partial<PlayState> {
        const changes: Partial<PlayState> = {};

        // Combine keys from both objects to catch additions, removals, and changes (needed in-case an extended object is passed in)
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const allKeys = new Set([...Object.keys(oldState), ...Object.keys(newState)] as (keyof PlayState)[]);
        for (const key of allKeys)
            if (oldState[key as keyof PlayState] !== newState[key])
                changes[key] = newState[key];
    
        return changes;
    }

    static depthAndStrokeToRange(depth: number, stroke: number): { from: number; to: number } {
        const clampedDepth = clamp(depth, 0, 100);
        const clampedStroke = clamp(clamp(stroke, 0, 100), 0, clampedDepth);

        return {
            from: clampedDepth - clampedStroke,
            to: clampedDepth
        };
    }

    static rangeToDepthAndStroke(from: number, to: number): { depth: number; stroke: number } {
        const clampedTo = clamp(to, 0, 100);
        const clampedFrom = clamp(from, 0, 100);

        return {
            depth: clampedTo,
            stroke: clamp(clampedTo - clampedFrom, 0, 100)
        };
    }
}
