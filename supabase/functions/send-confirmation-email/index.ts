import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "Giocatore").trim();
    const rawRedirectTo = String(body.redirectTo || "").trim();
    const redirectTo = rawRedirectTo.startsWith("https://gamespark.it") ? rawRedirectTo : "https://gamespark.it/auth";
    const fromEmail = String(body.fromEmail || Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@gamespark.it").trim();
    const fromName = String(body.fromName || Deno.env.get("SENDGRID_FROM_NAME") || "GameSpark").trim();
    const templateId = String(body.templateId || Deno.env.get("SENDGRID_CONFIRM_TEMPLATE_ID") || "").trim();

    // Preferisci sempre i secret server-side. Il body fallback serve solo per prototipo/admin locale.
    const sendGridApiKey = String(Deno.env.get("SENDGRID_API_KEY") || body.sendGridApiKey || "").trim();
    if (!email.includes("@")) return Response.json({ ok: false, error: "Email non valida" }, { status: 400, headers: corsHeaders });
    if (!sendGridApiKey) return Response.json({ ok: false, error: "SENDGRID_API_KEY mancante" }, { status: 400, headers: corsHeaders });

    const confirmationUrl = redirectTo;
    const payload: Record<string, unknown> = {
      personalizations: [{
        to: [{ email, name }],
        dynamic_template_data: { name, email, confirmationUrl },
      }],
      from: { email: fromEmail, name: fromName },
    };

    if (templateId) {
      payload.template_id = templateId;
    } else {
      payload.subject = "Conferma la tua email — Golden Room";
      payload.content = [{
        type: "text/html",
        value: `<div style="font-family:Arial,sans-serif;background:#160827;color:#fff;padding:24px;border-radius:18px"><h1>Benvenuto ${name}</h1><p>Conferma la tua email per entrare in Golden Room.</p><p><a href="${confirmationUrl}" style="display:inline-block;background:#f5b400;color:#24071d;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none">Conferma email</a></p></div>`,
      }];
    }

    const sg = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sendGridApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!sg.ok) {
      const text = await sg.text();
      return Response.json({ ok: false, error: text }, { status: sg.status, headers: corsHeaders });
    }

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500, headers: corsHeaders });
  }
});
