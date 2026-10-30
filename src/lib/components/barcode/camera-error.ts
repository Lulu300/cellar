import { m } from '#lib/paraglide/messages.js';

// Browsers name the same refusal differently: Firefox and Safari have thrown errors that are not
// DOMException instances, and older engines used the legacy names. Only the name is reliable.
const PERMISSION_ERRORS = new Set(['NotAllowedError', 'PermissionDeniedError', 'SecurityError']);
// A camera chosen by its id that is gone fails its exact constraint.
const NO_CAMERA_ERRORS = new Set(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError']);

/**
 * Why the camera could not start, in the user's language. The browser's own message is English,
 * so it is not shown.
 */
export function cameraErrorMessage(error: unknown): string {
    const name = String((error as { name?: unknown } | null)?.name);
    if (PERMISSION_ERRORS.has(name)) return m['scanner.permission_denied']();
    if (NO_CAMERA_ERRORS.has(name)) return m['scanner.no_camera']();
    return m['scanner.error_starting']();
}

/**
 * Why the page may not use the camera, or null when it may. A browser only gives it to a secure
 * context (HTTPS or localhost): on a plain http:// address of the network it hides
 * `navigator.mediaDevices`, or refuses it as if the user had. A secure page in a browser or a
 * webview without a camera API gets its own message, since HTTPS would not help.
 */
export function cameraUnavailableMessage(): string | null {
    if (!window.isSecureContext) return m['scanner.camera_unavailable']();
    if (!navigator.mediaDevices?.getUserMedia) return m['scanner.no_camera_api']();
    return null;
}
