<script lang="ts">
  import { signup } from "#lib/api/auth.remote.js";
  import { getLocalAuth } from "#lib/stores.js";
  import { KeyRound, ShieldAlert, User } from "lucide-svelte";
  import { toast } from "svelte-sonner";
</script>

<div class="mt-14 flex w-full justify-center">
  <div>
    <h1 class="text-primary text-center text-4xl font-bold">Sign up</h1>
    <p class="mt-1 text-center text-sm">
      Or <a href="/login" class="underline">log in</a>
    </p>

    <form
      {...signup.enhance(async (form) => {
        if (await form.submit()) {
          await getLocalAuth();
          toast.success("Logged in");
        }
      })}
      class="form-control mt-4"
    >
      <label
        for="invite"
        class="input input-bordered input-primary flex items-center gap-2 {signup.pending
          ? 'input-disabled'
          : ''}"
      >
        <ShieldAlert opacity={70} />
        <input {...signup.fields._invite.as("text")} id="invite" placeholder="Invite Token" />
      </label>

      {#each signup.fields._invite.issues() ?? [] as issue (issue.message)}
        <span class="text-error mt-1">{issue.message}</span>
      {/each}

      <label
        for="username"
        class="input input-bordered mt-4 flex items-center gap-2 {signup.pending
          ? 'input-disabled'
          : ''}"
      >
        <User opacity={70} />
        <input {...signup.fields.username.as("text")} id="username" placeholder="Username" />
      </label>

      {#each signup.fields.username.issues() ?? [] as issue (issue.message)}
        <span class="text-error mt-1">{issue.message}</span>
      {/each}

      <label
        for="password"
        class="input input-bordered mt-4 flex items-center gap-2 {signup.pending
          ? 'input-disabled'
          : ''}"
      >
        <KeyRound opacity={70} />
        <input {...signup.fields._password.as("password")} id="password" placeholder="Password" />
      </label>

      {#each signup.fields._password.issues() ?? [] as issue (issue.message)}
        <span class="text-error mt-1">{issue.message}</span>
      {/each}

      <button
        disabled={!!signup.pending}
        class="btn btn-primary mt-4 flex items-center gap-2 text-lg {signup.pending
          ? 'btn-disabled'
          : ''}"
      >
        {#if signup.pending}
          <span class="loading loading-spinner"></span>
        {/if}
        <span>Sign up</span>
      </button>
    </form>
  </div>
</div>
