import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in backend/.env before seeding. " +
        "See .env.example."
    );
  }

  if (adminPassword.length < 8) {
    throw new Error("ADMIN_SEED_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);

  // Upsert: safe to re-run (e.g. on every deploy) without creating duplicates
  // or clobbering the password of an admin who has since changed it via the
  // app — only the initial creation sets the password hash.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {}, // do not overwrite an existing admin's password/role on re-run
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isEmailVerified: true, // seeded admin doesn't need the email verification flow
    },
  });

  console.log(`✅ Admin user ready: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
