<script lang="ts">
  import { createInvite, getInvites } from "#lib/api/invites.remote.js";
  import dayjs from "dayjs";
  import { Copy } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import DeleteButton from "./DeleteButton.svelte";

  const data = $derived(await getInvites());

  let modal: HTMLDialogElement;

  function copyId(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to your clipboard");
    });
  }
</script>

<svelte:head>
  <title>invites :: files.maxz.dev</title>
</svelte:head>

<dialog class="modal" bind:this={modal}>
  <div class="modal-box">
    <h3 class="text-center text-lg font-bold">Create new invite</h3>

    <form
      {...createInvite.enhance(async (form) => {
        if (await form.submit().updates(getInvites())) {
          modal.close();
          form.element.reset();
        }
      })}
      class="form-control mt-4 gap-3"
    >
      <input
        {...createInvite.fields.label.as("text")}
        class="input input-bordered input-primary"
        placeholder="Label"
        required
      />
      {#each createInvite.fields.label.issues() ?? [] as issue (issue.message)}
        <p class="text-error">{issue.message}</p>
      {/each}
      <button class="btn btn-success" disabled={!!createInvite.pending}>Create</button>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop backdrop-blur-lg">
    <button>close</button>
  </form>
</dialog>

<button class="btn btn-success m-2" onclick={() => modal.show()}> Create </button>

<div class="mt-4 overflow-x-auto">
  <table class="table">
    <!-- head -->
    <thead>
      <tr>
        <th>Label</th>
        <th>Created At</th>
        <th>Used by</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.invites as invite (invite.id)}
        <tr>
          <td>{invite.label}</td>
          <td>{dayjs(invite.createdAt).format("YYYY-MM-DD")}</td>
          <td>{invite.username}</td>
          <td class="flex gap-2">
            <button
              onclick={() => copyId(invite.id)}
              class=" btn btn-ghost tooltip"
              data-tip="Copy invite token to clipboard"
            >
              <Copy size={16} />
            </button>

            <DeleteButton id={invite.id} />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
