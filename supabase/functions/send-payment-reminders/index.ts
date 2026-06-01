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
  start_date: string | null;
  repayments: Repayment[];
}

interface BorrowerStatement {
  borrowerName: string;
  borrowerEmail: string;
  loans: Loan[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const formatDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not set";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function summarizeLoan(loan: Loan, today: string) {
  const repayments = loan.repayments || [];
  const paidRepayments = repayments.filter((r) => r.paid);
  const unpaidRepayments = repayments.filter((r) => !r.paid);
  const overdueRepayments = unpaidRepayments.filter((r) => r.due_date < today);
  const upcomingRepayments = unpaidRepayments
    .filter((r) => r.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalRemaining = Math.max(Number(loan.amount) - totalPaid, 0);
  const totalOverdue = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    totalPaid,
    totalRemaining,
    totalOverdue,
    overdueCount: overdueRepayments.length,
    nextPayment: upcomingRepayments[0] ?? null,
  };
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

    let force = false;
    try {
      const payload = await req.json();
      force = payload?.force === true;
    } catch {
      // Cron sends a simple JSON body, but tolerate empty/manual requests too.
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split("T")[0];
    const statementMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
    const subject = `Monthly Loan Statement - ${statementMonth}`;
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

    const borrowers = new Map<string, BorrowerStatement>();
    for (const loan of loans as Loan[]) {
      const emailKey = loan.borrower_email.trim().toLowerCase();
      if (!emailKey) continue;

      if (!borrowers.has(emailKey)) {
        borrowers.set(emailKey, {
          borrowerName: loan.borrower_name,
          borrowerEmail: emailKey,
          loans: [],
        });
      }

      borrowers.get(emailKey)!.loans.push(loan);
    }

    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];
    const emailsSkipped: string[] = [];

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Email statements skipped.");
      for (const borrower of borrowers.values()) {
        await supabase.from("email_logs").insert({
          email_type: "payment_reminder",
          recipient_email: borrower.borrowerEmail,
          recipient_name: borrower.borrowerName,
          loan_id: null,
          subject,
          status: "failed",
          error_message: "RESEND_API_KEY not configured",
        });
        emailsFailed.push(borrower.borrowerEmail);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: "Email service not configured",
          totalLoans: loans.length,
          totalRecipients: borrowers.size,
          emailsSent: 0,
          emailsFailed: emailsFailed.length,
          emailsSkipped: 0,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const borrower of borrowers.values()) {
      if (!force) {
        const { data: existingSent } = await supabase
          .from("email_logs")
          .select("id")
          .eq("email_type", "payment_reminder")
          .eq("recipient_email", borrower.borrowerEmail)
          .eq("subject", subject)
          .eq("status", "sent")
          .limit(1)
          .maybeSingle();

        if (existingSent) {
          emailsSkipped.push(borrower.borrowerEmail);
          continue;
        }
      }

      const loanSummaries = borrower.loans.map((loan) => ({
        loan,
        summary: summarizeLoan(loan, today),
      }));

      const totalBorrowed = borrower.loans.reduce((sum, loan) => sum + Number(loan.amount), 0);
      const totalPaid = loanSummaries.reduce((sum, item) => sum + item.summary.totalPaid, 0);
      const totalRemaining = loanSummaries.reduce((sum, item) => sum + item.summary.totalRemaining, 0);
      const totalOverdue = loanSummaries.reduce((sum, item) => sum + item.summary.totalOverdue, 0);
      const overdueCount = loanSummaries.reduce((sum, item) => sum + item.summary.overdueCount, 0);
      const nextPayment = loanSummaries
        .map((item) => item.summary.nextPayment)
        .filter((payment): payment is Repayment => payment !== null)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;

      const loanRows = loanSummaries.map(({ loan, summary }, index) => `
        <tr>
          <td style="padding: 10px 0; border-top: ${index === 0 ? "none" : "1px solid #e5e7eb"};">
            <strong>${formatCurrency(Number(loan.amount))}</strong><br />
            <span style="color: #6b7280; font-size: 13px;">${escapeHtml(loan.frequency)} at ${Number(loan.interest_rate).toLocaleString()}% interest</span>
          </td>
          <td style="padding: 10px 0; border-top: ${index === 0 ? "none" : "1px solid #e5e7eb"}; text-align: right;">
            ${formatCurrency(summary.totalPaid)} paid<br />
            <strong>${formatCurrency(summary.totalRemaining)} remaining</strong>
          </td>
        </tr>
      `).join("");

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
          <div style="background-color: #1e40af; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 22px;">Monthly Loan Statement</h2>
            <p style="color: #bfdbfe; margin: 4px 0 0;">${statementMonth}</p>
          </div>

          <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0 0 20px;">Hi ${escapeHtml(borrower.borrowerName)},</p>
            <p style="margin: 0 0 20px;">Here is your monthly account statement covering ${borrower.loans.length} active loan${borrower.loans.length === 1 ? "" : "s"}.</p>

            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
              <div style="flex: 1; background-color: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 13px;">Total Borrowed</p>
                <p style="margin: 4px 0 0; color: #111827; font-size: 20px; font-weight: bold;">${formatCurrency(totalBorrowed)}</p>
              </div>
              <div style="flex: 1; background-color: #dcfce7; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 13px;">Total Paid</p>
                <p style="margin: 4px 0 0; color: #15803d; font-size: 20px; font-weight: bold;">${formatCurrency(totalPaid)}</p>
              </div>
              <div style="flex: 1; background-color: #dbeafe; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #1e40af; font-size: 13px;">Remaining Balance</p>
                <p style="margin: 4px 0 0; color: #1d4ed8; font-size: 20px; font-weight: bold;">${formatCurrency(totalRemaining)}</p>
              </div>
            </div>

            <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
              <h3 style="margin: 0 0 12px; color: #1f2937; font-size: 16px;">Loan Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">${loanRows}</table>
            </div>

            ${overdueCount > 0 ? `
            <div style="background-color: #fee2e2; padding: 16px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
              <h3 style="margin: 0 0 8px; color: #991b1b; font-size: 15px;">Overdue Payments</h3>
              <p style="margin: 0; color: #7f1d1d;">You have <strong>${overdueCount} overdue payment${overdueCount === 1 ? "" : "s"}</strong> totalling <strong>${formatCurrency(totalOverdue)}</strong>.</p>
            </div>
            ` : ""}

            ${nextPayment ? `
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 20px;">
              <h3 style="margin: 0 0 8px; color: #1e40af; font-size: 15px;">Next Payment Due</h3>
              <p style="margin: 0; color: #1e3a8a;"><strong>${formatDate(nextPayment.due_date)}</strong> - <strong>${formatCurrency(Number(nextPayment.amount))}</strong></p>
            </div>
            ` : totalRemaining > 0 ? `
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 20px;">
              <p style="margin: 0; color: #1e3a8a;">Your account has an outstanding balance of <strong>${formatCurrency(totalRemaining)}</strong>. No upcoming scheduled payment date is currently set.</p>
            </div>
            ` : `
            <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a; margin-bottom: 20px;">
              <p style="margin: 0; color: #166534; font-weight: bold;">All payments are up to date.</p>
            </div>
            `}

            <div style="text-align: center; margin: 24px 0 8px;">
              <a href="${dashboardUrl}" style="background-color: #1e40af; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">View My Account</a>
            </div>
          </div>

          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 13px;">Family &amp; Friends Loan Tracker - This is an automated monthly statement.</p>
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
            to: [borrower.borrowerEmail],
            subject,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errText = await emailResponse.text();
          logStatus = "failed";
          errorMessage = errText;
          emailsFailed.push(borrower.borrowerEmail);
        } else {
          const result = await emailResponse.json();
          providerMessageId = result.id || null;
          emailsSent.push(borrower.borrowerEmail);
        }
      } catch (sendErr) {
        logStatus = "failed";
        errorMessage = sendErr instanceof Error ? sendErr.message : String(sendErr);
        emailsFailed.push(borrower.borrowerEmail);
      }

      await supabase.from("email_logs").insert({
        email_type: "payment_reminder",
        recipient_email: borrower.borrowerEmail,
        recipient_name: borrower.borrowerName,
        loan_id: null,
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
        emailsSkipped: emailsSkipped.length,
        totalLoans: loans.length,
        totalRecipients: borrowers.size,
        recipients: emailsSent,
        skippedRecipients: emailsSkipped,
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
