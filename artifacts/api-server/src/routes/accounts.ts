import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, personnelTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const token = req.cookies?.session_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionToken, token))
    .limit(1);
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Session expired" });
    return false;
  }
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, session.accountId))
    .limit(1);
  if (!account || account.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

router.get("/", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const rows = await db
    .select({
      id: accountsTable.id,
      username: accountsTable.username,
      role: accountsTable.role,
      personnelId: accountsTable.personnelId,
      createdAt: accountsTable.createdAt,
      firstName: personnelTable.firstName,
      lastName: personnelTable.lastName,
    })
    .from(accountsTable)
    .leftJoin(personnelTable, eq(personnelTable.id, accountsTable.personnelId));

  const result = rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role as "admin" | "user",
    personnelId: r.personnelId ?? null,
    personnelName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : null,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { personnelId, password } = req.body;

  if (!personnelId || !password) {
    res.status(400).json({ error: "personnelId and password are required" });
    return;
  }

  const [personnel] = await db
    .select()
    .from(personnelTable)
    .where(eq(personnelTable.id, personnelId))
    .limit(1);

  if (!personnel) {
    res.status(404).json({ error: "Personnel not found" });
    return;
  }

  const existingByPersonnel = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.personnelId, personnelId))
    .limit(1);

  if (existingByPersonnel.length > 0) {
    res.status(400).json({ error: "This personnel already has an account" });
    return;
  }

  const existingByUsername = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.username, personnel.employeeId))
    .limit(1);

  if (existingByUsername.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [account] = await db
    .insert(accountsTable)
    .values({
      username: personnel.employeeId,
      passwordHash,
      role: "user",
      personnelId: personnel.id,
    })
    .returning();

  res.status(201).json({
    id: account.id,
    username: account.username,
    role: account.role as "admin" | "user",
    personnelId: account.personnelId ?? null,
    personnelName: `${personnel.firstName} ${personnel.lastName}`,
    createdAt: account.createdAt.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [updated] = await db
    .update(accountsTable)
    .set({ passwordHash })
    .where(eq(accountsTable.id, id))
    .returning();

  let personnelName: string | null = null;
  if (updated.personnelId) {
    const [p] = await db
      .select()
      .from(personnelTable)
      .where(eq(personnelTable.id, updated.personnelId))
      .limit(1);
    if (p) personnelName = `${p.firstName} ${p.lastName}`;
  }

  res.json({
    id: updated.id,
    username: updated.username,
    role: updated.role as "admin" | "user",
    personnelId: updated.personnelId ?? null,
    personnelName,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db.delete(accountsTable).where(eq(accountsTable.id, id));

  res.json({ message: "Account deleted" });
});

export default router;
