import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  full_name: string;
  password: string;
  role: string;
  login_url: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
  nursing: 'Nursing',
  service_development: 'Service Development',
  program_administrator: 'Program Administrator',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, full_name, password, role, login_url }: WelcomeEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const displayName = full_name || email.split('@')[0];
    const roleLabel = roleLabels[role] || role || 'User';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Budget Tracker</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to Budget Tracker</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 18px; color: #18181b;">
                Hello <strong>${displayName}</strong>,
              </p>
              
              <p style="margin: 0 0 25px; font-size: 16px; color: #52525b; line-height: 1.6;">
                Your account has been created and you've been assigned the role of <strong style="color: #3b82f6;">${roleLabel}</strong>. 
                Below are your login credentials:
              </p>
              
              <!-- Credentials Box -->
              <table role="presentation" style="width: 100%; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 4px;">Email Address</span>
                          <span style="font-size: 16px; color: #18181b; font-weight: 600;">${email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e2e8f0;">
                          <span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 4px;">Temporary Password</span>
                          <code style="font-size: 16px; color: #18181b; font-weight: 600; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px;">${password}</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${login_url}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      Login to Your Account
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security Notice -->
              <table role="presentation" style="width: 100%; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                      <strong>Security Reminder:</strong> For your security, please change your password after your first login.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; text-align: center;">
                If you have any questions, please contact your system administrator.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    console.log(`Sending welcome email to ${email}`);

    const emailResponse = await resend.emails.send({
      from: "Budget Tracker <invite@freedom.v8techco.com>",
      to: [email],
      subject: "Welcome to Budget Tracker - Your Account Has Been Created",
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-welcome-email function:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
