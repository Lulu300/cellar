export function ask() {
    alert('Are you sure you want this');
    if (!window.confirm('Delete everything now?')) return null;
    return prompt(`Name of the case`);
}
