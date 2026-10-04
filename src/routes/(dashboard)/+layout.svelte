<script lang="ts">
  import { dashboard } from "#lib/stores.js";
  import { onDestroy, onMount } from "svelte";
  import Sidebar from "./Sidebar.svelte";
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();

  onMount(() => {
    $dashboard = true;
  });

  onDestroy(() => {
    $dashboard = false;
  });
</script>

<div class="flex w-full justify-center">
  <div class="drawer lg:drawer-open w-full p-3 pl-0 lg:max-w-6xl">
    <input id="my-drawer" type="checkbox" class="drawer-toggle" />

    <Sidebar />

    <div class="drawer-content pl-3">
      {@render children?.()}
    </div>
  </div>
</div>
