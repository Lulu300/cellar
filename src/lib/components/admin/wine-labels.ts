// How the admin names a wine or a bottle in its messages, without the parts it lacks: a wine
// may have no producer, and a bottle no vintage.

export const wineLabel = (wine: { producer: string | null; name: string }) =>
    [wine.producer, wine.name].filter(Boolean).join(' - ');

export const bottleLabel = (bottle: { wineName: string; vintage: number | null }) =>
    [bottle.wineName, bottle.vintage].filter((part) => part != null).join(' ');
