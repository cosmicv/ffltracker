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
  loan_id: string;
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
      console.warn("RESEND_API_KEY not configured. Email reminders skipped.");
      return new Response(
        JSON.stringify({ success: true, message: "Email service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: dueRepayments, error: repaymentsError } = await supabase
      .from("repayments")
      .select("id, due_date, amount, paid, loan_id")
      .eq("paid", false)
      .lte("due_date", today);

    if (repaymentsError) throw new Error(`Failed to fetch repayments: ${repaymentsError.message}`);

    if (!dueRepayments || dueRepayments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No due payments found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loanIds = [...new Set(dueRepayments.map((r: Repayment) => r.loan_id))];

    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("id, borrower_name, borrower_email, amount, interest_rate, frequency, status, start_date")
      .in("id", loanIds)
      .in("status", ["active", "approved"]);

    if (loansError) throw new Error(`Failed to fetch loans: ${loansError.message}`);

    if (!loans || loans.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active loans with due payments", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];
    const dashboardUrl = `${appUrl}/login`;

    for (const loan of loans as Loan[]) {
      const loanRepayments = dueRepayments.filter((r: Repayment) => r.loan_id === loan.id);
      const totalDue = loanRepayments.reduce((sum: number, r: Repayment) => sum + Number(r.amount), 0);
      const overduePayments = loanRepayments.filter((r: Repayment) => r.due_date < today);
      const todayPayments = loanRepayments.filter((r: Repayment) => r.due_date === today);
      const isOverdue = overduePayments.length > 0;

      const subject = isOverdue ? "Payment Overdue - Action Required" : "Payment Reminder";

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${isOverdue ? '#dc2626' : '#2563eb'};">
            ${isOverdue ? 'Payment Overdue' : 'Payment Reminder'}
          </h2>
          <p>Hi ${loan.borrower_name},</p>
          <p>This is a reminder about your loan payment${loanRepayments.length > 1 ? 's' : ''}.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Loan Details</h3>
            <p style="margin: 10px 0;"><strong>Loan Amount:</strong> $${Number(loan.amount).toLocaleString()}</p>
            <p style="margin: 10px 0;"><strong>Interest Rate:</strong> ${loan.interest_rate}%</p>
            <p style="margin: 10px 0;"><strong>Payment Frequency:</strong> ${loan.frequency}</p>
          </div>
          <div style="background-color: ${isOverdue ? '#fee2e2' : '#dbeafe'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isOverdue ? '#dc2626' : '#2563eb'};">
            <h3 style="margin-top: 0; color: #1f2937;">Payment Due</h3>
            ${overduePayments.length > 0 ? `<p style="margin: 10px 0; color: #dc2626;"><strong>Overdue Payments:</strong> ${overduePayments.length}</p>` : ''}
            ${todayPayments.length > 0 ? `<p style="margin: 10px 0;"><strong>Due Today:</strong> ${todayPayments.length} payment${todayPayments.length > 1 ? 's' : ''}</p>` : ''}
            <p style="margin: 10px 0; font-size: 18px;"><strong>Total Amount Due:</strong> <span style="color: ${isOverdue ? '#dc2626' : '#2563eb'};">$${totalDue.toLocaleString()}</span></p>
          </div>
          <p>Please log in to your account to view details and make your payment.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Loan Details</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link:<br/>
          <a href="${dashboardUrl}" style="color: #2563eb;">${dashboardUrl}</a></p>
          <p style="margin-top: 30px;">Best regards,<br/>Family and Friends Loan Tracker</p>
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
        message: "Payment reminders processed",
        emailsSent: emailsSent.length,
        emailsFailed: emailsFailed.length,
        totalDuePayments: dueRepayments.length,
        recipients: emailsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing payment reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
