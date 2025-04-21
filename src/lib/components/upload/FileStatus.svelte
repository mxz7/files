<script lang="ts">
  import { formatBytes } from "$lib/format";
  import type { FileData } from "$lib/types/file";
  import { Check, CircleX, Copy } from "lucide-svelte";
  import toast from "svelte-french-toast";
  import { fly } from "svelte/transition";

  interface Props {
    data: FileData;
  }

  let { data }: Props = $props();

  let progress = data.progress;

  function copyId() {
    navigator.clipboard.writeText(`https://file.maxz.dev/${data.uploadedId}`).then(() => {
      toast.success("Copied to your clipboard", {
        style:
          "--tw-bg-opacity: 1; background-color: var(--fallback-b3,oklch(var(--b3)/var(--tw-bg-opacity))); --tw-text-opacity: 1; color: var(--fallback-bc,oklch(var(--bc)/var(--tw-text-opacity)));",
        iconTheme: {
          primary: "#a6e3a1",
          secondary: "#FFFFFF",
        },
      });
    });
  }
</script>

<div
  class="border-accent/5 bg-base-200 w-full rounded-lg border p-6"
  in:fly|global={{ y: -50, duration: 750 }}
>
  <div class="text-primary flex w-full items-center gap-4 text-lg font-bold">
    <h2 class="max-w-[75%] overflow-hidden text-nowrap text-ellipsis">{data.name}</h2>
    {#if data.uploadedId}
      <a
        href="https://file.maxz.dev/{data.uploadedId}"
        target="_blank"
        class="link link-primary flex-1"
      >
        {data.uploadedId}
      </a>

      <button onclick={copyId} class="btn btn-ghost tooltip" data-tip="Copy to clipboard">
        <Copy size={16} />
      </button>
    {/if}
  </div>
  <p>{formatBytes(data.size)}</p>

  <div class="mt-1 flex w-full items-center gap-2">
    {#if data.status === "metadata" || data.status === "uploading"}
      <span class="loading loading-spinner loading-xs"></span>
    {:else if data.status === "error"}
      <span class="tooltip tooltip-error" data-tip="failed to upload">
        <CircleX class="text-error" size={16} />
      </span>
    {:else if data.status === "done"}
      <span class="tooltip tooltip-success" data-tip="successfully uploaded">
        <Check class="text-success" size={16} />
      </span>
    {/if}
    <progress
      class="progress {data.status === 'error' ? 'progress-error' : 'progress-success'} w-full"
      value={$progress}
      max="100"
    ></progress>
  </div>
</div>
