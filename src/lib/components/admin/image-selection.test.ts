import { describe, expect, it } from 'vitest';
import { ImageSelection } from './image-selection.svelte';

const image = (id: string, filename: string, wines: string[] = []) => ({
    id,
    filename,
    wines: wines.map((name) => ({ name }))
});

function selection() {
    const data = {
        images: [
            image('margaux', 'Margaux.jpg'),
            image('latour', 'latour.jpg'),
            image('petrus', 'petrus-2010.png'),
            image('random', 'wine-0f3c.jpg', ['Château Cheval Blanc'])
        ]
    };
    return { data, images: new ImageSelection(() => data.images) };
}

describe('ImageSelection', () => {
    it('selects only the images the search shows, ignoring case', () => {
        const { images } = selection();
        images.search('.JPG');

        images.toggleAll();

        expect(images.ids.toSorted()).toEqual(['latour', 'margaux', 'random']);
    });

    it('finds an image by the name of a wine that uses it', () => {
        const { images } = selection();

        images.search('cheval blanc');

        expect(images.visible.map((shown) => shown.id)).toEqual(['random']);
    });

    it('drops a selected image that the search hides, so that it cannot be deleted unseen', () => {
        const { images } = selection();
        images.toggle('petrus', true);

        images.search('.jpg');
        images.search('');

        expect(images.ids).toEqual([]);
    });

    it('selects none when every shown image is already selected', () => {
        const { images } = selection();
        images.search('.jpg');
        images.toggleAll();

        images.toggleAll();

        expect(images.ids).toEqual([]);
    });

    it('drops a deleted image from the selection once the list is reloaded', () => {
        const { images, data } = selection();
        images.toggleAll();

        data.images = data.images.filter((image) => image.id !== 'latour');

        expect(images.ids.toSorted()).toEqual(['margaux', 'petrus', 'random']);
        expect(images.allSelected).toBe(true);
    });
});
