<script lang="ts">
  import { browser } from "$app/env";
  import { createUpload, finalizeUpload, cancelUpload } from "#lib/api/uploads.remote.js";
  import { getAuthedUser } from "#lib/api/auth.remote.js";
  import { uploadToS3 } from "#lib/upload.js";
  import type { FileData } from "#lib/types/file.js";
  import { CloudUpload, Copy } from "lucide-svelte";
  import { nanoid } from "nanoid/non-secure";
  import { onDestroy, onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";
  import FileStatus from "./FileStatus.svelte";

  const user = $derived(await getAuthedUser());

  interface Preferences {
    expireIn: number;
    anonymize: boolean;
  }

  let files: FileData[] = $state([]);
  let expireIn: number = $state(31556952000);
  let anonymize: boolean = $state(false);

  async function handleFile(file: File) {
    const type = file.type;
    const size = file.size;

    const clientId = nanoid();

    files.push({
      id: clientId,
      status: "metadata",
      progress: tweened(0, { easing: cubicOut }),
      name: file.name,
      type,
      size,
    });

    const index = files.findIndex((i) => i.id === clientId);

    let grant: string | undefined;

    try {
      const upload = await createUpload({
        fileName: file.name,
        size,
        contentType: type || "application/octet-stream",
        expire: expireIn,
        anonymize,
      });

      grant = upload.grant;
      files[index].status = "uploading";

      await uploadToS3(upload.uploadUrl, file, (percent) => {
        files[index].progress.set(percent * 0.9, { duration: 100 });
      });

      files[index].status = "metadata";
      files[index].progress.set(95, { duration: 200 });

      const { id } = await finalizeUpload(grant);

      files[index].status = "done";
      files[index].progress.set(100, { duration: 500 });
      files[index].uploadedId = id;
    } catch (cause) {
      files[index].status = "error";
      files[index].progress.set(100, { duration: 500 });

      toast.error(cause instanceof Error ? cause.message : "Failed to upload file");

      if (grant) await cancelUpload(grant).catch(() => undefined);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();

    const files = event.dataTransfer?.files;

    if (!files) return;

    for (const file of files) {
      handleFile(file);
    }
  }

  function copyAll() {
    navigator.clipboard
      .writeText(
        files
          .filter((i) => i.status === "done")
          .map((i) => `https://file.maxz.dev/${i.uploadedId}`)
          .join("\n"),
      )
      .then(() => {
        toast.success("Copied to your clipboard");
      });
  }

  let preferences: Preferences;

  onMount(() => {
    try {
      preferences = JSON.parse(localStorage.getItem("preferences")!);
    } catch {
      preferences = {
        expireIn,
        anonymize: false,
      };
    }

    if (!preferences) {
      preferences = {
        expireIn,
        anonymize: false,
      };
    }

    if (preferences.expireIn) expireIn = preferences.expireIn;
    if (preferences.anonymize) anonymize = preferences.anonymize;
  });

  $effect(() => {
    if (!preferences) return;

    if (expireIn !== preferences.expireIn) preferences.expireIn = expireIn;
    if (anonymize !== preferences.anonymize) preferences.anonymize = anonymize;

    localStorage.setItem("preferences", JSON.stringify(preferences));
  });

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;

    if (!items) return;

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();

        if (file) handleFile(file);
      }
    }
  }

  onMount(() => {
    if (!browser) return;
    window.addEventListener("paste", handlePaste);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener("paste", handlePaste);
  });
</script>

<svelte:head>
  <title>upload :: files.maxz.dev</title>
</svelte:head>

<h2 class="pb-2 font-semibold">expire in:</h2>
<div class="flex">
  <div class="flex gap-4 pb-4">
    <input
      type="radio"
      name="expire"
      class="btn btn-sm lg:btn"
      aria-label="1 day"
      value={86400000}
      bind:group={expireIn}
    />
    <input
      type="radio"
      name="expire"
      class="btn btn-sm lg:btn"
      aria-label="1 week"
      value={604800000}
      bind:group={expireIn}
    />
    <input
      type="radio"
      name="expire"
      class="btn btn-sm lg:btn"
      aria-label="1 month"
      value={2629746000}
      bind:group={expireIn}
    />
    <input
      type="radio"
      name="expire"
      class="btn btn-sm lg:btn"
      aria-label="1 year"
      value={31556952000}
      bind:group={expireIn}
    />
    {#if user?.admin}
      <input
        type="radio"
        name="expire"
        class="btn btn-sm lg:btn"
        aria-label="never"
        value={1577847600000}
        bind:group={expireIn}
      />
    {/if}
  </div>

  {#if files.filter((i) => i.status === "done").length > 1}
    <div class="grow"></div>
    <button onclick={copyAll} class="btn text-primary"><Copy size={16} /> Copy all</button>
  {/if}
</div>

<label class="flex items-center gap-2 pb-2" for="anonymize">
  <input
    type="checkbox"
    class="checkbox checkbox-primary checkbox-sm"
    name="anonymize"
    id="anonymize"
    bind:checked={anonymize}
  />
  anonymize file name
</label>

<label
  class="border-accent/15 bg-base-200 hover:border-accent/25 flex h-fit w-full cursor-pointer items-center justify-center rounded-lg border p-4 duration-200"
  for="file"
  ondrop={handleDrop}
  ondragover={(e) => e.preventDefault()}
>
  <input
    type="file"
    name="file"
    id="file"
    multiple
    hidden
    onchange={(event) => {
      for (const file of event.currentTarget.files ?? []) handleFile(file);
      event.currentTarget.value = "";
    }}
  />
  <div class="flex flex-col gap-2 text-center">
    <div class="flex w-full justify-center">
      <CloudUpload class="text-primary" />
    </div>
    <h1 class="text-lg font-semibold">click or drag and drop to upload</h1>
    <p class="text-sm">max: 1GB per file · 50MB for images</p>
  </div>
</label>

<div class="mt-4 grid w-full grid-cols-1 gap-4 px-4">
  {#each files as file (file.id)}
    <FileStatus data={file} />
  {/each}
</div>
