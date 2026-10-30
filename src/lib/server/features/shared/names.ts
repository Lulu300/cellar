/**
 * A name as names are compared: neither the case, accented letters included, nor the blanks around
 * it count; none is ''.
 */
export function normalized(value: unknown): string {
    return value == null ? '' : String(value).trim().toLowerCase();
}
