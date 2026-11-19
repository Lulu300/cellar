/** The group of each role of choice that the arrow keys move within. */
const GROUPS: Record<string, string> = { radio: 'radiogroup', tab: 'tablist' };

/**
 * The keys of a radio or a tab, as the WAI-ARIA radio group and tabs patterns want them: an arrow
 * moves to the previous or next choice of its group, Home and End to the first and the last, and
 * chooses it. Only the chosen one is in the tab order, so Tab leaves the group. With `choose` false
 * the keys only move, and Space or Enter choose: for a choice that reloads the page, such as the
 * language.
 */
export function moveChoice(event: KeyboardEvent, choose = true) {
    const choice = event.currentTarget as HTMLElement;
    const role = choice.getAttribute('role') ?? '';
    const group = choice.closest(`[role="${GROUPS[role]}"]`);
    if (!group) return;
    const choices = [...group.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
    const index = choices.indexOf(choice);
    const target = {
        ArrowRight: index + 1,
        ArrowDown: index + 1,
        ArrowLeft: index - 1,
        ArrowUp: index - 1,
        Home: 0,
        End: choices.length - 1
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    // Past either end, the arrows go round to the other one.
    const next = choices[(target + choices.length) % choices.length];
    next.focus();
    if (choose) next.click();
}
