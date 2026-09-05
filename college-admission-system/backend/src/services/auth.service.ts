import { Role } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { hashPassword, comparePassword, compareAgainstDummyHash } from "@/utils/password";
import { AppError } from "@/middlewares/error.middleware";
import * as tokenService from "@/services/token.service";
import * as emailService from "@/services/email.service";

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export async function registerStudent(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Signup is one of the few auth endpoints that intentionally does NOT
    // stay fully generic on enumeration: a real user needs to be told
    // "you already have an account" for the flow to be usable, and this is
    // a much lower-severity leak than doing the same on /login or
    // /forgot-password (which we keep fully generic below).
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: Role.STUDENT,
      studentProfile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
        },
      },
    },
  });

  const rawToken = await tokenService.createEmailVerificationToken(user.id);

  try {
    await emailService.sendVerificationEmail(user.email, rawToken);
  } catch (error) {
    // The account is already created at this point — a transient email
    // provider failure shouldn't fail the whole signup request. The user
    // can always hit /resend-verification.
    console.error("Failed to send verification email:", error);
  }

  return { id: user.id, email: user.email, role: user.role };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await compareAgainstDummyHash(password); // normalize response timing
    throw new AppError("Invalid email or password", 401);
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  const tokens = await tokenService.issueTokenPair(user.id, user.role);

  return {
    tokens,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
  };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (rawRefreshToken) {
    await tokenService.revokeRefreshToken(rawRefreshToken);
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    studentProfile: user.studentProfile,
  };
}

export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Silent no-op if the account doesn't exist or is already verified — the
  // controller returns the same generic message regardless (enumeration
  // protection).
  if (user && !user.isEmailVerified) {
    const rawToken = await tokenService.createEmailVerificationToken(user.id);
    try {
      await emailService.sendVerificationEmail(user.email, rawToken);
    } catch (error) {
      console.error("Failed to resend verification email:", error);
    }
  }
}

export async function verifyEmail(rawToken: string): Promise<void> {
  await tokenService.consumeEmailVerificationToken(rawToken);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always behaves identically whether or not the account exists — the
  // controller's response text is the same either way.
  if (user) {
    const rawToken = await tokenService.createPasswordResetToken(user.id);
    try {
      await emailService.sendPasswordResetEmail(user.email, rawToken);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  }
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const userId = await tokenService.consumePasswordResetToken(rawToken);
  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // A password reset is a strong signal the old password may have been
  // compromised (or the user simply wants a clean slate) — either way,
  // every existing session should end, not just the device doing the reset.
  await tokenService.revokeAllUserRefreshTokens(userId);
}
