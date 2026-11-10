import { type OssmProvider, State, type Pattern, type PlayState, type ReactiveSetting } from "./OssmProvider.svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
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

    settingNumber = $state(1);
    settings: SvelteSet<ReactiveSetting> = new SvelteSet([
        {
            friendlyName: "Number",
            type: "number",
            get: () => this.settingNumber,
            set: value => this.settingNumber = value,
        },
        {
            friendlyName: "Checkbox",
            type: "boolean",
            get: () => true,
            set: () => {}
        },
        {
            friendlyName: "Button",
            type: "button",
            icon: "linear_scale",
            action: () => console.log("settings: button pressed")
        }
    ]);

    constructor(doDynamicUpdate: boolean = false) {
        if (isDevMode) {
            // eslint-disable-next-line svelte/no-inspect
            $inspect(this.playState).with((_, playState) => console.log("[DummyProvider] Play state changed: ", playState));
        }

        // eslint-disable-next-line svelte/no-inspect
        $inspect(this.settingNumber).with((_, settingNumber) => console.log("[DummyProvider] settingNumber changed: ", settingNumber));
        setTimeout(() => {
            this.settingNumber = 5;
        }, 1500);

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
