<script>
  import { auth, dashboard } from "$lib/stores";
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
          <span class="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
            files
          </span>
        </a>
      {:else}
        <a href="/" class="btn btn-ghost text-xl font-semibold">
          <span class="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
            files
          </span>
        </a>
      {/if}
    </div>
    <div class="flex-none">
      {#if !$auth}
        <div class="btn btn-ghost">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {:else if !$auth.authenticated}
        <a href="/login" class="btn btn-ghost text-lg text-primary">Log in</a>
      {:else}
        <a href="/files" class="btn btn-ghost text-primary">
          <CircleUser strokeWidth={2.5} />
        </a>
      {/if}
    </div>
  </div>
</header>
