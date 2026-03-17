import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LoanInvitation {
  borrowerEmail: string;
  borrowerName: string;
  amount: string;
  lenderName?: string;
  loanId?: string;
}

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
    const { borrowerEmail, borrowerName, amount, lenderName, loanId }: LoanInvitation = await req.json();

    const subject = "New Loan Invitation";
    const dashboardUrl = `${appUrl}/login`;

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Email notification skipped.");
      await supabase.from("email_logs").insert({
        email_type: "loan_invitation",
        recipient_email: borrowerEmail,
        recipient_name: borrowerName,
        loan_id: loanId || null,
        subject,
        status: "failed",
        error_message: "RESEND_API_KEY not configured",
      });
      return new Response(
        JSON.stringify({ success: true, message: "Loan invitation logged (email service not configured)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Loan Invitation</h2>
        <p>Hi ${borrowerName},</p>
        <p>${lenderName || 'A lender'} has created a loan for you with the following details:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Loan Amount:</strong> $${Number(amount).toLocaleString()}</p>
        </div>
        <p>Click the button below to log in and review your loan details:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Loan Details</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:<br/>
        <a href="${dashboardUrl}" style="color: #2563eb;">${dashboardUrl}</a></p>
        <p style="margin-top: 30px;">Best regards,<br/>Family and Friends Loan Tracker</p>
      </div>
    `;

    let logStatus = "sent";
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Family & Friends Loan Tracker <onboarding@resend.dev>",
        to: [borrowerEmail],
        subject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      logStatus = "failed";
      errorMessage = errText;
    } else {
      const result = await emailResponse.json();
      providerMessageId = result.id || null;
    }

    await supabase.from("email_logs").insert({
      email_type: "loan_invitation",
      recipient_email: borrowerEmail,
      recipient_name: borrowerName,
      loan_id: loanId || null,
      subject,
      status: logStatus,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
    });

    if (logStatus === "failed") {
      throw new Error(`Failed to send email: ${errorMessage}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Loan invitation email sent successfully", emailId: providerMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing loan invitation:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
