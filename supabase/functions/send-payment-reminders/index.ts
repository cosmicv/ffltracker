import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Repayment {
  id: string;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
}

interface Loan {
  id: string;
  borrower_name: string;
  borrower_email: string;
  amount: number;
  interest_rate: number;
  frequency: string;
  status: string;
  start_date: string;
  repayments: Repayment[];
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

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Email statements skipped.");
      return new Response(
        JSON.stringify({ success: true, message: "Email service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const dashboardUrl = `${appUrl}/login`;

    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select(`
        id, borrower_name, borrower_email, amount, interest_rate, frequency, status, start_date,
        repayments (id, due_date, amount, paid, paid_at)
      `)
      .in("status", ["active", "approved"]);

    if (loansError) throw new Error(`Failed to fetch loans: ${loansError.message}`);

    if (!loans || loans.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active loans found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    for (const loan of loans as Loan[]) {
      const allRepayments = loan.repayments || [];
      const paidRepayments = allRepayments.filter((r) => r.paid);
      const unpaidRepayments = allRepayments.filter((r) => !r.paid);
      const overdueRepayments = unpaidRepayments.filter((r) => r.due_date < today);
      const upcomingRepayments = unpaidRepayments
        .filter((r) => r.due_date >= today)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      const totalRemaining = unpaidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      const totalOverdue = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      const nextPayment = upcomingRepayments[0] ?? null;

      const hasOverdue = overdueRepayments.length > 0;
      const subject = `Monthly Loan Statement - ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}`;

      const formatDate = (d: string) =>
        new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background-color: #1e40af; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 22px;">Monthly Loan Statement</h2>
            <p style="color: #bfdbfe; margin: 4px 0 0;">${new Date().toLocaleString("default", { month: "long", year: "numeric" })}</p>
          </div>

          <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0 0 20px;">Hi ${loan.borrower_name},</p>
            <p style="margin: 0 0 20px;">Here is your monthly account statement for your loan.</p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
              <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Loan Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280;">Original Loan Amount</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">$${Number(loan.amount).toLocaleString()}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Interest Rate</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${loan.interest_rate}%</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Payment Frequency</td><td style="padding: 6px 0; text-align: right; font-weight: bold; text-transform: capitalize;">${loan.frequency}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Loan Start Date</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${formatDate(loan.start_date)}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Status</td><td style="padding: 6px 0; text-align: right;"><span style="background-color: #dcfce7; color: #166534; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: bold; text-transform: capitalize;">${loan.status}</span></td></tr>
              </table>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
              <div style="flex: 1; background-color: #dcfce7; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 13px;">Total Paid</p>
                <p style="margin: 4px 0 0; color: #15803d; font-size: 20px; font-weight: bold;">$${totalPaid.toLocaleString()}</p>
              </div>
              <div style="flex: 1; background-color: #dbeafe; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #1e40af; font-size: 13px;">Remaining Balance</p>
                <p style="margin: 4px 0 0; color: #1d4ed8; font-size: 20px; font-weight: bold;">$${totalRemaining.toLocaleString()}</p>
              </div>
            </div>

            ${hasOverdue ? `
            <div style="background-color: #fee2e2; padding: 16px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
              <h3 style="margin: 0 0 8px; color: #991b1b; font-size: 15px;">Overdue Payments</h3>
              <p style="margin: 0; color: #7f1d1d;">You have <strong>${overdueRepayments.length} overdue payment${overdueRepayments.length > 1 ? "s" : ""}</strong> totalling <strong>$${totalOverdue.toLocaleString()}</strong>. Please log in to settle these as soon as possible.</p>
            </div>
            ` : ""}

            ${nextPayment ? `
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 20px;">
              <h3 style="margin: 0 0 8px; color: #1e40af; font-size: 15px;">Next Payment Due</h3>
              <p style="margin: 0; color: #1e3a8a;"><strong>${formatDate(nextPayment.due_date)}</strong> &mdash; <strong>$${Number(nextPayment.amount).toLocaleString()}</strong></p>
            </div>
            ` : `
            <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a; margin-bottom: 20px;">
              <p style="margin: 0; color: #166534; font-weight: bold;">All payments are up to date. Great work!</p>
            </div>
            `}

            <div style="text-align: center; margin: 24px 0 8px;">
              <a href="${dashboardUrl}" style="background-color: #1e40af; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">View My Account</a>
            </div>
          </div>

          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 13px;">Family &amp; Friends Loan Tracker &mdash; This is an automated monthly statement.</p>
          </div>
        </div>
      `;

      let logStatus = "sent";
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Family & Friends Loan Tracker <noreply@ffltracker.app>",
            to: [loan.borrower_email],
            subject,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errText = await emailResponse.text();
          logStatus = "failed";
          errorMessage = errText;
          emailsFailed.push(loan.borrower_email);
        } else {
          const result = await emailResponse.json();
          providerMessageId = result.id || null;
          emailsSent.push(loan.borrower_email);
        }
      } catch (sendErr) {
        logStatus = "failed";
        errorMessage = sendErr instanceof Error ? sendErr.message : String(sendErr);
        emailsFailed.push(loan.borrower_email);
      }

      await supabase.from("email_logs").insert({
        email_type: "payment_reminder",
        recipient_email: loan.borrower_email,
        recipient_name: loan.borrower_name,
        loan_id: loan.id,
        subject,
        status: logStatus,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Monthly statements processed",
        emailsSent: emailsSent.length,
        emailsFailed: emailsFailed.length,
        totalLoans: loans.length,
        recipients: emailsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing monthly statements:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
