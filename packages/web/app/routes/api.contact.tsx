import type { ActionFunctionArgs } from "react-router";
import { Resend } from "resend";
import { getEnv, getEnvWithDefault } from "~/lib/env";
import { auth } from "~/lib/auth";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { fullName, email, phone, countryCode, company, subject, message } =
      body;

    if (!fullName || !email || !subject || !message) {
      return new Response(
        JSON.stringify({
          error: "Full name, email, subject, and message are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get user session to include sender info
    let senderInfo = "Anonymous User";
    let session = null;

    try {
      const authInstance = await auth;
      session = await authInstance.api.getSession({
        headers: request.headers,
      });

      if (session?.user) {
        senderInfo = `${session.user.name || "User"} (${session.user.email})`;
      }
    } catch (err) {
      console.log("Could not fetch user info:", err);
    }

    // Initialize Resend
    const apiKey = getEnv("RESEND_API_KEY");
    if (!apiKey) {
      console.error("❌ RESEND_API_KEY is not set!");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const resendClient = new Resend(apiKey);
    const fromEmail = getEnvWithDefault(
      "RESEND_FROM",
      "Nowgai <no-reply@cuttheq.in>",
    );

    // Prepare CC recipients
    const ccRecipients: string[] = [];

    // Add the email from the form
    if (email) {
      ccRecipients.push(email);
    }

    // Add authenticated user's email if different from form email
    if (session?.user?.email && session.user.email !== email) {
      ccRecipients.push(session.user.email);
    }

    // Send email to tech@nowg.ai with CC to form email and authenticated user
    const emailData = {
      from: fromEmail,
      to: "tech@nowg.ai",
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject: `Contact Form: ${subject}`,
      html: createContactEmailTemplate({
        fullName,
        email,
        phone,
        countryCode,
        company,
        subject,
        message,
        senderInfo,
      }),
    };

    const result = await resendClient.emails.send(emailData);

    if (!result || !result.data || !result.data.id) {
      throw new Error("Email service returned invalid response");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Error sending contact email:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to send message. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

function createContactEmailTemplate({
  fullName,
  email,
  phone,
  countryCode,
  company,
  subject,
  message,
  senderInfo,
}: {
  fullName: string;
  email: string;
  phone?: string;
  countryCode?: string;
  company?: string;
  subject: string;
  message: string;
  senderInfo: string;
}): string {
  const phoneNumber =
    phone && countryCode ? `${countryCode} ${phone}` : phone || "Not provided";
  const companyName = company || "Not provided";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contact Form Submission</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          border-bottom: 3px solid #7c3aed;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          color: #7c3aed;
          font-size: 24px;
        }
        .field {
          margin-bottom: 20px;
        }
        .field-label {
          font-weight: 600;
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .field-value {
          background-color: #f9fafb;
          padding: 12px 16px;
          border-radius: 6px;
          border-left: 3px solid #7c3aed;
          font-size: 14px;
        }
        .message-content {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📬 New Contact Form Submission</h1>
        </div>
        
        <div class="field">
          <div class="field-label">Full Name</div>
          <div class="field-value">${fullName}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Email Address</div>
          <div class="field-value">${email}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Phone Number</div>
          <div class="field-value">${phoneNumber}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Company / Organization</div>
          <div class="field-value">${companyName}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Subject</div>
          <div class="field-value">${subject}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Message</div>
          <div class="field-value message-content">${message}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Authenticated User</div>
          <div class="field-value">${senderInfo}</div>
        </div>
        
        <div class="footer">
          <p>This message was sent via the NowgAI contact form</p>
          <p>Received at ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
