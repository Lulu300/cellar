import { vi } from 'vitest';

/** The link that saveUrl clicks to save a file, in a test without a DOM. */
export function fakeLink() {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    // The cookie is where the messages read the language from.
    vi.stubGlobal('document', {
        cookie: '',
        createElement: () => link,
        body: { appendChild: vi.fn() }
    });
    return link;
}
