/**
 * The arrow keys of a radio, as native radios have them (WAI-ARIA radio group pattern): they move
 * to the previous or next choice of its group, and choose it. Only the chosen radio is in the tab
 * order, so Tab leaves the group. With `choose` false the arrows only move, and Space or Enter
 * choose: for a choice that reloads the page, such as the language.
 */
export function moveChoice(event: KeyboardEvent, choose = true) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const radio = event.currentTarget as HTMLElement;
    const group = radio.closest('[role="radiogroup"]');
    if (!step || !group) return;
    event.preventDefault();
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
    const next = radios[(radios.indexOf(radio) + step + radios.length) % radios.length];
    next.focus();
    if (choose) next.click();
}
