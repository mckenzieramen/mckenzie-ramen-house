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



async function sendCustomPasswordResetEmail(req, res) {
  const email = normalizeEmail(req.body?.email);
  const continueUrl = String(req.body?.continueUrl || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(res, 400, "Please enter a valid email address.");
  }

  // Keep the reset destination tied to the site that requested it. This prevents
  // the endpoint from being used to generate password-reset links to arbitrary sites.
  let parsedUrl;
  try { parsedUrl = new URL(continueUrl); } catch (_) {}
  const requestOrigin = String(req.get("origin") || "").trim();
  if (!parsedUrl || !/^https?:$/.test(parsedUrl.protocol) ||
      (requestOrigin && parsedUrl.origin !== requestOrigin)) {
    return jsonError(res, 400, "Invalid password-reset destination.");
  }

  try {
    const actionCodeSettings = {
      url: continueUrl,
      handleCodeInApp: false
    };

    let resetLink = "";
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    } catch (error) {
      // Do not expose whether an email is registered. Firebase's default
      // password-reset flow also avoids account enumeration.
      if (error && error.code === "auth/user-not-found") {
        return res.json({ success: true, message: "If an account exists for this email, a password-reset link has been sent." });
      }
      throw error;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY.value()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL.value(),
        to: [email],
        subject: "Reset your McKenzie Ramen House password",
        html: `
          <div style="margin:0;padding:32px 16px;background:#f7eee7;font-family:Arial,Helvetica,sans-serif;color:#3a0709">
            <div style="max-width:600px;margin:0 auto;background:#fffaf3;border:1px solid #e7c8b8;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(58,7,9,.08)">
              <div style="padding:30px 32px 14px;text-align:center">
                <div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#a51620">MCKENZIE RAMEN HOUSE</div>
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;margin:12px 0 8px;color:#4a080b">Reset Your Password</h1>
                <p style="font-size:15px;line-height:1.7;color:#765f5a;margin:0">We received a request to reset the password for your McKenzie Ramen House account.</p>
              </div>
              <div style="padding:14px 32px 32px;text-align:center">
                <p style="font-size:15px;line-height:1.7;color:#4f3935;margin:0 0 22px">Click the button below to securely create a new password.</p>
                <a href="${resetLink}" style="display:inline-block;background:#a51620;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;padding:15px 28px;border-radius:10px;letter-spacing:.2px">Reset My Password</a>
                <p style="font-size:13px;line-height:1.7;color:#765f5a;margin:24px 0 0">This secure link will take you to the official McKenzie Ramen House website.</p>
                <div style="height:1px;background:#ead8cf;margin:24px 0"></div>
                <p style="font-size:12px;line-height:1.7;color:#8a716b;margin:0">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
              </div>
              <div style="padding:18px 32px;background:#4a080b;text-align:center;color:#fff7f1">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px">McKenzie Ramen House</div>
                <div style="font-size:11px;opacity:.8;margin-top:5px">Thank you for choosing us.</div>
              </div>
            </div>
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

    return res.json({ success: true, message: "If an account exists for this email, a password-reset link has been sent." });
  } catch (error) {
    console.error("sendCustomPasswordResetEmail error:", error);
    return jsonError(res, 502, "We could not send the password-reset email right now. Please try again later.");
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



function getBearerToken(req) {
  const h = String(req.get("Authorization") || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function requireCustomerToken(req) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Authentication required.");
  return admin.auth().verifyIdToken(token);
}

function reviewDocData(doc) {
  const r = doc.data() || {};
  return {
    reviewId: r.reviewId || doc.id,
    orderId: String(r.orderId || ""),
    productId: String(r.productId || ""),
    productName: String(r.productName || "Menu item"),
    rating: Number(r.rating || 0),
    review: String(r.review || ""),
    customerName: String(r.customerName || "Customer"),
    customerId: String(r.customerId || ""),
    submittedAt: r.submittedAt?.toDate ? r.submittedAt.toDate().toISOString() : String(r.submittedAt || ""),
    status: String(r.status || "Published")
  };
}

async function publishedReviews(req, res) {
  const snap = await db.collection("reviews").where("status", "==", "Published").get();
  return res.json({
    success: true,
    reviews: snap.docs.map(reviewDocData)
      .filter(r => r.rating >= 1 && r.rating <= 5)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
  });
}

async function customerReviewForm(req, res) {
  const decoded = await requireCustomerToken(req);
  const orderId = String(req.body?.orderId || "").trim();
  if (!orderId) return jsonError(res, 400, "Order ID is required.");
  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) return jsonError(res, 404, "Order not found.");
  const order = orderSnap.data() || {};
  if (String(order.userId || "") !== decoded.uid) return jsonError(res, 403, "Invalid customer account.");
  if (String(order.orderStatus || "") !== "Delivered" || !order.customerConfirmed) {
    return jsonError(res, 400, "You can review this order only after it has been delivered and received.");
  }
  const reviewsSnap = await db.collection("reviews").where("customerId", "==", decoded.uid).get();
  const byProduct = {};
  reviewsSnap.docs.forEach(d => {
    const r = d.data() || {};
    const key = String(r.productId || "");
    (byProduct[key] ||= []).push(r);
  });
  const items = [];
  for (const item of (Array.isArray(order.items) ? order.items : [])) {
    const productId = String(item.productId || item.id || "");
    const qty = Math.max(1, Number(item.quantity || 1));
    const existing = (byProduct[productId] || []).filter(r => String(r.orderId || "") === orderId)
      .sort((a,b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")));
    let image = String(item.image || item.productImage || "");
    if (!image && productId) {
      const ps = await db.collection("products").doc(productId).get();
      if (ps.exists) image = String((ps.data() || {}).image || (ps.data() || {}).imageUrl || "");
    }
    for (let unit = 0; unit < qty; unit++) {
      const r = existing[unit] || null;
      items.push({ productId, productName: String(item.productName || item.name || "Ramen item"), image,
        quantity: qty, unitIndex: unit + 1, reviewed: !!r,
        existingRating: r ? Number(r.rating || 0) : 0, existingReview: r ? String(r.review || "") : "" });
    }
  }
  return res.json({success:true, orderId, customerName:String(order.customerName || order.fullName || "Customer"), items,
    completed: items.length > 0 && items.every(i => i.reviewed)});
}

async function submitCustomerReviews(req, res) {
  const decoded = await requireCustomerToken(req);
  const orderId = String(req.body?.orderId || "").trim();
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (!orderId || !entries.length) return jsonError(res, 400, "Please rate at least one menu item before submitting.");
  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) return jsonError(res, 404, "Order not found.");
  const order = orderSnap.data() || {};
  if (String(order.userId || "") !== decoded.uid) return jsonError(res, 403, "Invalid customer account.");
  if (String(order.orderStatus || "") !== "Delivered" || !order.customerConfirmed) {
    return jsonError(res, 400, "You can review this order only after it has been delivered and received.");
  }
  const existingSnap = await db.collection("reviews").where("customerId", "==", decoded.uid).get();
  const existingCounts = {};
  existingSnap.docs.forEach(d => {
    const r=d.data()||{}; const key=String(r.orderId||"")+"|"+String(r.productId||"");
    existingCounts[key]=(existingCounts[key]||0)+1;
  });
  const batch=db.batch(); let count=0; const submittedCounts={};
  for (const ent of entries) {
    const pid=String(ent.productId||""); if(!pid) continue;
    const rating=Number(ent.rating||0), review=String(ent.review||"").trim();
    if(!Number.isFinite(rating)||rating<1||rating>5) return jsonError(res,400,"Please select a rating from 1 to 5 stars for every menu item.");
    if(review.length>1000) return jsonError(res,400,"A review is too long. Please keep each comment under 1000 characters.");
    const target=(Array.isArray(order.items)?order.items:[]).find(item=>String(item.productId||item.id||"")===pid);
    if(!target) return jsonError(res,400,"One of the selected menu items was not part of this order.");
    const key=orderId+"|"+pid, already=Number(existingCounts[key]||0)+Number(submittedCounts[key]||0);
    const qty=Math.max(1,Number(target.quantity||1)); if(already>=qty) continue;
    const id="REV-"+Date.now()+"-"+Math.floor(Math.random()*100000)+"-"+count;
    batch.set(db.collection("reviews").doc(id),{reviewId:id,orderId,customerId:decoded.uid,productId:pid,
      productName:String(target.productName||target.name||"Ramen item"),rating,review,unitIndex:already+1,reviewedUnit:already+1,
      customerName:String(order.customerName||order.fullName||"Customer"),submittedAt:admin.firestore.FieldValue.serverTimestamp(),status:"Published"});
    submittedCounts[key]=(submittedCounts[key]||0)+1; count++;
  }
  if(count) await batch.commit();
  return res.json({success:true,message:"Thank you for supporting McKenzie Ramen House!",reviewCount:count,completed:true});
}

async function customerReceiptAction(req, res) {
  const decoded = await requireCustomerToken(req);
  const orderId=String(req.body?.orderId||"").trim(), action=String(req.body?.action||"").trim();
  if(!orderId || !["received","dismiss"].includes(action)) return jsonError(res,400,"Invalid receipt confirmation request.");
  const ref=db.collection("orders").doc(orderId), snap=await ref.get();
  if(!snap.exists) return jsonError(res,404,"Order not found.");
  const order=snap.data()||{};
  if(String(order.userId||"")!==decoded.uid) return jsonError(res,403,"Invalid customer account.");
  if(String(order.orderStatus||"")!=="Delivered") return jsonError(res,400,"The order has not been marked as delivered yet.");
  const now=admin.firestore.FieldValue.serverTimestamp();
  if(action==="dismiss") await ref.update({receiptPromptDismissed:true,receiptPromptDismissedAt:now});
  else await ref.update({customerConfirmed:true,confirmedAt:now,closed:true,receiptPromptDismissed:true,receiptPromptDismissedAt:now});
  const notificationId=String(req.body?.notificationId||"");
  if(notificationId){const nr=db.collection("notifications").doc(notificationId), ns=await nr.get(); if(ns.exists && String((ns.data()||{}).userId||"")===decoded.uid) await nr.update({readAt:now});}
  return res.json({success:true,received:action==="received",dismissed:action==="dismiss"});
}



exports.sendCustomPasswordResetEmail = onRequest(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY, RESEND_FROM_EMAIL],
    invoker: "public"
  },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
    try {
      return await sendCustomPasswordResetEmail(req, res);
    } catch (error) {
      console.error(error);
      return jsonError(res, 500, "Unable to process the password-reset request.");
    }
  }
);

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


exports.publishedReviews = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req,res)=>{ setCors(res); if(req.method==="OPTIONS")return res.status(204).send(""); if(req.method!=="GET")return jsonError(res,405,"Method not allowed."); try{return await publishedReviews(req,res);}catch(e){console.error(e);return jsonError(res,500,"Unable to load published reviews.");} }
);

exports.customerReviewForm = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req,res)=>{ setCors(res); if(req.method==="OPTIONS")return res.status(204).send(""); if(req.method!=="POST")return jsonError(res,405,"Method not allowed."); try{return await customerReviewForm(req,res);}catch(e){console.error(e);return jsonError(res, e.code === "auth/id-token-expired" || e.code === "auth/argument-error" ? 401 : 500, e.message || "Unable to load the review form.");} }
);

exports.submitCustomerReviews = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req,res)=>{ setCors(res); if(req.method==="OPTIONS")return res.status(204).send(""); if(req.method!=="POST")return jsonError(res,405,"Method not allowed."); try{return await submitCustomerReviews(req,res);}catch(e){console.error(e);return jsonError(res, e.code === "auth/id-token-expired" || e.code === "auth/argument-error" ? 401 : 500, e.message || "Unable to submit the review.");} }
);

exports.customerReceiptAction = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req,res)=>{ setCors(res); if(req.method==="OPTIONS")return res.status(204).send(""); if(req.method!=="POST")return jsonError(res,405,"Method not allowed."); try{return await customerReceiptAction(req,res);}catch(e){console.error(e);return jsonError(res, e.code === "auth/id-token-expired" || e.code === "auth/argument-error" ? 401 : 500, e.message || "Unable to save the receipt response.");} }
);
