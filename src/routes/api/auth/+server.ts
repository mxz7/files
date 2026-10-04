export async function GET({ locals }) {
  return Response.json(await locals.validate());
}
