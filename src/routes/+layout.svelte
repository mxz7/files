<script lang="ts">
  import { dev } from "$app/environment";
  import Navbar from "$lib/components/NavigationBar.svelte";
  import { getLocalAuth } from "$lib/stores";
  import { onMount } from "svelte";
  import { Toaster } from "svelte-french-toast";
  import "../app.css";
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();

  onMount(() => {
    getLocalAuth();
  });
</script>

<svelte:head>
  {#if !dev}
    <script
      defer
      data-domain="files.maxz.dev"
      src="https://analytics.maxz.dev/js/script.js"
    ></script>
  {/if}
</svelte:head>

<Toaster />

<Navbar />

{@render children?.()}
