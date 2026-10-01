import { OssmProvider, State, type Pattern, type PlayState } from "./OssmProvider.svelte";
import { SvelteMap } from "svelte/reactivity";
import { KnownPatterns } from "$lib/utils/KnownPatterns";
import { isDevMode } from "$lib/utils/Helpers.svelte";

export class DummyProvider extends OssmProvider {
    override state: State = $state(State.Ready);
    override patterns: SvelteMap<number, Pattern> = new SvelteMap<number, Pattern>(KnownPatterns);
    override readonly maxUpdateRateHz = 1;
    override playState: PlayState = $state({
        patternId: 1,
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
