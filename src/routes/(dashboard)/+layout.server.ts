import { redirect } from "@sveltejs/kit";

export async function load({ locals }) {
  const auth = await locals.validate();

  if (!auth.authenticated) return redirect(302, "/login");

  return { auth };
}
