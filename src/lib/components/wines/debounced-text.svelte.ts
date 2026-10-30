/** How long typing pauses before the value is passed on. */
const DELAY_MS = 200;

/**
 * The text of a field whose value lives elsewhere (the URL of the wine list): it shows what is
 * typed at once, and passes it on once typing pauses, so that the list is filtered once rather
 * than at each key.
 */
export class DebouncedText {
    // A number field binds a number, or null when empty.
    text = $state<string | number | null>('');
    #timer: ReturnType<typeof setTimeout> | undefined;
    // The last value passed on, which comes back through follow() once the URL holds it
    #sent: string;
    #onChange: (value: string) => void;

    constructor(value: string, onChange: (value: string) => void) {
        this.text = this.#sent = value;
        this.#onChange = onChange;
    }

    /** After each key: passes the text on once typing pauses. */
    input() {
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => {
            this.#timer = undefined;
            this.#sent = String(this.text ?? '');
            this.#onChange(this.#sent);
        }, DELAY_MS);
    }

    /**
     * Takes the value as it now is. A value changed from outside (Back, a link to the bare list)
     * replaces the text and drops the typing not yet passed on, which would otherwise write
     * itself over the new value; the value passed on, coming back, keeps any newer typing. An
     * outside change that leaves the value as it was cannot be told apart, and keeps the typing.
     */
    follow(value: string) {
        if (value === this.#sent) return;
        this.stop();
        this.text = this.#sent = value;
    }

    /** Drops the typing not yet passed on. */
    stop() {
        clearTimeout(this.#timer);
        this.#timer = undefined;
    }
}
