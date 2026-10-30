import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebouncedText } from './debounced-text.svelte';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

/** Types `text` in the field, as a key press does. */
function type(field: DebouncedText, text: string) {
    field.text = text;
    field.input();
}

describe('DebouncedText', () => {
    it('passes the text on once typing pauses for 200 ms', () => {
        const onChange = vi.fn();
        const field = new DebouncedText('', onChange);

        type(field, 'Bu');
        vi.advanceTimersByTime(150);
        type(field, 'Bug04');
        vi.advanceTimersByTime(199);
        expect(onChange).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(onChange).toHaveBeenCalledExactlyOnceWith('Bug04');
    });

    it('takes a value changed from outside while typing, and drops the typing', () => {
        const onChange = vi.fn();
        const field = new DebouncedText('Seed', onChange);

        type(field, 'Bug');
        // A link to the bare list clears the search before the typing is passed on
        field.follow('');
        vi.runAllTimers();

        expect(field.text).toBe('');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps newer typing when its own value comes back, and passes that on after', () => {
        const onChange = vi.fn();
        const field = new DebouncedText('', onChange);

        type(field, 'Bug');
        vi.advanceTimersByTime(200);
        type(field, 'Bug04');
        // The URL now holds "Bug", the value passed on
        field.follow('Bug');
        expect(field.text).toBe('Bug04');

        vi.advanceTimersByTime(200);
        expect(onChange).toHaveBeenLastCalledWith('Bug04');
    });

    it('passes on a number field as text, and an emptied one as an empty value', () => {
        const onChange = vi.fn();
        const field = new DebouncedText('', onChange);

        field.text = 2010;
        field.input();
        vi.advanceTimersByTime(200);
        field.text = null;
        field.input();
        vi.advanceTimersByTime(200);

        expect(onChange.mock.calls).toEqual([['2010'], ['']]);
    });
});
