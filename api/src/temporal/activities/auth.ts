import { eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, pool, schema } from "../../db/index.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { generateRefreshSecret, parseRefreshToken, REFRESH_TOKEN_TTL_MS, signAccessToken } from "../../auth/jwt.js";

async function issueSession(userId: string, role: "owner" | "tenant") {
  const accessToken = signAccessToken({ sub: userId, role });
  const secret = generateRefreshSecret();
  const refreshTokenHash = await hashPassword(secret);
  const [session] = await db
    .insert(schema.sessions)
    .values({
      userId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })
    .returning({ id: schema.sessions.id });
  return { accessToken, refreshToken: `${session.id}.${secret}` };
}

async function findValidSession(refreshToken: string) {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return null;
  const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, parsed.sessionId));
  if (!session || session.expiresAt < new Date()) return null;
  if (!(await verifyPassword(parsed.secret, session.refreshTokenHash))) return null;
  return session;
}

// Atomic signup: users + profiles (+ tenant_profiles if role=tenant) in one
// transaction. The old Supabase app created these rows client-side, after
// auth.signUp() returned — non-atomically, which could leave an auth
// identity with no profile row if the client crashed mid-flow. Fixed here;
// kept as a raw pg transaction (bypassing Drizzle) exactly as before the
// migration into Temporal.
export async function signupActivity(input: { email: string; password: string; role: "owner" | "tenant" }) {
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email));
  if (existing) throw ApplicationFailure.create({ type: "email_in_use", nonRetryable: true });

  const passwordHash = await hashPassword(input.password);

  const client = await pool.connect();
  let userId: string;
  try {
    await client.query("BEGIN");
    const userResult = await client.query<{ id: string }>(
      "insert into users (email, password_hash) values ($1, $2) returning id",
      [input.email, passwordHash],
    );
    userId = userResult.rows[0].id;

    await client.query("insert into profiles (id, role) values ($1, $2)", [userId, input.role]);

    if (input.role === "tenant") {
      await client.query("insert into tenant_profiles (user_id, full_name) values ($1, $2)", [userId, ""]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const session = await issueSession(userId, input.role);
  return { ...session, user: { id: userId, email: input.email, role: input.role } };
}

export async function loginActivity(input: { email: string; password: string }) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email));
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw ApplicationFailure.create({ type: "invalid_credentials", nonRetryable: true });
  }
  const [profile] = await db.select({ role: schema.profiles.role }).from(schema.profiles).where(eq(schema.profiles.id, user.id));
  const role = (profile?.role ?? "owner") as "owner" | "tenant";

  const session = await issueSession(user.id, role);
  return { ...session, user: { id: user.id, email: user.email, role } };
}

export async function refreshActivity(input: { refreshToken: string }) {
  const matched = await findValidSession(input.refreshToken);
  if (!matched) throw ApplicationFailure.create({ type: "invalid_refresh_token", nonRetryable: true });

  // Rotate: delete the used session, issue a fresh one.
  await db.delete(schema.sessions).where(eq(schema.sessions.id, matched.id));

  const [profile] = await db.select({ role: schema.profiles.role }).from(schema.profiles).where(eq(schema.profiles.id, matched.userId));
  const role = (profile?.role ?? "owner") as "owner" | "tenant";
  return issueSession(matched.userId, role);
}

export async function logoutActivity(input: { refreshToken: string }) {
  const matched = await findValidSession(input.refreshToken);
  if (matched) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, matched.id));
  }
}

export async function getMeActivity(input: { userId: string; userRole: "owner" | "tenant" }) {
  const [user] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, input.userId));
  if (!user) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return { ...user, role: input.userRole };
}
