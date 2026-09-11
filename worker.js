const ALLOWED_ORIGINS = [
  "https://mckenzieramen.com",
  "https://www.mckenzieramen.com",
  "https://mckenzieramen.github.io"
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin)
    }
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendVerificationEmail(email, code, env) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [email],
      subject: "Your McKenzie Ramen House Verification Code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px">
          <h2>McKenzie Ramen House</h2>

          <p>Hello!</p>

          <p>
            Your verification code for creating your McKenzie Ramen House
            account is:
          </p>

          <div style="
            font-size:36px;
            font-weight:bold;
            letter-spacing:8px;
            text-align:center;
            padding:20px;
            margin:25px 0;
            background:#f5f5f5;
            border-radius:10px;
          ">
            ${code}
          </div>

          <p>
            This code will expire in <strong>10 minutes</strong>.
          </p>

          <p>
            If you did not request this code, you can safely ignore this email.
          </p>

          <p>
            Thank you,<br>
            McKenzie Ramen House
          </p>
        </div>
      `
    })
  });

  const result = await response.text();

  if (!response.ok) {
    throw new Error(result || "Unable to send verification email.");
  }

  return result;
}

async function handleVerificationRequest(request, env, origin) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        success: false,
        message: "Invalid request."
      },
      400,
      origin
    );
  }

  const email = normalizeEmail(body.email);

  if (!email || !email.includes("@")) {
    return jsonResponse(
      {
        success: false,
        message: "Please provide a valid email address."
      },
      400,
      origin
    );
  }

  if (!env.VERIFICATION_CODES) {
    return jsonResponse(
      {
        success: false,
        message: "Verification storage is not configured yet."
      },
      500,
      origin
    );
  }

  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return jsonResponse(
      {
        success: false,
        message: "Email service is not configured yet."
      },
      500,
      origin
    );
  }

  const key = `verification:${email}`;

  const existing = await env.VERIFICATION_CODES.get(key, "json");

  if (existing && existing.lastSentAt) {
    const secondsSinceLastSend =
      Math.floor(Date.now() / 1000) - existing.lastSentAt;

    if (secondsSinceLastSend < 60) {
      return jsonResponse(
        {
          success: false,
          message: "Please wait 60 seconds before requesting another code."
        },
        429,
        origin
      );
    }
  }

  const code = generateCode();
  const codeHash = await sha256(code);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600;

  const record = {
    email,
    codeHash,
    createdAt: now,
    expiresAt,
    lastSentAt: now,
    attempts: 0
  };

  await env.VERIFICATION_CODES.put(
    key,
    JSON.stringify(record),
    {
      expirationTtl: 600
    }
  );

  try {
    await sendVerificationEmail(email, code, env);

    return jsonResponse(
      {
        success: true,
        message: "Verification code sent successfully.",
        expiresIn: 600
      },
      200,
      origin
    );
  } catch (error) {
    await env.VERIFICATION_CODES.delete(key);

    return jsonResponse(
      {
        success: false,
        message: "Unable to send verification email."
      },
      500,
      origin
    );
  }
}

async function handleVerifyCode(request, env, origin) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        success: false,
        message: "Invalid request."
      },
      400,
      origin
    );
  }

  const email = normalizeEmail(body.email);
  const code = String(body.code || "").trim();

  if (!email || !code) {
    return jsonResponse(
      {
        success: false,
        message: "Email and verification code are required."
      },
      400,
      origin
    );
  }

  if (!/^\d{6}$/.test(code)) {
    return jsonResponse(
      {
        success: false,
        message: "Verification code must contain 6 digits."
      },
      400,
      origin
    );
  }

  if (!env.VERIFICATION_CODES) {
    return jsonResponse(
      {
        success: false,
        message: "Verification storage is not configured yet."
      },
      500,
      origin
    );
  }

  const key = `verification:${email}`;

  const record = await env.VERIFICATION_CODES.get(key, "json");

  if (!record) {
    return jsonResponse(
      {
        success: false,
        message: "The verification code has expired or does not exist."
      },
      400,
      origin
    );
  }

  const now = Math.floor(Date.now() / 1000);

  if (now > record.expiresAt) {
    await env.VERIFICATION_CODES.delete(key);

    return jsonResponse(
      {
        success: false,
        message: "The verification code has expired."
      },
      400,
      origin
    );
  }

  if ((record.attempts || 0) >= 5) {
    await env.VERIFICATION_CODES.delete(key);

    return jsonResponse(
      {
        success: false,
        message: "Too many incorrect attempts. Please request a new code."
      },
      429,
      origin
    );
  }

  const submittedHash = await sha256(code);

  if (submittedHash !== record.codeHash) {
    record.attempts = (record.attempts || 0) + 1;

    await env.VERIFICATION_CODES.put(
      key,
      JSON.stringify(record),
      {
        expirationTtl: Math.max(1, record.expiresAt - now)
      }
    );

    return jsonResponse(
      {
        success: false,
        message: "Incorrect verification code."
      },
      400,
      origin
    );
  }

  await env.VERIFICATION_CODES.delete(key);

  return jsonResponse(
    {
      success: true,
      verified: true,
      email
    },
    200,
    origin
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      (
        url.pathname === "/requestEmailVerification" ||
        url.pathname === "/api/requestEmailVerification"
      )
    ) {
      return handleVerificationRequest(request, env, origin);
    }

    if (
      request.method === "POST" &&
      (
        url.pathname === "/verifyEmailCode" ||
        url.pathname === "/api/verifyEmailCode"
      )
    ) {
      return handleVerifyCode(request, env, origin);
    }

    if (
      request.method === "POST" &&
      (
        url.pathname === "/resendVerificationCode" ||
        url.pathname === "/api/resendVerificationCode"
      )
    ) {
      return handleVerificationRequest(request, env, origin);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("McKenzie Ramen House Worker is running.", {
      status: 200
    });
  }
};
