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
  const fromEmail = getResendFrom();

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY is not set!");
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject,
      html: createPasswordResetEmailTemplate({ resetUrl, userName }),
    };

    const result = await getResendClient().emails.send(emailData);

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
