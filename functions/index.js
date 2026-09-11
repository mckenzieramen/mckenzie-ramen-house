const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const db = admin.firestore();
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const RESEND_FROM_EMAIL = defineSecret("RESEND_FROM_EMAIL");
const VERIFICATION_SECRET = defineSecret("VERIFICATION_SECRET");

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

function jsonError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function makeCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashCode(token, code) {
  return crypto
    .createHmac("sha256", VERIFICATION_SECRET.value())
    .update(String(token) + ":" + String(code))
    .digest("hex");
}

function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ""), "hex");
  const bb = Buffer.from(String(b || ""), "hex");
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

async function sendVerificationEmail({ to, code }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL.value(),
      to: [to],
      subject: "Your McKenzie Ramen House verification code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;background:#fffaf3;color:#3a0709;border:1px solid #e7c8b8;border-radius:16px">
          <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#a51620">MCKENZIE RAMEN HOUSE</div>
          <h1 style="font-family:Georgia,serif;font-size:28px;margin:10px 0 8px">Verify your email</h1>
          <p style="font-size:14px;line-height:1.6">Use the verification code below to finish creating your McKenzie Ramen House account.</p>
          <div style="font-size:34px;font-weight:900;letter-spacing:10px;text-align:center;padding:20px 10px;margin:20px 0;background:#fff;border:2px solid #e9ad35;border-radius:14px">${code}</div>
          <p style="font-size:13px;line-height:1.6;color:#765f5a">This code expires in 10 minutes. If you did not request an account, you can ignore this email.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body && body.message ? String(body.message) : "";
    } catch (_) {}
    throw new Error(detail || `Email service returned HTTP ${response.status}.`);
  }
}

async function createVerification(req, res) {
  const fullName = String(req.body?.fullName || "").trim();
  const email = normalizeEmail(req.body?.email);
  const username = normalizeUsername(req.body?.username);
  const mobile = String(req.body?.mobile || "").trim();
  const password = String(req.body?.password || "");

  if (!fullName || !email || !username || !mobile || !password) {
    return jsonError(res, 400, "Please complete all required fields.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(res, 400, "Please enter a valid email address.");
  }
  if (password.length < 6) {
    return jsonError(res, 400, "Password must be at least 6 characters.");
  }

  let existingUser = null;
  try {
    existingUser = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }

  if (existingUser && existingUser.emailVerified) {
    return jsonError(res, 409, "An account with this email already exists. Please sign in.");
  }

  const usernameSnap = await db.collection("users").where("username", "==", username).limit(1).get();
  if (!usernameSnap.empty) {
    const sameUser = usernameSnap.docs[0];
    if (!existingUser || sameUser.id !== existingUser.uid) {
      return jsonError(res, 409, "That username is already in use. Please choose another username.");
    }
  }

  let uid = existingUser ? existingUser.uid : "";
  let createdNewUser = false;

  try {
    if (existingUser) {
      await admin.auth().updateUser(existingUser.uid, {
        password,
        displayName: fullName,
        disabled: true
      });
      uid = existingUser.uid;
    } else {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: false,
        disabled: true
      });
      uid = userRecord.uid;
      createdNewUser = true;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const code = makeCode();
    const now = Date.now();
    const expiresAt = now + CODE_TTL_MS;

    await db.collection("emailVerifications").doc(token).set({
      uid,
      email,
      fullName,
      username,
      mobile,
      codeHash: hashCode(token, code),
      attempts: 0,
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      updatedAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
      lastSentAt: admin.firestore.Timestamp.fromMillis(now),
      used: false
    });

    try {
      await sendVerificationEmail({ to: email, code });
    } catch (emailError) {
      await db.collection("emailVerifications").doc(token).delete().catch(() => {});
      if (createdNewUser) {
        await admin.auth().deleteUser(uid).catch(() => {});
      } else {
        await admin.auth().updateUser(uid, { disabled: true }).catch(() => {});
      }
      console.error("Verification email failed:", emailError);
      return jsonError(res, 502, "We could not send the verification code. Please try again later.");
    }

    return res.json({
      success: true,
      message: "A 6-digit verification code has been sent to your email.",
      verificationToken: token,
      email,
      expiresInSeconds: 600
    });
  } catch (error) {
    console.error("createVerification error:", error);
    return jsonError(res, 500, "Unable to create the verification request. Please try again.");
  }
}

async function verifyCode(req, res) {
  const token = String(req.body?.token || "").trim();
  const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);

  if (!token || !/^\d{6}$/.test(code)) {
    return jsonError(res, 400, "Please enter the 6-digit verification code.");
  }

  const ref = db.collection("emailVerifications").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return jsonError(res, 404, "Verification session expired. Please create the account again.");

  const data = snap.data() || {};
  const now = Date.now();
  const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;

  if (data.used) return jsonError(res, 400, "This verification code has already been used.");
  if (!expiresAt || now > expiresAt) {
    return jsonError(res, 400, "This verification code has expired. Please request a new one.");
  }
  if (Number(data.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    return jsonError(res, 429, "Too many incorrect attempts. Please request a new code.");
  }

  const expectedHash = hashCode(token, code);
  if (!safeEqualHex(expectedHash, data.codeHash)) {
    await ref.update({
      attempts: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return jsonError(res, 400, "Incorrect verification code. Please try again.");
  }

  try {
    await admin.auth().updateUser(data.uid, {
      emailVerified: true,
      disabled: false,
      displayName: data.fullName || undefined
    });

    await db.collection("users").doc(data.uid).set({
      username: data.username || "",
      email: data.email || "",
      fullName: data.fullName || "",
      mobile: data.mobile || "",
      country: "Philippines",
      status: "ACTIVE",
      emailVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await ref.update({
      used: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      message: "Email verified. Your account has been created.",
      userId: data.uid,
      email: data.email || ""
    });
  } catch (error) {
    console.error("verifyCode error:", error);
    return jsonError(res, 500, "Verification succeeded but the account could not be activated. Please try again.");
  }
}

async function resendCode(req, res) {
  const token = String(req.body?.token || "").trim();
  if (!token) return jsonError(res, 400, "Verification session is missing.");

  const ref = db.collection("emailVerifications").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return jsonError(res, 404, "Verification session expired. Please create the account again.");

  const data = snap.data() || {};
  const now = Date.now();
  const lastSentAt = data.lastSentAt?.toMillis ? data.lastSentAt.toMillis() : 0;
  const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;

  if (data.used) return jsonError(res, 400, "This verification session is already completed.");
  if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
    return jsonError(res, 429, `Please wait ${wait} seconds before requesting another code.`);
  }

  const code = makeCode();
  const newExpiresAt = now + CODE_TTL_MS;

  try {
    await sendVerificationEmail({ to: data.email, code });
    await ref.update({
      codeHash: hashCode(token, code),
      attempts: 0,
      lastSentAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(newExpiresAt),
      updatedAt: admin.firestore.Timestamp.fromMillis(now)
    });

    return res.json({
      success: true,
      message: "A new 6-digit verification code has been sent.",
      expiresInSeconds: 600
    });
  } catch (error) {
    console.error("resendCode error:", error);
    return jsonError(res, 502, "We could not resend the verification code. Please try again later.");
  }
}

exports.requestEmailVerification = onRequest(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY, RESEND_FROM_EMAIL, VERIFICATION_SECRET],
    invoker: "public"
  },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
    try {
      return await createVerification(req, res);
    } catch (error) {
      console.error(error);
      return jsonError(res, 500, "Unable to process the verification request.");
    }
  }
);

exports.verifyEmailCode = onRequest(
  {
    region: "us-central1",
    secrets: [VERIFICATION_SECRET],
    invoker: "public"
  },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
    try {
      return await verifyCode(req, res);
    } catch (error) {
      console.error(error);
      return jsonError(res, 500, "Unable to verify the code.");
    }
  }
);

exports.resendVerificationCode = onRequest(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY, RESEND_FROM_EMAIL, VERIFICATION_SECRET],
    invoker: "public"
  },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
    try {
      return await resendCode(req, res);
    } catch (error) {
      console.error(error);
      return jsonError(res, 500, "Unable to resend the verification code.");
    }
  }
);
