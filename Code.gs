// McKenzie Ramen House — FINAL ORDER WORKFLOW v0.1s
function doGet(e) {
  // Public customer-order API for the GitHub Pages frontend.
  // Notification/receipt APIs are intentionally JSONP-compatible so the
  // existing customer frontend can poll without changing its architecture.
  if (e && e.parameter) {
    const api = String(e.parameter.api || "").trim();
    const callback = String(e.parameter.callback || "").replace(/[^a-zA-Z0-9_$]/g, "");
    const respond = function(result) {
      const body = JSON.stringify(result);
      if (callback) {
        return ContentService.createTextOutput(callback + "(" + body + ");")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
    };

    if (api === "customerNotifications") {
      try {
        return respond({success:true, notifications:getCustomerNotifications(String(e.parameter.userId || ""))});
      } catch (error) {
        return respond({success:false, error:error && error.message ? error.message : String(error)});
      }
    }

    if (api === "respondCustomerReceipt") {
      try {
        const received = String(e.parameter.received || "").toLowerCase() === "true" || String(e.parameter.received || "") === "1";
        return respond(respondCustomerReceipt(
          String(e.parameter.userId || ""),
          String(e.parameter.orderId || ""),
          received,
          String(e.parameter.notificationId || "")
        ));
      } catch (error) {
        return respond({success:false, error:error && error.message ? error.message : String(error)});
      }
    }

    if (api === "markCustomerNotificationRead") {
      try {
        return respond(markCustomerNotificationRead(
          String(e.parameter.userId || ""),
          String(e.parameter.notificationId || "")
        ));
      } catch (error) {
        return respond({success:false, error:error && error.message ? error.message : String(error)});
      }
    }

    if (api === "getCustomerReviewForm") {
      try {
        return respond(getCustomerReviewForm(
          String(e.parameter.userId || ""),
          String(e.parameter.orderId || "")
        ));
      } catch (error) {
        return respond({success:false, error:error && error.message ? error.message : String(error)});
      }
    }

    if (api === "submitCustomerReview") {
      try {
        return respond(submitCustomerReview(
          String(e.parameter.userId || ""),
          String(e.parameter.orderId || ""),
          String(e.parameter.productId || ""),
          Number(e.parameter.rating || 0),
          String(e.parameter.review || "")
        ));
      } catch (error) {
        return respond({success:false, error:error && error.message ? error.message : String(error)});
      }
    }
  }
  if (e && e.parameter && String(e.parameter.api || "").trim() === "recordOrder") {
    try {
      const orderId = String(e.parameter.orderId || "").trim();
      const payload = JSON.parse(String(e.parameter.payload || "{}"));
      const result = recordCompletedCustomerOrder(orderId, payload);
      const callback = String(e.parameter.callback || "").replace(/[^a-zA-Z0-9_$]/g, "");
      const body = JSON.stringify(result);
      if (callback) {
        return ContentService
          .createTextOutput(callback + "(" + body + ");")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService
        .createTextOutput(body)
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      const callback = String((e && e.parameter && e.parameter.callback) || "").replace(/[^a-zA-Z0-9_$]/g, "");
      const body = JSON.stringify({
        success: false,
        error: error && error.message ? error.message : String(error)
      });
      if (callback) {
        return ContentService
          .createTextOutput(callback + "(" + body + ");")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService
        .createTextOutput(body)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  const page =
    e && e.parameter && e.parameter.page
      ? String(e.parameter.page).toLowerCase()
      : "index";

  let fileName = "Index";

  if (page === "login") {
    fileName = "LoginPage";
  }

  if (page === "create") {
    fileName = "CreateAccount";
  }

  if (page === "ratings") {
    fileName = "ProductRatingPage";
  }

  if (page === "admin") {
    fileName = "Admin";
  }

  if (fileName === "Admin") {
    const adminHtml = HtmlService.createHtmlOutputFromFile(fileName).getContent();
    const guard = `<script>
(function(){
  window.alert = function(message){
    var text = String(message || "");
    var box = document.getElementById("adminToast");
    if (box && typeof window.showAdminToast === "function") {
      window.showAdminToast("✓ Review notification", text);
      return;
    }
    var old = document.getElementById("mckenzieEmergencyToast");
    if(old) old.remove();
    old = document.createElement("div");
    old.id = "mckenzieEmergencyToast";
    old.style.cssText = "position:fixed;top:24px;right:24px;z-index:2147483647;background:#fff;border:1px solid #b91e35;border-left:5px solid #b91e35;border-radius:14px;padding:16px 20px;box-shadow:0 15px 40px rgba(0,0,0,.22);font:600 14px Arial;color:#333;max-width:380px";
    old.textContent = text;
    document.body.appendChild(old);
    setTimeout(function(){ if(old && old.parentNode) old.parentNode.removeChild(old); }, 4500);
  };
})();
</script>`;
    return HtmlService
      .createHtmlOutput(adminHtml + guard)
      .setTitle("McKenzie Ramen House")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService
    .createHtmlOutputFromFile(fileName)
    .setTitle("McKenzie Ramen House")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/* =========================================================
   CUSTOMER ORDER API
   Allows the GitHub/customer frontend to send completed orders
   to this Apps Script backend without google.script.run.
   ========================================================= */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const data = JSON.parse(raw);
    const action = String(data.action || "").trim();
    const args = Array.isArray(data.args) ? data.args : [];

    if (action === "recordCompletedCustomerOrder") {
      const result = recordCompletedCustomerOrder(args[0], args[1]);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Unknown API action.");
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error && error.message ? error.message : String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/* =====================================================
   USERS
===================================================== */

function getUsersSheet_() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName("Users");

  if (!sheet) {

    sheet =
      ss.insertSheet("Users");

    sheet.appendRow([
      "ID",
      "Username",
      "Email",
      "Mobile",
      "Password Hash",
      "Password Salt",
      "House/Unit",
      "Street",
      "Barangay",
      "City",
      "Province",
      "Postal Code",
      "Country",
      "Created At",
      "Status",
      "Full Name",
      "Region",
      "Additional Instruction"
    ]);

  }

  // Upgrade an existing 15-column Users sheet.
  const requiredHeaders = [
    "Full Name",
    "Region",
    "Additional Instruction"
  ];

  const currentLastColumn =
    Math.max(sheet.getLastColumn(), 15);

  const headerValues =
    sheet
      .getRange(1, 1, 1, currentLastColumn)
      .getValues()[0];

  requiredHeaders.forEach(function(header, i) {
    const col = 16 + i;

    if (
      String(headerValues[col - 1] || "").trim() !==
      header
    ) {
      sheet.getRange(1, col).setValue(header);
    }
  });

  return sheet;
}

/* =====================================================
   PASSWORD
===================================================== */

function hashPassword_(password, salt) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password + salt,
      Utilities.Charset.UTF_8
    );

  return digest
    .map(function(byte) {

      const value =
        byte < 0
          ? byte + 256
          : byte;

      return (
        "0" +
        value.toString(16)
      ).slice(-2);

    })
    .join("");
}


/* =====================================================
   CREATE ACCOUNT
===================================================== */

/* =====================================================
   EMAIL VERIFICATION
   6-digit code, 10-minute expiry, max 5 attempts.
   Password is stored only as a salted hash while pending.
===================================================== */
function requestEmailVerification(fullName, email, username, password, mobile) {
  fullName = String(fullName || "").trim();
  email = String(email || "").trim().toLowerCase();
  username = String(username || "").trim();
  password = String(password || "");
  mobile = String(mobile || "").trim();

  if (!fullName) throw new Error("Please enter your full name.");
  if (!email) throw new Error("Please enter your email address.");
  if (!username) throw new Error("Please enter a username.");
  if (!password) throw new Error("Please enter a password.");
  if (!mobile) throw new Error("Please enter your mobile number.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const sheet = getUsersSheet_();
  const last = sheet.getLastRow();
  if (last >= 2) {
    const users = sheet.getRange(2, 1, last - 1, 15).getValues();
    for (let i = 0; i < users.length; i++) {
      if (String(users[i][1] || "").trim().toLowerCase() === username.toLowerCase()) throw new Error("Username already exists.");
      if (String(users[i][2] || "").trim().toLowerCase() === email) throw new Error("Email already registered.");
      if (String(users[i][3] || "").trim() === mobile) throw new Error("Mobile already registered.");
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = Utilities.getUuid();
  const salt = Utilities.getUuid();
  const passwordHash = hashPassword_(password, salt);
  const now = Date.now();
  const props = PropertiesService.getScriptProperties();
  const key = "MCKENZIE_VERIFY_" + token;

  props.setProperty(key, JSON.stringify({
    fullName: fullName,
    email: email,
    username: username,
    mobile: mobile,
    passwordHash: passwordHash,
    salt: salt,
    code: code,
    createdAt: now,
    expiresAt: now + (10 * 60 * 1000),
    attempts: 0
  }));

  try {
    MailApp.sendEmail({
      to: email,
      subject: "Mckenzie Ramen House - Email Verification Code",
      body: "Hello " + fullName + ",\n\n" +
        "Thank you for creating an account with Mckenzie Ramen House.\n\n" +
        "Your verification code is: " + code + "\n\n" +
        "This code will expire in 10 minutes. Please enter it on the website to verify your email.\n\n" +
        "If you did not request this account, you can safely ignore this email.\n\n" +
        "Mckenzie Ramen House 🍜"
    });
  } catch (error) {
    props.deleteProperty(key);
    console.error("MAIL SEND ERROR:", error);
    throw new Error(
      "MAIL SEND ERROR: " +
      (error && error.message ? error.message : String(error))
    );
  }

  return { success: true, message: "Verification code sent.", verificationToken: token, email: email, expiresInSeconds: 600 };
}

function verifyEmailCode(token, code) {
  token = String(token || "").trim();
  code = String(code || "").replace(/\D/g, "").trim();
  if (!token) throw new Error("Verification session expired. Please create the account again.");
  if (!/^\d{6}$/.test(code)) throw new Error("Please enter the 6-digit verification code.");

  const props = PropertiesService.getScriptProperties();
  const key = "MCKENZIE_VERIFY_" + token;
  const raw = props.getProperty(key);
  if (!raw) throw new Error("Verification session expired. Please request a new code.");

  let pending;
  try { pending = JSON.parse(raw); } catch (error) { props.deleteProperty(key); throw new Error("Verification session is invalid. Please create the account again."); }
  if (Date.now() > Number(pending.expiresAt || 0)) { props.deleteProperty(key); throw new Error("Verification code expired. Please request a new code."); }

  const attempts = Number(pending.attempts || 0);
  if (attempts >= 5) { props.deleteProperty(key); throw new Error("Too many incorrect attempts. Please create the account again."); }
  if (String(pending.code) !== code) {
    pending.attempts = attempts + 1;
    props.setProperty(key, JSON.stringify(pending));
    const remaining = 5 - pending.attempts;
    throw new Error("Invalid verification code. " + remaining + " attempt" + (remaining === 1 ? "" : "s") + " remaining.");
  }

  const sheet = getUsersSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const last = sheet.getLastRow();
    if (last >= 2) {
      const users = sheet.getRange(2, 1, last - 1, 15).getValues();
      for (let i = 0; i < users.length; i++) {
        if (String(users[i][1] || "").trim().toLowerCase() === String(pending.username).toLowerCase()) { props.deleteProperty(key); throw new Error("Username already exists."); }
        if (String(users[i][2] || "").trim().toLowerCase() === String(pending.email).toLowerCase()) { props.deleteProperty(key); throw new Error("Email already registered."); }
      }
    }
    sheet.appendRow([
      Utilities.getUuid(),
      pending.username,
      pending.email,
      pending.mobile || "",
      pending.passwordHash,
      pending.salt,
      "",
      "",
      "",
      "",
      "",
      "",
      "Philippines",
      new Date(),
      "ACTIVE",
      pending.fullName || "",
      "",
      ""
    ]);
    props.deleteProperty(key);
    return { success: true, message: "Email verified and account created successfully." };
  } finally {
    lock.releaseLock();
  }
}

function resendVerificationCode(token) {
  token = String(token || "").trim();
  if (!token) throw new Error("Verification session expired. Please create the account again.");
  const props = PropertiesService.getScriptProperties();
  const key = "MCKENZIE_VERIFY_" + token;
  const raw = props.getProperty(key);
  if (!raw) throw new Error("Verification session expired. Please create the account again.");
  let pending;
  try { pending = JSON.parse(raw); } catch (error) { props.deleteProperty(key); throw new Error("Verification session is invalid. Please create the account again."); }
  if (Date.now() > Number(pending.expiresAt || 0)) { props.deleteProperty(key); throw new Error("Verification session expired. Please create the account again."); }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  pending.code = code;
  pending.createdAt = Date.now();
  pending.expiresAt = Date.now() + (10 * 60 * 1000);
  pending.attempts = 0;
  props.setProperty(key, JSON.stringify(pending));

  try {
    MailApp.sendEmail({
      to: pending.email,
      subject: "Mckenzie Ramen House - New Verification Code",
      body: "Hello " + pending.fullName + ",\n\n" +
        "Your new Mckenzie Ramen House verification code is: " + code + "\n\n" +
        "This code will expire in 10 minutes.\n\nMckenzie Ramen House 🍜"
    });
  } catch (error) {
    console.error("Verification email resend failed:", error);
    throw new Error(
      "We couldn't resend the verification email right now. Please try again in a moment."
    );
  }
  return { success: true, message: "A new verification code has been sent." };
}


function createUser(fullName, email, username, password) {
  fullName = String(fullName || "").trim();
  email = String(email || "").trim().toLowerCase();
  username = String(username || "").trim();
  password = String(password || "");

  if (!fullName) throw new Error("Please enter your full name.");
  if (!email) throw new Error("Please enter your email address.");
  if (!username) throw new Error("Please enter a username.");
  if (!password) throw new Error("Please enter a password.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const sheet = getUsersSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const last = sheet.getLastRow();
    if (last >= 2) {
      const users = sheet.getRange(2, 1, last - 1, 15).getValues();

      for (let i = 0; i < users.length; i++) {
        if (String(users[i][1] || "").trim().toLowerCase() === username.toLowerCase()) {
          throw new Error("Username already exists.");
        }
        if (String(users[i][2] || "").trim().toLowerCase() === email) {
          throw new Error("Email already registered.");
        }
      }
    }

    const salt = Utilities.getUuid();
    const passwordHash = hashPassword_(password, salt);

    sheet.appendRow([
      Utilities.getUuid(),
      username,
      email,
      "",
      passwordHash,
      salt,
      "",
      "",
      "",
      "",
      "",
      "",
      "Philippines",
      new Date(),
      "ACTIVE"
    ]);

    return {
      success: true,
      message: "Account created successfully.",
      fullName: fullName,
      username: username,
      email: email
    };
  } finally {
    lock.releaseLock();
  }
}


function createAccount(data) {

  if (!data) {
    throw new Error(
      "Invalid account information."
    );
  }

  const username =
    String(data.username || "").trim();

  const email =
    String(data.email || "")
      .trim()
      .toLowerCase();

  const mobile =
    String(data.mobile || "").trim();

  const password =
    String(data.password || "");

  const confirmPassword =
    String(data.confirmPassword || "");

  const houseUnit =
    String(data.houseUnit || "").trim();

  const street =
    String(data.street || "").trim();

  const barangay =
    String(data.barangay || "").trim();

  const city =
    String(data.city || "").trim();

  const province =
    String(data.province || "").trim();

  const postalCode =
    String(data.postalCode || "").trim();


  if (!username) {
    throw new Error("Please enter username.");
  }

  if (!email) {
    throw new Error("Please enter email.");
  }

  if (!mobile) {
    throw new Error("Please enter mobile number.");
  }

  if (!password) {
    throw new Error("Please enter password.");
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  if (password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters."
    );
  }


  const sheet =
    getUsersSheet_();

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {

    const last =
      sheet.getLastRow();

    if (last >= 2) {

      const users =
        sheet
          .getRange(
            2,
            1,
            last - 1,
            15
          )
          .getValues();

      for (
        let i = 0;
        i < users.length;
        i++
      ) {

        if (
          String(users[i][1])
            .toLowerCase() ===
          username.toLowerCase()
        ) {
          throw new Error(
            "Username already exists."
          );
        }

        if (
          String(users[i][2])
            .toLowerCase() ===
          email
        ) {
          throw new Error(
            "Email already registered."
          );
        }

        if (
          String(users[i][3]) ===
          mobile
        ) {
          throw new Error(
            "Mobile already registered."
          );
        }

      }

    }


    const salt =
      Utilities.getUuid();

    const passwordHash =
      hashPassword_(
        password,
        salt
      );


    sheet.appendRow([

      Utilities.getUuid(),
      username,
      email,
      mobile,
      passwordHash,
      salt,
      houseUnit,
      street,
      barangay,
      city,
      province,
      postalCode,
      "Philippines",
      new Date(),
      "ACTIVE",
      String(data.fullName || "").trim(),
      String(data.region || "").trim(),
      String(data.additionalInstruction || "").trim()

    ]);


    return {

      success: true,

      message:
        "Account created successfully."

    };


  } finally {

    lock.releaseLock();

  }

}


/* =====================================================
   PASSWORD CHANGE / RESET
===================================================== */
function makePasswordOtp_(userId, email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = Utilities.getUuid();
  const now = Date.now();
  const key = "MCKENZIE_PASSWORD_RESET_" + token;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify({
    userId: String(userId), email: String(email), code: code,
    createdAt: now, expiresAt: now + (10 * 60 * 1000), attempts: 0
  }));
  try {
    MailApp.sendEmail({
      to: email,
      subject: "Mckenzie Ramen House - Password Reset OTP",
      body: "Hello,\n\nYour Mckenzie Ramen House password reset OTP is: " + code +
        "\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nMckenzie Ramen House 🍜"
    });
  } catch (error) {
    PropertiesService.getScriptProperties().deleteProperty(key);
    throw new Error("We couldn't send the verification email right now. Please try again in a moment.");
  }
  return { success: true, verificationToken: token, email: email, expiresInSeconds: 600 };
}

function findUserRowByIdentifier_(identifier) {
  identifier = String(identifier || "").trim().toLowerCase();
  if (!identifier) throw new Error("Please enter your username or email.");
  const sheet = getUsersSheet_();
  const last = sheet.getLastRow();
  if (last < 2) throw new Error("No registered accounts found.");
  const rows = sheet.getRange(2, 1, last - 1, 18).getValues();
  for (let i=0;i<rows.length;i++) {
    const u=rows[i];
    if (String(u[1]||"").trim().toLowerCase()===identifier || String(u[2]||"").trim().toLowerCase()===identifier) return { row:i+2, user:u };
  }
  throw new Error("We couldn't find an account with that username or email.");
}

function requestPasswordResetOtp(identifier) {
  const found=findUserRowByIdentifier_(identifier);
  const u=found.user;
  const status=String(u[14]||"").trim().toUpperCase();
  if(status!=="ACTIVE") throw new Error("Account is not active.");
  const email=String(u[2]||"").trim();
  if(!email) throw new Error("This account does not have a registered email address.");
  return makePasswordOtp_(String(u[0]||""),email);
}

function requestPasswordResetOtpForUser(userId) {
  userId=String(userId||"").trim();
  if(!userId) throw new Error("Please log in again.");
  const sheet=getUsersSheet_(), last=sheet.getLastRow();
  if(last<2) throw new Error("User account not found.");
  const rows=sheet.getRange(2,1,last-1,18).getValues();
  for(let i=0;i<rows.length;i++){
    const u=rows[i];
    if(String(u[0]||"").trim()===userId){
      const email=String(u[2]||"").trim();
      if(!email)throw new Error("This account does not have a registered email address.");
      return makePasswordOtp_(userId,email);
    }
  }
  throw new Error("Customer ID not found.");
}

function resetPasswordWithOtp(token, code, newPassword) {
  token=String(token||"").trim(); code=String(code||"").replace(/\D/g,""); newPassword=String(newPassword||"");
  if(!token)throw new Error("OTP session expired. Please request a new code.");
  if(!/^\d{6}$/.test(code))throw new Error("Please enter the 6-digit OTP.");
  if(newPassword.length<6)throw new Error("Password must be at least 6 characters.");
  const props=PropertiesService.getScriptProperties(), key="MCKENZIE_PASSWORD_RESET_"+token, raw=props.getProperty(key);
  if(!raw)throw new Error("OTP session expired. Please request a new code.");
  let pending; try{pending=JSON.parse(raw);}catch(e){props.deleteProperty(key);throw new Error("Invalid OTP session. Please request a new code.");}
  if(Date.now()>Number(pending.expiresAt||0)){props.deleteProperty(key);throw new Error("OTP expired. Please request a new code.");}
  const attempts=Number(pending.attempts||0);
  if(attempts>=5){props.deleteProperty(key);throw new Error("Too many incorrect attempts. Please request a new code.");}
  if(String(pending.code)!==code){pending.attempts=attempts+1;props.setProperty(key,JSON.stringify(pending));throw new Error("Invalid OTP. " + (5-pending.attempts) + " attempt" + (5-pending.attempts===1?"":"s") + " remaining.");}
  const sheet=getUsersSheet_(), last=sheet.getLastRow();
  const rows=sheet.getRange(2,1,last-1,18).getValues();
  for(let i=0;i<rows.length;i++){
    if(String(rows[i][0]||"").trim()===String(pending.userId)){
      const salt=Utilities.getUuid();
      sheet.getRange(i+2,5).setValue(hashPassword_(newPassword,salt));
      sheet.getRange(i+2,6).setValue(salt);
      props.deleteProperty(key);
      return {success:true};
    }
  }
  props.deleteProperty(key); throw new Error("User account not found.");
}

function changePassword(userId, oldPassword, newPassword) {
  userId=String(userId||"").trim(); oldPassword=String(oldPassword||""); newPassword=String(newPassword||"");
  if(!userId)throw new Error("Please log in again.");
  if(!oldPassword)throw new Error("Please enter your old password.");
  if(newPassword.length<6)throw new Error("Password must be at least 6 characters.");
  const sheet=getUsersSheet_(), last=sheet.getLastRow();
  if(last<2)throw new Error("User account not found.");
  const rows=sheet.getRange(2,1,last-1,18).getValues();
  for(let i=0;i<rows.length;i++){
    const u=rows[i];
    if(String(u[0]||"").trim()===userId){
      const currentHash=String(u[4]||""), salt=String(u[5]||"");
      if(hashPassword_(oldPassword,salt)!==currentHash)throw new Error("Old password is incorrect. If you forgot it, use the email OTP option.");
      const newSalt=Utilities.getUuid();
      sheet.getRange(i+2,5).setValue(hashPassword_(newPassword,newSalt));
      sheet.getRange(i+2,6).setValue(newSalt);
      return {success:true};
    }
  }
  throw new Error("Customer ID not found.");
}

/* =====================================================
   LOGIN
===================================================== */

function loginUser(
  identifier,
  password
) {

  identifier =
    String(identifier || "")
      .trim()
      .toLowerCase();

  password =
    String(password || "");


  if (
    !identifier ||
    !password
  ) {

    throw new Error(
      "Please enter username/email and password."
    );

  }


  const sheet =
    getUsersSheet_();

  const last =
    sheet.getLastRow();


  if (last < 2) {

    throw new Error(
      "No registered accounts found."
    );

  }


  const users =
    sheet
      .getRange(
        2,
        1,
        last - 1,
        Math.max(18, sheet.getLastColumn())
      )
      .getValues();


  for (
    let i = 0;
    i < users.length;
    i++
  ) {

    const user =
      users[i];

    const username =
      String(user[1] || "")
        .trim()
        .toLowerCase();

    const email =
      String(user[2] || "")
        .trim()
        .toLowerCase();

    const passwordHash =
      String(user[4] || "");

    const salt =
      String(user[5] || "");

    const status =
      String(user[14] || "")
        .toUpperCase();


    if (
      username === identifier ||
      email === identifier
    ) {

      if (status !== "ACTIVE") {

        throw new Error(
          "Account is not active."
        );

      }


      const enteredHash =
        hashPassword_(
          password,
          salt
        );


      if (
        enteredHash !==
        passwordHash
      ) {

        throw new Error(
          "Incorrect username/email or password."
        );

      }


      return {

        success: true,

        userId: user[0],
        username: user[1],
        email: user[2],
        mobile: user[3],
        fullName: user[15] || "",
        houseUnit: user[6] || "",
        street: user[7] || "",
        barangay: user[8] || "",
        city: user[9] || "",
        province: user[10] || "",
        postalCode: user[11] || "",
        country: user[12] || "Philippines",
        region: user[16] || "",
        additionalInstruction: user[17] || ""
      };

    }

  }


  throw new Error(
    "Incorrect username/email or password."
  );

}



/* =====================================================
   PROFILE
   Full customer profile is stored in Users.
===================================================== */

function getUserProfile(userId) {
  userId = String(userId || "").trim();
  if (!userId) throw new Error("Please log in again.");

  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("User account not found.");

  // Find the exact Customer ID in Users!A.
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let matchedRow = -1;

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === userId) {
      matchedRow = i + 2;
      break;
    }
  }

  if (matchedRow === -1) {
    throw new Error("Customer ID not found in Users sheet.");
  }

  // Read the SAME matched row.
  // A ID | B Username | C Email | D Mobile | ... | P Full Name | Q Region | R Additional Instruction
  const u = sheet.getRange(matchedRow, 1, 1, 18).getDisplayValues()[0];

  return {
    success: true,
    userId: String(u[0] || "").trim(),
    username: String(u[1] || "").trim(),
    email: String(u[2] || "").trim(),
    mobile: String(u[3] || "").trim(),
    houseUnit: String(u[6] || "").trim(),
    street: String(u[7] || "").trim(),
    barangay: String(u[8] || "").trim(),
    city: String(u[9] || "").trim(),
    province: String(u[10] || "").trim(),
    postalCode: String(u[11] || "").trim(),
    country: String(u[12] || "").trim() || "Philippines",
    fullName: String(u[15] || "").trim(),
    region: String(u[16] || "").trim(),
    additionalInstruction: String(u[17] || "").trim()
  };
}

/* =====================================================
   CHECKOUT CUSTOMER LOOKUP
   Direct Users-sheet lookup by exact Customer ID.
   A = Customer ID
   C = Email
   D = Mobile / Phone
   P = Full Name
===================================================== */
function getCheckoutCustomerById(userId) {
  userId = String(userId || "").trim();
  if (!userId) throw new Error("Please log in again.");

  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("User account not found.");

  // Match the exact Customer ID in Column A first.
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let matchedRow = -1;

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === userId) {
      matchedRow = i + 2;
      break;
    }
  }

  if (matchedRow === -1) {
    throw new Error("Customer ID not found in Users sheet.");
  }

  const u = sheet.getRange(matchedRow, 1, 1, 18).getDisplayValues()[0];

  return {
    success: true,
    userId: String(u[0] || "").trim(),
    username: String(u[1] || "").trim(),
    email: String(u[2] || "").trim(),
    mobile: String(u[3] || "").trim(),
    houseUnit: String(u[6] || "").trim(),
    street: String(u[7] || "").trim(),
    barangay: String(u[8] || "").trim(),
    city: String(u[9] || "").trim(),
    province: String(u[10] || "").trim(),
    postalCode: String(u[11] || "").trim(),
    country: String(u[12] || "").trim() || "Philippines",
    fullName: String(u[15] || "").trim(),
    region: String(u[16] || "").trim(),
    additionalInstruction: String(u[17] || "").trim()
  };
}

function updateUserProfile(data) {
  if (!data) throw new Error("Invalid profile information.");

  const userId = String(data.userId || "").trim();
  const fullName = String(data.fullName || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const mobile = String(data.mobile || "").trim();
  const houseUnit = String(data.houseUnit || "").trim();
  const street = String(data.street || "").trim();
  const barangay = String(data.barangay || "").trim();
  const city = String(data.city || "").trim();
  const province = String(data.province || "").trim();
  const postalCode = String(data.postalCode || "").trim();
  const region = String(data.region || "").trim();
  const additionalInstruction = String(data.additionalInstruction || "").trim();

  if (!userId) throw new Error("Please log in again.");
  if (!fullName) throw new Error("Full name is required.");
  if (!email) throw new Error("Email address is required.");
  if (!mobile) throw new Error("Phone number is required.");

  const sheet = getUsersSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const last = sheet.getLastRow();
    if (last < 2) throw new Error("User account not found.");

    const rows = sheet.getRange(2, 1, last - 1, 18).getValues();
    let rowNumber = -1;

    for (let i = 0; i < rows.length; i++) {
      const u = rows[i];
      if (String(u[0] || "").trim() === userId) {
        rowNumber = i + 2;
        continue;
      }

      if (String(u[2] || "").trim().toLowerCase() === email) {
        throw new Error("Email address is already used by another account.");
      }

      if (String(u[3] || "").trim() === mobile) {
        throw new Error("Phone number is already used by another account.");
      }
    }

    if (rowNumber < 0) throw new Error("User account not found.");

    sheet.getRange(rowNumber, 3).setValue(email);
    sheet.getRange(rowNumber, 4).setValue(mobile);
    sheet.getRange(rowNumber, 7).setValue(houseUnit);
    sheet.getRange(rowNumber, 8).setValue(street);
    sheet.getRange(rowNumber, 9).setValue(barangay);
    sheet.getRange(rowNumber, 10).setValue(city);
    sheet.getRange(rowNumber, 11).setValue(province);
    sheet.getRange(rowNumber, 12).setValue(postalCode);
    sheet.getRange(rowNumber, 13).setValue("Philippines");
    sheet.getRange(rowNumber, 16).setValue(fullName);
    sheet.getRange(rowNumber, 17).setValue(region);
    sheet.getRange(rowNumber, 18).setValue(additionalInstruction);

    if (region || province || city || barangay || houseUnit || street) {
      upsertCustomerDefaultAddress_(userId, {
        label: "Home", houseUnit: houseUnit, street: street, barangay: barangay,
        city: city, province: province, region: region, postalCode: postalCode,
        country: "Philippines", additionalInstruction: additionalInstruction
      });
    }

    return getUserProfile(userId);
  } finally {
    lock.releaseLock();
  }
}


/* =====================================================
   CUSTOMER SAVED ADDRESSES
   Each address is isolated by exact Customer ID.
===================================================== */

function getCustomerAddressesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("CustomerAddresses");
  if (!sheet) {
    sheet = ss.insertSheet("CustomerAddresses");
    sheet.appendRow(["Address ID","Customer ID","Label","House/Unit","Street","Barangay","City","Province","Region","Postal Code","Country","Additional Instruction","Is Default","Created At","Updated At"]);
  }
  return sheet;
}

function syncUsersAddressFromAddress_(userId, address) {
  const sheet=getUsersSheet_(); const lastRow=sheet.getLastRow(); if(lastRow<2)return;
  const rows=sheet.getRange(2,1,lastRow-1,18).getValues();
  for(let i=0;i<rows.length;i++){
    if(String(rows[i][0]||"").trim()!==userId)continue;
    const row=i+2;
    sheet.getRange(row,7,1,7).setValues([[address.houseUnit||"",address.street||"",address.barangay||"",address.city||"",address.province||"",address.postalCode||"",address.country||"Philippines"]]);
    sheet.getRange(row,17).setValue(address.region||""); sheet.getRange(row,18).setValue(address.additionalInstruction||""); return;
  }
}

function getCustomerAddresses(userId) {
  userId=String(userId||"").trim(); if(!userId)throw new Error("Please log in again.");
  const sheet=getCustomerAddressesSheet_(); const lastRow=sheet.getLastRow(); let rows=[];
  if(lastRow>=2)rows=sheet.getRange(2,1,lastRow-1,15).getDisplayValues().filter(function(row){return String(row[1]||"").trim()===userId;});
  if(!rows.length){
    const profile=getUserProfile(userId);
    if(profile&&(profile.region||profile.province||profile.city||profile.barangay||profile.houseUnit||profile.street)){
      const now=new Date(); sheet.appendRow([Utilities.getUuid(),userId,"Home",profile.houseUnit||"",profile.street||"",profile.barangay||"",profile.city||"",profile.province||"",profile.region||"",profile.postalCode||"",profile.country||"Philippines",profile.additionalInstruction||"",true,now,now]);
      rows=sheet.getRange(sheet.getLastRow(),1,1,15).getDisplayValues();
    }
  }
  return rows.map(function(row){return {addressId:String(row[0]||"").trim(),userId:String(row[1]||"").trim(),label:String(row[2]||"").trim()||"Saved Address",houseUnit:String(row[3]||"").trim(),street:String(row[4]||"").trim(),barangay:String(row[5]||"").trim(),city:String(row[6]||"").trim(),province:String(row[7]||"").trim(),region:String(row[8]||"").trim(),postalCode:String(row[9]||"").trim(),country:String(row[10]||"").trim()||"Philippines",additionalInstruction:String(row[11]||"").trim(),isDefault:String(row[12]||"").toLowerCase()==="true",createdAt:row[13]||"",updatedAt:row[14]||""};}).sort(function(a,b){return (b.isDefault?1:0)-(a.isDefault?1:0);});
}

function upsertCustomerDefaultAddress_(userId,data) {
  const sheet=getCustomerAddressesSheet_(); const lastRow=sheet.getLastRow(); const now=new Date();
  if(lastRow>=2){const rows=sheet.getRange(2,1,lastRow-1,15).getValues();for(let i=0;i<rows.length;i++){if(String(rows[i][1]||"").trim()===userId&&rows[i][12]===true){const row=i+2;sheet.getRange(row,3,1,12).setValues([[data.label||"Home",data.houseUnit||"",data.street||"",data.barangay||"",data.city||"",data.province||"",data.region||"",data.postalCode||"",data.country||"Philippines",data.additionalInstruction||"",true,rows[i][13]||now]]);sheet.getRange(row,15).setValue(now);return;}}}
  sheet.appendRow([Utilities.getUuid(),userId,data.label||"Home",data.houseUnit||"",data.street||"",data.barangay||"",data.city||"",data.province||"",data.region||"",data.postalCode||"",data.country||"Philippines",data.additionalInstruction||"",true,now,now]);
}

function saveCustomerAddress(data) {
  if(!data)throw new Error("Invalid address information.");
  const userId=String(data.userId||"").trim(), label=String(data.label||"").trim()||"Saved Address", region=String(data.region||"").trim(), province=String(data.province||"").trim(), city=String(data.city||"").trim(), barangay=String(data.barangay||"").trim(), houseUnit=String(data.houseUnit||"").trim(), street=String(data.street||"").trim(), postalCode=String(data.postalCode||"").trim(), country=String(data.country||"Philippines").trim()||"Philippines", additionalInstruction=String(data.additionalInstruction||"").trim(), isDefault=data.isDefault!==false;
  if(!userId)throw new Error("Please log in again."); if(!region)throw new Error("Please select your region."); if(!province)throw new Error("Please select your province."); if(!city)throw new Error("Please select your city/municipality."); if(!barangay)throw new Error("Please select your barangay."); if(!houseUnit)throw new Error("Please enter your lot/house/unit number."); if(!street)throw new Error("Please enter your street.");
  const sheet=getCustomerAddressesSheet_(); const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const lastRow=sheet.getLastRow();
    if(lastRow>=2&&isDefault){const rows=sheet.getRange(2,1,lastRow-1,15).getValues();rows.forEach(function(row,i){if(String(row[1]||"").trim()===userId&&row[12]===true){sheet.getRange(i+2,13).setValue(false);sheet.getRange(i+2,15).setValue(new Date());}});}
    const now=new Date(); const address={label:label,houseUnit:houseUnit,street:street,barangay:barangay,city:city,province:province,region:region,postalCode:postalCode,country:country,additionalInstruction:additionalInstruction};
    sheet.appendRow([Utilities.getUuid(),userId,label,houseUnit,street,barangay,city,province,region,postalCode,country,additionalInstruction,isDefault,now,now]);
    if(isDefault)syncUsersAddressFromAddress_(userId,address);
    return getCustomerAddresses(userId);
  }finally{lock.releaseLock();}
}

function setDefaultCustomerAddress(userId,addressId) {
  userId=String(userId||"").trim(); addressId=String(addressId||"").trim(); if(!userId)throw new Error("Please log in again."); if(!addressId)throw new Error("Address not found.");
  const sheet=getCustomerAddressesSheet_(); const lastRow=sheet.getLastRow(); if(lastRow<2)throw new Error("Address not found.");
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const rows=sheet.getRange(2,1,lastRow-1,15).getValues(); let selected=null;
    rows.forEach(function(row,i){if(String(row[1]||"").trim()===userId){const isSelected=String(row[0]||"").trim()===addressId;sheet.getRange(i+2,13).setValue(isSelected);sheet.getRange(i+2,15).setValue(new Date());if(isSelected)selected=row;}});
    if(!selected)throw new Error("Address not found for this customer.");
    syncUsersAddressFromAddress_(userId,{houseUnit:selected[3],street:selected[4],barangay:selected[5],city:selected[6],province:selected[7],region:selected[8],postalCode:selected[9],country:selected[10],additionalInstruction:selected[11]});
    return getCustomerAddresses(userId);
  }finally{lock.releaseLock();}
}

/* =====================================================
   PHILIPPINE ADDRESS DATA
   Uses PSGC Cloud public reference data.
===================================================== */

function fetchPsgcJson_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { "Accept": "application/json" }
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error("Unable to load Philippine location data.");
  }

  return JSON.parse(response.getContentText());
}

function getAddressRegions() {
  return fetchPsgcJson_("https://psgc.cloud/api/regions");
}

function getAddressProvinces(regionCode) {
  regionCode = String(regionCode || "").trim();
  if (!regionCode) return [];
  return fetchPsgcJson_("https://psgc.cloud/api/regions/" + encodeURIComponent(regionCode) + "/provinces");
}

function getAddressCities(provinceCode) {
  provinceCode = String(provinceCode || "").trim();
  if (!provinceCode) return [];
  return fetchPsgcJson_("https://psgc.cloud/api/provinces/" + encodeURIComponent(provinceCode) + "/cities-municipalities");
}

function getAddressBarangays(cityCode) {
  cityCode = String(cityCode || "").trim();
  if (!cityCode) return [];
  return fetchPsgcJson_("https://psgc.cloud/api/cities-municipalities/" + encodeURIComponent(cityCode) + "/barangays");
}

/* =====================================================
   PRODUCTS
===================================================== */

function getProducts() {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      "Products"
    );


  if (!sheet) {

    throw new Error(
      "Products sheet not found."
    );

  }


  const last =
    sheet.getLastRow();


  if (last < 2) {
    return [];
  }


  const values =
    sheet
      .getRange(
        2,
        1,
        last - 1,
        8
      )
      .getValues();


  return values

    .map(function(row, index) {

      const badge =
        String(
          row[7] || ""
        )
          .trim()
          .toUpperCase();


      return {

        id:
          row[0],

        name:
          row[1],

        category:
          row[2],

        price:
          row[3],

        image:
          getProductImageUrl_(
            sheet,
            index + 2
          ),

        description:
          row[5],

        available:
          row[6] === true ||
          String(row[6])
            .trim()
            .toUpperCase() ===
          "TRUE",

        bestSeller:
          badge === "TRUE" ||
          badge === "BEST SELLER",

        newProduct:
          badge === "NEW"

      };

    })

    .filter(function(product) {

      return product.name;

    });

}


/* =====================================================
   BRAND ASSETS

   I1  = LOGO
   I2  = BACKGROUND
   I8  = SAKURA
   I10 = RAMEN LOADING IMAGE
===================================================== */

function getBrandAssets() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        "Products"
      );


  if (!sheet) {

    throw new Error(
      "Products sheet not found."
    );

  }


  return {

    logo:
      getCellImageUrl(
        sheet.getRange("I1")
      ),

    background:
      getCellImageUrl(
        sheet.getRange("I2")
      ),

    sakura:
      getCellImageUrl(
        sheet.getRange("I8")
      ),

    loading:
      getCellImageUrl(
        sheet.getRange("I10")
      )

  };

}


/* =====================================================
   IMAGE READER
   Supports:
   1. =IMAGE("URL")
   2. Image in cell (CellImage)
   3. Direct URL text
   4. Image over cells
===================================================== */

function getCellImageUrl(cell) {

  try {

    /* =============================================
       1. IMAGE() FORMULA
    ============================================= */

    const formula =
      cell.getFormula();

    if (formula) {

      const match =
        formula.match(
          /IMAGE\s*\(\s*"([^"]+)"/i
        );

      if (
        match &&
        match[1]
      ) {

        return match[1];

      }

    }


    /* =============================================
       2. IMAGE IN CELL
    ============================================= */

    const value =
      cell.getValue();

    if (
      value &&
      typeof value.getContentUrl ===
      "function"
    ) {

      try {

        const contentUrl =
          value.getContentUrl();

        if (contentUrl) {

          /*
             IMPORTANT:
             Google Sheets CellImage URLs can require
             Google authorization and may not display
             directly in the browser.

             Convert I10 (and other in-cell images) to
             a data URL so the loading image can display
             reliably.
          */
          try {

            const response =
              UrlFetchApp.fetch(
                contentUrl,
                {
                  muteHttpExceptions: true,
                  headers: {
                    Authorization:
                      "Bearer " +
                      ScriptApp.getOAuthToken()
                  }
                }
              );

            if (
              response.getResponseCode() >= 200 &&
              response.getResponseCode() < 300
            ) {

              return blobToDataUrl_(
                response.getBlob()
              );

            }

          } catch (fetchError) {

            console.log(
              "CellImage fetch error:",
              fetchError
            );

          }

          /*
             If fetching fails, still return the
             original URL as a secondary fallback.
          */
          return contentUrl;

        }

      } catch (e) {

        console.log(
          "CellImage URL error:",
          e
        );

      }

    }


    /* =============================================
       3. DIRECT URL
    ============================================= */

    const displayValue =
      String(
        cell.getDisplayValue() || ""
      )
        .trim();

    if (
      /^https?:\/\//i.test(
        displayValue
      )
    ) {

      return displayValue;

    }


    /* =============================================
       4. IMAGE OVER CELLS
    ============================================= */

    const sheet =
      cell.getSheet();

    const images =
      sheet.getImages();

    for (
      let i = 0;
      i < images.length;
      i++
    ) {

      const image =
        images[i];

      const anchor =
        image.getAnchorCell();

      if (
        anchor.getA1Notation() ===
        cell.getA1Notation()
      ) {

        try {

          return blobToDataUrl_(
            image.getBlob()
          );

        } catch (e) {

          console.log(
            "Over-cell image error:",
            e
          );

        }

      }

    }

  } catch (error) {

    console.log(
      "getCellImageUrl error:",
      error
    );

  }

  return "";
}


/* =====================================================
   PRODUCT IMAGE
===================================================== */

function getProductImageUrl_(
  sheet,
  rowNumber
) {

  return getCellImageUrl(
    sheet.getRange(
      rowNumber,
      5
    )
  );

}


/* =====================================================
   BLOB → DATA URL
===================================================== */

function blobToDataUrl_(blob) {

  try {

    const contentType =
      blob.getContentType();

    const bytes =
      blob.getBytes();

    const base64 =
      Utilities.base64Encode(
        bytes
      );

    return (
      "data:" +
      contentType +
      ";base64," +
      base64
    );

  } catch (error) {

    console.log(
      "Blob conversion error:",
      error
    );

    return "";

  }

}


/* =====================================================
   PHILIPPINE LOCATIONS
===================================================== */

function getPhilippineLocations() {

  return [

    {
      code: "ABR",
      name: "Abra",
      cities: []
    },

    {
      code: "AGN",
      name: "Agusan del Norte",
      cities: []
    },

    {
      code: "AGS",
      name: "Agusan del Sur",
      cities: []
    },

    {
      code: "AKL",
      name: "Aklan",
      cities: []
    },

    {
      code: "ALB",
      name: "Albay",
      cities: []
    }

  ];

}


/* =====================================================
   RAMEN LOADING IMAGE — Products!I10
   Required by the homepage full-screen loader.
===================================================== */
function getRamenLoadingImage() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Products");

  if (!sheet) {
    throw new Error("Products sheet not found.");
  }

  // Ramen sipping/loading image is stored in Products!I9.
  const imageUrl = getCellImageUrl(sheet.getRange("I9"));

  if (!imageUrl) {
    throw new Error("No loading image found in Products!I9.");
  }

  return imageUrl;
}


function testEmailAuthorization() {
  const email = Session.getEffectiveUser().getEmail();

  MailApp.sendEmail({
    to: email,
    subject: "Mckenzie Ramen House - Email Test",
    body: "Email authorization is working correctly."
  });

  return "Email sent successfully to: " + email;
}


/* =====================================================
   ADMIN — PRODUCT MANAGEMENT
   ===================================================== */

function setupAdminCredentials(email, password) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "");

  if (!email) throw new Error("Admin email is required.");
  if (!password || password.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const salt = Utilities.getUuid();
  const hash = hashPassword_(password, salt);
  const props = PropertiesService.getScriptProperties();

  props.setProperty("MCK_ADMIN_EMAIL", email);
  props.setProperty("MCK_ADMIN_PASSWORD_HASH", hash);
  props.setProperty("MCK_ADMIN_PASSWORD_SALT", salt);

  return { success: true, email: email };
}

/**
 * One-time setup for the McKenzie Ramen House admin account.
 * Run this function once from the Apps Script function dropdown.
 */
function setupAdminOnce() {
  setupAdminCredentials(
    "admin@mckenzieramenhouse.com",
    "McKenzieAdmin123!"
  );
}

function adminLogin(email, password) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "");

  const props = PropertiesService.getScriptProperties();
  const adminEmail = String(props.getProperty("MCK_ADMIN_EMAIL") || "").trim().toLowerCase();
  const storedHash = String(props.getProperty("MCK_ADMIN_PASSWORD_HASH") || "");
  const salt = String(props.getProperty("MCK_ADMIN_PASSWORD_SALT") || "");

  if (!adminEmail || !storedHash || !salt) {
    throw new Error("Admin credentials are not configured yet. Run setupAdminCredentials once in Apps Script.");
  }

  if (email !== adminEmail || hashPassword_(password, salt) !== storedHash) {
    throw new Error("Invalid admin email or password.");
  }

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    "MCK_ADMIN_SESSION_" + token,
    adminEmail,
    21600
  );

  return { success: true, token: token, email: adminEmail };
}

function requireAdmin_(token) {
  token = String(token || "").trim();
  if (!token) throw new Error("Admin session is required.");

  const email = CacheService.getScriptCache().get("MCK_ADMIN_SESSION_" + token);
  if (!email) throw new Error("Admin session expired. Please log in again.");

  return email;
}

function adminGetProducts(token) {
  requireAdmin_(token);
  return { success: true, products: getProducts() };
}

function adminSaveProduct(data) {
  if (!data) throw new Error("Product information is required.");

  const token = String(data.token || "").trim();
  requireAdmin_(token);

  const name = String(data.name || "").trim();
  const category = String(data.category || "").trim();
  const description = String(data.description || "").trim();
  const price = Number(data.price);
  const available = data.available === true || String(data.available).toLowerCase() === "true";
  const bestSeller = data.bestSeller === true || String(data.bestSeller).toLowerCase() === "true";
  const newProduct = data.newProduct === true || String(data.newProduct).toLowerCase() === "true";
  const productId = String(data.id || "").trim();

  if (!name) throw new Error("Product name is required.");
  if (!category) throw new Error("Product category is required.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Please enter a valid product price.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Products");
  if (!sheet) {
    sheet = ss.insertSheet("Products");
    sheet.getRange(1, 1, 1, 8).setValues([[
      "ID", "Name", "Category", "Price", "Image", "Description", "Available", "Badge"
    ]]);
  }

  const lastRow = sheet.getLastRow();
  let rowNumber = -1;
  let existingImage = "";

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || "").trim() === productId && productId) {
        rowNumber = i + 2;
        existingImage = String(sheet.getRange(rowNumber, 5).getDisplayValue() || "").trim();
        break;
      }
    }
  }

  const image = data.image || null;
  let imageUrl = existingImage;

  if (image && image.base64) {
    const bytes = Utilities.base64Decode(String(image.base64));
    const contentType = String(image.type || "image/jpeg");
    const fileName = String(image.name || (name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".jpg"));
    const blob = Utilities.newBlob(bytes, contentType, fileName);

    const folderId = String(
      PropertiesService.getScriptProperties().getProperty("MCK_PRODUCT_IMAGE_FOLDER_ID") || ""
    ).trim();

    const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      console.log("Drive sharing could not be changed:", sharingError);
    }

    imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
  }

  const badge = bestSeller ? "BEST SELLER" : (newProduct ? "NEW" : "");
  const id = productId || Utilities.getUuid();
  const values = [id, name, category, price, imageUrl, description, available, badge];

  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, 8).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  return { success: true, productId: id, products: getProducts() };
}

function adminDeleteProduct(token, productId) {
  requireAdmin_(token);

  productId = String(productId || "").trim();
  if (!productId) throw new Error("Product ID is required.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Products");
  if (!sheet) throw new Error("Products sheet not found.");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Product not found.");

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === productId) {
      sheet.deleteRow(i + 2);
      return { success: true, products: getProducts() };
    }
  }

  throw new Error("Product not found.");
}


/* =========================================================
   EASY ADMIN SETUP
   Change ONLY the email and password below, then run createAdmin()
   ========================================================= */
function createAdmin() {
  var adminEmail = "admin@mckenzieramenhouse.com";
  var adminPassword = "McKenzieAdmin123!";
  setupAdminCredentials(adminEmail, adminPassword);

  // IMPORTANT: permanently remember the exact spreadsheet used by this
  // Apps Script project. Admin and customer orders will use this same file.
  initializeOrdersDatabase_();

  Logger.log("Admin account created/updated for: " + adminEmail);
}

function setupMcKenzieOrdersDatabase() {
  const result = initializeOrdersDatabase_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/* =========================================================
   CENTRAL ORDERS DATABASE

   Admin and customer order traffic MUST use the same spreadsheet.
   We store the Spreadsheet ID in Script Properties so web-app requests
   never depend on whichever spreadsheet happens to be considered active.
   ========================================================= */
function getOrdersSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = String(props.getProperty("MCKENZIE_ORDERS_SPREADSHEET_ID") || "").trim();

  // Preferred path: use the permanently saved spreadsheet ID.
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (error) {
      // If the saved ID is no longer accessible, fall through and recover
      // from the bound spreadsheet below.
    }
  }

  // First-time setup / recovery for a spreadsheet-bound Apps Script.
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty("MCKENZIE_ORDERS_SPREADSHEET_ID", active.getId());
    return active;
  }

  throw new Error(
    "McKenzie Orders database is not configured. Open the Apps Script project that is bound to the restaurant Google Sheet and run createAdmin() once."
  );
}

function initializeOrdersDatabase_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("This Apps Script must be bound to the McKenzie Ramen House Google Sheet.");
  }

  PropertiesService.getScriptProperties()
    .setProperty("MCKENZIE_ORDERS_SPREADSHEET_ID", ss.getId());

  const sheet = getCustomerOrdersSheet_();
  return {
    success: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    ordersSheet: sheet.getName(),
    ordersLastRow: sheet.getLastRow()
  };
}


/* =========================================================
   MCKENZIE RAMEN HOUSE — SINGLE SOURCE OF TRUTH FOR ORDERS
   CustomerOrders = order header
   CustomerOrderItems = each menu item + item-level status
   Orders = legacy/compatibility only; not used by Admin/customer history.
   ========================================================= */

function getCustomerOrdersSheet_() {
  const ss = getOrdersSpreadsheet_();
  let sheet = ss.getSheetByName("CustomerOrders");
  if (!sheet) sheet = ss.insertSheet("CustomerOrders");
  const headers = [
    "Order ID", "Customer ID", "Ordered At", "Total", "Payment Method",
    "Payment Status", "Order Status", "Delivered At", "Customer Confirmed",
    "Confirmed At", "Customer Name", "Phone", "Address", "Additional Instruction"
  ];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function getCustomerOrderItemsSheet_() {
  const ss = getOrdersSpreadsheet_();
  let sheet = ss.getSheetByName("CustomerOrderItems");
  if (!sheet) sheet = ss.insertSheet("CustomerOrderItems");
  const headers = [
    "Order ID", "Customer ID", "Product ID", "Product Name", "Price", "Quantity", "Subtotal", "Item Status"
  ];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function normalizeItemStatus_(status) {
  const s = String(status || "Preparing").trim().toLowerCase();
  if (s === "ready") return "Ready";
  return "Preparing";
}

function getItemRowsByOrder_() {
  const sheet = getCustomerOrderItemsSheet_();
  const map = {};
  if (sheet.getLastRow() < 2) return map;
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  rows.forEach(function(row, idx) {
    const orderId = String(row[0] || "").trim();
    if (!orderId) return;
    if (!map[orderId]) map[orderId] = [];
    map[orderId].push({
      sheetRow: idx + 2,
      itemIndex: map[orderId].length,
      productId: String(row[2] || ""),
      productName: String(row[3] || "Ramen item"),
      price: Number(row[4] || 0),
      quantity: Number(row[5] || 0),
      subtotal: Number(row[6] || (Number(row[4] || 0) * Number(row[5] || 0))),
      itemStatus: normalizeItemStatus_(row[7])
    });
  });
  return map;
}

function deriveOrderStatusFromItems_(items, existingStatus) {
  // IMPORTANT: item dropdown changes NEVER change the order status.
  // The Admin must explicitly click: Preparing -> Ready -> On the Way -> Delivered.
  // This prevents Ready items from being changed back to Preparing/Ready by refreshes.
  const current = String(existingStatus || "Preparing").trim();
  if (current === "Pending" || !current) return "Preparing";
  return current;
}

function buildCanonicalOrders_() {
  const sheet = getCustomerOrdersSheet_();
  const itemsByOrder = getItemRowsByOrder_();
  if (sheet.getLastRow() < 2) return [];

  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,14).getValues();
  return rows.map(function(row) {
    const orderId = String(row[0] || "").trim();
    if (!orderId) return null;
    const items = itemsByOrder[orderId] || [];
    const normalizedItems = items.map(function(item){
      return {
        itemIndex: item.itemIndex,
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        itemStatus: item.itemStatus
      };
    });
    const storedStatus = String(row[6] || "Pending").trim();
    const derived = deriveOrderStatusFromItems_(normalizedItems, storedStatus);
    return {
      orderId: orderId,
      userId: String(row[1] || ""),
      customerName: String(row[10] || ""),
      fullName: String(row[10] || ""),
      email: "",
      mobile: String(row[11] || ""),
      items: normalizedItems,
      total: Number(row[3] || 0),
      paymentMethod: String(row[4] || ""),
      paymentStatus: String(row[5] || "Pending"),
      orderStatus: derived,
      address: String(row[12] || ""),
      instruction: String(row[13] || ""),
      orderedAt: row[2] ? new Date(row[2]).toISOString() : "",
      customerConfirmed: row[8] === true || String(row[8]).toLowerCase() === "true",
      confirmedAt: row[9] ? new Date(row[9]).toISOString() : "",
      deliveredAt: row[7] ? new Date(row[7]).toISOString() : "",
      closed: row[8] === true || String(row[8]).toLowerCase() === "true",
      canRate: derived === "Delivered" && (row[8] === true || String(row[8]).toLowerCase() === "true")
    };
  }).filter(Boolean).sort(function(a,b){
    return String(b.orderedAt || "").localeCompare(String(a.orderedAt || ""));
  });
}

function getAllOrders_() {
  return buildCanonicalOrders_();
}

function recordCompletedCustomerOrder(orderId, payload) {
  payload = payload || {};
  orderId = String(orderId || "").trim();
  if (!orderId) throw new Error("Order ID is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const orders = getCustomerOrdersSheet_();
    const items = getCustomerOrderItemsSheet_();
    const last = orders.getLastRow();
    if (last >= 2) {
      const ids = orders.getRange(2,1,last-1,1).getDisplayValues();
      for (let i=0;i<ids.length;i++) if (String(ids[i][0]).trim() === orderId) {
        return {success:true, orderId:orderId, duplicate:true};
      }
    }

    const cleanItems = Array.isArray(payload.items) ? payload.items.map(function(item){
      const price = Number(item.price || 0);
      const quantity = Number(item.quantity || 0);
      return {
        id: String(item.id || item.productId || ""),
        name: String(item.name || item.productName || "Ramen item"),
        price: price,
        quantity: quantity,
        subtotal: Number(item.subtotal != null ? item.subtotal : price * quantity)
      };
    }).filter(function(item){ return item.quantity > 0; }) : [];
    if (!cleanItems.length) throw new Error("The order contains no items.");

    const total = cleanItems.reduce(function(sum,item){ return sum + item.subtotal; },0);
    const address = [payload.houseUnit,payload.street,payload.barangay,payload.city,payload.province,payload.region]
      .map(function(v){return String(v || "").trim();}).filter(Boolean).join(", ");
    const now = new Date();

    orders.appendRow([
      orderId,
      String(payload.userId || ""),
      now,
      total,
      String(payload.paymentMethod || ""),
      "Pending",
      "Preparing",
      "",
      false,
      "",
      String(payload.fullName || ""),
      String(payload.mobile || ""),
      address,
      String(payload.additionalInstruction || "")
    ]);

    cleanItems.forEach(function(item){
      items.appendRow([
        orderId,
        String(payload.userId || ""),
        item.id,
        item.name,
        item.price,
        item.quantity,
        item.subtotal,
        "Preparing"
      ]);
    });
    SpreadsheetApp.flush();
    return {success:true, orderId:orderId, status:"Preparing"};
  } finally {
    lock.releaseLock();
  }
}

function getCustomerOrderHistory(userId) {
  userId = String(userId || "").trim();
  if (!userId) return [];
  return buildCanonicalOrders_().filter(function(order){ return order.userId === userId; });
}

function getCustomerPaymentHistory(userId) {
  return getCustomerOrderHistory(userId).map(function(order){
    return {orderId:order.orderId,total:order.total,paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus,orderStatus:order.orderStatus,orderedAt:order.orderedAt};
  });
}

function getOrderReviewProgress_(orderId) {
  orderId = String(orderId || '').trim();
  const order = buildCanonicalOrders_().find(function(o){ return String(o.orderId) === orderId; });
  if (!order) return { reviewRequested:false, reviewCompleted:false, reviewedCount:0, reviewTotal:0 };
  const reviews = getReviewRows_().filter(function(r){ return String(r.orderId) === orderId; });
  const reviewedProducts = {};
  reviews.forEach(function(r){ reviewedProducts[String(r.productId || '')] = true; });
  const items = Array.isArray(order.items) ? order.items : [];
  const total = items.length;
  const reviewedCount = items.filter(function(i){ return !!reviewedProducts[String(i.productId || '')]; }).length;
  const notifications = getCustomerNotificationsForOrder_(orderId, String(order.userId || ''));
  const reviewRequested = notifications.some(function(n){ return n.type === 'REVIEW_REQUEST'; });
  return {
    reviewRequested: reviewRequested,
    reviewCompleted: total > 0 && reviewedCount >= total,
    reviewedCount: reviewedCount,
    reviewTotal: total
  };
}

function adminGetOrders(token) {
  requireAdmin_(token);
  const orders = buildCanonicalOrders_();
  orders.forEach(function(order){
    const progress = getOrderReviewProgress_(order.orderId);
    order.reviewRequested = progress.reviewRequested;
    order.reviewCompleted = progress.reviewCompleted;
    order.reviewedCount = progress.reviewedCount;
    order.reviewTotal = progress.reviewTotal;
  });
  return {success:true, orders:orders};
}

function adminUpdateOrderItemStatus(token, orderId, itemIndex, newStatus) {
  requireAdmin_(token);
  orderId = String(orderId || "").trim();
  itemIndex = Number(itemIndex);
  newStatus = normalizeItemStatus_(newStatus);
  if (!orderId || !isFinite(itemIndex)) throw new Error("Order item information is required.");

  const lockSheet = getCustomerOrdersSheet_();
  const lockRows = lockSheet.getLastRow() >= 2 ? lockSheet.getRange(2,1,lockSheet.getLastRow()-1,14).getValues() : [];
  const lockOrder = lockRows.find(function(r){ return String(r[0] || '').trim() === orderId; });
  if (!lockOrder) throw new Error("Order not found.");
  if (String(lockOrder[6] || '').trim() === 'Delivered') throw new Error("Delivered orders are locked and can no longer be changed.");
  if (String(lockOrder[8] || '').toLowerCase() === 'true' || lockOrder[8] === true) throw new Error("This order is closed and can no longer be changed.");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
  const sheet = getCustomerOrderItemsSheet_();
  const rows = sheet.getLastRow() >= 2 ? sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues() : [];
  let found = 0;
  let targetRow = -1;
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i][0] || "").trim() === orderId) {
      if (found === itemIndex) { targetRow = i + 2; break; }
      found++;
    }
  }
  if (targetRow < 0) throw new Error("Order item not found.");
  const existingItemStatus = String(rows[targetRow - 2][7] || "Preparing").trim();
  // A Ready item is locked. Never allow it to revert to Preparing.
  if (existingItemStatus === "Ready" && newStatus === "Preparing") {
    SpreadsheetApp.flush();
    return {success:true, order:buildCanonicalOrders_().find(function(o){return o.orderId === orderId;})};
  }
  sheet.getRange(targetRow,8).setValue(newStatus);

  const orderSheet = getCustomerOrdersSheet_();
  const orderRows = orderSheet.getLastRow() >= 2 ? orderSheet.getRange(2,1,orderSheet.getLastRow()-1,14).getValues() : [];
  for (let i=0;i<orderRows.length;i++) {
    if (String(orderRows[i][0] || "").trim() === orderId) {
      const rowNumber = i + 2;
      // Item readiness must NOT automatically change the order status.
      // The order stays Preparing until the Admin explicitly clicks Ready.
      // This prevents the workflow from jumping back/forth while items are being updated.
      const currentOrderStatus = String(orderRows[i][6] || "Preparing").trim();
      if (currentOrderStatus === "Pending" || !currentOrderStatus) {
        orderSheet.getRange(rowNumber,7).setValue("Preparing");
      }
      SpreadsheetApp.flush();
      return {success:true, order:buildCanonicalOrders_().find(function(o){return o.orderId === orderId;})};
    }
  }
  throw new Error("Order not found.");
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function adminUpdateOrderStatus(token, orderId, newStatus) {
  requireAdmin_(token);
  orderId = String(orderId || "").trim();
  newStatus = String(newStatus || "").trim();
  const allowed = ["Preparing","Ready","On the Way","Delivered","Cancelled"];
  if (!orderId || !allowed.includes(newStatus)) throw new Error("Invalid order status.");

  const sheet = getCustomerOrdersSheet_();
  const rows = sheet.getLastRow() >= 2 ? sheet.getRange(2,1,sheet.getLastRow()-1,14).getValues() : [];
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i][0] || "").trim() === orderId) {
      const currentStatus = String(rows[i][6] || 'Preparing').trim() === 'Pending' ? 'Preparing' : String(rows[i][6] || 'Preparing').trim();
      const alreadyClosed = String(rows[i][8] || '').toLowerCase() === 'true' || rows[i][8] === true;
      if (currentStatus === 'Delivered' || alreadyClosed) throw new Error("This order is already closed and can no longer be changed.");
      if (newStatus === 'Ready' && currentStatus !== 'Preparing') throw new Error("Order must be in Preparing before it can be marked Ready.");
      if (newStatus === 'On the Way' && currentStatus !== 'Ready') throw new Error("Order must be Ready before it can be moved On the Way.");
      if (newStatus === 'Delivered' && currentStatus !== 'On the Way') throw new Error("Order must be On the Way before it can be marked Delivered.");
      if (newStatus === 'Ready') {
        const itemRows = getItemRowsByOrder_()[orderId] || [];
        if (!itemRows.length || !itemRows.every(function(item){ return String(item.itemStatus || 'Preparing').trim() === 'Ready'; })) {
          throw new Error("All menu items must be Ready before the order can be moved On the Way.");
        }
        // There is intentionally NO separate On the Way button.
        // Clicking Ready immediately advances the order to On the Way.
        newStatus = 'On the Way';
      }
      const rowNumber = i + 2;
      const deliveredNow = newStatus === "Delivered";
      const deliveredAt = deliveredNow ? new Date() : null;
      sheet.getRange(rowNumber,7).setValue(newStatus);
      if (deliveredNow) {
        sheet.getRange(rowNumber,8).setValue(deliveredAt);
        // Delivered means the restaurant marked the order delivered.
        // Customer confirmation remains false until the customer answers
        // the receipt popup. This is required before the survey can be sent.
        sheet.getRange(rowNumber,9).setValue(false);
        sheet.getRange(rowNumber,10).clearContent();
      } else {
        sheet.getRange(rowNumber,8).clearContent();
        sheet.getRange(rowNumber,9).setValue(false);
        sheet.getRange(rowNumber,10).clearContent();
      }
      SpreadsheetApp.flush();

      let receiptNotificationSent = false;
      if (deliveredNow) {
        const updatedOrder = buildCanonicalOrders_().find(function(o){return o.orderId === orderId;});
        if (updatedOrder && String(updatedOrder.userId || '').trim()) {
          const nSheet = getCustomerNotificationsSheet_();
          const existingReceipt = getCustomerNotificationsForOrder_(orderId, String(updatedOrder.userId || ''))
            .find(function(n){ return n.type === 'RECEIPT_CONFIRMATION' && !n.readAt; });
          if (!existingReceipt) {
            const id = 'NTF-' + Date.now() + '-' + Math.floor(Math.random()*10000);
            const createdAt = new Date();
            nSheet.appendRow([
              id, String(updatedOrder.userId || ''), orderId, 'RECEIPT_CONFIRMATION',
              '🍜 Did you receive your food?',
              'Your McKenzie Ramen House order was marked as Delivered. Did you receive your food?',
              createdAt, ''
            ]);
            cacheCustomerNotification_({
              notificationId:id, userId:String(updatedOrder.userId || ''), orderId:orderId,
              type:'RECEIPT_CONFIRMATION', title:'🍜 Did you receive your food?',
              message:'Your McKenzie Ramen House order was marked as Delivered. Did you receive your food?',
              createdAt:createdAt.toISOString(), readAt:''
            });
            receiptNotificationSent = true;
          }
        }
      }

      return {
        success:true,
        receiptNotificationSent:receiptNotificationSent,
        order:buildCanonicalOrders_().find(function(o){return o.orderId === orderId;})
      };
    }
  }
  throw new Error("Order not found.");
}

function respondCustomerReceipt(userId, orderId, received, notificationId) {
  userId = String(userId || '').trim();
  orderId = String(orderId || '').trim();
  notificationId = String(notificationId || '').trim();
  if (!userId || !orderId) throw new Error("Order information is required.");

  const sheet = getCustomerOrdersSheet_();
  const rows = sheet.getLastRow() >= 2 ? sheet.getRange(2,1,sheet.getLastRow()-1,14).getValues() : [];
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i][0] || '').trim() === orderId && String(rows[i][1] || '').trim() === userId) {
      if (String(rows[i][6] || '').trim() !== 'Delivered') throw new Error('The order has not been marked as delivered yet.');
      const rowNumber=i+2;
      const now=new Date();
      sheet.getRange(rowNumber,9).setValue(!!received);
      sheet.getRange(rowNumber,10).setValue(received ? now : '');
      if (notificationId) {
        try { markCustomerNotificationRead(userId, notificationId); } catch (ignore) {}
      }
      SpreadsheetApp.flush();
      return {success:true, received:!!received, closed:!!received, contact:{phone:'09123456789',email:'Mckenzieramenhouse@gmail.com',facebook:'Mckenzie Ramen House'}};
    }
  }
  throw new Error('Order not found.');
}

function confirmCustomerOrderReceived(userId, orderId) {
  return respondCustomerReceipt(userId, orderId, true, '');
}


/* =========================================================
   CUSTOMER REVIEWS / PRODUCT RATINGS
   Real reviews only: customer must have a Delivered order and
   must have confirmed receipt before submitting a review.
   ========================================================= */
function getReviewsSheet_() {
  const ss = getOrdersSpreadsheet_();
  let sheet = ss.getSheetByName("Reviews");
  if (!sheet) sheet = ss.insertSheet("Reviews");
  const headers = [
    "Review ID", "Order ID", "Customer ID", "Product ID", "Product Name",
    "Rating", "Review", "Customer Name", "Submitted At", "Status"
  ];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    headers.forEach(function(header, i) {
      if (String(current[i] || "").trim() !== header) sheet.getRange(1, i + 1).setValue(header);
    });
  }
  return sheet;
}

function getReviewRows_() {
  const sheet = getReviewsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 10).getValues().map(function(row, i) {
    return {
      rowNumber: i + 2,
      reviewId: String(row[0] || ""),
      orderId: String(row[1] || ""),
      customerId: String(row[2] || ""),
      productId: String(row[3] || ""),
      productName: String(row[4] || ""),
      rating: Number(row[5] || 0),
      review: String(row[6] || ""),
      customerName: String(row[7] || "Customer"),
      submittedAt: row[8] ? new Date(row[8]).toISOString() : "",
      status: String(row[9] || "Published")
    };
  }).filter(function(r) { return r.reviewId || r.orderId || r.productName; });
}

function getCustomerReviewForm(userId, orderId) {
  userId = String(userId || "").trim();
  orderId = String(orderId || "").trim();
  if (!userId || !orderId) throw new Error("Order information is required.");

  const order = getCustomerOrderHistory(userId).find(function(o) { return o.orderId === orderId; });
  if (!order) throw new Error("Order not found.");
  if (String(order.orderStatus) !== "Delivered" || !order.customerConfirmed) {
    throw new Error("You can review this order only after it has been delivered and received.");
  }

  const existing = getReviewRows_().filter(function(r) {
    return r.orderId === orderId && r.customerId === userId;
  });
  const existingByProduct = {};
  existing.forEach(function(r) { existingByProduct[r.productId] = r; });

  return {
    success: true,
    orderId: order.orderId,
    customerName: order.customerName || "Customer",
    items: (order.items || []).map(function(item) {
      const productId = String(item.productId || "");
      const prior = existingByProduct[productId];
      return {
        productId: productId,
        productName: item.productName || "Ramen item",
        quantity: Number(item.quantity || 0),
        reviewed: !!prior,
        existingRating: prior ? prior.rating : 0,
        existingReview: prior ? prior.review : ""
      };
    }),
    completed: (order.items || []).every(function(item) {
      return !!existingByProduct[String(item.productId || "")];
    })
  };
}

function submitCustomerReview(userId, orderId, productId, rating, review) {
  userId = String(userId || "").trim();
  orderId = String(orderId || "").trim();
  productId = String(productId || "").trim();
  rating = Number(rating);
  review = String(review || "").trim();
  if (!userId || !orderId || !productId) throw new Error("Review information is required.");
  if (!isFinite(rating) || rating < 1 || rating > 5) throw new Error("Please select a rating from 1 to 5 stars.");
  if (review.length > 1000) throw new Error("Review is too long. Please keep it under 1000 characters.");

  const form = getCustomerReviewForm(userId, orderId);
  const item = form.items.find(function(i) { return String(i.productId) === productId; });
  if (!item) throw new Error("That menu item was not part of this order.");
  if (item.reviewed) throw new Error("You already reviewed this menu item.");

  const sheet = getReviewsSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rows = getReviewRows_();
    const duplicate = rows.some(function(r) {
      return r.orderId === orderId && r.customerId === userId && r.productId === productId;
    });
    if (duplicate) throw new Error("You already reviewed this menu item.");

    sheet.appendRow([
      Utilities.getUuid(),
      orderId,
      userId,
      productId,
      item.productName,
      rating,
      review,
      form.customerName || "Customer",
      new Date(),
      "Published"
    ]);
    SpreadsheetApp.flush();
    return { success: true, message: "Your review has been submitted.", reviewId: sheet.getRange(sheet.getLastRow(), 1).getValue() };
  } finally {
    lock.releaseLock();
  }
}

function getPublishedReviews() {
  return getReviewRows_().filter(function(r) {
    return String(r.status || "Published").toLowerCase() === "published";
  }).sort(function(a, b) {
    return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
  }).slice(0, 12).map(function(r) {
    return {
      reviewId: r.reviewId,
      orderId: r.orderId,
      productId: r.productId,
      productName: r.productName,
      rating: r.rating,
      review: r.review,
      customerName: r.customerName,
      submittedAt: r.submittedAt
    };
  });
}

function adminGetReviews(token) {
  requireAdmin_(token);
  const reviews = getReviewRows_().sort(function(a, b) {
    return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
  });
  const published = reviews.filter(function(r) { return String(r.status).toLowerCase() === "published"; });
  const average = published.length ? published.reduce(function(sum, r) { return sum + Number(r.rating || 0); }, 0) / published.length : 0;
  return {
    success: true,
    reviews: reviews,
    stats: { total: reviews.length, published: published.length, hidden: reviews.length - published.length, average: Math.round(average * 10) / 10 }
  };
}

function adminUpdateReviewStatus(token, reviewId, newStatus) {
  requireAdmin_(token);
  reviewId = String(reviewId || "").trim();
  newStatus = String(newStatus || "").trim();
  if (!reviewId || !["Published", "Hidden"].includes(newStatus)) throw new Error("Invalid review status.");
  const sheet = getReviewsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) throw new Error("Review not found.");
  const ids = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === reviewId) {
      sheet.getRange(i + 2, 10).setValue(newStatus);
      SpreadsheetApp.flush();
      return { success: true, status: newStatus };
    }
  }
  throw new Error("Review not found.");
}


/* =========================================================
   CUSTOMER REVIEW NOTIFICATIONS
   Admin can notify a delivered customer to review their order.
   Customer frontend polls unread notifications and shows a popup.
   ========================================================= */
function getCustomerNotificationsSheet_() {
  const ss = getOrdersSpreadsheet_();
  let sheet = ss.getSheetByName('CustomerNotifications');
  const headers = ['Notification ID','Customer ID','Order ID','Type','Title','Message','Created At','Read At'];
  if (!sheet) {
    sheet = ss.insertSheet('CustomerNotifications');
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    headers.forEach(function(h,i){
      if (String(sheet.getRange(1,i+1).getValue() || '').trim() !== h) sheet.getRange(1,i+1).setValue(h);
    });
  }
  return sheet;
}

function getCustomerNotificationsForOrder_(orderId, userId) {
  orderId = String(orderId || '').trim();
  userId = String(userId || '').trim();
  if (!orderId || !userId) return [];
  const sheet = getCustomerNotificationsSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues().map(function(row,i){
    return {
      rowNumber:i+2,
      notificationId:String(row[0] || ''),
      userId:String(row[1] || ''),
      orderId:String(row[2] || ''),
      type:String(row[3] || ''),
      title:String(row[4] || ''),
      message:String(row[5] || ''),
      createdAt:row[6] ? new Date(row[6]).toISOString() : '',
      readAt:row[7] ? new Date(row[7]).toISOString() : ''
    };
  }).filter(function(n){ return n.orderId === orderId && n.userId === userId; });
}


/* =========================================================
   FAST CUSTOMER NOTIFICATION CACHE
   Permanent source remains CustomerNotifications sheet.
   Cache only shortens the delivery path for newly-created alerts.
   ========================================================= */
function notificationCacheKey_(userId) {
  return 'MCK_NOTIFY_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(userId || ''))
  ).replace(/=+$/,'');
}
function cacheCustomerNotification_(notification) {
  try {
    const uid=String(notification && notification.userId || '').trim();
    if(!uid)return;
    const cache=CacheService.getScriptCache();
    const key=notificationCacheKey_(uid);
    let list=[];
    const raw=cache.get(key);
    if(raw){try{list=JSON.parse(raw)||[];}catch(ignore){list=[];}}
    list=list.filter(function(n){return String(n.notificationId||'')!==String(notification.notificationId||'');});
    list.unshift(notification);
    cache.put(key,JSON.stringify(list.slice(0,10)),300);
  } catch(ignore) {}
}
function getCachedCustomerNotifications_(userId) {
  try {
    const uid=String(userId||'').trim();
    if(!uid)return [];
    const raw=CacheService.getScriptCache().get(notificationCacheKey_(uid));
    if(!raw)return [];
    const list=JSON.parse(raw)||[];
    return Array.isArray(list)?list.filter(function(n){return String(n.userId||'')===uid&&!n.readAt;}):[];
  } catch(ignore){return []}
}
function removeCachedCustomerNotification_(userId,notificationId) {
  try {
    const uid=String(userId||'').trim(), nid=String(notificationId||'').trim();
    if(!uid||!nid)return;
    const cache=CacheService.getScriptCache(), key=notificationCacheKey_(uid), raw=cache.get(key);
    if(!raw)return;
    let list=[];try{list=JSON.parse(raw)||[];}catch(ignore){list=[];}
    list=Array.isArray(list)?list.filter(function(n){return String(n.notificationId||'')!==nid;}):[];
    if(list.length)cache.put(key,JSON.stringify(list.slice(0,10)),300);else cache.remove(key);
  } catch(ignore) {}
}

function adminNotifyCustomerReview(token, orderId, forceResend) {
  requireAdmin_(token);
  orderId = String(orderId || '').trim();
  forceResend = forceResend === true;
  if (!orderId) throw new Error('Order ID is required.');

  const order = buildCanonicalOrders_().find(function(o){ return String(o.orderId) === orderId; });
  if (!order) throw new Error('Order not found.');
  if (String(order.orderStatus) !== 'Delivered') throw new Error('The customer can only be notified after the order is Delivered.');
  if (!order.customerConfirmed) throw new Error('Wait for the customer to confirm that the order was received before sending the review request.');

  const progress = getOrderReviewProgress_(orderId);
  if (progress.reviewCompleted) {
    return {success:true, sent:false, completed:true, message:'Customer has already reviewed this order.'};
  }

  const sheet = getCustomerNotificationsSheet_();
  const existing = getCustomerNotificationsForOrder_(orderId, String(order.userId || ''))
    .find(function(n){ return n.type === 'REVIEW_REQUEST' && !n.readAt; });

  // Normal notification: prevent duplicate unread notifications.
  if (existing && !forceResend) {
    return {
      success:true,
      sent:false,
      alreadyNotified:true,
      notificationId:existing.notificationId,
      message:'Review notification is already waiting for the customer.'
    };
  }

  // Notify Again: close ALL existing unread review requests for this order,
  // then create exactly one fresh notification. This makes resend deterministic
  // even if more than one old notification exists.
  if (forceResend) {
    const allExisting = getCustomerNotificationsForOrder_(orderId, String(order.userId || ''))
      .filter(function(n){ return n.type === 'REVIEW_REQUEST' && !n.readAt; });
    allExisting.forEach(function(n){
      sheet.getRange(n.rowNumber, 8).setValue(new Date());
    });
  }

  const id = 'NTF-' + Date.now() + '-' + Math.floor(Math.random()*10000);
  const createdAt = new Date();
  sheet.appendRow([
    id, String(order.userId || ''), orderId, 'REVIEW_REQUEST',
    '🍜 Your ramen review is ready!',
    'Your order has been delivered. Please share your rating and review for the menu items you received.',
    createdAt, ''
  ]);
  cacheCustomerNotification_({
    notificationId:id, userId:String(order.userId || ''), orderId:orderId,
    type:'REVIEW_REQUEST', title:'🍜 Your ramen review is ready!',
    message:'Your order has been delivered. Please share your rating and review for the menu items you received.',
    createdAt:createdAt.toISOString(), readAt:''
  });

  return {
    success:true,
    sent:true,
    resent:!!forceResend,
    notificationId:id,
    message:forceResend ? 'Review resent to the customer.' : 'Review notification sent to the customer.'
  };
}

function getCustomerNotifications(userId) {
  userId = String(userId || '').trim();
  if (!userId) return [];
  let sheetNotifications = [];
  const sheet = getCustomerNotificationsSheet_();
  if (sheet.getLastRow() >= 2) {
    sheetNotifications = sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues().map(function(row,i){
      return {rowNumber:i+2,notificationId:String(row[0]||''),userId:String(row[1]||''),orderId:String(row[2]||''),type:String(row[3]||''),title:String(row[4]||''),message:String(row[5]||''),createdAt:row[6]?new Date(row[6]).toISOString():'',readAt:row[7]?new Date(row[7]).toISOString():''};
    }).filter(function(n){return n.userId===userId&&!n.readAt;});
  }
  const cached=getCachedCustomerNotifications_(userId), merged=[], seen={};
  cached.concat(sheetNotifications).forEach(function(n){
    const id=String(n.notificationId||'');
    if(!id||seen[id])return;
    seen[id]=true; merged.push(n);
  });
  merged.sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0);});
  return merged;
}

function markCustomerNotificationRead(userId, notificationId) {
  userId = String(userId || '').trim();
  notificationId = String(notificationId || '').trim();
  if (!userId || !notificationId) throw new Error('Notification information is required.');
  const sheet = getCustomerNotificationsSheet_();
  if (sheet.getLastRow() < 2) throw new Error('Notification not found.');
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i][0] || '') === notificationId && String(rows[i][1] || '') === userId) {
      sheet.getRange(i+2,8).setValue(new Date());
      removeCachedCustomerNotification_(userId,notificationId);
      return {success:true};
    }
  }
  throw new Error('Notification not found.');
}
