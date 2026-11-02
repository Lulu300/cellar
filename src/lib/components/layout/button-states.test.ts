import { describe, expect, it } from 'vitest';
import { buttonVariants } from '#lib/components/ui/button/index.js';
import { focusRing, iconButton, quietButton } from './button-states.js';

const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const;
const classesOf = (variant: (typeof variants)[number]) => buttonVariants({ variant }).split(' ');

/** The opacity of a fill class such as `bg-secondary/80`, 100 without one. */
const opacity = (fill: string) => Number(fill.split('/')[1] ?? 100);

describe('the hover of a button (UI-33)', () => {
    it.each(variants)('does not fade the fill of the %s variant', (variant) => {
        const classes = classesOf(variant);
        for (const mode of ['', 'dark:']) {
            for (const fill of classes.filter((c) => c.startsWith(`${mode}bg-`))) {
                const colour = fill.slice(`${mode}bg-`.length).split('/')[0];
                // A fill drawn more transparent on hover fades into the surface under it: the
                // bottles count of a wine card hardly changed (1.02:1).
                for (const hover of classes.filter((c) =>
                    c.startsWith(`${mode}hover:bg-${colour}/`)
                )) {
                    expect(opacity(hover), `${fill} ${hover}`).toBeGreaterThan(opacity(fill));
                }
            }
        }
    });

    it.each(variants)('keeps the hover of the %s variant in dark mode', (variant) => {
        const classes = classesOf(variant);
        // A dark fill class outweighs the plain hover class: the destructive button had none.
        if (classes.some((c) => c.startsWith('dark:bg-'))) {
            expect(classes.some((c) => c.startsWith('dark:hover:bg-'))).toBe(true);
        }
    });
});

describe('the keyboard focus of a button (UI-33)', () => {
    it.each(variants)('draws the full ring of the theme on the %s variant', (variant) => {
        const classes = classesOf(variant);
        expect(classes).toContain('focus-visible:ring-ring');
        expect(
            classes.filter((c) => c.startsWith('focus-visible:ring-') && c.includes('/'))
        ).toEqual([]);
    });

    it('draws the same ring on the buttons made by hand', () => {
        for (const classes of [quietButton, iconButton]) {
            expect(classes.split(' ')).toEqual(expect.arrayContaining(focusRing.split(' ')));
        }
    });
});

describe('a quiet button made by hand (UI-33)', () => {
    it('takes no hover while disabled', () => {
        expect(quietButton.split(' ')).toContain('disabled:pointer-events-none');
    });
});
