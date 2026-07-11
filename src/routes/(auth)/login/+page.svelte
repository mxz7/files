<script lang="ts">
  import { getLocalAuth } from "$lib/stores.js";
  import { KeyRound, User } from "lucide-svelte";
  import { superForm } from "sveltekit-superforms";

  let { data } = $props();

  const { form, errors, enhance, constraints, delayed } = $derived(
    superForm(data.form, {
      delayMs: 100,
      onResult(event) {
        getLocalAuth();
      },
    }),
  );
</script>

<div class="mt-14 flex w-full justify-center">
  <div>
    <h1 class="text-primary text-center text-4xl font-bold">Log in</h1>
    <p class="mt-1 text-center text-sm">
      Or <a href="/signup" class="underline">sign up</a>
    </p>

    <form action="?/login" method="post" class="form-control mt-4" use:enhance>
      <label
        for="username"
        class="input input-bordered mt-4 flex items-center gap-2 {$delayed ? 'input-disabled' : ''}"
      >
        <User opacity={70} />
        <input
          type="text"
          name="username"
          id="username"
          placeholder="Username"
          bind:value={$form.username}
          {...$constraints.username}
        />
      </label>

      {#if Array.isArray($errors.username)}
        <span class="text-error mt-1">{$errors.username[0]}</span>
      {/if}

      <label
        for="password"
        class="input input-bordered mt-4 flex items-center gap-2 {$delayed ? 'input-disabled' : ''}"
      >
        <KeyRound opacity={70} />
        <input
          type="password"
          name="password"
          id="password"
          placeholder="Password"
          bind:value={$form.password}
          {...$constraints.password}
        />
      </label>

      {#if Array.isArray($errors.password)}
        <span class="text-error mt-1">{$errors.password[0]}</span>
      {/if}

      <button
        class="btn btn-primary mt-4 flex items-center gap-2 text-lg {$delayed
          ? 'btn-disabled'
          : ''}"
      >
        {#if $delayed}
          <span class="loading loading-spinner"></span>
        {/if}
        <span>Log in</span>
      </button>
    </form>
  </div>
</div>
