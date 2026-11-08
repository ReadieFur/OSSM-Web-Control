import { type OssmProvider, State, type Pattern, type PlayState } from "./OssmProvider.svelte";
import { SvelteMap } from "svelte/reactivity";
import { KnownPatterns } from "$lib/utils/KnownPatterns";
import { isDevMode } from "$lib/utils/Helpers.svelte";

export class DummyProvider implements OssmProvider {
    state: State = $state(State.Ready);
    patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>(KnownPatterns);
    readonly maxUpdateRateHz = 1;
    playState: PlayState = $state({
        patternId: 1,
        depth: 45,
        stroke: 25,
        speed: 30,
        sensation: 55,
    });

    constructor(doDynamicUpdate: boolean = false) {
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

    emergencyStop(): Promise<void> { return Promise.resolve(); }
    recalibrate(): Promise<void> { return Promise.resolve(); }
    disconnect(): Promise<void> { return Promise.resolve(); }
}
