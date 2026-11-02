<svelte:options runes />

<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import ChoiceGroup from '#lib/components/preferences/ChoiceGroup.svelte';
    import { moveChoice } from '#lib/components/preferences/radio-group.js';
    import { viewOptions } from '#lib/components/wines/wine-list.js';
    import { Check, Palette, Languages } from '@lucide/svelte';
    import { themes } from '#lib/utils/theme-colors.js';
    import { preferences, type ThemeId } from '#lib/stores/preferences.svelte.js';
    import { m } from '#lib/paraglide/messages.js';
    import { getLocale, setLocale } from '#lib/paraglide/runtime.js';
    import { chosenTile, quietButton } from '#lib/components/layout/button-states.js';

    const themeOptions = Object.entries(themes).map(([id, theme]) => ({
        id: id as ThemeId,
        name: theme.name,
        preview: theme.preview
    }));
</script>

<svelte:head>
    <title>{pageTitle(m['navigation.preferences']())}</title>
    <meta name="description" content={m['preferences.description']()} />
</svelte:head>

<div class="container mx-auto py-8 max-w-none w-full px-4 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
    <div class="mb-6">
        <Button href="/wines" variant="outline">
            {m['preferences.back_to_wines']()}
        </Button>
    </div>

    <div class="space-y-6">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">{m['navigation.preferences']()}</h1>
            <p class="text-muted-foreground">{m['preferences.description']()}</p>
        </div>

        <!-- Language Selection -->
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Languages class="h-5 w-5" />
                    {m['preferences.language']()}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ChoiceGroup
                    label={m['preferences.language']()}
                    description={m['preferences.language_description']()}
                    options={[
                        { value: 'en', label: m['preferences.english']() },
                        { value: 'fr', label: m['preferences.french']() }
                    ]}
                    value={getLocale()}
                    onchange={setLocale}
                    chooseWithArrows={false}
                />
            </CardContent>
        </Card>

        <!-- Theme Selection -->
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Palette class="h-5 w-5" />
                    {m['preferences.color_theme']()}
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
                <ChoiceGroup
                    label={m['preferences.theme_mode']()}
                    description={m['preferences.theme_mode_description']()}
                    options={[
                        { value: 'light', label: m['preferences.light']() },
                        { value: 'dark', label: m['preferences.dark']() },
                        { value: 'system', label: m['preferences.auto']() }
                    ]}
                    value={preferences.themeMode}
                    onchange={(mode) => preferences.set('themeMode', mode)}
                >
                    {#if preferences.themeMode === 'system'}
                        <p class="text-xs text-muted-foreground mt-1">
                            {m['preferences.currently_following_system']()}
                            <span class="font-medium"
                                >{preferences.isDark
                                    ? m['preferences.dark']()
                                    : m['preferences.light']()}</span
                            >
                        </p>
                    {/if}
                </ChoiceGroup>

                <!-- Theme Selection -->
                <div>
                    <p id="color-scheme-label" class="text-base font-medium leading-none">
                        {m['preferences.color_scheme']()}
                    </p>
                    <p id="color-scheme-description" class="text-sm text-muted-foreground mb-4">
                        {m['preferences.color_scheme_description']()}
                    </p>

                    <div
                        role="radiogroup"
                        aria-labelledby="color-scheme-label"
                        aria-describedby="color-scheme-description"
                        class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4"
                    >
                        {#each themeOptions as theme (theme.id)}
                            {@const checked = preferences.theme === theme.id}
                            <button
                                role="radio"
                                aria-checked={checked}
                                tabindex={checked ? 0 : -1}
                                class="relative p-4 border-2 rounded-lg {checked
                                    ? `border-primary ${chosenTile}`
                                    : `${quietButton} border-border`}"
                                onclick={() => preferences.set('theme', theme.id)}
                                onkeydown={moveChoice}
                            >
                                <!-- Theme Preview -->
                                <div class="space-y-2">
                                    <div class="flex gap-1 justify-center">
                                        <div
                                            class="w-4 h-4 rounded-full border"
                                            style="background-color: {theme.preview.primary}"
                                        ></div>
                                        <div
                                            class="w-4 h-4 rounded-full border"
                                            style="background-color: {theme.preview.secondary}"
                                        ></div>
                                        <div
                                            class="w-4 h-4 rounded-full border"
                                            style="background-color: {theme.preview.accent}"
                                        ></div>
                                    </div>

                                    <div class="text-sm font-medium">{theme.name()}</div>

                                    {#if checked}
                                        <div class="absolute top-2 right-2">
                                            <Check
                                                class="h-4 w-4 text-primary"
                                                aria-hidden="true"
                                            />
                                        </div>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Current Theme Preview -->
                <div class="border rounded-lg p-4 bg-card">
                    <p class="text-base font-medium leading-none">{m['preferences.preview']()}</p>
                    <div class="mt-2 space-y-2">
                        <div class="flex flex-wrap gap-2 items-center">
                            <Button size="sm">{m['preferences.primary_button']()}</Button>
                            <Button variant="secondary" size="sm"
                                >{m['preferences.secondary']()}</Button
                            >
                            <Button variant="outline" size="sm">{m['preferences.outline']()}</Button
                            >
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Badge>{m['preferences.default_badge']()}</Badge>
                            <Badge variant="secondary">{m['preferences.secondary_badge']()}</Badge>
                            <Badge variant="outline">{m['preferences.outline_badge']()}</Badge>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Additional Preferences Section -->
        <Card>
            <CardHeader>
                <CardTitle>{m['preferences.app_preferences']()}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <ChoiceGroup
                    label={m['preferences.show_wine_images_default']()}
                    description={m['preferences.show_wine_images_description']()}
                    options={[
                        { value: true, label: m['preferences.show']() },
                        { value: false, label: m['preferences.hide']() }
                    ]}
                    value={preferences.showImages}
                    onchange={(show) => preferences.set('showImages', show)}
                />
                <ChoiceGroup
                    label={m['preferences.default_wine_list_view']()}
                    description={m['preferences.default_wine_list_view_description']()}
                    options={viewOptions()}
                    value={preferences.wineListView}
                    onchange={(view) => preferences.set('wineListView', view)}
                />
                <ChoiceGroup
                    label={m['preferences.default_storage_view']()}
                    description={m['preferences.default_storage_view_description']()}
                    options={[
                        { value: 'table', label: m['common.table']() },
                        { value: 'grid', label: m['common.grid']() }
                    ]}
                    value={preferences.storageViewMode}
                    onchange={(view) => preferences.set('storageViewMode', view)}
                />
                <ChoiceGroup
                    label={m['preferences.default_table_layout']()}
                    description={m['preferences.default_table_layout_description']()}
                    options={[
                        { value: true, label: m['preferences.columns']() },
                        { value: false, label: m['preferences.rows']() }
                    ]}
                    value={preferences.containersAsColumns}
                    onchange={(asColumns) => preferences.set('containersAsColumns', asColumns)}
                />
            </CardContent>
        </Card>

        <p class="text-center text-sm text-muted-foreground">
            {m['preferences.version']({ version: __APP_VERSION__ })}
        </p>
    </div>
</div>
