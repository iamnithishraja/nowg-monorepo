import { Resend } from "resend";
import { getEnv, getEnvWithDefault } from "~/lib/env";

let resend: Resend | null = null;
let RESEND_FROM = "";

// Initialize Resend client lazily after env is loaded
function getResendClient(): Resend {
  if (!resend) {
    const apiKey = getEnv("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

// Initialize RESEND_FROM lazily after env is loaded
function getResendFrom(): string {
  if (!RESEND_FROM) {
    RESEND_FROM = getEnvWithDefault(
      "RESEND_FROM",
      "Nowgai <no-reply@cuttheq.in>"
    );
  }
  return RESEND_FROM;
}

interface SendVerificationEmailProps {
  to: string;
  subject: string;
  verificationUrl: string;
  userName: string;
}

interface SendPasswordResetEmailProps {
  to: string;
  subject: string;
  resetUrl: string;
  userName: string;
}

interface SendTeamInvitationEmailProps {
  to: string;
  subject: string;
  invitationUrl: string;
  teamName: string;
  inviterName: string;
  role: string;
}

export async function sendVerificationEmail({
  to,
  subject,
  verificationUrl,
  userName,
}: SendVerificationEmailProps) {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.error("❌ RESEND_API_KEY is not set!");
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  const fromEmail = getResendFrom();
  if (!fromEmail) {
    console.error("❌ RESEND_FROM is not set!");
    throw new Error("RESEND_FROM environment variable is required");
  }

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject,
      html: createVerificationEmailTemplate({ verificationUrl, userName }),
      text: createVerificationEmailTemplate({ verificationUrl, userName }),
    };

    const result = await getResendClient().emails.send(emailData);

    return result;
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    throw new Error(
      `Failed to send verification email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function sendPasswordResetEmail({
  to,
  subject,
  resetUrl,
  userName,
}: SendPasswordResetEmailProps) {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.error("❌ RESEND_API_KEY is not set!");
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  const fromEmail = getResendFrom();
  if (!fromEmail) {
    console.error("❌ RESEND_FROM is not set!");
    throw new Error("RESEND_FROM environment variable is required");
  }

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject,
      html: createPasswordResetEmailTemplate({ resetUrl, userName }),
    };

    console.log("📧 Sending password reset email to:", to);
    const result = await getResendClient().emails.send(emailData);
    console.log("✅ Password reset email sent successfully:", result);

    if (!result || !result.data || !result.data.id) {
      throw new Error("Email service returned invalid response");
    }

    return result;
  } catch (error) {
    console.error("❌ Error sending password reset email:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : error
    );
    throw new Error(
      `Failed to send password reset email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function sendTeamInvitationEmail({
  to,
  subject,
  invitationUrl,
  teamName,
  inviterName,
  role,
}: SendTeamInvitationEmailProps) {
  const apiKey = getEnv("RESEND_API_KEY");
  const fromEmail = getResendFrom();

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY is not set!");
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  if (!fromEmail) {
    console.error("❌ RESEND_FROM is not set!");
    throw new Error("RESEND_FROM environment variable is required");
  }

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject,
      html: createTeamInvitationEmailTemplate({
        invitationUrl,
        teamName,
        inviterName,
        role,
      }),
    };

    const result = await getResendClient().emails.send(emailData);

    return result;
  } catch (error) {
    console.error("❌ Error sending team invitation email:", error);
    throw new Error(
      `Failed to send team invitation email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createVerificationEmailTemplate({
  verificationUrl,
  userName,
}: {
  verificationUrl: string;
  userName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;    console.error(
      "Error details:",
      error instanceof Error ? error.message : error
    );
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .button {
          display: inline-block;
          background-color: #000;
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: background-color 0.2s;
        }
        .button:hover {
          background-color: #333;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #888;
        }
        .link {
          word-break: break-all;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai</div>
        </div>
        
        <h1 class="title">Verify your email address</h1>
        
        <div class="message">
          <p>Hi ${userName},</p>
          <p>Thanks for signing up for Nowgai! To complete your registration and start building fullstack web apps, please verify your email address by clicking the button below.</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        
        <div class="message">
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p class="link">${verificationUrl}</p>
        </div>
        
        <div class="footer">
          <p>This verification link will expire in 1 hour for security reasons.</p>
          <p>If you didn't create an account with Nowgai, you can safely ignore this email.</p>
          <p>Best regards,<br>The Nowgai Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createPasswordResetEmailTemplate({
  resetUrl,
  userName,
}: {
  resetUrl: string;
  userName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .button {
          display: inline-block;
          background-color: #000;
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: background-color 0.2s;
        }
        .button:hover {
          background-color: #333;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #888;
        }
        .link {
          word-break: break-all;
          color: #666;
          font-size: 14px;
        }
        .warning {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai</div>
        </div>
        
        <h1 class="title">Reset your password</h1>
        
        <div class="message">
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password for your Nowgai account. Click the button below to create a new password.</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        
        <div class="message">
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p class="link">${resetUrl}</p>
        </div>

        <div class="warning">
          <strong>Security Notice:</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </div>
        
        <div class="footer">
          <p>This password reset link will expire in 1 hour for security reasons.</p>
          <p>Best regards,<br>The Nowgai Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createTeamInvitationEmailTemplate({
  invitationUrl,
  teamName,
  inviterName,
  role,
}: {
  invitationUrl: string;
  teamName: string;
  inviterName: string;
  role: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .button {
          display: inline-block;
          background-color: #000;
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: background-color 0.2s;
        }
        .button:hover {
          background-color: #333;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #888;
        }
        .link {
          word-break: break-all;
          color: #666;
          font-size: 14px;
        }
        .info-box {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #0c4a6e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai</div>
        </div>
        
        <h1 class="title">You've been invited to join a team!</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong> as a <strong>${role}</strong>.</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${invitationUrl}" class="button">Accept Invitation</a>
        </div>
        
        <div class="message">
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p class="link">${invitationUrl}</p>
        </div>

        <div class="info-box">
          <strong>Important:</strong> This invitation will expire in 24 hours. Please accept it soon to join the team.
        </div>
        
        <div class="footer">
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          <p>Best regards,<br>The Nowgai Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendOrgUserInvitationEmailProps {
  to: string;
  organizationName: string;
  inviterName: string;
  acceptUrl?: string;
  rejectUrl?: string;
}

export async function sendOrgUserInvitationEmail({
  to,
  organizationName,
  inviterName,
  acceptUrl,
  rejectUrl,
}: SendOrgUserInvitationEmailProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `You've been invited to join ${organizationName}`,
      html: createOrgUserInvitationEmailTemplate({
        organizationName,
        inviterName,
        acceptUrl,
        rejectUrl,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending org user invitation email:", error);
    throw new Error(
      `Failed to send org user invitation email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createOrgUserInvitationEmailTemplate({
  organizationName,
  inviterName,
  acceptUrl,
  rejectUrl,
}: {
  organizationName: string;
  inviterName: string;
  acceptUrl?: string;
  rejectUrl?: string;
}) {
  const hasButtons = acceptUrl && rejectUrl;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Organization Invitation - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #888;
        }
        .info-box {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #0c4a6e;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          margin: 0 10px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
        }
        .button-accept {
          background-color: #10b981;
          color: white;
        }
        .button-reject {
          background-color: #ef4444;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai Admin</div>
        </div>
        
        <h1 class="title">You've Been Invited to Join an Organization</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join the organization <strong>"${organizationName}"</strong>.</p>
          <p>You can now be assigned to projects within this organization by project admins.</p>
        </div>

        <div class="info-box">
          <strong>What this means:</strong> Project admins in this organization can now add you to their projects. You'll receive notifications when you're assigned to a project.
        </div>
        
        ${
          hasButtons
            ? `
        <div class="button-container">
          <a href="${acceptUrl}" class="button button-accept">Accept Invitation</a>
          <a href="${rejectUrl}" class="button button-reject">Reject Invitation</a>
        </div>
        `
            : ""
        }
        
        <div class="footer">
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendProjectAdminAssignedEmailProps {
  to: string;
  projectName: string;
  organizationName: string;
  assignedByName: string;
}

export async function sendProjectAdminAssignedEmail({
  to,
  projectName,
  organizationName,
  assignedByName,
}: SendProjectAdminAssignedEmailProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `You've been assigned as Project Admin for ${projectName}`,
      html: createProjectAdminAssignedEmailTemplate({
        projectName,
        organizationName,
        assignedByName,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending project admin assigned email:", error);
    throw new Error(
      `Failed to send project admin assigned email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createProjectAdminAssignedEmailTemplate({
  projectName,
  organizationName,
  assignedByName,
}: {
  projectName: string;
  organizationName: string;
  assignedByName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Admin Assignment - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .project-badge {
          display: inline-block;
          background-color: #000;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          margin: 10px 0;
        }
        .role-badge {
          display: inline-block;
          background-color: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          margin: 10px 0;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #888;
        }
        .info-box {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #0c4a6e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai Admin</div>
        </div>
        
        <h1 class="title">You've Been Assigned as Project Admin</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${assignedByName}</strong> has assigned you as a <strong>Project Admin</strong> for the project <strong>"${projectName}"</strong> in the organization <strong>"${organizationName}"</strong>.</p>
          <p>Project:</p>
          <div class="project-badge">${projectName}</div>
          <p>Your role:</p>
          <div class="role-badge">Project Admin</div>
        </div>

        <div class="info-box">
          <strong>What this means:</strong> As a Project Admin, you can manage this project, add team members, and oversee all project activities. You have full administrative access to this project.
        </div>
        
        <div class="footer">
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendOrgUserInvitationEmailForNewUserProps {
  to: string;
  organizationName: string;
  inviterName: string;
  signupUrl: string;
  acceptUrl?: string;
  rejectUrl?: string;
}

export async function sendOrgUserInvitationEmailForNewUser({
  to,
  organizationName,
  inviterName,
  signupUrl,
  acceptUrl,
  rejectUrl,
}: SendOrgUserInvitationEmailForNewUserProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `You've been invited to join ${organizationName} on Nowgai`,
      html: createOrgUserInvitationEmailForNewUserTemplate({
        organizationName,
        inviterName,
        signupUrl,
        acceptUrl,
        rejectUrl,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending org user invitation email for new user:", error);
    throw new Error(
      `Failed to send org user invitation email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createOrgUserInvitationEmailForNewUserTemplate({
  organizationName,
  inviterName,
  signupUrl,
  acceptUrl,
  rejectUrl,
}: {
  organizationName: string;
  inviterName: string;
  signupUrl: string;
  acceptUrl?: string;
  rejectUrl?: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Organization Invitation - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #888;
        }
        .info-box {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #0c4a6e;
        }
        .highlight-box {
          background-color: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          color: #92400e;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          margin: 0 10px 10px 10px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
        }
        .button-primary {
          background-color: #3b82f6;
          color: white;
        }
        .button-accept {
          background-color: #10b981;
          color: white;
        }
        .button-reject {
          background-color: #ef4444;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai Admin</div>
        </div>
        
        <h1 class="title">You've Been Invited to Join an Organization</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join the organization <strong>"${organizationName}"</strong> on Nowgai.</p>
          <p>To accept this invitation, you'll need to create a Nowgai account first.</p>
        </div>

        <div class="highlight-box">
          <strong>📝 Next Steps:</strong><br>
          1. Click the button below to create your account<br>
          2. Once registered, you'll be able to accept or reject the organization invitation<br>
          3. After accepting, project admins can assign you to their projects
        </div>
        
        <div class="button-container">
          <a href="${signupUrl}" class="button button-primary">Create Account & Accept Invitation</a>
        </div>

        <div class="info-box">
          <strong>What this means:</strong> Once you accept, project admins in this organization can add you to their projects. You'll receive notifications when you're assigned to a project.
        </div>
        
        <div class="footer">
          <p>If you don't want to join this organization, you can simply ignore this email.</p>
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// Enterprise Organization Request Emails
// ============================================

interface SendEnterpriseRequestSubmittedEmailProps {
  to: string;
  userName: string;
  organizationName: string;
}

export async function sendEnterpriseRequestSubmittedEmail({
  to,
  userName,
  organizationName,
}: SendEnterpriseRequestSubmittedEmailProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `Enterprise Request Received - ${organizationName}`,
      html: createEnterpriseRequestSubmittedTemplate({ userName, organizationName }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending enterprise request submitted email:", error);
    throw new Error(
      `Failed to send enterprise request submitted email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createEnterpriseRequestSubmittedTemplate({
  userName,
  organizationName,
}: {
  userName: string;
  organizationName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Enterprise Request Received - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #0f0f1a;
        }
        .container {
          background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
          border-radius: 16px;
          padding: 40px;
          border: 1px solid rgba(123, 76, 255, 0.2);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          background: linear-gradient(135deg, #7b4cff 0%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }
        .icon-container {
          width: 80px;
          height: 80px;
          background: rgba(251, 191, 36, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #fbbf24;
          margin-bottom: 10px;
          text-align: center;
        }
        .subtitle {
          font-size: 16px;
          color: #9ca3af;
          text-align: center;
          margin-bottom: 30px;
        }
        .message {
          font-size: 16px;
          color: #d1d5db;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .info-box {
          background: rgba(123, 76, 255, 0.1);
          border: 1px solid rgba(123, 76, 255, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-box h4 {
          color: #a78bfa;
          margin: 0 0 15px 0;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-box ul {
          margin: 0;
          padding-left: 20px;
          color: #9ca3af;
        }
        .info-box li {
          margin-bottom: 10px;
        }
        .detail-box {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
        }
        .detail-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-value {
          font-size: 16px;
          color: #f3f4f6;
          font-weight: 500;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
        .footer a {
          color: #7b4cff;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai</div>
        </div>
        
        <div class="icon-container">
          <span style="font-size: 36px;">⏳</span>
        </div>
        
        <h1 class="title">Request Under Review</h1>
        <p class="subtitle">Thank you for your interest in Nowgai Enterprise!</p>
        
        <div class="message">
          <p>Hi ${userName},</p>
          <p>We've received your Enterprise organization request for <strong style="color: #f3f4f6;">"${organizationName}"</strong>. Our team is now reviewing your application.</p>
        </div>

        <div class="detail-box">
          <div class="detail-label">Organization Name</div>
          <div class="detail-value">${organizationName}</div>
        </div>

        <div class="info-box">
          <h4>What happens next?</h4>
          <ul>
            <li>Our team will review your request within 1-2 business days</li>
            <li>You'll receive an email notification once a decision is made</li>
            <li>If approved, you'll get immediate access to Enterprise features</li>
            <li>We may reach out if we need additional information</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>Have questions? Contact us at <a href="mailto:support@nowgai.com">support@nowgai.com</a></p>
          <p>Best regards,<br>The Nowgai Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendEnterpriseRequestNotificationToAdminProps {
  organizationName: string;
  organizationId: string;
  requesterEmail: string;
  requesterName: string;
  companySize: string;
  industry: string;
  website: string;
  useCase: string;
}

export async function sendEnterpriseRequestNotificationToAdmin({
  organizationName,
  organizationId,
  requesterEmail,
  requesterName,
  companySize,
  industry,
  website,
  useCase,
}: SendEnterpriseRequestNotificationToAdminProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();
  // Always notify tech@nowg.ai for enterprise requests
  const adminEmail = "tech@nowg.ai";

  try {
    const emailData = {
      from: fromEmail,
      to: adminEmail,
      subject: `🏢 New Enterprise Request: ${organizationName}`,
      html: createEnterpriseRequestNotificationToAdminTemplate({
        organizationName,
        organizationId,
        requesterEmail,
        requesterName,
        companySize,
        industry,
        website,
        useCase,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending enterprise request notification to admin:", error);
    throw new Error(
      `Failed to send enterprise request notification: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createEnterpriseRequestNotificationToAdminTemplate({
  organizationName,
  organizationId,
  requesterEmail,
  requesterName,
  companySize,
  industry,
  website,
  useCase,
}: {
  organizationName: string;
  organizationId: string;
  requesterEmail: string;
  requesterName: string;
  companySize: string;
  industry: string;
  website: string;
  useCase: string;
}) {
  const adminUrl = getEnvWithDefault("ADMIN_PANEL_URL", "http://localhost:5174");
  const reviewUrl = `${adminUrl}/admin/organizations`;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Enterprise Request - Nowgai Admin</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #7b4cff;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #7b4cff;
          margin-bottom: 5px;
        }
        .badge {
          display: inline-block;
          background: linear-gradient(135deg, #7b4cff 0%, #a855f7 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .title {
          font-size: 22px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 20px 0 10px;
        }
        .org-name {
          font-size: 28px;
          font-weight: 700;
          color: #7b4cff;
          margin-bottom: 20px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 25px 0;
        }
        .detail-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }
        .detail-item.full-width {
          grid-column: span 2;
        }
        .detail-label {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        .detail-value {
          font-size: 15px;
          color: #1a1a1a;
          font-weight: 500;
        }
        .use-case-box {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .use-case-box h4 {
          color: #0c4a6e;
          margin: 0 0 10px 0;
          font-size: 14px;
        }
        .use-case-box p {
          color: #0369a1;
          margin: 0;
          font-style: italic;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 40px;
          background: linear-gradient(135deg, #7b4cff 0%, #a855f7 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 13px;
          color: #888;
          text-align: center;
        }
        .org-id {
          font-family: monospace;
          font-size: 12px;
          color: #9ca3af;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai Admin</div>
          <span class="badge">New Enterprise Request</span>
        </div>
        
        <h1 class="title">New Organization Request</h1>
        <div class="org-name">${organizationName}</div>
        <span class="org-id">ID: ${organizationId}</span>
        
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Requester Name</div>
            <div class="detail-value">${requesterName}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Email</div>
            <div class="detail-value">${requesterEmail}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Company Size</div>
            <div class="detail-value">${companySize}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Industry</div>
            <div class="detail-value">${industry}</div>
          </div>
          <div class="detail-item full-width">
            <div class="detail-label">Website</div>
            <div class="detail-value">${website}</div>
          </div>
        </div>

        <div class="use-case-box">
          <h4>📋 Use Case Description</h4>
          <p>"${useCase}"</p>
        </div>
        
        <div class="button-container">
          <a href="${reviewUrl}" class="button">Review Request</a>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Nowgai Admin.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendEnterpriseRequestApprovedEmailProps {
  to: string;
  userName: string;
  organizationName: string;
}

export async function sendEnterpriseRequestApprovedEmail({
  to,
  userName,
  organizationName,
}: SendEnterpriseRequestApprovedEmailProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `🎉 Enterprise Request Approved - ${organizationName}`,
      html: createEnterpriseRequestApprovedTemplate({ userName, organizationName }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending enterprise request approved email:", error);
    throw new Error(
      `Failed to send enterprise request approved email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createEnterpriseRequestApprovedTemplate({
  userName,
  organizationName,
}: {
  userName: string;
  organizationName: string;
}) {
  const appUrl = getEnvWithDefault("APP_URL", "http://localhost:3000");
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Enterprise Request Approved - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #0f0f1a;
        }
        .container {
          background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
          border-radius: 16px;
          padding: 40px;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          background: linear-gradient(135deg, #7b4cff 0%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }
        .icon-container {
          width: 80px;
          height: 80px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }
        .title {
          font-size: 28px;
          font-weight: 600;
          color: #10b981;
          margin-bottom: 10px;
          text-align: center;
        }
        .subtitle {
          font-size: 16px;
          color: #9ca3af;
          text-align: center;
          margin-bottom: 30px;
        }
        .message {
          font-size: 16px;
          color: #d1d5db;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .highlight {
          color: #f3f4f6;
          font-weight: 600;
        }
        .info-box {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-box h4 {
          color: #10b981;
          margin: 0 0 15px 0;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-box ul {
          margin: 0;
          padding-left: 20px;
          color: #9ca3af;
        }
        .info-box li {
          margin-bottom: 10px;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 40px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
        .footer a {
          color: #7b4cff;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai</div>
        </div>
        
        <div class="icon-container">
          <span style="font-size: 36px;">🎉</span>
        </div>
        
        <h1 class="title">Request Approved!</h1>
        <p class="subtitle">Welcome to Nowgai Enterprise</p>
        
        <div class="message">
          <p>Hi ${userName},</p>
          <p>Great news! Your Enterprise organization request for <span class="highlight">"${organizationName}"</span> has been approved.</p>
          <p>You now have full access to all Enterprise features and can start building with your team.</p>
        </div>

        <div class="info-box">
          <h4>What you can do now</h4>
          <ul>
            <li>Invite team members to your organization</li>
            <li>Create projects and assign project admins</li>
            <li>Access Enterprise-tier AI models and features</li>
            <li>Manage billing and credits for your organization</li>
          </ul>
        </div>
        
        <div class="button-container">
          <a href="${appUrl}/manage-org/convo" class="button">Go to Dashboard</a>
        </div>
        
        <div class="footer">
          <p>Need help getting started? Contact us at <a href="mailto:support@nowgai.com">support@nowgai.com</a></p>
          <p>Best regards,<br>The Nowgai Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendEnterpriseRequestRejectedEmailProps {
  to: string;
  userName: string;
  organizationName: string;
  reason?: string;
}

export async function sendEnterpriseRequestRejectedEmail({
  to,
  userName,
  organizationName,
  reason,
}: SendEnterpriseRequestRejectedEmailProps) {
  const resendClient = getResendClient();
  const fromEmail = getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `Enterprise Request Update - ${organizationName}`,
      html: createEnterpriseRequestRejectedTemplate({ userName, organizationName, reason }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending enterprise request rejected email:", error);
    throw new Error(
      `Failed to send enterprise request rejected email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createEnterpriseRequestRejectedTemplate({
  userName,
  organizationName,
  reason,
}: {
  userName: string;
  organizationName: string;
  reason?: string;
}) {
  const appUrl = getEnvWithDefault("APP_URL", "http://localhost:3000");
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Enterprise Request Update - Nowgai</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #0f0f1a;
        }
        .container {
          background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
          border-radius: 16px;
          padding: 40px;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          background: linear-gradient(135deg, #7b4cff 0%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #f87171;
          margin-bottom: 10px;
          text-align: center;
        }
        .subtitle {
          font-size: 16px;
          color: #9ca3af;
          text-align: center;
          margin-bottom: 30px;
        }
        .message {
          font-size: 16px;
          color: #d1d5db;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .highlight {
          color: #f3f4f6;
          font-weight: 600;
        }
        .reason-box {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .reason-box h4 {
          color: #f87171;
          margin: 0 0 10px 0;
          font-size: 14px;
        }
        .reason-box p {
          color: #fca5a5;
          margin: 0;
        }
        .info-box {
          background: rgba(123, 76, 255, 0.1);
          border: 1px solid rgba(123, 76, 255, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-box h4 {
          color: #a78bfa;
          margin: 0 0 15px 0;
          font-size: 14px;
        }
        .info-box p {
          color: #9ca3af;
          margin: 0;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 40px;
          background: linear-gradient(135deg, #7b4cff 0%, #a855f7 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
        .footer a {
          color: #7b4cff;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Nowgai</div>
        </div>
        
        <h1 class="title">Request Not Approved</h1>
        <p class="subtitle">We appreciate your interest in Nowgai Enterprise</p>
        
        <div class="message">
          <p>Hi ${userName},</p>
          <p>Thank you for your interest in Nowgai Enterprise. After reviewing your request for <span class="highlight">"${organizationName}"</span>, we're unable to approve it at this time.</p>
        </div>

        ${reason ? `
        <div class="reason-box">
          <h4>Reason</h4>
          <p>${reason}</p>
        </div>
        ` : ''}

        <div class="info-box">
          <h4>What you can do</h4>
          <p>You can still use Nowgai with our Core plan, which includes many powerful features. If you believe this decision was made in error or would like to discuss your use case further, please don't hesitate to reach out to us.</p>
        </div>
        
        <div class="button-container">
          <a href="${appUrl}/manage-org/convo" class="button">Try Core Plan</a>
        </div>
        
        <div class="footer">
          <p>Questions? Contact us at <a href="mailto:support@nowgai.com">support@nowgai.com</a></p>
          <p>Best regards,<br>The Nowgai Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
