<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import Pages from "$lib/components/Pages.svelte";
  import { formatBytes } from "$lib/format.js";
  import { debounce } from "$lib/utils";
  import dayjs from "dayjs";
  import { ArrowDownNarrowWide, ArrowDownWideNarrow, Pen, Search } from "lucide-svelte";
  import { superForm } from "sveltekit-superforms";
  import DeleteButton from "./DeleteButton.svelte";

  let { data } = $props();

  let renameModal: HTMLDialogElement;

  const { form, enhance, errors, constraints, delayed } = superForm(data.form, {
    delayMs: 250,
    onResult(event) {
      renameModal.close();
      invalidate("file_uploads");
    },
    invalidateAll: false,
  });

  function updateSearch(value: string) {
    const params = new URLSearchParams($page.url.searchParams);

    if (value) params.set("search", value);
    else params.delete("search");

    goto(`?${params.toString()}`, { replaceState: true });
  }

  const updateSearchDebounced = debounce(updateSearch, 500);
</script>

<svelte:head>
  <title>uploads :: files.maxz.dev</title>
</svelte:head>

<dialog class="modal" bind:this={renameModal}>
  <div class="modal-box">
    <h3 class="text-lg font-bold">Rename {$form.id}</h3>
    <form action="?/rename" method="POST" class="form-control mt-2 gap-4" use:enhance>
      <input
        type="text"
        name="id"
        id="id"
        class="hidden"
        bind:value={$form.id}
        {...$constraints.id}
      />
      {#if $errors.id}
        <p class="text-error">{$errors.id}</p>
      {/if}
      <input
        type="text"
        name="label"
        id="label"
        class="input input-bordered input-primary"
        bind:value={$form.label}
        {...$constraints.label}
      />
      {#if $errors.label}
        <p class="text-error">{$errors.label}</p>
      {/if}
      <button class="btn btn-primary">Submit</button>
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
              const params = new URLSearchParams($page.url.searchParams);

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
              const params = new URLSearchParams($page.url.searchParams);

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
              const params = new URLSearchParams($page.url.searchParams);

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
              const params = new URLSearchParams($page.url.searchParams);

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
            <div
              class="flex w-fit max-w-52 items-center gap-3 overflow-hidden text-nowrap text-ellipsis"
            >
              {#if file.id.endsWith("png") || file.id.endsWith("jpeg") || file.id.endsWith("jpg") || file.id.endsWith("webp") || file.id.endsWith("avif") || file.id.endsWith("gif")}
                <div class="avatar">
                  <div class="mask mask-squircle h-12 w-12">
                    <img
                      src="https://file.maxz.dev/{file.id}"
                      alt={file.label}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              {/if}
              <div>
                {#if file.label}
                  <a
                    href="https://file.maxz.dev/{file.id}"
                    target="_blank"
                    class="link-hover overflow-hidden font-bold text-nowrap text-ellipsis"
                  >
                    {file.label}
                  </a>
                {:else}
                  <a
                    href="https://file.maxz.dev/{file.id}"
                    target="_blank"
                    class="link-hover font-semibold opacity-50">{file.id}</a
                  >
                {/if}
              </div>
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
              data-tip="rename"
              onclick={() => {
                $form.id = file.id;
                $form.label = file.label;
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
