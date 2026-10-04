<script>
  import { dashboard } from "#lib/stores.js";
  import { getAuthedUser } from "#lib/api/auth.remote.js";
  const user = $derived(await getAuthedUser());
  import { AlignLeft, CircleUser } from "lucide-svelte";
</script>

<header class="flex w-full justify-center">
  <div class="navbar bg-base-200 lg:mt-3 lg:max-w-6xl lg:rounded-xl">
    <div class="flex-1">
      {#if $dashboard}
        <label for="my-drawer" class="btn btn-ghost drawer-button text-primary lg:hidden">
          <AlignLeft strokeWidth={2.5} />
        </label>
        <a href="/" class="btn btn-ghost hidden text-xl font-semibold lg:inline-flex">
          <span class="from-primary to-info bg-gradient-to-r bg-clip-text text-transparent">
            files
          </span>
        </a>
      {:else}
        <a href="/" class="btn btn-ghost text-xl font-semibold">
          <span class="from-primary to-info bg-gradient-to-r bg-clip-text text-transparent">
            files
          </span>
        </a>
      {/if}
    </div>
    <div class="flex-none">
      {#if !user}
        <a href="/login" class="btn btn-ghost text-primary text-lg">Log in</a>
      {:else}
        <a href="/files" class="btn btn-ghost text-primary">
          <CircleUser strokeWidth={2.5} />
        </a>
      {/if}
    </div>
  </div>
</header>
