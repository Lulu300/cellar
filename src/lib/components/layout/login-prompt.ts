// The layout's login dialog, which registers itself here once mounted, so that a list can open it
// when a visitor asks for a change.
let showLogin: (() => void) | undefined;

export function registerLoginDialog(show: () => void): () => void {
    showLogin = show;
    return () => (showLogin = undefined);
}

export function askToLogIn(): void {
    showLogin?.();
}
