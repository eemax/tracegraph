<script lang="ts">
  import { onMount } from 'svelte';
  import ExplorerShell from '$lib/components/explorer/ExplorerShell.svelte';
  import { ExplorerState } from '$lib/state/explorer.svelte';

  const state = new ExplorerState();

  onMount(() => {
    void state.start();

    return () => {
      state.stop();
    };
  });
</script>

<svelte:head>
  <title>Tracegraph</title>
</svelte:head>

<ExplorerShell {state} />
