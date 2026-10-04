<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/state";
  import Pages from "#lib/components/Pages.svelte";
  import { formatBytes } from "#lib/format.js";
  import { debounce } from "#lib/utils.js";
  import dayjs from "dayjs";
  import {
    ArrowDownNarrowWide,
    ArrowDownWideNarrow,
    Copy,
    LoaderCircle,
    Pen,
    Search,
  } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import { renameFile } from "#lib/api/files.remote.js";
  import DeleteButton from "./DeleteButton.svelte";

  let { data } = $props();

  let renameModal: HTMLDialogElement;

  function updateSearch(value: string) {
    const params = new URL(page.url.href).searchParams;

    if (value) params.set("search", value);
    else params.delete("search");

    goto(`?${params.toString()}`, { replace: true });
  }

  const updateSearchDebounced = debounce(updateSearch, 500);
</script>

<svelte:head>
  <title>uploads :: files.maxz.dev</title>
</svelte:head>

<dialog class="modal" bind:this={renameModal}>
  <div class="modal-box">
    <h3 class="text-lg font-bold">
      Rename {renameFile.fields.label.value() || renameFile.fields.id.value()}
    </h3>
    <form
      {...renameFile.enhance(async (form) => {
        if (await form.submit().updates()) {
          renameModal.close();
          await invalidate("file_uploads");
        }
      })}
      class="mt-2 flex flex-col gap-4"
    >
      <input
        {...renameFile.fields.id.as("hidden", renameFile.fields.id.value() ?? "")}
        id="id"
        class="hidden"
      />
      {#each renameFile.fields.id.issues() ?? [] as issue (issue.message)}
        <p class="text-error">{issue.message}</p>
      {/each}
      <input
        {...renameFile.fields.label.as("text")}
        id="label"
        class="input input-bordered input-primary w-full"
      />
      {#each renameFile.fields.label.issues() ?? [] as issue (issue.message)}
        <p class="text-error">{issue.message}</p>
      {/each}

      <label for="includeLabelInUrl" class="flex items-center gap-2">
        <input
          {...renameFile.fields.includeLabelInUrl.as("checkbox")}
          class="checkbox checkbox-sm checkbox-primary"
          id="includeLabelInUrl"
        />
        Include label in URL
      </label>

      <button class="btn btn-primary" disabled={!!renameFile.pending}>
        {#if renameFile.pending}
          <span class="animate-spin"><LoaderCircle /></span>
        {:else}
          Submit
        {/if}
      </button>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop backdrop-blur-lg">
    <button>close</button>
  </form>
</dialog>

<label for="search" class="input input-bordered input-primary w-full">
  <Search size={16} />

  <input
    type="text"
    name="search"
    id="search"
    placeholder="Search"
    oninput={(e) => {
      updateSearchDebounced(e.currentTarget.value);
    }}
  />
</label>

<div class="overflow-x-auto overflow-y-hidden">
  <table class="table">
    <!-- head -->
    <thead>
      <tr>
        <th>
          <button
            class="flex items-center gap-2"
            onclick={() => {
              const params = new URL(page.url.href).searchParams;

              if (data.orderDisplay.column === "label") {
                if (data.orderDisplay.direction === "asc") {
                  params.set("order", "filede");
                } else {
                  params.set("order", "fileas");
                }
              } else {
                params.set("order", "filede");
              }

              goto(`?${params.toString()}`);
            }}
          >
            {#if data.orderDisplay.column === "label"}
              {#if data.orderDisplay.direction === "desc"}
                <ArrowDownWideNarrow size={16} />
              {:else}
                <ArrowDownNarrowWide size={16} />
              {/if}
            {/if}
            File
          </button>
        </th>
        <th>
          <button
            class="flex items-center gap-2"
            onclick={() => {
              const params = new URL(page.url.href).searchParams;

              if (data.orderDisplay.column === "size") {
                if (data.orderDisplay.direction === "asc") {
                  params.set("order", "sizede");
                } else {
                  params.set("order", "sizeas");
                }
              } else {
                params.set("order", "sizede");
              }

              goto(`?${params.toString()}`);
            }}
          >
            {#if data.orderDisplay.column === "size"}
              {#if data.orderDisplay.direction === "desc"}
                <ArrowDownWideNarrow size={16} />
              {:else}
                <ArrowDownNarrowWide size={16} />
              {/if}
            {/if}
            Size
          </button>
        </th>
        <th>
          <button
            class="flex items-center gap-2"
            onclick={() => {
              const params = new URL(page.url.href).searchParams;

              if (data.orderDisplay.column === "date") {
                if (data.orderDisplay.direction === "asc") {
                  params.set("order", "datede");
                } else {
                  params.set("order", "dateas");
                }
              } else {
                params.set("order", "datede");
              }

              goto(`?${params.toString()}`);
            }}
          >
            {#if data.orderDisplay.column === "date"}
              {#if data.orderDisplay.direction === "desc"}
                <ArrowDownWideNarrow size={16} />
              {:else}
                <ArrowDownNarrowWide size={16} />
              {/if}
            {/if}
            Uploaded At
          </button>
        </th>
        <th>
          <button
            class="flex items-center gap-2"
            onclick={() => {
              const params = new URL(page.url.href).searchParams;

              if (data.orderDisplay.column === "expire") {
                if (data.orderDisplay.direction === "asc") {
                  params.set("order", "expirede");
                } else {
                  params.set("order", "expireas");
                }
              } else {
                params.set("order", "expirede");
              }

              goto(`?${params.toString()}`);
            }}
          >
            {#if data.orderDisplay.column === "expire"}
              {#if data.orderDisplay.direction === "desc"}
                <ArrowDownWideNarrow size={16} />
              {:else}
                <ArrowDownNarrowWide size={16} />
              {/if}
            {/if}
            Expires At
          </button>
        </th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.files as file}
        <tr>
          <td class="w-fit">
            <div class="flex w-full max-w-80 items-center gap-3">
              {#if file.id.endsWith("png") || file.id.endsWith("jpeg") || file.id.endsWith("jpg") || file.id.endsWith("webp") || file.id.endsWith("avif") || file.id.endsWith("gif")}
                <img
                  src="https://file.maxz.dev/{file.id}"
                  alt={file.label}
                  loading="lazy"
                  decoding="async"
                  class="h-12 w-12 rounded-lg object-cover"
                />
              {/if}
              {#if file.label}
                <a
                  href="https://file.maxz.dev/{file.id}"
                  target="_blank"
                  class="link-hover truncate font-bold"
                >
                  {file.label}
                </a>
              {:else}
                <a
                  href="https://file.maxz.dev/{file.id}"
                  target="_blank"
                  class="link-hover truncate font-semibold opacity-50">{file.id}</a
                >
              {/if}
            </div>
          </td>
          <td>
            {formatBytes(file.bytes || 0)}
          </td>
          <td class="text-xs">
            <span class="tooltip" data-tip={dayjs(file.createdAt).format()}
              >{dayjs(file.createdAt).format("YYYY-MM-DD")}</span
            >
          </td>
          <td class="text-xs">
            <span class="tooltip" data-tip={dayjs(file.expireAt).format()}
              >{dayjs(file.expireAt).format("YYYY-MM-DD")}</span
            >
          </td>
          <td class="flex items-center gap-1">
            <button
              class="btn btn-ghost tooltip tooltip-top"
              data-tip="Copy"
              onclick={() => {
                navigator.clipboard.writeText(`https://file.maxz.dev/${file.id}`);
                toast.success("Copied to your clipboard");
              }}
            >
              <Copy size={16} />
            </button>

            <button
              class="btn btn-ghost tooltip tooltip-top"
              data-tip="rename"
              onclick={() => {
                renameFile.fields.id.set(file.id);
                renameFile.fields.label.set(file.label ?? "");
                renameFile.fields.includeLabelInUrl.set(file.id.includes("/"));

                renameModal.showModal();
              }}
            >
              <Pen size={16} strokeWidth={2.5} />
            </button>

            <DeleteButton id={file.id} />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <Pages currentPage={data.page} lastPage={data.lastPage} route="/files" />
</div>
