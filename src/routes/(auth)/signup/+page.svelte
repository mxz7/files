<script lang="ts">
  import { goto } from "$app/navigation";
  import { getLocalAuth } from "$lib/stores";
  import { KeyRound, ShieldAlert, User } from "lucide-svelte";
  import toast from "svelte-french-toast";
  import { superForm } from "sveltekit-superforms";

  let { data } = $props();

  const { form, errors, enhance, constraints, message, delayed } = $derived(
    superForm(data.form, {
      delayMs: 100,
      onResult(event) {
        getLocalAuth();
      },
    }),
  );

  // svelte-ignore state_referenced_locally
  message.subscribe((value) => {
    if (value === "ok") {
      toast.success("Logged in", {
        style:
          "--tw-bg-opacity: 1; background-color: var(--fallback-b3,oklch(var(--b3)/var(--tw-bg-opacity))); --tw-text-opacity: 1; color: var(--fallback-bc,oklch(var(--bc)/var(--tw-text-opacity)));",
        iconTheme: {
          primary: "#a6e3a1",
          secondary: "#FFFFFF",
        },
      });
      goto("/files", { invalidateAll: true });
      getLocalAuth();
    }
  });
</script>

<div class="mt-14 flex w-full justify-center">
  <div>
    <h1 class="text-primary text-center text-4xl font-bold">Sign up</h1>
    <p class="mt-1 text-center text-sm">
      Or <a href="/login" class="underline">log in</a>
    </p>

    <form action="?/signup" method="post" class="form-control mt-4" use:enhance>
      <label
        for="invite"
        class="input input-bordered input-primary flex items-center gap-2 {$delayed
          ? 'input-disabled'
          : ''}"
      >
        <ShieldAlert opacity={70} />
        <input
          type="text"
          name="invite"
          id="invite"
          placeholder="Invite Token"
          bind:value={$form.invite}
          {...$constraints.invite}
        />
      </label>

      {#if Array.isArray($errors.invite)}
        <span class="text-error mt-1">{$errors.invite[0]}</span>
      {/if}

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
        <span>Sign up</span>
      </button>
    </form>
  </div>
</div>
