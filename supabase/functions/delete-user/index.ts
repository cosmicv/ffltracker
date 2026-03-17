import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    let callerId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerId = payload.sub;
    } catch {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    if (!callerId) {
      return jsonResponse({ error: "Invalid token payload" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: `Profile lookup failed: ${profileError.message}` }, 500);
    }

    if (!callerProfile || callerProfile.role !== "master_admin") {
      return jsonResponse({ error: "Forbidden: master_admin role required" }, 403);
    }

    const { userId } = await req.json();

    if (!userId) {
      return jsonResponse({ error: "userId is required" }, 400);
    }

    if (userId === callerId) {
      return jsonResponse({ error: "Cannot delete yourself" }, 400);
    }

    const { data: userProfile } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const { data: userLoans } = await adminClient
      .from("loans")
      .select("id")
      .or(`borrower_id.eq.${userId},lender_id.eq.${userId}${userProfile?.email ? `,borrower_email.eq.${userProfile.email}` : ""}`);

    if (userLoans && userLoans.length > 0) {
      const loanIds = userLoans.map((l: { id: string }) => l.id);
      const { error: repErr } = await adminClient
        .from("repayments")
        .delete()
        .in("loan_id", loanIds);
      if (repErr) {
        return jsonResponse({ error: `Delete repayments failed: ${repErr.message}` }, 500);
      }
    }

    const loanDeleteFilter = `borrower_id.eq.${userId},lender_id.eq.${userId}${userProfile?.email ? `,borrower_email.eq.${userProfile.email}` : ""}`;
    const { error: loanErr } = await adminClient
      .from("loans")
      .delete()
      .or(loanDeleteFilter);
    if (loanErr) {
      return jsonResponse({ error: `Delete loans failed: ${loanErr.message}` }, 500);
    }

    const { error: feedbackErr } = await adminClient
      .from("feedback")
      .delete()
      .eq("user_id", userId);
    if (feedbackErr) {
      return jsonResponse({ error: `Delete feedback failed: ${feedbackErr.message}` }, 500);
    }

    const { data: stripeCustomer } = await adminClient
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (stripeCustomer?.customer_id) {
      await adminClient
        .from("stripe_subscriptions")
        .delete()
        .eq("customer_id", stripeCustomer.customer_id);
      await adminClient
        .from("stripe_orders")
        .delete()
        .eq("customer_id", stripeCustomer.customer_id);
    }

    await adminClient.from("stripe_customers").delete().eq("user_id", userId);

    const { error: profileDelErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileDelErr) {
      return jsonResponse({ error: `Delete profile failed: ${profileDelErr.message}` }, 500);
    }

    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
      return jsonResponse({ error: `Delete auth user failed: ${authError.message}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500
    );
  }
});
