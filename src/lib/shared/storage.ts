/**
 * The name of a container as the storage page shows it and sorts it: the first versions named
 * their containers "Column A", and their cases "A1". Only a leading "Column " is left out: a
 * container "Wine Column X" keeps its name.
 */
export function containerLabel(name: string): string {
    return name.replace(/^Column /, '');
}
