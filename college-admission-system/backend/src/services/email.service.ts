import { resend } from "@/config/resend";
import { env } from "@/config/env";

/**
 * Both functions send the RAW token in the email link. The database only
 * ever stores sha256(rawToken) (see utils/tokenGenerator.ts) — the email
 * itself is the only place the raw, usable token exists outside of a brief
 * moment in server memory during generation.
 */

export async function sendVerificationEmail(to: string, rawToken: string): Promise<void> {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Verify your email address",
    html: `
      <p>Welcome to the College Admission Management System.</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in ${env.EMAIL_VERIFICATION_TTL_MIN} minutes. If you didn't create this account, you can safely ignore this email.</p>
    `,
  });
}

/**
 * Phase 4: fired whenever an admin changes an application's status
 * (applicationReview.service.updateApplicationStatus). Sent best-effort,
 * after the DB transaction has already committed — see that service for
 * why a failed send here must never roll back a recorded decision.
 */
export async function sendApplicationStatusUpdateEmail(
  to: string,
  programName: string,
  status: string,
  note?: string | null
): Promise<void> {
  const readableStatus = status.replace(/_/g, " ").toLowerCase();

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `Update on your application to ${programName}`,
    html: `
      <p>There's an update on your application to <strong>${programName}</strong>.</p>
      <p>New status: <strong>${readableStatus}</strong></p>
      ${note ? `<p>Note from the admissions team: ${note}</p>` : ""}
      <p>Log in to your account to view the full details.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in ${env.PASSWORD_RESET_TTL_MIN} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
    `,
  });
}
