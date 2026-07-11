<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidate } from "$app/navigation";
  import dayjs from "dayjs";
  import { Copy } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import DeleteButton from "./DeleteButton.svelte";

  let { data } = $props();

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
      method="post"
      action="?/create"
      class="form-control mt-4 gap-3"
      use:enhance={() => {
        return async ({ result }) => {
          console.log(result);
          modal.close();
          invalidate("invites");

          if (result.status !== 200) {
            toast.error("failed to create label");
          }
        };
      }}
    >
      <input
        type="text"
        name="label"
        class="input input-bordered input-primary"
        placeholder="Label"
        required
      />
      <button class="btn btn-success">Create</button>
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
      {#each data.invites as invite}
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
