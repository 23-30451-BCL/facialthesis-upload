import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { personnelTable, accountsTable, sessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

async function getSessionAccount(req: any): Promise<{ id: number; role: string; personnelId: number | null } | null> {
  const token = req.cookies?.session_token;
  if (!token) return null;
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.sessionToken, token)).limit(1);
  if (!session || session.expiresAt < new Date()) return null;
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, session.accountId)).limit(1);
  if (!account) return null;
  return { id: account.id, role: account.role, personnelId: account.personnelId ?? null };
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const account = await getSessionAccount(req);
  if (!account) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (account.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return false; }
  return true;
}

router.get("/", async (req, res) => {
  const account = await getSessionAccount(req);
  if (!account) { res.status(401).json({ error: "Not authenticated" }); return; }

  let departmentFilter: string | null = null;

  if (account.role === "user") {
    if (account.personnelId) {
      const [p] = await db.select().from(personnelTable).where(eq(personnelTable.id, account.personnelId)).limit(1);
      if (p) departmentFilter = p.department;
    }
  } else if (account.role === "admin" && req.query.department) {
    departmentFilter = req.query.department as string;
  }

  const query = db
    .select({
      id: personnelTable.id,
      lastName: personnelTable.lastName,
      firstName: personnelTable.firstName,
      middleInitial: personnelTable.middleInitial,
      employeeId: personnelTable.employeeId,
      department: personnelTable.department,
      position: personnelTable.position,
      photoUrl: personnelTable.photoUrl,
      vehiclePlate: personnelTable.vehiclePlate,
      createdAt: personnelTable.createdAt,
      accountId: accountsTable.id,
    })
    .from(personnelTable)
    .leftJoin(accountsTable, eq(accountsTable.personnelId, personnelTable.id));

  const rows = departmentFilter
    ? await query.where(eq(personnelTable.department, departmentFilter))
    : await query;

  res.json(rows.map((r) => ({
    id: r.id,
    lastName: r.lastName,
    firstName: r.firstName,
    middleInitial: r.middleInitial ?? null,
    employeeId: r.employeeId,
    department: r.department,
    position: r.position,
    photoUrl: r.photoUrl ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
    hasAccount: r.accountId !== null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { lastName, firstName, middleInitial, employeeId, department, position, photoUrl, vehiclePlate, createAccount, password } = req.body;

  if (!lastName || !firstName || !employeeId || !department || !position) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const existing = await db.select().from(personnelTable).where(eq(personnelTable.employeeId, employeeId)).limit(1);
  if (existing.length > 0) { res.status(400).json({ error: "Employee ID already exists" }); return; }

  const [personnel] = await db
    .insert(personnelTable)
    .values({ lastName, firstName, middleInitial: middleInitial || null, employeeId, department, position, photoUrl: photoUrl || null, vehiclePlate: vehiclePlate || null })
    .returning();

  if (createAccount && password) {
    const existingAccount = await db.select().from(accountsTable).where(eq(accountsTable.username, employeeId)).limit(1);
    if (existingAccount.length === 0) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(accountsTable).values({ username: employeeId, passwordHash, role: "user", personnelId: personnel.id });
    }
  }

  res.status(201).json({
    id: personnel.id,
    lastName: personnel.lastName,
    firstName: personnel.firstName,
    middleInitial: personnel.middleInitial ?? null,
    employeeId: personnel.employeeId,
    department: personnel.department,
    position: personnel.position,
    photoUrl: personnel.photoUrl ?? null,
    vehiclePlate: personnel.vehiclePlate ?? null,
    hasAccount: !!(createAccount && password),
    createdAt: personnel.createdAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const account = await getSessionAccount(req);
  if (!account) { res.status(401).json({ error: "Not authenticated" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rows = await db
    .select({
      id: personnelTable.id,
      lastName: personnelTable.lastName,
      firstName: personnelTable.firstName,
      middleInitial: personnelTable.middleInitial,
      employeeId: personnelTable.employeeId,
      department: personnelTable.department,
      position: personnelTable.position,
      photoUrl: personnelTable.photoUrl,
      vehiclePlate: personnelTable.vehiclePlate,
      createdAt: personnelTable.createdAt,
      accountId: accountsTable.id,
    })
    .from(personnelTable)
    .leftJoin(accountsTable, eq(accountsTable.personnelId, personnelTable.id))
    .where(eq(personnelTable.id, id))
    .limit(1);

  if (rows.length === 0) { res.status(404).json({ error: "Personnel not found" }); return; }
  const r = rows[0];
  res.json({
    id: r.id, lastName: r.lastName, firstName: r.firstName,
    middleInitial: r.middleInitial ?? null, employeeId: r.employeeId,
    department: r.department, position: r.position,
    photoUrl: r.photoUrl ?? null, vehiclePlate: r.vehiclePlate ?? null,
    hasAccount: r.accountId !== null, createdAt: r.createdAt.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { lastName, firstName, middleInitial, department, position, photoUrl, vehiclePlate } = req.body;
  const existing = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (existing.length === 0) { res.status(404).json({ error: "Personnel not found" }); return; }

  const [updated] = await db
    .update(personnelTable)
    .set({
      lastName: lastName ?? existing[0].lastName,
      firstName: firstName ?? existing[0].firstName,
      middleInitial: middleInitial !== undefined ? middleInitial : existing[0].middleInitial,
      department: department ?? existing[0].department,
      position: position ?? existing[0].position,
      photoUrl: photoUrl !== undefined ? photoUrl : existing[0].photoUrl,
      vehiclePlate: vehiclePlate !== undefined ? vehiclePlate : existing[0].vehiclePlate,
    })
    .where(eq(personnelTable.id, id))
    .returning();

  const [accRow] = await db.select().from(accountsTable).where(eq(accountsTable.personnelId, id)).limit(1);
  res.json({
    id: updated.id, lastName: updated.lastName, firstName: updated.firstName,
    middleInitial: updated.middleInitial ?? null, employeeId: updated.employeeId,
    department: updated.department, position: updated.position,
    photoUrl: updated.photoUrl ?? null, vehiclePlate: updated.vehiclePlate ?? null,
    hasAccount: !!accRow, createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const existing = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (existing.length === 0) { res.status(404).json({ error: "Personnel not found" }); return; }

  await db.delete(personnelTable).where(eq(personnelTable.id, id));
  res.json({ message: "Personnel deleted" });
});

export default router;
