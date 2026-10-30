<script lang="ts">
    function leave() {
        if (confirm('Leave this page?')) history.back();
    }
</script>

<button onclick={leave}>{m['cases.used']()}</button>
