<script lang="ts">
  import Navbar from "$lib/components/NavigationBar.svelte";
  import { getLocalAuth } from "$lib/stores";
  import { onMount } from "svelte";
  import { Toaster } from "svelte-sonner";
  import "../app.css";
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();

  onMount(() => {
    getLocalAuth();
  });
</script>

<Toaster
  expand
  toastOptions={{
    unstyled: true,
    classes: {
      toast: "alert alert-soft",
      title: "text-sm font-bold",
      error: "alert-error",
      success: "alert-success",
    },
  }}
/>

<Navbar />

{@render children?.()}
