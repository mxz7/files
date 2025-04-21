<script lang="ts">
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

<Toaster />

<Navbar />

{@render children?.()}
