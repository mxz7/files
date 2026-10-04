<script lang="ts">
  import dayjs from "dayjs";
  import { createKey, deleteKeys } from "#lib/api/keys.remote.js";
  import { getLocalAuth } from "#lib/stores.js";

  let { data } = $props();

  let createModal: HTMLDialogElement;
</script>

<svelte:head>
  <title>keys :: files.maxz.devs</title>
</svelte:head>

<dialog class="modal" bind:this={createModal}>
  <div class="modal-box">
    <h3 class="text-lg font-bold">create session key</h3>
    <form
      {...createKey.enhance(async (form) => {
        if (await form.submit()) {
          createModal.close();
        }
      })}
      class="mt-2 flex flex-col gap-4"
    >
      <label for="days" class="input">
        <span class="label">days until expire</span>
        <input
          {...createKey.fields.days.as("number", 1)}
          min="1"
          max="700"
          id="days"
          class="input"
        />
      </label>
      {#each createKey.fields.days.issues() ?? [] as issue (issue.message)}
        <p class="text-error">{issue.message}</p>
      {/each}

      <button class="btn btn-primary" disabled={!!createKey.pending}> create </button>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop backdrop-blur-lg">
    <button>close</button>
  </form>
</dialog>

<div class="flex justify-end gap-2">
  <button class="btn btn-success btn-sm" onclick={() => createModal.showModal()}>create</button>

  <form
    {...deleteKeys.enhance(async (form) => {
      if (await form.submit()) await getLocalAuth();
    })}
  >
    <button class="btn btn-error btn-sm" disabled={!!deleteKeys.pending}>delete all</button>
  </form>
</div>

{#if createKey.result}
  <p class="bg-base-200 my-4 rounded-lg p-4 font-mono text-sm">{createKey.result}</p>
{/if}

<div class="overflow-x-auto">
  <table class="table">
    <thead>
      <tr>
        <th>current</th>
        <th>expires at</th>
      </tr>
    </thead>
    <tbody>
      {#each data.sessions as session}
        <tr>
          <td>{session.current ? "yes" : "no"}</td>
          <td>{dayjs(session.expiresAt * 1000).format("YYYY-MM-DD HH:mm:ss")}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
