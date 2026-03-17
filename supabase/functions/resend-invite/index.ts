import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://your-app-url.com";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { borrowerEmail, borrowerName, lenderName } = await req.json();

    if (!borrowerEmail || !borrowerName) {
      return new Response(
        JSON.stringify({ success: false, error: "borrowerEmail and borrowerName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = "You've been invited to Family & Friends Loan Tracker";
    const loginUrl = `${appUrl}/login`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You're Invited!</h2>
        <p>Hi ${borrowerName},</p>
        <p>${lenderName || "A lender"} has invited you to view your loan details on the Family and Friends Loan Tracker.</p>
        <p>Please sign up or log in to your account to view your loan details and payment history.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Your Loan</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:<br/>
        <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
        <p style="margin-top: 30px;">Best regards,<br/>Family and Friends Loan Tracker</p>
      </div>
    `;

    if (!resendApiKey) {
      await supabase.from("email_logs").insert({
        email_type: "loan_invitation",
        recipient_email: borrowerEmail,
        recipient_name: borrowerName,
        subject,
        status: "failed",
        error_message: "RESEND_API_KEY not configured",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured. Please add a RESEND_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Family & Friends Loan Tracker <noreply@ffltracker.app>",
        to: [borrowerEmail],
        subject,
        html: emailHtml,
      }),
    });

    const responseText = await emailResponse.text();
    let logStatus = "sent";
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    if (!emailResponse.ok) {
      logStatus = "failed";
      errorMessage = responseText;

      let friendlyError = "Failed to send email.";
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.message && parsed.message.includes("verify a domain")) {
          friendlyError = "Your Resend account requires a verified domain to send emails to external addresses. Please verify a domain at resend.com/domains and update the 'from' address in the edge function.";
        } else {
          friendlyError = parsed.message || responseText;
        }
      } catch {
        friendlyError = responseText;
      }

      await supabase.from("email_logs").insert({
        email_type: "loan_invitation",
        recipient_email: borrowerEmail,
        recipient_name: borrowerName,
        subject,
        status: logStatus,
        error_message: errorMessage,
      });

      return new Response(
        JSON.stringify({ success: false, error: friendlyError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const result = JSON.parse(responseText);
      providerMessageId = result.id || null;
    } catch {
      // ignore parse errors
    }

    await supabase.from("email_logs").insert({
      email_type: "loan_invitation",
      recipient_email: borrowerEmail,
      recipient_name: borrowerName,
      subject,
      status: logStatus,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Invite email sent successfully", emailId: providerMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending invite:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
