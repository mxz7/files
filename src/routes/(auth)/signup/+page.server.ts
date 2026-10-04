import { redirect } from "@sveltejs/kit";

export async function load({ locals }) {
  const auth = await locals.validate();
  if (auth.authenticated) redirect(302, "/files");
}
