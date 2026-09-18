<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';

    // Based on: https://troll-winner.com/blog/one-more-dual-range-slider

    interface Props extends HTMLAttributes<HTMLDivElement> {
        from?: number;
        to?: number;
        min?: number;
        max?: number;
        step?: number;
        minGap?: number;
        orientation?: 'horizontal' | 'vertical';
    }

    let {
        from = $bindable(0),
        to = $bindable(100),
        min = 0,
        max = 100,
        step = 1,
        minGap = 0,
        orientation,
        class: className = '',
        style = '',
        ...restProps
    }: Props = $props();

    let fromPercent = $derived.by(() => {
        const rangeDistance = max - min;
        if (rangeDistance <= 0) return 0;
        return ((from - min) / rangeDistance) * 100;
    });

    let toPercent = $derived.by(() => {
        const rangeDistance = max - min;
        if (rangeDistance <= 0) return 100;
        return ((to - min) / rangeDistance) * 100;
    });

    function onFromSliderInput(event: Event & { currentTarget: HTMLInputElement }) {
        let val = Number(event.currentTarget.value);
        if (val > to)
            val = to;
        if (to - val < minGap)
            val = to - minGap;
        from = val;
    }

    function onToSliderInput(event: Event & { currentTarget: HTMLInputElement }) {
        let val = Number(event.currentTarget.value);
        if (from > val)
            val = from;
        if (val - from < minGap)
            val = from + minGap;
        to = val;
    }

    // TODO: Enforce gap immediately
</script>

<div
    class="input-container-range-double {className}"
    data-orientation={orientation}
    style="--range-from-value: {fromPercent}%; --range-to-value: {toPercent}%; {style}"
    {...restProps}
>
    <input
        type="range"
        data-component="from"
        value={from}
        oninput={onFromSliderInput}
        {min}
        {max}
        {step}
        data-styled="false"
    />
    <input
        type="range"
        data-component="to"
        value={to}
        oninput={onToSliderInput}
        {min}
        {max}
        {step}
        data-styled="false"
    />
</div>

<style lang="scss">
.input-container-range-double {
    // Set in script
    --range-from-value: 20%;
    --range-to-value: 80%;

    // TODO: Make this more transparent without getting "muddy"
    $track-background: hsl(from $surface-2 h s l / 0.5);
    $track-fill: hsl(from $accent-1 h s l / 0.5);

    position: relative;
    display: inline-flex;
    flex-wrap: wrap;

    > input[type="range"] {
        position: relative;
        flex: 100%;

        &[data-component="from"] {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 1;
        }
    }

    &:not([data-orientation="vertical"]) {
        > input[type="range"] {
            // Left side
            &[data-component="from"] {
                $offset: calc(100% - var(--range-to-value) + ((var(--range-to-value) - var(--range-from-value)) / 2));
                $handle-offset: 0;
                $left-offset: $offset; //These two would be flipped if direction was right-to-left
                $right-offset: 0;
                clip-path: inset($handle-offset $left-offset $handle-offset $right-offset);

                @include range-track {
                    background: transparent;
                }
            }

            // Right side
            &[data-component="to"]:not(:disabled) {
                @include range-track {
                    background:
                        linear-gradient(
                            to right,
                            $track-background 0%,
                            $track-background var(--range-from-value),
                            $track-fill var(--range-from-value),
                            $track-fill var(--range-to-value),
                            $track-background var(--range-to-value),
                            $track-background 100%
                        ) center / 100% var(--range-track-thickness) no-repeat;
                }
            }
        }
    }

    &[data-orientation="vertical"] {
        // width: fit-content;

        > input[type="range"] {
            @include range-vertical;

            @include range-thumb {
                @include ifWebKit {
                    width: var(--range-track-thickness);
                    height: 1rem;
                }
            }

            height: initial;

            // Bottom side
            &[data-component="from"] {
                $offset: calc(100% - var(--range-to-value) + ((var(--range-to-value) - var(--range-from-value)) / 2));
                $handle-offset: 0;
                $top-offset: 0; //These two would be flipped if direction was top-to-bottom
                $bottom-offset: $offset;
                clip-path: inset($bottom-offset $handle-offset $top-offset $handle-offset);

                @include range-track {
                    background: transparent;
                }
            }

            // Top side
            &[data-component="to"]:not(:disabled) {
                @include range-track {
                    background:
                        linear-gradient(
                            to top,
                            $track-background 0%,
                            $track-background var(--range-from-value),
                            $track-fill var(--range-from-value),
                            $track-fill var(--range-to-value),
                            $track-background var(--range-to-value),
                            $track-background 100%
                        ) center / var(--range-track-thickness) 100% no-repeat;
                }
            }
        }
    }
}
</style>
