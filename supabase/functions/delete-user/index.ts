import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "master_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (userId === caller.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete yourself" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: userLoans } = await callerClient
      .from("loans")
      .select("id")
      .or(`borrower_id.eq.${userId},lender_id.eq.${userId}`);

    if (userLoans && userLoans.length > 0) {
      const loanIds = userLoans.map((l: { id: string }) => l.id);
      const { error: repErr } = await callerClient.from("repayments").delete().in("loan_id", loanIds);
      if (repErr) throw new Error(`Failed to delete repayments: ${repErr.message}`);
    }

    const { error: loanErr } = await callerClient
      .from("loans")
      .delete()
      .or(`borrower_id.eq.${userId},lender_id.eq.${userId}`);
    if (loanErr) throw new Error(`Failed to delete loans: ${loanErr.message}`);

    const { error: feedbackErr } = await callerClient.from("feedback").delete().eq("user_id", userId);
    if (feedbackErr) throw new Error(`Failed to delete feedback: ${feedbackErr.message}`);

    const { data: stripeCustomer } = await callerClient
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (stripeCustomer?.customer_id) {
      await callerClient.from("stripe_subscriptions").delete().eq("customer_id", stripeCustomer.customer_id);
      await callerClient.from("stripe_orders").delete().eq("customer_id", stripeCustomer.customer_id);
    }

    const { error: stripeErr } = await callerClient.from("stripe_customers").delete().eq("user_id", userId);
    if (stripeErr) throw new Error(`Failed to delete stripe customer: ${stripeErr.message}`);

    const { error: profileErr } = await callerClient.from("profiles").delete().eq("id", userId);
    if (profileErr) throw new Error(`Failed to delete profile: ${profileErr.message}`);

    const { error: authError } =
      await callerClient.auth.admin.deleteUser(userId);

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
