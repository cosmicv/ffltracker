import { createClient } from "npm:@supabase/supabase-js@2";

export function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service configuration");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing authorization", status: 401 } as const;
  }

  const adminClient = getServiceClient();
  const token = authHeader.slice("Bearer ".length);
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return { error: "Invalid authorization", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: `Profile lookup failed: ${profileError.message}`, status: 500 } as const;
  }

  if (!profile || !["admin", "master_admin"].includes(profile.role)) {
    return { error: "Forbidden: admin role required", status: 403 } as const;
  }

  return { adminClient, user, profile } as const;
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
