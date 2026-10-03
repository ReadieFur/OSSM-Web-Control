import { SensationType, type Pattern } from "$lib/services/OssmProvider.svelte"

// https://github.com/KinkyMakers/OSSM-hardware/blob/b7f01bf6df1be6f3ebf17dc0e31ed64ddf4c15b7/Software/lib/ui/src/Strings.h#L132
// https://github.com/ReadieFur/OSSM-BLE-Web/blob/7f851548533147aac66df9a8f44ef730dbf8a20a/src/patterns.ts#L121
export const KnownPatterns: ReadonlyMap<number, Pattern> = new Map([
    [0, {
        name: "Simple Stroke",
        description: "Acceleration, coasting, deceleration equally split.",
        sensationType: SensationType.None
    }],
    [1, {
        name: "Teasing Pounding",
        description: "Provides a thrusting motion; sensation changes how aggressively the actuator moves in one direction direction, direction can be inverted.",
        sensationType: SensationType.Invertible
    }],
    [2, {
        name: "Robo Stroke",
        description: "Robotic-style strokes; sensation changes how smoothed the motion is.",
        sensationType: SensationType.Normal
    }],
    [3, {
        name: "Half'n'Half",
        description: "Full and half depth strokes alternate; sensation affects how pronounced the half/full depth effect is.",
        sensationType: SensationType.Invertible
    }],
    [4, {
        name: "Deeper",
        description: "Gradually deepens the stroke over a number of cycles; sensation sets how many cycles occur before restarting.",
        sensationType: SensationType.Normal
    }],
    [5, {
        name: "Stop'n'Go",
        description: "Pauses between strokes; sensation adjusts pause duration.",
        sensationType: SensationType.Normal
    }],
    [6, {
        name: "Insist",
        // TODO: Clarify this description
        description: "Modifies length, maintains speed; sensation influences direction.",
        sensationType: SensationType.Normal
    }]
]);
