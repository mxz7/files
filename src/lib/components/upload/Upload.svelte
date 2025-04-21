<script lang="ts">
  import { auth } from "$lib/stores";
  import type { FileData } from "$lib/types/file";
  import { CloudUpload, Copy } from "lucide-svelte";
  import { nanoid } from "nanoid/non-secure";
  import toast from "svelte-french-toast";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";
  import { writable } from "svelte/store";
  import FileStatus from "./FileStatus.svelte";

  let formFiles = writable<FileList>();
  let files: FileData[] = $state([]);
  let expireIn: number = $state(31556952000);
  let stripExif = $state(true);

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

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: JSON.stringify({ bytes: size, label: file.name, expire: expireIn }),
    });

    if (uploadResponse.status !== 200) {
      files[index].status = "error";
      files[index].progress.set(100, { duration: 500 });
      console.error(uploadResponse);
      return;
    }

    const { id }: { id: string } = await uploadResponse.json();

    files[index].status = "uploading";
    files[index].progress.set(85, { duration: 15000 });

    const formData = new FormData();
    formData.set("file", file);

    const uploadRes = await fetch(`/api/upload/${id}`, { method: "PUT", body: formData });

    if (uploadRes.status === 200) {
      files[index].status = "done";
      files[index].progress.set(100, { duration: 1000 });
      files[index].uploadedId = await uploadRes.json().then((r) => r.id);
    } else {
      console.error(uploadRes);
      files[index].status = "error";
      files[index].progress.set(100, { duration: 500 });
    }
  }

  formFiles.subscribe((files) => {
    if (!files) return;

    for (const file of files) {
      handleFile(file);
    }
  });

  function handleDrop(event: DragEvent) {
    event.preventDefault();

    const files = event.dataTransfer?.files;

    if (!files) return;

    console.log(files);

    for (const file of files) {
      handleFile(file);
    }
  }

  function copyAll() {
    navigator.clipboard
      .writeText(
        files
          .filter((i) => i.status === "done")
          .map((i) => `https://cdn.maxz.dev/${i.uploadedId}`)
          .join("\n"),
      )
      .then(() => {
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

<svelte:head>
  <title>upload :: files.maxz.dev</title>
</svelte:head>

<h2 class="pb-2 font-semibold">Expire in:</h2>
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
    {#if $auth?.authenticated && $auth?.user.admin}
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

<label
  class="border-accent/15 bg-base-200 hover:border-accent/25 flex h-fit w-full cursor-pointer items-center justify-center rounded-lg border p-4 duration-200"
  for="file"
  ondrop={handleDrop}
  ondragover={(e) => e.preventDefault()}
>
  <input type="file" name="file" id="file" multiple hidden bind:files={$formFiles} />
  <div class="flex flex-col gap-2 text-center">
    <div class="flex w-full justify-center">
      <CloudUpload class="text-primary" />
    </div>
    <h1 class="text-lg font-semibold">Click or drag and drop to upload</h1>
    <p class="text-sm">Max: 1GB per file</p>
  </div>
</label>

<div class="mt-4 grid w-full grid-cols-1 gap-4 px-4">
  {#each files as file}
    <FileStatus data={file} />
  {/each}
</div>
