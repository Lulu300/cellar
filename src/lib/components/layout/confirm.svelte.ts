interface Question {
    message: string;
    /** The label of the button that confirms; "Delete" by default. */
    confirmLabel?: string;
    /** The label of the button that declines; "Cancel" by default. */
    cancelLabel?: string;
}

/** The question that the confirmation dialog of the root layout shows, one at a time. */
class Confirmation {
    open = $state(false);
    /** Kept once answered, so that the dialog keeps its text while it closes. */
    question = $state<Question | null>(null);
    #answer: ((confirmed: boolean) => void) | null = null;

    /** Shows `question`, and resolves to whether the user confirmed it. */
    ask(question: Question): Promise<boolean> {
        // A new question cancels one left open.
        this.#answer?.(false);
        this.question = question;
        this.open = true;
        return new Promise((resolve) => (this.#answer = resolve));
    }

    answer(confirmed: boolean) {
        this.#answer?.(confirmed);
        this.#answer = null;
        this.open = false;
    }
}

export const confirmation = new Confirmation();

/** Asks the user to confirm, in the dialog of the root layout: `if (await confirm({...}))`. */
export const confirm = (question: Question) => confirmation.ask(question);
