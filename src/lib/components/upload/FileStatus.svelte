<script lang="ts">
  import { formatBytes } from "#lib/format.js";
  import type { FileData } from "#lib/types/file.js";
  import { Check, CircleX, Copy } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import { fly } from "svelte/transition";

  interface Props {
    data: FileData;
  }

  let { data }: Props = $props();

  let progress = $derived(data.progress);

  function copyId() {
    navigator.clipboard.writeText(`https://file.maxz.dev/${data.uploadedId}`).then(() => {
      toast.success("copied to your clipboard");
    });
  }
</script>

<div
  class="border-accent/5 bg-base-200 w-full rounded-lg border p-6"
  in:fly|global={{ y: -50, duration: 750 }}
>
  <div class="text-primary flex w-full items-start gap-4 text-lg font-bold">
    <div class="min-w-0 flex-1">
      <h2 class="[overflow-wrap:anywhere]">{data.name}</h2>

      {#if data.uploadedId}
        <a
          href="https://file.maxz.dev/{data.uploadedId}"
          target="_blank"
          class="link link-primary mt-1 block text-sm font-normal [overflow-wrap:anywhere]"
        >
          {data.uploadedId}
        </a>
      {/if}
    </div>

    {#if data.uploadedId}
      <button
        onclick={copyId}
        class="btn btn-ghost tooltip shrink-0"
        data-tip="Copy to clipboard"
        aria-label="Copy file link"
      >
        <Copy size={16} />
      </button>
    {/if}
  </div>

  <p class="mt-2">{formatBytes(data.size)}</p>

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
