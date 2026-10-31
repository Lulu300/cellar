<script lang="ts">
    import { tick } from 'svelte';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { m } from '#lib/paraglide/messages.js';

    type Option = { id: string; name: string };
    /** A line of the list: an option, or one of the actions around them. */
    type Entry = { label: string; choose: () => void; class: string };

    let {
        options = [],
        value = $bindable(''),
        placeholder,
        allowCreate = false,
        onCreate = null,
        isLoading = false,
        disabled = false,
        valueField = 'name',
        autoFocus = true,
        name,
        id
    }: {
        options?: Option[];
        value?: string;
        placeholder?: string;
        allowCreate?: boolean;
        onCreate?: ((name: string) => Promise<Option>) | null;
        isLoading?: boolean;
        disabled?: boolean;
        /** 'name' binds the name of the selected option, 'id' its id. */
        valueField?: 'name' | 'id';
        /** Whether focusing the input opens the list. */
        autoFocus?: boolean;
        /** The name under which a native form receives the value. */
        name?: string;
        /** The id of the search field, for a label to name it. */
        id?: string;
    } = $props();

    const uid = $props.id();
    const listId = `${uid}-list`;
    const optionId = (index: number) => `${uid}-option-${index}`;
    const newItemMissingId = `${uid}-new-item-missing`;

    let searchTerm = $state('');
    let showNewInput = $state(false);
    let newItemName = $state('');
    // Add is greyed without a name: a line says why, before any click. A disabled list greys the
    // whole field, which says it.
    const newItemMissing = $derived(!newItemName.trim() && !disabled);
    let isCreating = $state(false);
    let isOpen = $state(false);
    /** The entry that the arrow keys moved to, which Enter chooses; -1 for none. */
    let activeIndex = $state(-1);

    let inputElement = $state<HTMLInputElement | null>(null);
    let dropdownPosition = $state({ top: 0, left: 0, width: 200 });

    const searchPlaceholder = $derived(placeholder ?? m['placeholders.search_or_select']());

    const filteredOptions = $derived(
        options.filter((option) => option?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const showDropdown = $derived(
        isOpen && (filteredOptions.length > 0 || (!!searchTerm.trim() && allowCreate))
    );

    const entries = $derived.by(() => {
        const list: Entry[] = [];
        if (value) {
            list.push({
                label: m['common.clear_selection'](),
                choose: clearSelection,
                class: 'text-muted-foreground border-b border-border/20'
            });
        }
        for (const option of filteredOptions) {
            list.push({
                label: option.name,
                choose: () => selectOption(option),
                class: 'text-popover-foreground border-b border-border/20 last:border-b-0'
            });
        }
        if (allowCreate && onCreate) {
            if (filteredOptions.length === 0 && searchTerm.trim() && !findOption(searchTerm)) {
                list.push({
                    label: m['forms.add_search_as_new']({ name: searchTerm.trim() }),
                    choose: handleCreateFromSearch,
                    class: 'text-primary-text font-medium'
                });
            }
            list.push({
                label: m['forms.add_new_item'](),
                choose: openNewInput,
                class: 'text-popover-foreground border-t border-border'
            });
        }
        return list;
    });

    // A screen reader follows the active entry while the focus stays in the input, which keeps it
    // inside the focus trap of a dialog although the list is moved out of it.
    const activeId = $derived(
        showDropdown && activeIndex >= 0 && activeIndex < entries.length
            ? optionId(activeIndex)
            : undefined
    );

    const displayValue = $derived.by(() => {
        if (!value) return '';
        if (valueField === 'id') {
            // Nothing to show for an id until the options that name it have loaded.
            return options.find((option) => option?.id === value)?.name ?? '';
        }
        return value;
    });

    // A native form hears of each value chosen, as from a field of its own: it can then forget
    // the error that a check left on this one.
    let hiddenInput = $state<HTMLInputElement>();
    $effect(() => {
        void value;
        hiddenInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // The value whose name the input shows. A value set from outside, by a prefilled form or a
    // parent that derives it, replaces the text once its name is known; typing does not, as it
    // clears the value with this one.
    let shownValue = '';
    $effect.pre(() => {
        if (value === shownValue || (value && !displayValue)) return;
        searchTerm = displayValue;
        shownValue = value;
    });

    // The list scrolls, so the entry reached with the arrows must be brought into view.
    $effect(() => {
        if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
    });

    function close() {
        isOpen = false;
        activeIndex = -1;
    }

    function findOption(name: string) {
        const wanted = name.trim().toLowerCase();
        return options.find((option) => option?.name?.toLowerCase() === wanted);
    }

    function selectOption(option: Option) {
        value = shownValue = valueField === 'id' ? option.id : option.name;
        searchTerm = option.name;
        close();
    }

    function clearSelection() {
        value = shownValue = '';
        searchTerm = '';
        close();
    }

    function chooseEntry(index: number) {
        if (disabled || isCreating) return;
        entries[index]?.choose();
    }

    /** Selects the option of that name (in any case), or creates it. False if neither happened. */
    async function selectOrCreate(name: string): Promise<boolean> {
        const existingOption = findOption(name);
        if (existingOption) {
            selectOption(existingOption);
            return true;
        }
        if (!onCreate) return false;

        try {
            isCreating = true;
            // The parent adds the new item to the options.
            const newItem = await onCreate(name.trim());
            if (newItem) {
                selectOption(newItem);
                return true;
            }
        } catch {
            // createReference told the user why the server refused; the field keeps what was typed.
        } finally {
            isCreating = false;
        }
        return false;
    }

    function openNewInput() {
        showNewInput = true;
        newItemName = '';
        close();
    }

    /** Goes back from the name of a new item to the search field, where the keyboard was. */
    async function closeNewInput() {
        showNewInput = false;
        newItemName = '';
        await tick();
        inputElement?.focus();
        // Focusing the field opens the list when autoFocus is on; the user has just left it.
        close();
    }

    async function handleAddNew() {
        if (!newItemName.trim()) return;
        if (await selectOrCreate(newItemName)) await closeNewInput();
    }

    async function handleCreateFromSearch() {
        if (searchTerm.trim()) await selectOrCreate(searchTerm);
    }

    // Reset function for external use
    export function reset() {
        value = shownValue = '';
        searchTerm = '';
        close();
        showNewInput = false;
        newItemName = '';
    }

    /** Moves the active entry by one step, round the list, and opens it if needed. */
    function moveActive(step: 1 | -1) {
        isOpen = true;
        const count = entries.length;
        if (!showDropdown || !count) return;
        if (activeIndex < 0) activeIndex = step > 0 ? 0 : count - 1;
        else activeIndex = (activeIndex + step + count) % count;
    }

    function handleKeydown(event: KeyboardEvent) {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                moveActive(event.key === 'ArrowDown' ? 1 : -1);
                break;
            case 'Home':
            case 'End':
                // Without an active entry, these keys move the caret in the text.
                if (!activeId) return;
                event.preventDefault();
                activeIndex = event.key === 'Home' ? 0 : entries.length - 1;
                break;
            case 'Enter':
                event.preventDefault();
                if (activeId) chooseEntry(activeIndex);
                else chooseTypedName();
                break;
            case 'Escape':
                // Escape closes the list only, not the dialog that holds the field.
                if (showDropdown) event.stopPropagation();
                close();
                searchTerm = displayValue;
                break;
        }
    }

    /** Enter without an active entry: the exact name typed, the only match, or a new item. */
    function chooseTypedName() {
        const exactMatch = filteredOptions.find(
            (opt) => opt.name.toLowerCase() === searchTerm.trim().toLowerCase()
        );
        if (exactMatch) {
            selectOption(exactMatch);
        } else if (filteredOptions.length === 1) {
            selectOption(filteredOptions[0]);
        } else if (searchTerm.trim() && filteredOptions.length === 0 && allowCreate && onCreate) {
            handleCreateFromSearch();
        }
    }

    // Leaving the field, with Tab or a click elsewhere, closes the list and puts back the name of
    // the chosen value, or nothing if none was chosen. A click on the list does not blur the
    // field, as the list keeps the focus away from itself.
    function handleBlur() {
        close();
        searchTerm = displayValue;
    }

    // The list is fixed under the input, so that a dialog or a scrolling parent does not clip it.
    function updateDropdownPosition() {
        if (!inputElement) return;
        const rect = inputElement.getBoundingClientRect();
        dropdownPosition = { top: rect.bottom + 4, left: rect.left, width: rect.width };
    }

    $effect(() => {
        if (!isOpen) return;
        updateDropdownPosition();
        document.addEventListener('scroll', updateDropdownPosition, true);
        window.addEventListener('resize', updateDropdownPosition);
        return () => {
            document.removeEventListener('scroll', updateDropdownPosition, true);
            window.removeEventListener('resize', updateDropdownPosition);
        };
    });

    /** Moves the list to the end of the body, above the dialogs. */
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                node.remove();
            }
        };
    }
</script>

<div class="space-y-2 relative">
    {#if name}
        <input bind:this={hiddenInput} type="hidden" {name} {value} {disabled} />
    {/if}
    {#if isLoading}
        <div class="text-sm text-muted-foreground">{m['admin.loading']()}</div>
    {:else if showNewInput}
        <div class="space-y-2">
            <!-- The user asked for this field from the list: the keyboard goes straight to it. -->
            <Input
                bind:value={newItemName}
                placeholder={m['forms.new_item_name']()}
                autofocus
                {disabled}
                aria-describedby={newItemMissing ? newItemMissingId : undefined}
                onkeydown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNew();
                    } else if (e.key === 'Escape') {
                        // Escape leaves the new item only, not the dialog that holds the field.
                        e.stopPropagation();
                        closeNewInput();
                    }
                }}
            />
            {#if newItemMissing}
                <p id={newItemMissingId} class="text-xs text-muted-foreground">
                    {m['forms.new_item_name_missing']()}
                </p>
            {/if}
            <div class="flex gap-2">
                <Button
                    type="button"
                    size="sm"
                    onclick={handleAddNew}
                    disabled={isCreating || !newItemName.trim() || disabled}
                >
                    {isCreating ? m['common.adding']() : m['common.add']()}
                </Button>
                <Button type="button" variant="outline" size="sm" onclick={closeNewInput}>
                    {m['common.cancel']()}
                </Button>
            </div>
        </div>
    {:else}
        <Input
            {id}
            bind:ref={inputElement}
            bind:value={searchTerm}
            placeholder={searchPlaceholder}
            {disabled}
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listId : undefined}
            aria-activedescendant={activeId}
            onkeydown={handleKeydown}
            onblur={handleBlur}
            onfocus={() => {
                // Only set searchTerm to displayValue if there's already a selected value
                if (!searchTerm && displayValue && value) {
                    searchTerm = displayValue;
                }
                // Not on a field in error (FormField marks it): a refused form focuses it, and
                // the list would cover the message under it. A click, typing or the arrows still
                // open it.
                if (autoFocus && inputElement?.getAttribute('aria-invalid') !== 'true') {
                    isOpen = true;
                }
            }}
            oninput={() => {
                isOpen = true;
                activeIndex = -1;
                // Clear value if searchTerm is modified and doesn't match the current selection
                if (value && searchTerm !== displayValue) {
                    value = shownValue = '';
                }
            }}
            onclick={() => {
                isOpen = true;
            }}
        />
    {/if}
</div>

{#if showDropdown}
    <!-- The focus stays in the input, which handles the keys: a press on the list must not take
         the focus, or the input would blur and close the list before the click. -->
    <div
        use:portal
        id={listId}
        role="listbox"
        tabindex="-1"
        aria-label={searchPlaceholder}
        class="bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-y-auto pointer-events-auto"
        style="position: fixed; top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; z-index: 9999;"
        onmousedown={(e) => e.preventDefault()}
    >
        {#each entries as entry, index (index)}
            <!-- The input handles the keys and keeps the focus (aria-activedescendant). -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
            <div
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                class={[
                    'w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                    entry.class,
                    index === activeIndex && 'bg-accent text-accent-foreground'
                ]}
                onclick={() => chooseEntry(index)}
            >
                {entry.label}
            </div>
        {/each}
    </div>
{/if}
