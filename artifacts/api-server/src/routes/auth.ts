import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, personnelTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router: IRouter = Router();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.username, username))
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await db.insert(sessionsTable).values({
    sessionToken: token,
    accountId: account.id,
    expiresAt,
  });

  res.cookie("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  let name: string | null = null;
  if (account.personnelId) {
    const [personnel] = await db
      .select()
      .from(personnelTable)
      .where(eq(personnelTable.id, account.personnelId))
      .limit(1);
    if (personnel) {
      name = `${personnel.firstName} ${personnel.lastName}`;
    }
  }

  res.json({
    id: account.id,
    username: account.username,
    role: account.role,
    personnelId: account.personnelId ?? null,
    name,
  });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.sessionToken, token));
    res.clearCookie("session_token", { path: "/" });
  }
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  const token = req.cookies?.session_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionToken, token))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionToken, token));
    }
    res.clearCookie("session_token", { path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, session.accountId))
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "Account not found" });
    return;
  }

  let name: string | null = null;
  if (account.personnelId) {
    const [personnel] = await db
      .select()
      .from(personnelTable)
      .where(eq(personnelTable.id, account.personnelId))
      .limit(1);
    if (personnel) {
      name = `${personnel.firstName} ${personnel.lastName}`;
    }
  }

  res.json({
    id: account.id,
    username: account.username,
    role: account.role,
    personnelId: account.personnelId ?? null,
    name,
  });
});

export default router;
