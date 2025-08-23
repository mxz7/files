<script lang="ts">
  import dayjs from "dayjs";
  import toast from "svelte-french-toast";
  import { superForm } from "sveltekit-superforms";

  let { data } = $props();

  let createModal: HTMLDialogElement;

  const { form, errors, enhance, constraints, message } = superForm(data.form, {
    onSubmit() {
      createModal.close();
    },
  });
</script>

<svelte:head>
  <title>keys :: files.maxz.devs</title>
</svelte:head>

<dialog class="modal" bind:this={createModal}>
  <div class="modal-box">
    <h3 class="text-lg font-bold">create session key</h3>
    <form action="?/create" method="POST" class="mt-2 flex flex-col gap-4" use:enhance>
      <label for="days" class="input">
        <span class="label">days until expire</span>
        <input
          type="number"
          name="days"
          id="days"
          class="input"
          bind:value={$form.days}
          {...$constraints.days}
        />
      </label>
      {#if $errors.days}
        <p class="text-error">{$errors.days}</p>
      {/if}

      <button class="btn btn-primary"> create </button>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop backdrop-blur-lg">
    <button>close</button>
  </form>
</dialog>

<div class="flex justify-end gap-2">
  <button class="btn btn-success btn-sm" onclick={() => createModal.showModal()}>create</button>

  <form action="?/delete" method="post">
    <button class="btn btn-error btn-sm">delete all</button>
  </form>
</div>

{#if $message}
  <p class="bg-base-200 my-4 rounded-lg p-4 font-mono text-sm">{$message}</p>
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
