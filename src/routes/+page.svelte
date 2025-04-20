<script>
  import Upload from "$lib/components/upload/Upload.svelte";
  import { auth } from "$lib/stores";
</script>

<svelte:head>
  <title>files.maxz.dev</title>
</svelte:head>

<h1
  class="from-primary to-info mt-16 w-full bg-gradient-to-r bg-clip-text text-center text-3xl font-bold text-transparent md:text-5xl"
>
  files.maxz.dev
</h1>
<p class="text-accent text-center text-sm italic">private file storage</p>

<div class="mt-8 flex w-full justify-center">
  <div class="w-full px-4 md:max-w-4xl md:px-0">
    {#if !$auth}
      <div class="flex w-full justify-center">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else if $auth && !$auth.authenticated}
      <h3 class="text-error text-center">You must be logged in to upload files</h3>
      <div class="mt-2 flex w-full justify-center gap-4">
        <a href="/login" class="btn">Log in</a>
        <a href="/signup" class="btn">Sign up</a>
      </div>
    {:else if $auth.authenticated}
      <div class="flex justify-center">
        <div class="w-full max-w-3xl pb-8">
          <Upload />
        </div>
      </div>
    {/if}
  </div>
</div>
