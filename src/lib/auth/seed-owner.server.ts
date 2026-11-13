import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

const EMAIL = "ou1163359315@gmail.com";
const PASSWORD = "ouxiaoxin456";

const globalSeed = globalThis as typeof globalThis & { __mtOwnerSeed__?: Promise<void> };

/** Ensure the site owner exists, with this password, as the only admin. */
export function seedOwner(): Promise<void> {
  globalSeed.__mtOwnerSeed__ ??= run().catch((error) => {
    globalSeed.__mtOwnerSeed__ = undefined;
    throw error;
  });
  return globalSeed.__mtOwnerSeed__;
}

async function run() {
  const sql = await getSql();
  const hash = await hashPassword(PASSWORD);
  const existing = await sql<{ id: string }>`select id from "user" where lower(email) = ${EMAIL}`;
  let userId = existing[0]?.id;
  if (!userId) {
    userId = crypto.randomUUID();
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${EMAIL}, ${EMAIL}, true, now(), now())
    `;
  }
  const accounts = await sql<{ id: string }>`
    select id from account where "userId" = ${userId} and "providerId" = 'credential'
  `;
  if (accounts[0]) {
    await sql`update account set password = ${hash}, "updatedAt" = now() where id = ${accounts[0].id}`;
  } else {
    const accountId = crypto.randomUUID();
    await sql`
      insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${accountId}, ${userId}, 'credential', ${userId}, ${hash}, now(), now())
    `;
  }
  await sql`delete from admins where user_id <> ${userId}`;
  await sql`
    insert into admins (user_id) values (${userId})
    on conflict (user_id) do nothing
  `;
  const forever = new Date("2099-01-01T00:00:00Z");
  await sql`
    insert into user_access (user_id, disabled, expires_at)
    values (${userId}, false, ${forever})
    on conflict (user_id) do update
      set disabled = false, expires_at = ${forever}
  `;
}
