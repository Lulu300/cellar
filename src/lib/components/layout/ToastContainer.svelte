<script lang="ts">
    import { toasts } from '#lib/stores/toast.svelte.js';
    import Toast from './Toast.svelte';
</script>

<div class="fixed top-4 right-4 z-[9999] space-y-2">
    {#each toasts.items as toast (toast.id)}
        <Toast message={toast.message} type={toast.type} onClose={() => toasts.remove(toast.id)} />
    {/each}
</div>
