<script lang="ts">
    let { kind } = $props();
</script>

<p>{m['cases.used']()}</p>
<p>{m['cases.missing_in_fr']()}</p>
<p>{m['cases.defined_twice']()}</p>
<p>{m['cases.hand_plural']({ count: 2 })}</p>
<p>{m['cases.not_text']()}</p>
<p>{m[`cases.${kind}`]()}</p>
