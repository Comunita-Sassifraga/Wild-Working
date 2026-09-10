/**
 * Who is signed in, for Server Components. Returns the internal id only:
 * pages never need the email, and the id is what every helper works with.
 */

import { clientServer } from "@/lib/db/server";

export async function utenteAttuale(): Promise<{ id: string } | null> {
  const client = await clientServer();
  const { data } = await client.auth.getUser();
  return data.user ? { id: data.user.id } : null;
}
