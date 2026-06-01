import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LoanStatusNotification {
  borrowerEmail: string;
  borrowerName: string;
  amount: string;
  lenderName?: string;
  status: 'completed' | 'deleted';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) {
      return jsonResponse({ success: false, error: auth.error }, auth.status, corsHeaders);
    }

    const { borrowerEmail, borrowerName, amount, lenderName, status }: LoanStatusNotification = await req.json();

    if (!borrowerEmail || !borrowerName || !amount || !["completed", "deleted"].includes(status)) {
      return jsonResponse(
        { success: false, error: "borrowerEmail, borrowerName, amount, and a valid status are required" },
        400,
        corsHeaders,
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured. Email notification skipped.');
      return new Response(
        JSON.stringify({
          success: true,
          message: "Loan status notification logged (email service not configured)",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://your-app-url.com';
    const dashboardUrl = `${appUrl}/login`;

    let emailSubject = '';
    let emailTitle = '';
    let emailMessage = '';
    let buttonText = '';
    let buttonColor = '';

    if (status === 'completed') {
      emailSubject = 'Loan Paid Off - Congratulations!';
      emailTitle = 'Loan Paid Off';
      emailMessage = `Great news! Your loan with ${lenderName || 'your lender'} has been marked as paid off.`;
      buttonText = 'View Details';
      buttonColor = '#16a34a';
    } else if (status === 'deleted') {
      emailSubject = 'Loan Deleted - Notification';
      emailTitle = 'Loan Deleted';
      emailMessage = `This is to inform you that your loan with ${lenderName || 'your lender'} has been deleted from the system.`;
      buttonText = 'View Dashboard';
      buttonColor = '#dc2626';
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${buttonColor};">${emailTitle}</h2>
        <p>Hi ${borrowerName},</p>
        <p>${emailMessage}</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Loan Amount:</strong> $${Number(amount).toLocaleString()}</p>
          <p style="margin: 10px 0;"><strong>Status:</strong> ${status === 'completed' ? 'Paid Off' : 'Deleted'}</p>
        </div>
        ${status === 'completed' ? '<p>Congratulations on completing your loan payment! Your financial commitment has been fulfilled.</p>' : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" style="background-color: ${buttonColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${buttonText}</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:<br/>
        <a href="${dashboardUrl}" style="color: #2563eb;">${dashboardUrl}</a></p>
        <p style="margin-top: 30px;">Best regards,<br/>Loan Management System</p>
      </div>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Family & Friends Loan Tracker <noreply@ffltracker.app>',
        to: [borrowerEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await emailResponse.json();
    console.log('Email sent successfully:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Loan ${status} notification email sent successfully`,
        emailId: result.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing loan status notification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
