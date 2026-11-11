import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { useLocale } from '../../../test/locale';
import BarChart from './BarChart.svelte';

const bars = [
    { key: 'a', name: 'Domaine des Coteaux Imaginaires', count: 10 },
    { key: 'b', name: 'Central Valley', detail: 'Chile', count: 3 }
];

describe('BarChart', () => {
    // A phone has no hover: the whole name of a cut label must show without a tooltip.
    it('gives the whole name and count of the first bar under the chart, before any tap', () => {
        useLocale('fr');

        const { body } = render(BarChart, { props: { bars } });

        expect(body).toMatch(
            /<p[^>]*>(?:\s|<!--[^>]*-->)*Domaine des Coteaux Imaginaires :(?:\s|<!--[^>]*-->)*<span[^>]*>10 bouteilles<\/span>/
        );
    });

    it('names each bar in full for assistive technologies, a shared region with its country', () => {
        useLocale('en');

        const { body } = render(BarChart, { props: { bars } });

        expect(body).toContain('aria-label="Domaine des Coteaux Imaginaires: 10 bottles"');
        expect(body).toContain('aria-label="Central Valley (Chile): 3 bottles"');
    });

    it('keeps each name on one line, cut by the browser where its bar ends', () => {
        useLocale('en');

        const { body } = render(BarChart, { props: { bars } });

        expect(body).toMatch(
            /class="[^"]*\btruncate\b[^"]*"[^>]*>Domaine des Coteaux Imaginaires</
        );
    });

    it('shows the short label of a bar under it, and its whole name under the chart', () => {
        useLocale('en');

        const { body } = render(BarChart, {
            props: { bars: [{ key: 2017, name: '2017', short: '’17', count: 4 }] }
        });

        expect(body).toMatch(/class="[^"]*\btruncate\b[^"]*"[^>]*>’17</);
        expect(body).toContain('aria-label="2017: 4 bottles"');
        expect(body).toMatch(
            /<p[^>]*>(?:\s|<!--[^>]*-->)*2017:(?:\s|<!--[^>]*-->)*<span[^>]*>4 bottles<\/span>/
        );
    });

    // A producer's bar (FEAT-07): its name under the chart opens its page.
    it('links the name under the chart to the page of what the bar counts', () => {
        useLocale('en');

        const { body } = render(BarChart, {
            props: { bars: [{ key: 'p1', name: 'Huet', count: 4, href: '/producers/p1' }] }
        });

        expect(body).toMatch(/<a href="\/producers\/p1"[^>]*>Huet<\/a>:/);
    });
});
