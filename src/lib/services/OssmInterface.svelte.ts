export type State = "disconnected" | "reconnecting" | "connected" | "ready" | "error";

export interface PlayState {
    patternIdx: number,
    depth: number,
    stroke: number,
    speed: number,
    sensation: number,
};

export interface Pattern {
    idx: number;
    name: string;
    description: string;
    hasSensation: boolean;
    canSensationInvert: boolean;
}

export abstract class OssmInterface {
    abstract get state(): State;
    abstract get playState(): PlayState;
    abstract get patterns(): Pattern[];
}

export class DummyOssmDevice extends OssmInterface {
    state: State = $state("ready");
    playState: PlayState = $state({
        patternIdx: 0,
        depth: 45,
        stroke: 15,
        speed: 30,
        sensation: 50,
    });
    patterns: Pattern[] = $state([
        { idx: 0, name: "Pattern 1", description: "Lorem ipsum dolor sit amet", hasSensation: true, canSensationInvert: true },
        { idx: 1, name: "Pattern 2", description: "consectetur adipiscing elit", hasSensation: false, canSensationInvert: false }
    ]);

    constructor(doDynamicUpdate: boolean = false) {
        super();
        if (doDynamicUpdate) {
            setTimeout(() => {
                this.playState = {
                    patternIdx: 1,
                    depth: 20,
                    stroke: 5,
                    speed: 70,
                    sensation: 40,
                };
            }, 2000);
        }
    }
}
