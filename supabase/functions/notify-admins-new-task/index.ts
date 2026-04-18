/**
 * Notify all admins (OneSignal `external_user_id` = Supabase profile id) when a
 * member inserts a task.
 *
 * Deploy:
 *   supabase secrets set ONESIGNAL_APP_ID=... ONESIGNAL_REST_API_KEY=... TASK_WEBHOOK_SECRET=...
 *   supabase functions deploy notify-admins-new-task
 *
 * Supabase Dashboard → Database → Webhooks:
 *   Table: public.tasks  Events: Insert
 *   HTTP Request URL: https://<ref>.supabase.co/functions/v1/notify-admins-new-task
 *   HTTP Headers: x-taskmaster-webhook-secret: <same as TASK_WEBHOOK_SECRET>
 *
 * OneSignal Dashboard: Web → add your site URL; Keys & IDs → REST API Key + App ID.
 * Users are linked via OneSignal.login(supabaseUser.id) in the web app.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-taskmaster-webhook-secret",
};

interface WebhookBody {
  type?: string;
  table?: string;
  schema?: string;
  record?: {
    id?: string;
    title?: string;
    user_name?: string;
    created_by?: string | null;
    category_id?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("TASK_WEBHOOK_SECRET") ?? "";
  const headerSecret = req.headers.get("x-taskmaster-webhook-secret") ?? "";

  if (!webhookSecret || headerSecret !== webhookSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
  const onesignalKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!onesignalAppId || !onesignalKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as WebhookBody;

    if (body.type !== "INSERT" || body.table !== "tasks" || !body.record) {
      return new Response(JSON.stringify({ ok: true, skipped: "not_task_insert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdBy = body.record.created_by;
    if (!createdBy) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_created_by" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: author } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", createdBy)
      .maybeSingle();

    if (author?.role !== "member") {
      return new Response(JSON.stringify({ ok: true, skipped: "not_member_author" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: admins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    const adminIds = (admins ?? [])
      .map((r) => r.id as string)
      .filter((id): id is string => Boolean(id));

    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = "New task";
    const who = body.record.user_name?.trim() || "Someone";
    const taskTitle = body.record.title?.trim() || "Task";
    const contents = `${who} added: ${taskTitle}`;

    const osRes = await fetch("https://api.onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${onesignalKey}`,
      },
      body: JSON.stringify({
        app_id: onesignalAppId,
        include_external_user_ids: adminIds,
        headings: { en: title },
        contents: { en: contents },
        data: {
          task_id: body.record.id,
          category_id: body.record.category_id,
        },
      }),
    });

    const osText = await osRes.text();
    let osJson: Record<string, unknown> = {};
    try {
      osJson = JSON.parse(osText) as Record<string, unknown>;
    } catch {
      osJson = { raw: osText };
    }

    if (!osRes.ok) {
      console.error("[notify-admins-new-task] OneSignal:", osRes.status, osText);
      return new Response(
        JSON.stringify({ error: "OneSignal request failed", detail: osJson }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const recipients = osJson["recipients"];
    const osErrors = osJson["errors"];
    const id = osJson["id"];

    // Surfaces in net._http_response: recipients === 0 means no subscribed devices
    // for include_external_user_ids (admin must open app + allow push + OneSignal.login).
    return new Response(
      JSON.stringify({
        ok: true,
        notified_admin_ids: adminIds,
        onesignal: { id, recipients, errors: osErrors },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
