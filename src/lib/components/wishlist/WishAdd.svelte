<script lang="ts">
    import { onDestroy } from 'svelte';
    import { Plus, X } from '@lucide/svelte';
    import { page } from '$app/state';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Card, CardContent } from '#lib/components/ui/card/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import FormField from '#lib/components/forms/FormField.svelte';
    import { ImageUploads } from '#lib/components/forms/image-uploads.js';
    import LongTextarea from '#lib/components/forms/LongTextarea.svelte';
    import PhotoField from '#lib/components/forms/PhotoField.svelte';
    import { iconButton, refocus } from '#lib/components/layout/button-states.js';
    import { NAME_MAX_LENGTH } from '#lib/shared/schemas/common.js';
    import { addWholeWish } from './wishes.js';

    type Wine = { id: string; name: string; producer: string | null };

    /** The most wines that the field suggests. */
    const MAX_SUGGESTIONS = 5;

    /**
     * The form that adds a wish, whole, in the order it is read: the photo of the label, the name,
     * the note and the quantity. The name typed suggests the wines of the cellar that match: one
     * chosen makes the wish a wish for that wine, which shows its own photos; otherwise the name
     * becomes a text wish.
     */
    let { wines }: { wines: Wine[] } = $props();

    const formId = $props.id();
    let text = $state('');
    let chosen = $state.raw<Wine | null>(null);
    let note = $state('');
    // A number input binds a number, or null once emptied
    let quantity = $state<number | null>(null);
    let imageId = $state('');
    let file = $state<File | null>(null);
    let previewUrl = $state('');
    let saving = $state(false);
    let nameField = $state<HTMLInputElement | null>(null);
    let changeButton = $state<HTMLButtonElement | null>(null);
    let submitButton = $state<HTMLButtonElement | null>(null);

    const uploads = new ImageUploads();
    onDestroy(() => uploads.close());

    // Loaded by the root layout: the wines already on the list
    const wishedWines: Record<string, string> = $derived(page.data.wishedWines ?? {});

    // The wines whose name and producer hold every word typed, as the search of the wine list does
    const suggestions = $derived.by(() => {
        const words = text.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        return wines
            .filter((wine) => {
                const label = `${wine.name} ${wine.producer ?? ''}`.toLowerCase();
                return words.every((word) => label.includes(word));
            })
            .slice(0, MAX_SUGGESTIONS);
    });

    // The field that takes the place of the other gets the focus, which would otherwise fall back
    // to the page.
    async function choose(wine: Wine | null) {
        chosen = wine;
        await refocus(() => (wine ? changeButton : nameField));
    }

    // A photo chosen for a name stays when a wine of the cellar is added: it is for the next name.
    async function add(event: SubmitEvent) {
        event.preventDefault();
        const wine = chosen;
        if (!wine && !text.trim()) return;
        saving = true;
        const saved = await addWholeWish(uploads, { wine, text, file, imageId, note, quantity });
        saving = false;
        // The button, disabled while saving, lost the focus: back to it after a refusal, or to the
        // name of the next wish, since the emptied form keeps the button disabled.
        if (!saved) return refocus(() => submitButton);
        text = note = '';
        quantity = chosen = null;
        if (!wine) {
            imageId = previewUrl = '';
            file = null;
        }
        await refocus(() => nameField);
    }
</script>

<Card class="mb-6 py-0">
    <CardContent class="p-4">
        <h2 id="{formId}-title" class="mb-4 text-lg font-semibold">
            {m['wishlist.add_label']()}
        </h2>
        <form
            aria-labelledby="{formId}-title"
            class="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
            onsubmit={add}
        >
            <!-- Hidden, not removed, while a wine is chosen: the photo kept for the next name
                 keeps its preview, which PhotoField frees when it goes. -->
            <div>
                <div class={chosen ? 'hidden' : ''}>
                    <PhotoField
                        label={m['wishlist.photo']()}
                        hint={m['wishlist.photo_hint']()}
                        bind:imageId
                        bind:file
                        bind:previewUrl
                    />
                </div>
                {#if chosen}
                    <div class="space-y-2">
                        <p class="text-sm font-medium">{m['wishlist.photo']()}</p>
                        <p class="text-sm text-muted-foreground">{m['wishlist.wine_photos']()}</p>
                    </div>
                {/if}
            </div>

            <div class="space-y-4">
                {#if chosen}
                    <div role="group" aria-labelledby="{formId}-chosen" class="space-y-2">
                        <p id="{formId}-chosen" class="text-sm font-medium">
                            {m['forms.wine_name']()}
                        </p>
                        <div
                            class="flex items-center justify-between gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-3"
                        >
                            <span>
                                {chosen.name}
                                {#if chosen.producer}
                                    <span class="text-muted-foreground">· {chosen.producer}</span>
                                {/if}
                            </span>
                            <button
                                type="button"
                                class={iconButton}
                                title={m['wishlist.change_wine']()}
                                aria-label={m['wishlist.change_wine']()}
                                bind:this={changeButton}
                                onclick={() => choose(null)}
                            >
                                <X class="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                {:else}
                    <FormField
                        label="{m['forms.wine_name']()} *"
                        id="{formId}-text"
                        hint={m['wishlist.add_hint']()}
                    >
                        <Input
                            id="{formId}-text"
                            bind:ref={nameField}
                            bind:value={text}
                            maxlength={NAME_MAX_LENGTH}
                            autocomplete="off"
                            placeholder={m['wishlist.add_placeholder']()}
                        />
                    </FormField>

                    {#if suggestions.length > 0}
                        <section aria-labelledby="{formId}-suggestions">
                            <h3 id="{formId}-suggestions" class="mb-1 text-sm font-medium">
                                {m['wishlist.your_wines']()}
                            </h3>
                            <ul class="flex flex-col gap-1">
                                {#each suggestions as wine (wine.id)}
                                    {@const wished = !!wishedWines[wine.id]}
                                    <li>
                                        <Button
                                            variant="outline"
                                            class="h-auto w-full justify-between gap-2 py-2 text-left whitespace-normal"
                                            disabled={saving || wished}
                                            onclick={() => choose(wine)}
                                        >
                                            <span>
                                                {wine.name}
                                                {#if wine.producer}
                                                    <span class="text-muted-foreground"
                                                        >· {wine.producer}</span
                                                    >
                                                {/if}
                                            </span>
                                            <span class="shrink-0 text-xs text-muted-foreground">
                                                {wished
                                                    ? m['wishlist.on_the_list']()
                                                    : m['wishlist.choose']()}
                                            </span>
                                        </Button>
                                    </li>
                                {/each}
                            </ul>
                        </section>
                    {/if}
                {/if}

                <FormField label={m['common.notes']()} id="{formId}-note">
                    <LongTextarea id="{formId}-note" bind:value={note} rows={3} />
                </FormField>

                <FormField
                    label={m['wishlist.quantity']()}
                    id="{formId}-quantity"
                    hint={m['wishlist.quantity_hint']()}
                >
                    <Input
                        id="{formId}-quantity"
                        bind:value={quantity}
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        inputmode="numeric"
                        class="w-32"
                    />
                </FormField>

                <div class="flex justify-end">
                    <Button
                        type="submit"
                        bind:ref={submitButton}
                        disabled={saving || (!chosen && !text.trim())}
                    >
                        <Plus class="mr-2 h-4 w-4" aria-hidden="true" />
                        {m['wishlist.add_wish']()}
                    </Button>
                </div>
            </div>
        </form>
    </CardContent>
</Card>
