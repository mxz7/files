<script lang="ts">
  import { requireAuth } from "#lib/api/auth.remote.js";
  import Sidebar from "./Sidebar.svelte";
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();
</script>

{#if await requireAuth()}
  <div class="flex w-full justify-center">
    <div class="drawer lg:drawer-open w-full p-3 pl-0 lg:max-w-6xl">
      <input id="my-drawer" type="checkbox" class="drawer-toggle" />

      <Sidebar />

      <div class="drawer-content pl-3">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
