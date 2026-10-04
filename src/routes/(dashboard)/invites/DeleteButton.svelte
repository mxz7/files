<script lang="ts">
  import { deleteInvite, getInvites } from "#lib/api/invites.remote.js";
  import { toast } from "svelte-sonner";
  import { Trash } from "lucide-svelte";

  interface Props {
    id: string;
  }

  let { id }: Props = $props();
  let loading = $state(false);

  async function onClick() {
    if (loading) return;
    loading = true;

    try {
      await deleteInvite(id).updates(getInvites());
    } catch {
      toast.error("Failed to delete invite");
    } finally {
      loading = false;
    }
  }
</script>

<button onclick={onClick} class="btn btn-ghost tooltip tooltip-error" data-tip="Delete token">
  {#if loading}
    <span class="loading loading-spinner text-error"></span>
  {:else}
    <Trash size={16} class="text-error" />
  {/if}
</button>
