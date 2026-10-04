<script lang="ts">
  import { login } from "#lib/api/auth.remote.js";
  import { getLocalAuth } from "#lib/stores.js";
  import { KeyRound, User } from "lucide-svelte";
</script>

<div class="mt-14 flex w-full justify-center">
  <div>
    <h1 class="text-primary text-center text-4xl font-bold">Log in</h1>
    <p class="mt-1 text-center text-sm">
      Or <a href="/signup" class="underline">sign up</a>
    </p>

    <form
      {...login.enhance(async (form) => {
        if (await form.submit()) {
          await getLocalAuth();
        }
      })}
      class="form-control mt-4"
    >
      <label
        for="username"
        class="input input-bordered mt-4 flex items-center gap-2 {login.pending
          ? 'input-disabled'
          : ''}"
      >
        <User opacity={70} />
        <input {...login.fields.username.as("text")} id="username" placeholder="Username" />
      </label>

      {#each login.fields.username.issues() ?? [] as issue (issue.message)}
        <span class="text-error mt-1">{issue.message}</span>
      {/each}

      <label
        for="password"
        class="input input-bordered mt-4 flex items-center gap-2 {login.pending
          ? 'input-disabled'
          : ''}"
      >
        <KeyRound opacity={70} />
        <input {...login.fields._password.as("password")} id="password" placeholder="Password" />
      </label>

      {#each login.fields._password.issues() ?? [] as issue (issue.message)}
        <span class="text-error mt-1">{issue.message}</span>
      {/each}

      <button
        disabled={!!login.pending}
        class="btn btn-primary mt-4 flex items-center gap-2 text-lg {login.pending
          ? 'btn-disabled'
          : ''}"
      >
        {#if login.pending}
          <span class="loading loading-spinner"></span>
        {/if}
        <span>Log in</span>
      </button>
    </form>
  </div>
</div>
