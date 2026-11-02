<script lang="ts">
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { containerLabel } from '#lib/shared/storage.js';

    /**
     * The name of a container, the same neutral pill for every container: on the storage page,
     * colour tells the colour of the wines. Its edge takes the field border, which stays visible
     * in dark mode and in every theme.
     */
    let { name }: { name: string } = $props();
</script>

<Badge variant="outline" class="border-input">{containerLabel(name)}</Badge>
