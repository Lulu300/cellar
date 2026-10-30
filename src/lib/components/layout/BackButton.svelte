<script lang="ts">
    import { afterNavigate, goto } from '$app/navigation';
    import { Button } from '#lib/components/ui/button/index.js';
    import { m } from '#lib/paraglide/messages.js';

    // Back goes to the page of Cellar that led here. A page opened in a new tab or from another
    // site has none: history.back() would do nothing or leave Cellar, so Back goes to the list of
    // the wines. After the browser's Back or Forward, the page before this one is unknown: the list
    // again. A new sort or page of a table replaces the entry of its page and changes nothing.
    let cameFromCellar = false;

    afterNavigate(({ from, to, type }) => {
        if (from?.url.pathname === to?.url.pathname) return;
        cameFromCellar = from !== null && type !== 'popstate';
    });
</script>

<Button onclick={() => (cameFromCellar ? history.back() : goto('/wines'))} variant="outline">
    ← {m['common.back']()}
</Button>
