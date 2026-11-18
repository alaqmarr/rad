import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, users } from "@/db";

export async function GET() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const count = Number(row?.count || 0);
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(req: Request) {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
    if (Number(row?.count || 0) > 0) {
      return NextResponse.json(
        { error: "Setup is already locked because an admin account already exists." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        { error: "Name, valid email, and password (minimum 8 characters) are required." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: "admin",
      })
      .returning({ id: users.id, name: users.name, email: users.email });

    return NextResponse.json({ success: true, user: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create admin account." },
      { status: 500 }
    );
  }
}
