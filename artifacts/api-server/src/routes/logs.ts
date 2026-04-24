import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceLogsTable, accountsTable, personnelTable, sessionsTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

async function getSessionUser(req: any): Promise<{ accountId: number; role: string; personnelId: number | null } | null> {
  const token = req.cookies?.session_token;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionToken, token))
    .limit(1);

  if (!session || session.expiresAt < new Date()) return null;

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, session.accountId))
    .limit(1);

  if (!account) return null;
  return { accountId: account.id, role: account.role, personnelId: account.personnelId ?? null };
}

router.get("/", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let department: string | null = null;

  if (user.role === "user" && user.personnelId) {
    const [personnel] = await db
      .select()
      .from(personnelTable)
      .where(eq(personnelTable.id, user.personnelId))
      .limit(1);
    if (personnel) {
      department = personnel.department;
    }
  } else if (user.role === "admin" && req.query.department) {
    department = req.query.department as string;
  }

  const logs = department
    ? await db
        .select()
        .from(attendanceLogsTable)
        .where(eq(attendanceLogsTable.department, department))
        .orderBy(desc(attendanceLogsTable.timestamp))
        .limit(200)
    : await db
        .select()
        .from(attendanceLogsTable)
        .orderBy(desc(attendanceLogsTable.timestamp))
        .limit(200);

  res.json(
    logs.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      name: l.name,
      department: l.department,
      vehiclePlate: l.vehiclePlate ?? null,
      logType: l.logType,
      timestamp: l.timestamp.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.FACIAL_RECOGNITION_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  const { employeeId, logType } = req.body;

  if (!employeeId) {
    res.status(400).json({ error: "employeeId is required" });
    return;
  }

  const [personnel] = await db
    .select()
    .from(personnelTable)
    .where(eq(personnelTable.employeeId, employeeId))
    .limit(1);

  if (!personnel) {
    res.status(404).json({ error: "Personnel not found for employeeId: " + employeeId });
    return;
  }

  const cooldownSeconds = 8;
  const cooldownTime = new Date(Date.now() - cooldownSeconds * 1000);

  const recentLog = await db
    .select()
    .from(attendanceLogsTable)
    .where(
      and(
        eq(attendanceLogsTable.employeeId, employeeId),
        gte(attendanceLogsTable.timestamp, cooldownTime)
      )
    )
    .limit(1);

  if (recentLog.length > 0) {
    res.status(200).json({ message: "Duplicate suppressed (cooldown active)", duplicate: true });
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [lastLogToday] = await db
    .select()
    .from(attendanceLogsTable)
    .where(
      and(
        eq(attendanceLogsTable.employeeId, employeeId),
        gte(attendanceLogsTable.timestamp, todayStart)
      )
    )
    .orderBy(desc(attendanceLogsTable.timestamp))
    .limit(1);

  let nextLogType: string;
  if (!lastLogToday) {
    nextLogType = "TIME_IN";
  } else if (lastLogToday.logType === "TIME_IN") {
    nextLogType = "TIME_OUT";
  } else {
    nextLogType = "TIME_IN";
  }

  const [log] = await db
    .insert(attendanceLogsTable)
    .values({
      personnelId: personnel.id,
      employeeId: personnel.employeeId,
      name: `${personnel.firstName} ${personnel.lastName}`,
      department: personnel.department,
      vehiclePlate: personnel.vehiclePlate ?? null,
      logType: nextLogType,
    })
    .returning();

  res.status(201).json({
    id: log.id,
    employeeId: log.employeeId,
    name: log.name,
    department: log.department,
    vehiclePlate: log.vehiclePlate ?? null,
    logType: log.logType,
    timestamp: log.timestamp.toISOString(),
  });
});

router.get("/personnel-photos", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.FACIAL_RECOGNITION_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  const personnel = await db
    .select({
      employeeId: personnelTable.employeeId,
      firstName: personnelTable.firstName,
      lastName: personnelTable.lastName,
      department: personnelTable.department,
      photoUrl: personnelTable.photoUrl,
    })
    .from(personnelTable)
    .where(eq(personnelTable.photoUrl, personnelTable.photoUrl));

  const withPhotos = personnel.filter((p) => p.photoUrl && p.photoUrl.startsWith("data:image"));

  res.json(
    withPhotos.map((p) => ({
      employeeId: p.employeeId,
      name: `${p.firstName} ${p.lastName}`,
      department: p.department,
      photoBase64: p.photoUrl,
    }))
  );
});

export default router;
