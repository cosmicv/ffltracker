import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FeedbackPayload {
  user_email: string;
  user_name: string;
  message: string;
  type: 'feature_request' | 'problem_report';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { user_email, user_name, message, type }: FeedbackPayload = await req.json();

    const typeLabel = type === 'feature_request' ? 'Feature Request' : 'Problem Report';

    const emailContent = `
New ${typeLabel} from Loan Tracker App

From: ${user_name} (${user_email})
Type: ${typeLabel}

Message:
${message}

---
Submitted at: ${new Date().toLocaleString()}
    `.trim();

    console.log('Feedback received:', {
      from: user_email,
      name: user_name,
      type: typeLabel,
      message: message.substring(0, 100),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback recorded',
        note: 'Email notification would be sent to cosmicvortex@gmail.com in production'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing feedback:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
