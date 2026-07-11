<script lang="ts">
  import Pages from "$lib/components/Pages.svelte";
  import { formatBytes } from "$lib/format.js";
  import dayjs from "dayjs";

  let { data } = $props();
</script>

<svelte:head>
  <title>users :: files.maxz.devs</title>
</svelte:head>

{#key data}
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Type</th>
          <th>Created At</th>
          <th>IP</th>
          <th>Uploaded</th>
          <th>Bytes</th>
        </tr>
      </thead>
      <tbody>
        {#each data.rows as row}
          <tr>
            <th>
              <a href="/users/{row.id}" class="link">
                {row.username}
              </a>
            </th>
            <td>{row.type}</td>
            <td>{dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss")}</td>
            <td>{row.ip}</td>
            <td>{row.uploaded.toLocaleString()}</td>
            <td>
              {#if row.size}
                {formatBytes(parseInt(row.size))}
              {:else}
                null
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <Pages currentPage={data.page} lastPage={data.page} route="/users" />
  </div>
{/key}
