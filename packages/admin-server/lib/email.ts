import { EnvConfig } from "@nowgai/shared/models";
import { Resend } from "resend";

let resend: Resend | null = null;
let RESEND_FROM = "";

// Initialize Resend client lazily after env is loaded
async function getResendClient(): Promise<Resend> {
  if (!resend) {
    // Get API key from database
    const envConfig = await EnvConfig.findOne({ key: "RESEND_API_KEY" });
    if (!envConfig) {
      throw new Error(
        "RESEND_API_KEY not found in database. Please add it via admin panel."
      );
    }
    resend = new Resend(envConfig.value);
  }
  return resend;
}

// Initialize RESEND_FROM lazily after env is loaded
async function getResendFrom(): Promise<string> {
  if (!RESEND_FROM) {
    const envConfig = await EnvConfig.findOne({ key: "RESEND_FROM" });
    RESEND_FROM = envConfig?.value || "Nowgai Admin <no-reply@cuttheq.in>";
  }
  return RESEND_FROM;
}

interface SendOrgAdminInvitationEmailProps {
  to: string;
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  rejectUrl: string;
}

export async function sendOrgAdminInvitationEmail({
  to,
  organizationName,
  inviterName,
  acceptUrl,
  rejectUrl,
}: SendOrgAdminInvitationEmailProps) {
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `You've been invited to be an Organization Admin for ${organizationName}`,
      html: createOrgAdminInvitationEmailTemplate({
        organizationName,
        inviterName,
        acceptUrl,
        rejectUrl,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error(
      "❌ Error sending organization admin invitation email:",
      error
    );
    throw new Error(
      `Failed to send organization admin invitation email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

interface SendUserRoleUpdateEmailProps {
  to: string;
  organizationName: string;
  inviterName: string;
  newRole: string;
  roleDisplayName: string;
}

export async function sendUserRoleUpdateEmail({
  to,
  organizationName,
  inviterName,
  newRole,
  roleDisplayName,
}: SendUserRoleUpdateEmailProps) {
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `Your role has been updated for ${organizationName}`,
      html: createUserRoleUpdateEmailTemplate({
        organizationName,
        inviterName,
        newRole,
        roleDisplayName,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending user role update email:", error);
    throw new Error(
      `Failed to send user role update email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createUserRoleUpdateEmailTemplate({
  organizationName,
  inviterName,
  newRole,
  roleDisplayName,
}: {
  organizationName: string;
  inviterName: string;
  newRole: string;
  roleDisplayName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Role Update - Nowgai</title>
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
        .role-badge {
          display: inline-block;
          background-color: #000;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
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
        
        <h1 class="title">Your Role Has Been Updated</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has updated your role for the organization <strong>"${organizationName}"</strong>.</p>
          <p>Your new role is:</p>
          <div class="role-badge">${roleDisplayName}</div>
        </div>

        <div class="info-box">
          <strong>What this means:</strong> Your access permissions and capabilities within the organization have been updated accordingly. If you have any questions, please contact your organization administrator.
        </div>
        
        <div class="footer">
          <p>If you didn't expect this role change, please contact your organization administrator.</p>
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createOrgAdminInvitationEmailTemplate({
  organizationName,
  inviterName,
  acceptUrl,
  rejectUrl,
}: {
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  rejectUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Organization Admin Invitation - Nowgai</title>
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
        .button-container {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: background-color 0.2s;
        }
        .button-accept {
          background-color: #000;
          color: white;
        }
        .button-accept:hover {
          background-color: #333;
        }
        .button-reject {
          background-color: #ef4444;
          color: white;
        }
        .button-reject:hover {
          background-color: #dc2626;
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
          <div class="logo">Nowgai Admin</div>
        </div>
        
        <h1 class="title">Organization Admin Invitation</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to become an Organization Admin for <strong>"${organizationName}"</strong>.</p>
          <p>As an Organization Admin, you will be able to manage your organization's settings and invite members from allowed domains.</p>
        </div>
        
        <div class="button-container">
          <a href="${acceptUrl}" class="button button-accept">Accept Invitation</a>
          <a href="${rejectUrl}" class="button button-reject">Reject</a>
        </div>
        
        <div class="message">
          <p>If the buttons don't work, you can also use these links:</p>
          <p><strong>Accept:</strong> <span class="link">${acceptUrl}</span></p>
          <p><strong>Reject:</strong> <span class="link">${rejectUrl}</span></p>
        </div>

        <div class="info-box">
          <strong>Important:</strong> This invitation will expire in 7 days. Please respond soon.
        </div>
        
        <div class="footer">
          <p>If you didn't expect this invitation, you can safely reject it or ignore this email.</p>
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface SendProjectCreatedEmailProps {
  to: string;
  projectName: string;
  organizationName: string;
}

export async function sendProjectCreatedEmail({
  to,
  projectName,
  organizationName,
}: SendProjectCreatedEmailProps) {
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `New Project Created: ${projectName}`,
      html: createProjectCreatedEmailTemplate({
        projectName,
        organizationName,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending project created email:", error);
    throw new Error(
      `Failed to send project created email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

interface SendProjectAdminInvitationEmailProps {
  to: string;
  projectName: string;
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  rejectUrl: string;
}

export async function sendProjectAdminInvitationEmail({
  to,
  projectName,
  organizationName,
  inviterName,
  acceptUrl,
  rejectUrl,
}: SendProjectAdminInvitationEmailProps) {
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `You've been invited to be a Project Admin for ${projectName}`,
      html: createProjectAdminInvitationEmailTemplate({
        projectName,
        organizationName,
        inviterName,
        acceptUrl,
        rejectUrl,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending project admin invitation email:", error);
    throw new Error(
      `Failed to send project admin invitation email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
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
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

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

function createProjectCreatedEmailTemplate({
  projectName,
  organizationName,
}: {
  projectName: string;
  organizationName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Created - Nowgai</title>
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
        
        <h1 class="title">New Project Created</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p>A new project has been created for your organization <strong>"${organizationName}"</strong>.</p>
          <p>Project name:</p>
          <div class="project-badge">${projectName}</div>
        </div>

        <div class="info-box">
          <strong>Next steps:</strong> You can now assign a project admin to this project and transfer funds from your organization wallet to the project wallet.
        </div>
        
        <div class="footer">
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createProjectAdminInvitationEmailTemplate({
  projectName,
  organizationName,
  inviterName,
  acceptUrl,
  rejectUrl,
}: {
  projectName: string;
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  rejectUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Admin Invitation - Nowgai</title>
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
        .button-container {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: background-color 0.2s;
        }
        .button-accept {
          background-color: #000;
          color: white;
        }
        .button-accept:hover {
          background-color: #333;
        }
        .button-reject {
          background-color: #ef4444;
          color: white;
        }
        .button-reject:hover {
          background-color: #dc2626;
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
          <div class="logo">Nowgai Admin</div>
        </div>
        
        <h1 class="title">Project Admin Invitation</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to become a Project Admin for <strong>"${projectName}"</strong> in the organization <strong>"${organizationName}"</strong>.</p>
          <p>As a Project Admin, you will be able to manage this project and use team members from the associated organization.</p>
        </div>
        
        <div class="button-container">
          <a href="${acceptUrl}" class="button button-accept">Accept Invitation</a>
          <a href="${rejectUrl}" class="button button-reject">Reject</a>
        </div>
        
        <div class="message">
          <p>If the buttons don't work, you can also use these links:</p>
          <p><strong>Accept:</strong> <span class="link">${acceptUrl}</span></p>
          <p><strong>Reject:</strong> <span class="link">${rejectUrl}</span></p>
        </div>

        <div class="info-box">
          <strong>Important:</strong> This invitation will expire in 7 days. Please respond soon.
        </div>
        
        <div class="footer">
          <p>If you didn't expect this invitation, you can safely reject it or ignore this email.</p>
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
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
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

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

interface SendProjectMemberInvitationEmailProps {
  to: string;
  projectName: string;
  organizationName: string;
  inviterName: string;
}

export async function sendProjectMemberInvitationEmail({
  to,
  projectName,
  organizationName,
  inviterName,
}: SendProjectMemberInvitationEmailProps) {
  const resendClient = await getResendClient();
  const fromEmail = await getResendFrom();

  try {
    const emailData = {
      from: fromEmail,
      to,
      subject: `You've been added to project: ${projectName}`,
      html: createProjectMemberInvitationEmailTemplate({
        projectName,
        organizationName,
        inviterName,
      }),
    };

    const result = await resendClient.emails.send(emailData);
    return result;
  } catch (error) {
    console.error("❌ Error sending project member invitation email:", error);
    throw new Error(
      `Failed to send project member invitation email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function createProjectMemberInvitationEmailTemplate({
  projectName,
  organizationName,
  inviterName,
}: {
  projectName: string;
  organizationName: string;
  inviterName: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Member Assignment - Nowgai</title>
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
        
        <h1 class="title">You've Been Added to a Project</h1>
        
        <div class="message">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has added you to the project <strong>"${projectName}"</strong> in the organization <strong>"${organizationName}"</strong>.</p>
          <p>Project:</p>
          <div class="project-badge">${projectName}</div>
        </div>

        <div class="info-box">
          <strong>What this means:</strong> You now have access to this project and can work on it as part of the organization team.
        </div>
        
        <div class="footer">
          <p>Best regards,<br>The Nowgai Admin Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
