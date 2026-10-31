/** How long a session lasts, in whole hours: checked by the API and greyed in its dialog. */
export const MIN_SESSION_TIMEOUT_HOURS = 1;
export const MAX_SESSION_TIMEOUT_HOURS = 168;

export function isValidSessionTimeout(hours: unknown): hours is number {
    return (
        Number.isInteger(hours) &&
        (hours as number) >= MIN_SESSION_TIMEOUT_HOURS &&
        (hours as number) <= MAX_SESSION_TIMEOUT_HOURS
    );
}
