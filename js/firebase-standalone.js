/*
  McKenzie Ramen House — STANDALONE Firebase bridge
  --------------------------------------------------
  This file intentionally exposes a compatibility layer named
  google.script.run so the existing customer/admin UI can keep its
  current function calls while the backend is now Firebase.

  No Google Apps Script / Google Sheets calls are made.
*/
(function () {
  "use strict";

  // The Firebase config is embedded as a fallback so the admin page still
  // works even if GitHub Pages serves js/firebase-config.js from cache or
  // fails to load that helper file.
  const EMBEDDED_CONFIG = {
    apiKey: "AIzaSyDnLMhAhkAw1JMlbTxN4u8vB6poip5dt94",
    authDomain: "mckenzie-ramen-house.firebaseapp.com",
    projectId: "mckenzie-ramen-house",
    storageBucket: "mckenzie-ramen-house.firebasestorage.app",
    messagingSenderId: "1048288418639",
    appId: "1:1048288418639:web:85e0148036179259c8033a",
    measurementId: "G-C2KDRE88ZW"
  };

  // Use the verified Firebase Console web config as the source of truth.
  // This prevents an old/stale firebase-config.js from causing auth/api-key errors.
  const cfg = EMBEDDED_CONFIG;
  window.MCKENZIE_FIREBASE_CONFIG = EMBEDDED_CONFIG;
  window.MCKENZIE_ADMIN_UID = window.MCKENZIE_ADMIN_UID || "OHDs2DV4jyO3eBrww8d0gUQkNli2";

  const READY = (async function () {
    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
      const authMod = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      const fsMod = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");

      const app = appMod.initializeApp(
        cfg,
        "mckenzie-ramen-house"
      );

      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);

      console.log(
        "McKenzie Ramen House Firebase initialized successfully."
      );

      return {
        app,
        auth,
        db,
        ...authMod,
        ...fsMod
      };

    } catch (error) {
      console.error(
        "McKenzie Firebase initialization failed:",
        error
      );

      throw error;
    }
  })();

  window.MckenzieFirebaseReady = READY;

  function makeError(message) {
    const e = new Error(
      String(
        message ||
        "Firebase request failed."
      )
    );

    return e;
  }

  function isoNow() {
    return new Date().toISOString();
  }

  async function currentUser(required) {
    const f = await READY;

    if (f.auth.currentUser) {
      return f.auth.currentUser;
    }

    if (!required) {
      return null;
    }

    throw makeError(
      "Please log in again."
    );
  }

  async function isAdmin() {
    const f = await READY;
    const u = f.auth.currentUser;

    if (!u) {
      return false;
    }

    const configuredUid = String(
      window.MCKENZIE_ADMIN_UID || ""
    ).trim();

    if (
      configuredUid &&
      configuredUid !==
        "PASTE_ADMIN_USER_UID_HERE"
    ) {
      return u.uid === configuredUid;
    }

    return false;
  }

  async function requireAdmin() {
    if (!(await isAdmin())) {
      throw makeError(
        "Admin access is not configured for this account."
      );
    }

    return true;
  }

  function cleanTimestamp(v) {
    if (!v) {
      return "";
    }

    if (typeof v === "string") {
      return v;
    }

    if (
      v &&
      typeof v.toDate === "function"
    ) {
      return v.toDate().toISOString();
    }

    if (v instanceof Date) {
      return v.toISOString();
    }

    return String(v);
  }

  function docData(snap) {
    return snap.exists()
      ? {
          id: snap.id,
          ...snap.data()
        }
      : null;
  }

  async function getDocById(
    collectionName,
    id
  ) {
    const f = await READY;

    const snap = await f.getDoc(
      f.doc(
        f.db,
        collectionName,
        String(id)
      )
    );

    return docData(snap);
  }

  async function getCollection(
    collectionName,
    queryConstraint
  ) {
    const f = await READY;

    const ref = f.collection(
      f.db,
      collectionName
    );

    const snap = queryConstraint
      ? await f.getDocs(
          f.query(
            ref,
            queryConstraint
          )
        )
      : await f.getDocs(ref);

    return snap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );
  }

  function profileFromUser(
    u,
    data
  ) {
    const p = data || {};

    return {
      success: true,
      userId: u.uid,
      username: p.username || "",
      email:
        u.email ||
        p.email ||
        "",
      mobile:
        p.mobile ||
        "",
      fullName:
        p.fullName ||
        u.displayName ||
        "",
      houseUnit:
        p.houseUnit ||
        "",
      street:
        p.street ||
        "",
      barangay:
        p.barangay ||
        "",
      city:
        p.city ||
        "",
      province:
        p.province ||
        "",
      postalCode:
        p.postalCode ||
        "",
      country:
        p.country ||
        "Philippines",
      region:
        p.region ||
        "",
      additionalInstruction:
        p.additionalInstruction ||
        ""
    };
  }

  async function getProfile(
    userId
  ) {
    const u =
      await currentUser(true);

    if (
      String(userId) !==
      String(u.uid)
    ) {
      throw makeError(
        "You can only access your own profile."
      );
    }

    const p =
      await getDocById(
        "users",
        u.uid
      );

    return profileFromUser(
      u,
      p || {}
    );
  }

  async function saveProfile(
    data
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    data = data || {};

    if (
      String(
        data.userId || ""
      ) !== u.uid
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const fullName =
      String(
        data.fullName || ""
      ).trim();

    const email =
      String(
        data.email ||
        u.email ||
        ""
      )
        .trim()
        .toLowerCase();

    const mobile =
      String(
        data.mobile || ""
      ).trim();

    if (!fullName) {
      throw makeError(
        "Full name is required."
      );
    }

    if (!email) {
      throw makeError(
        "Email address is required."
      );
    }

    if (!mobile) {
      throw makeError(
        "Phone number is required."
      );
    }

    await f.setDoc(
      f.doc(
        f.db,
        "users",
        u.uid
      ),
      {
        username:
          data.username || "",
        email,
        fullName,
        mobile,

        houseUnit:
          String(
            data.houseUnit || ""
          ).trim(),

        street:
          String(
            data.street || ""
          ).trim(),

        barangay:
          String(
            data.barangay || ""
          ).trim(),

        city:
          String(
            data.city || ""
          ).trim(),

        province:
          String(
            data.province || ""
          ).trim(),

        postalCode:
          String(
            data.postalCode || ""
          ).trim(),

        country:
          String(
            data.country ||
            "Philippines"
          ).trim() ||
          "Philippines",

        region:
          String(
            data.region || ""
          ).trim(),

        additionalInstruction:
          String(
            data.additionalInstruction ||
            ""
          ).trim(),

        updatedAt:
          isoNow()
      },
      {
        merge: true
      }
    );

    return getProfile(
      u.uid
    );
  }

  async function loginUser(
    identifier,
    password
  ) {
    const f = await READY;

    identifier =
      String(
        identifier || ""
      )
        .trim()
        .toLowerCase();

    password =
      String(
        password || ""
      );

    if (
      !identifier ||
      !password
    ) {
      throw makeError(
        "Please enter username/email and password."
      );
    }

    if (
      !identifier.includes("@")
    ) {
      throw makeError(
        "Please log in using your registered email address."
      );
    }

    const cred =
      await f.signInWithEmailAndPassword(
        f.auth,
        identifier,
        password
      );

    const p =
      await getDocById(
        "users",
        cred.user.uid
      );

    return profileFromUser(
      cred.user,
      p || {}
    );
  }

  async function createAccount(
    fullName,
    email,
    username,
    password,
    mobile
  ) {
    const f = await READY;

    const cred =
      await f.createUserWithEmailAndPassword(
        f.auth,
        String(email)
          .trim()
          .toLowerCase(),
        String(password)
      );

    await f.setDoc(
      f.doc(
        f.db,
        "users",
        cred.user.uid
      ),
      {
        username:
          String(
            username || ""
          ).trim(),

        email:
          cred.user.email ||
          String(email)
            .trim()
            .toLowerCase(),

        fullName:
          String(
            fullName || ""
          ).trim(),

        mobile:
          String(
            mobile || ""
          ).trim(),

        country:
          "Philippines",

        status:
          "ACTIVE",

        createdAt:
          isoNow(),

        updatedAt:
          isoNow()
      },
      {
        merge: true
      }
    );

    try {
      await f.sendEmailVerification(
        cred.user
      );
    } catch (e) {
      console.warn(
        "Verification email could not be sent:",
        e
      );
    }

    return {
      success: true,

      message:
        "Account created. Please verify your email, then log in.",

      verificationToken:
        cred.user.uid,

      email:
        cred.user.email ||
        email,

      expiresInSeconds:
        600
    };
  }

  async function verifyEmailCode(
    token,
    code
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    await f.auth.currentUser.reload();

    if (
      !f.auth.currentUser
        .emailVerified
    ) {
      throw makeError(
        "Please open the verification email and click the verification link first."
      );
    }

    return {
      success: true,
      message:
        "Email verified."
    };
  }

  async function sendPasswordReset(
    identifier
  ) {
    const f = await READY;

    const email =
      String(
        identifier || ""
      )
        .trim()
        .toLowerCase();

    if (
      !email ||
      !email.includes("@")
    ) {
      throw makeError(
        "Please enter your registered email address."
      );
    }

    await f.sendPasswordResetEmail(
      f.auth,
      email
    );

    return {
      success: true,
      email,
      message:
        "Password reset email sent."
    };
  }

  async function changePassword(
    userId,
    oldPassword,
    newPassword
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    if (
      !newPassword ||
      String(newPassword).length < 6
    ) {
      throw makeError(
        "Password must be at least 6 characters."
      );
    }

    if (!u.email) {
      throw makeError(
        "Your account has no email address."
      );
    }

    const cred =
      f.EmailAuthProvider.credential(
        u.email,
        String(
          oldPassword || ""
        )
      );

    await f.reauthenticateWithCredential(
      u,
      cred
    );

    await f.updatePassword(
      u,
      String(newPassword)
    );

    return {
      success: true
    };
  }

  async function addresses(
    userId
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const list =
      await getCollection(
        "addresses"
      );

    return list
      .filter(
        a =>
          String(a.userId) ===
          u.uid
      )
      .sort(
        (a, b) =>
          (b.isDefault ? 1 : 0) -
          (a.isDefault ? 1 : 0)
      )
      .map(
        a => ({
          addressId:
            a.id,

          userId:
            a.userId,

          label:
            a.label ||
            "Saved Address",

          houseUnit:
            a.houseUnit ||
            "",

          street:
            a.street ||
            "",

          barangay:
            a.barangay ||
            "",

          city:
            a.city ||
            "",

          province:
            a.province ||
            "",

          region:
            a.region ||
            "",

          postalCode:
            a.postalCode ||
            "",

          country:
            a.country ||
            "Philippines",

          additionalInstruction:
            a.additionalInstruction ||
            "",

          isDefault:
            !!a.isDefault,

          createdAt:
            cleanTimestamp(
              a.createdAt
            ),

          updatedAt:
            cleanTimestamp(
              a.updatedAt
            )
        })
      );
  }

  async function saveAddress(
    data
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    data = data || {};

    if (
      String(
        data.userId || ""
      ) !== u.uid
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const required = [
      [
        "region",
        "region"
      ],
      [
        "province",
        "province"
      ],
      [
        "city",
        "city/municipality"
      ],
      [
        "barangay",
        "barangay"
      ],
      [
        "houseUnit",
        "lot/house/unit number"
      ],
      [
        "street",
        "street"
      ]
    ];

    for (
      const [key, label] of required
    ) {
      if (
        !String(
          data[key] || ""
        ).trim()
      ) {
        throw makeError(
          "Please select/enter your " +
          label +
          "."
        );
      }
    }

    const all =
      await addresses(
        u.uid
      );

    const id =
      String(
        data.addressId ||
        (
          "ADDR-" +
          Date.now() +
          "-" +
          Math.floor(
            Math.random() * 10000
          )
        )
      );

    if (
      data.isDefault !== false
    ) {
      for (
        const a of all
      ) {
        if (
          a.isDefault
        ) {
          await f.updateDoc(
            f.doc(
              f.db,
              "addresses",
              a.addressId
            ),
            {
              isDefault: false,
              updatedAt:
                isoNow()
            }
          );
        }
      }
    }

    await f.setDoc(
      f.doc(
        f.db,
        "addresses",
        id
      ),
      {
        userId:
          u.uid,

        label:
          String(
            data.label ||
            "Saved Address"
          ).trim(),

        houseUnit:
          String(
            data.houseUnit ||
            ""
          ).trim(),

        street:
          String(
            data.street ||
            ""
          ).trim(),

        barangay:
          String(
            data.barangay ||
            ""
          ).trim(),

        city:
          String(
            data.city ||
            ""
          ).trim(),

        province:
          String(
            data.province ||
            ""
          ).trim(),

        region:
          String(
            data.region ||
            ""
          ).trim(),

        postalCode:
          String(
            data.postalCode ||
            ""
          ).trim(),

        country:
          String(
            data.country ||
            "Philippines"
          ).trim(),

        additionalInstruction:
          String(
            data.additionalInstruction ||
            ""
          ).trim(),

        isDefault:
          data.isDefault !== false,

        createdAt:
          data.createdAt ||
          isoNow(),

        updatedAt:
          isoNow()
      },
      {
        merge: true
      }
    );

    if (
      data.isDefault !== false
    ) {
      await f.setDoc(
        f.doc(
          f.db,
          "users",
          u.uid
        ),
        {
          houseUnit:
            data.houseUnit ||
            "",

          street:
            data.street ||
            "",

          barangay:
            data.barangay ||
            "",

          city:
            data.city ||
            "",

          province:
            data.province ||
            "",

          region:
            data.region ||
            "",

          postalCode:
            data.postalCode ||
            "",

          country:
            data.country ||
            "Philippines",

          additionalInstruction:
            data.additionalInstruction ||
            "",

          updatedAt:
            isoNow()
        },
        {
          merge: true
        }
      );
    }

    return addresses(
      u.uid
    );
  }

  async function setDefaultAddress(
    userId,
    addressId
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const all =
      await addresses(
        u.uid
      );

    const selected =
      all.find(
        a =>
          a.addressId ===
          String(addressId)
      );

    if (!selected) {
      throw makeError(
        "Address not found."
      );
    }

    for (
      const a of all
    ) {
      await f.updateDoc(
        f.doc(
          f.db,
          "addresses",
          a.addressId
        ),
        {
          isDefault:
            a.addressId ===
            selected.addressId,

          updatedAt:
            isoNow()
        }
      );
    }

    return addresses(
      u.uid
    );
  }

  // ============================================================
  // PRODUCTS
  // ============================================================

  async function getProducts() {

    // Products are publicly readable according to Firestore Rules.
    // No admin authentication is required to READ products.

    const list =
      await getCollection(
        "products"
      );

    return list
      .filter(
        p =>
          p.name
      )
      .map(
        p => ({
          id:
            p.id,

          name:
            p.name,

          category:
            p.category ||
            "Ramen",

          price:
            Number(
              p.price || 0
            ),

          image:
            p.image ||
            "",

          description:
            p.description ||
            "",

          available:
            p.available !==
            false,

          bestSeller:
            !!p.bestSeller,

          newProduct:
            !!p.newProduct
        })
      );
  }

  async function getBrandAssets() {
    const p =
      await getDocById(
        "brandAssets",
        "main"
      );

    return p || {};
  }

  async function getRamenLoadingImage() {
    const p =
      await getBrandAssets();

    return (
      p.ramenLoadingImage ||
      ""
    );
  }

  function orderAddress(
    payload
  ) {
    return [
      payload.houseUnit,
      payload.street,
      payload.barangay,
      payload.city,
      payload.province,
      payload.region
    ]
      .map(
        v =>
          String(
            v || ""
          ).trim()
      )
      .filter(Boolean)
      .join(", ");
  }

  async function saveOrder(
    orderId,
    payload
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    payload =
      payload || {};

    if (
      String(
        payload.userId || ""
      ) !== u.uid
    ) {
      throw makeError(
        "Please log in again."
      );
    }

    const cleanItems =
      Array.isArray(
        payload.items
      )
        ? payload.items
            .map(
              item => ({
                productId:
                  String(
                    item.id ||
                    item.productId ||
                    ""
                  ),

                productName:
                  String(
                    item.name ||
                    item.productName ||
                    "Ramen item"
                  ),

                price:
                  Number(
                    item.price || 0
                  ),

                quantity:
                  Number(
                    item.quantity || 0
                  ),

                subtotal:
                  Number(
                    item.subtotal !=
                    null
                      ? item.subtotal
                      : Number(
                          item.price ||
                          0
                        ) *
                        Number(
                          item.quantity ||
                          0
                        )
                  ),

                itemStatus:
                  "Preparing"
              })
            )
            .filter(
              x =>
                x.quantity > 0
            )
        : [];

    if (!cleanItems.length) {
      throw makeError(
        "The order contains no items."
      );
    }

    const total =
      cleanItems.reduce(
        (s, i) =>
          s + i.subtotal,
        0
      );

    const ref =
      f.doc(
        f.db,
        "orders",
        String(orderId)
      );

    const existing =
      await f.getDoc(ref);

    if (
      existing.exists()
    ) {
      return {
        success: true,
        orderId:
          String(orderId),
        duplicate: true
      };
    }

    await f.setDoc(
      ref,
      {
        orderId:
          String(orderId),

        userId:
          u.uid,

        customerName:
          String(
            payload.fullName ||
            ""
          ),

        fullName:
          String(
            payload.fullName ||
            ""
          ),

        email:
          u.email ||
          "",

        mobile:
          String(
            payload.mobile ||
            ""
          ),

        items:
          cleanItems,

        total,

        paymentMethod:
          String(
            payload.paymentMethod ||
            ""
          ),

        paymentStatus:
          "Pending",

        orderStatus:
          "Preparing",

        address:
          orderAddress(
            payload
          ),

        instruction:
          String(
            payload.additionalInstruction ||
            ""
          ),

        orderedAt:
          isoNow(),

        customerConfirmed:
          false,

        confirmedAt:
          "",

        deliveredAt:
          "",

        closed:
          false
      }
    );

    return {
      success: true,
      orderId:
        String(orderId),
      status:
        "Preparing"
    };
  }

  function normalizeOrder(o) {
    if (!o) {
      return null;
    }

    return {
      orderId:
        String(
          o.orderId ||
          o.id ||
          ""
        ),

      userId:
        String(
          o.userId ||
          ""
        ),

      customerName:
        o.customerName ||
        o.fullName ||
        "Customer",

      fullName:
        o.fullName ||
        o.customerName ||
        "Customer",

      email:
        o.email ||
        "",

      mobile:
        o.mobile ||
        "",

      items:
        Array.isArray(
          o.items
        )
          ? o.items.map(
              (
                it,
                idx
              ) => ({
                itemIndex:
                  idx,

                productId:
                  String(
                    it.productId ||
                    it.id ||
                    ""
                  ),

                productName:
                  it.productName ||
                  it.name ||
                  "Ramen item",

                price:
                  Number(
                    it.price ||
                    0
                  ),

                quantity:
                  Number(
                    it.quantity ||
                    0
                  ),

                subtotal:
                  Number(
                    it.subtotal !=
                    null
                      ? it.subtotal
                      : Number(
                          it.price ||
                          0
                        ) *
                        Number(
                          it.quantity ||
                          0
                        )
                  ),

                itemStatus:
                  String(
                    it.itemStatus ||
                    "Preparing"
                  )
              })
            )
          : [],

      total:
        Number(
          o.total ||
          0
        ),

      paymentMethod:
        o.paymentMethod ||
        "",

      paymentStatus:
        o.paymentStatus ||
        "Pending",

      orderStatus:
        o.orderStatus ===
        "Pending"
          ? "Preparing"
          : (
              o.orderStatus ||
              "Preparing"
            ),

      address:
        o.address ||
        "",

      instruction:
        o.instruction ||
        o.additionalInstruction ||
        "",

      orderedAt:
        cleanTimestamp(
          o.orderedAt
        ),

      customerConfirmed:
        !!o.customerConfirmed,

      confirmedAt:
        cleanTimestamp(
          o.confirmedAt
        ),

      deliveredAt:
        cleanTimestamp(
          o.deliveredAt
        ),

      closed:
        !!o.closed,

      canRate:
        o.orderStatus ===
          "Delivered" &&
        !!o.customerConfirmed
    };
  }

  async function getOrdersForUser(
    userId
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const list =
      await getCollection(
        "orders"
      );

    return list
      .filter(
        o =>
          String(
            o.userId
          ) ===
          u.uid
      )
      .map(
        normalizeOrder
      )
      .sort(
        (a, b) =>
          String(
            b.orderedAt
          ).localeCompare(
            String(
              a.orderedAt
            )
          )
      );
  }

  async function getReviewsForOrder(
    orderId,
    userId
  ) {
    const list =
      await getCollection(
        "reviews"
      );

    return list.filter(
      r =>
        String(
          r.orderId
        ) ===
          String(orderId) &&
        String(
          r.customerId ||
          r.userId
        ) ===
          String(userId)
    );
  }

  async function getReviewForm(
    userId,
    orderId
  ) {
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const order =
      (
        await getOrdersForUser(
          u.uid
        )
      ).find(
        o =>
          o.orderId ===
          String(orderId)
      );

    if (!order) {
      throw makeError(
        "Order not found."
      );
    }

    if (
      order.orderStatus !==
        "Delivered" ||
      !order.customerConfirmed
    ) {
      throw makeError(
        "You can review this order only after it has been delivered and received."
      );
    }

    const reviews =
      await getReviewsForOrder(
        orderId,
        u.uid
      );

    const byProduct =
      {};

    reviews.forEach(
      r =>
        byProduct[
          String(
            r.productId
          )
        ] = r
    );

    return {
      success: true,

      orderId:
        order.orderId,

      customerName:
        order.customerName ||
        "Customer",

      items:
        order.items.map(
          item => ({
            productId:
              item.productId,

            productName:
              item.productName,

            quantity:
              item.quantity,

            reviewed:
              !!byProduct[
                item.productId
              ],

            existingRating:
              byProduct[
                item.productId
              ]?.rating || 0,

            existingReview:
              byProduct[
                item.productId
              ]?.review || ""
          })
        ),

      completed:
        order.items.every(
          item =>
            !!byProduct[
              item.productId
            ]
        )
    };
  }

  async function submitReview(
    userId,
    orderId,
    productId,
    rating,
    review
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    rating =
      Number(rating);

    review =
      String(
        review || ""
      ).trim();

    if (
      !Number.isFinite(
        rating
      ) ||
      rating < 1 ||
      rating > 5
    ) {
      throw makeError(
        "Please select a rating from 1 to 5 stars."
      );
    }

    if (
      review.length > 1000
    ) {
      throw makeError(
        "Review is too long. Please keep it under 1000 characters."
      );
    }

    const form =
      await getReviewForm(
        u.uid,
        orderId
      );

    const item =
      form.items.find(
        i =>
          String(
            i.productId
          ) ===
          String(productId)
      );

    if (!item) {
      throw makeError(
        "That menu item was not part of this order."
      );
    }

    if (item.reviewed) {
      throw makeError(
        "You already reviewed this menu item."
      );
    }

    const id =
      "REV-" +
      Date.now() +
      "-" +
      Math.floor(
        Math.random() *
        10000
      );

    await f.setDoc(
      f.doc(
        f.db,
        "reviews",
        id
      ),
      {
        reviewId:
          id,

        orderId:
          String(orderId),

        customerId:
          u.uid,

        productId:
          String(productId),

        productName:
          item.productName,

        rating,

        review,

        customerName:
          form.customerName ||
          "Customer",

        submittedAt:
          isoNow(),

        status:
          "Published"
      }
    );

    return {
      success: true,

      message:
        "Your review has been submitted.",

      reviewId:
        id
    };
  }

  async function getPublishedReviews() {
    const list =
      await getCollection(
        "reviews"
      );

    return list
      .filter(
        r =>
          String(
            r.status ||
            "Published"
          ).toLowerCase() ===
          "published"
      )
      .sort(
        (a, b) =>
          String(
            b.submittedAt ||
            ""
          ).localeCompare(
            String(
              a.submittedAt ||
              ""
            )
          )
      )
      .slice(
        0,
        12
      )
      .map(
        r => ({
          reviewId:
            r.reviewId ||
            r.id,

          orderId:
            r.orderId,

          productId:
            r.productId,

          productName:
            r.productName,

          rating:
            r.rating,

          review:
            r.review,

          customerName:
            r.customerName,

          submittedAt:
            cleanTimestamp(
              r.submittedAt
            )
        })
      );
  }

  async function getNotifications(
    userId
  ) {
    const list =
      await getCollection(
        "notifications"
      );

    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    return list
      .filter(
        n =>
          String(
            n.userId
          ) ===
            u.uid &&
          !n.readAt
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt ||
            0
          ) -
          new Date(
            a.createdAt ||
            0
          )
      )
      .map(
        n => ({
          ...n,

          notificationId:
            n.notificationId ||
            n.id,

          createdAt:
            cleanTimestamp(
              n.createdAt
            ),

          readAt:
            cleanTimestamp(
              n.readAt
            )
        })
      );
  }

  async function markNotificationRead(
    userId,
    notificationId
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const ref =
      f.doc(
        f.db,
        "notifications",
        String(notificationId)
      );

    const snap =
      await f.getDoc(ref);

    if (
      !snap.exists() ||
      String(
        snap.data().userId
      ) !==
      u.uid
    ) {
      throw makeError(
        "Notification not found."
      );
    }

    await f.updateDoc(
      ref,
      {
        readAt:
          isoNow()
      }
    );

    return {
      success: true
    };
  }

  async function respondReceipt(
    userId,
    orderId,
    received,
    notificationId
  ) {
    const f = await READY;
    const u =
      await currentUser(true);

    if (
      u.uid !==
      String(userId)
    ) {
      throw makeError(
        "Invalid customer account."
      );
    }

    const ref =
      f.doc(
        f.db,
        "orders",
        String(orderId)
      );

    const snap =
      await f.getDoc(ref);

    if (
      !snap.exists() ||
      String(
        snap.data().userId
      ) !==
      u.uid
    ) {
      throw makeError(
        "Order not found."
      );
    }

    const o =
      snap.data();

    if (
      String(
        o.orderStatus
      ) !==
      "Delivered"
    ) {
      throw makeError(
        "The order has not been marked as delivered yet."
      );
    }

    const now =
      isoNow();

    await f.updateDoc(
      ref,
      {
        customerConfirmed:
          !!received,

        confirmedAt:
          received
            ? now
            : "",

        closed:
          !!received
      }
    );

    if (notificationId) {
      try {
        await markNotificationRead(
          u.uid,
          notificationId
        );
      } catch (e) {}
    }

    return {
      success: true,

      received:
        !!received,

      closed:
        !!received,

      contact: {
        phone:
          "09123456789",

        email:
          "Mckenzieramenhouse@gmail.com",

        facebook:
          "Mckenzie Ramen House"
      }
    };
  }

  // ============================================================
  // ADMIN PRODUCTS
  // ============================================================

  async function getAdminProducts() {

    // IMPORTANT:
    // Firestore Rules allow public READ access to products.
    // Therefore we do NOT call requireAdmin() here.
    // Admin authentication remains required for writes.

    const products =
      await getProducts();

    return {
      success: true,
      products
    };
  }

  async function saveProduct(
    data
  ) {
    const f =
      await READY;

    await requireAdmin();

    data =
      data || {};

    const name =
      String(
        data.name || ""
      ).trim();

    const category =
      String(
        data.category || ""
      ).trim();

    const description =
      String(
        data.description || ""
      ).trim();

    const price =
      Number(
        data.price
      );

    if (!name) {
      throw makeError(
        "Product name is required."
      );
    }

    if (!category) {
      throw makeError(
        "Product category is required."
      );
    }

    if (
      !Number.isFinite(
        price
      ) ||
      price < 0
    ) {
      throw makeError(
        "Please enter a valid product price."
      );
    }

    // Direct product-photo upload.
    //
    // The revised Admin page compresses the selected
    // image in the browser and sends the resulting
    // data URL here.
    //
    // This avoids Firebase Storage / Blaze billing.
    let image =
      String(
        data.imageUrl ||
        data.image ||
        ""
      ).trim();

    if (
      image.startsWith(
        "data:"
      )
    ) {

      // Firestore documents have a 1 MiB limit.
      // Keep the image below that limit so the
      // rest of the product document has room.
      const MAX_IMAGE_CHARS =
        820000;

      if (
        image.length >
        MAX_IMAGE_CHARS
      ) {
        throw makeError(
          "The product photo is still too large after compression. Please choose a smaller image."
        );
      }

      if (
        !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(
          image
        )
      ) {
        throw makeError(
          "The product photo must be a JPG, PNG, or WEBP image."
        );
      }
    }

    const id =
      String(
        data.id || ""
      ).trim() ||
      (
        "PROD-" +
        Date.now()
      );

    await f.setDoc(
      f.doc(
        f.db,
        "products",
        id
      ),
      {
        name,
        category,
        price,
        image,
        description,

        available:
          data.available !==
          false,

        bestSeller:
          !!data.bestSeller,

        newProduct:
          !!data.newProduct,

        updatedAt:
          isoNow()
      },
      {
        merge: true
      }
    );

    return {
      success: true,

      productId:
        id,

      products:
        await getProducts()
    };
  }

  async function deleteProduct(
    id
  ) {
    const f =
      await READY;

    await requireAdmin();

    id =
      String(
        id || ""
      ).trim();

    if (!id) {
      throw makeError(
        "Product ID is required."
      );
    }

    await f.deleteDoc(
      f.doc(
        f.db,
        "products",
        id
      )
    );

    return {
      success: true,

      products:
        await getProducts()
    };
  }

  // ============================================================
  // ADMIN ORDERS
  // ============================================================

  async function adminOrders() {
    await requireAdmin();

    const list =
      await getCollection(
        "orders"
      );

    const orders =
      list.map(
        normalizeOrder
      );

    const reviews =
      await getCollection(
        "reviews"
      );

    const notes =
      await getCollection(
        "notifications"
      );

    orders.forEach(
      o => {

        const rs =
          reviews.filter(
            r =>
              String(
                r.orderId
              ) ===
              o.orderId
          );

        const productIds =
          new Set(
            rs.map(
              r =>
                String(
                  r.productId
                )
            )
          );

        o.reviewTotal =
          o.items.length;

        o.reviewedCount =
          o.items.filter(
            i =>
              productIds.has(
                String(
                  i.productId
                )
              )
          ).length;

        o.reviewCompleted =
          o.reviewTotal > 0 &&
          o.reviewedCount >=
            o.reviewTotal;

        o.reviewRequested =
          notes.some(
            n =>
              String(
                n.orderId
              ) ===
                o.orderId &&
              n.type ===
                "REVIEW_REQUEST"
          );
      }
    );

    return {
      success: true,

      orders:
        orders.sort(
          (a, b) =>
            String(
              b.orderedAt
            ).localeCompare(
              String(
                a.orderedAt
              )
            )
        )
    };
  }

  async function updateOrderItemStatus(
    orderId,
    index,
    status
  ) {
    const f =
      await READY;

    await requireAdmin();

    const ref =
      f.doc(
        f.db,
        "orders",
        String(orderId)
      );

    const snap =
      await f.getDoc(ref);

    if (
      !snap.exists()
    ) {
      throw makeError(
        "Order not found."
      );
    }

    const o =
      snap.data();

    if (
      o.orderStatus ===
        "Delivered" ||
      o.closed
    ) {
      throw makeError(
        "This order is already closed and can no longer be changed."
      );
    }

    const items =
      Array.isArray(
        o.items
      )
        ? o.items.map(
            x => ({
              ...x
            })
          )
        : [];

    const i =
      Number(index);

    if (!items[i]) {
      throw makeError(
        "Order item not found."
      );
    }

    const current =
      String(
        items[i].itemStatus ||
        "Preparing"
      );

    if (
      current ===
        "Ready" &&
      String(status) !==
        "Ready"
    ) {
      return {
        success: true,
        order:
          normalizeOrder(o)
      };
    }

    items[i].itemStatus =
      String(status) ===
      "Ready"
        ? "Ready"
        : "Preparing";

    await f.updateDoc(
      ref,
      {
        items,

        updatedAt:
          isoNow()
      }
    );

    const fresh =
      (
        await f.getDoc(
          ref
        )
      ).data();

    return {
      success: true,

      order:
        normalizeOrder(
          fresh
        )
    };
  }

  async function updateOrderStatus(
    orderId,
    status
  ) {
    const f =
      await READY;

    await requireAdmin();

    const ref =
      f.doc(
        f.db,
        "orders",
        String(orderId)
      );

    const snap =
      await f.getDoc(ref);

    if (
      !snap.exists()
    ) {
      throw makeError(
        "Order not found."
      );
    }

    const o =
      snap.data();

    const current =
      o.orderStatus ===
      "Pending"
        ? "Preparing"
        : (
            o.orderStatus ||
            "Preparing"
          );

    if (
      current ===
        "Delivered" ||
      o.closed
    ) {
      throw makeError(
        "This order is already closed and can no longer be changed."
      );
    }

    let next =
      String(
        status || ""
      );

    if (
      next ===
      "Ready"
    ) {

      if (
        current !==
        "Preparing"
      ) {
        throw makeError(
          "Order must be in Preparing before it can be marked Ready."
        );
      }

      if (
        !Array.isArray(
          o.items
        ) ||
        !o.items.length ||
        !o.items.every(
          i =>
            String(
              i.itemStatus ||
              "Preparing"
            ) ===
            "Ready"
        )
      ) {
        throw makeError(
          "All menu items must be Ready before the order can be moved On the Way."
        );
      }

      next =
        "On the Way";

    } else if (
      next ===
        "On the Way" &&
      current !==
        "Ready"
    ) {

      throw makeError(
        "Order must be Ready before it can be moved On the Way."
      );

    } else if (
      next ===
        "Delivered" &&
      current !==
        "On the Way"
    ) {

      throw makeError(
        "Order must be On the Way before it can be marked Delivered."
      );
    }

    const patch = {
      orderStatus:
        next,

      updatedAt:
        isoNow()
    };

    if (
      next ===
      "Delivered"
    ) {

      patch.deliveredAt =
        isoNow();

      patch.customerConfirmed =
        false;

      patch.closed =
        false;
    }

    await f.updateDoc(
      ref,
      patch
    );

    if (
      next ===
        "Delivered" &&
      o.userId
    ) {

      const nid =
        "NTF-" +
        Date.now() +
        "-" +
        Math.floor(
          Math.random() *
          10000
        );

      await f.setDoc(
        f.doc(
          f.db,
          "notifications",
          nid
        ),
        {
          notificationId:
            nid,

          userId:
            o.userId,

          orderId:
            String(
              orderId
            ),

          type:
            "RECEIPT_CONFIRMATION",

          title:
            "🍜 Did you receive your food?",

          message:
            "Your McKenzie Ramen House order was marked as Delivered. Did you receive your food?",

          createdAt:
            isoNow(),

          readAt:
            ""
        }
      );
    }

    return {
      success: true,

      order:
        normalizeOrder(
          (
            await f.getDoc(
              ref
            )
          ).data()
        )
    };
  }

  // ============================================================
  // ADMIN REVIEWS
  // ============================================================

  async function adminReviews() {
    await requireAdmin();

    const reviews =
      await getCollection(
        "reviews"
      );

    const published =
      reviews.filter(
        r =>
          String(
            r.status ||
            "Published"
          ).toLowerCase() ===
          "published"
      );

    const avg =
      published.length
        ? published.reduce(
            (s, r) =>
              s +
              Number(
                r.rating ||
                0
              ),
            0
          ) /
          published.length
        : 0;

    return {
      success: true,

      reviews:
        reviews
          .sort(
            (a, b) =>
              String(
                b.submittedAt ||
                ""
              ).localeCompare(
                String(
                  a.submittedAt ||
                  ""
                )
              )
          )
          .map(
            r => ({
              reviewId:
                r.reviewId ||
                r.id,

              orderId:
                r.orderId,

              customerId:
                r.customerId,

              productId:
                r.productId,

              productName:
                r.productName,

              rating:
                r.rating,

              review:
                r.review,

              customerName:
                r.customerName,

              submittedAt:
                cleanTimestamp(
                  r.submittedAt
                ),

              status:
                r.status ||
                "Published"
            })
          ),

      stats: {
        total:
          reviews.length,

        published:
          published.length,

        hidden:
          reviews.length -
          published.length,

        average:
          Math.round(
            avg * 10
          ) / 10
      }
    };
  }

  async function updateReviewStatus(
    id,
    status
  ) {
    const f =
      await READY;

    await requireAdmin();

    if (
      ![
        "Published",
        "Hidden"
      ].includes(
        String(status)
      )
    ) {
      throw makeError(
        "Invalid review status."
      );
    }

    const ref =
      f.doc(
        f.db,
        "reviews",
        String(id)
      );

    const snap =
      await f.getDoc(ref);

    if (
      !snap.exists()
    ) {
      throw makeError(
        "Review not found."
      );
    }

    await f.updateDoc(
      ref,
      {
        status:
          String(status)
      }
    );

    return {
      success: true,

      status:
        String(status)
    };
  }

  async function notifyCustomerReview(
    orderId,
    forceResend
  ) {
    const f =
      await READY;

    await requireAdmin();

    const orderSnap =
      await f.getDoc(
        f.doc(
          f.db,
          "orders",
          String(orderId)
        )
      );

    if (
      !orderSnap.exists()
    ) {
      throw makeError(
        "Order not found."
      );
    }

    const order =
      orderSnap.data();

    if (
      order.orderStatus !==
      "Delivered"
    ) {
      throw makeError(
        "The customer can only be notified after the order is Delivered."
      );
    }

    if (
      !order.customerConfirmed
    ) {
      throw makeError(
        "Wait for the customer to confirm that the order was received before sending the review request."
      );
    }

    const reviews =
      await getCollection(
        "reviews"
      );

    const complete =
      (
        Array.isArray(
          order.items
        )
          ? order.items
          : []
      ).every(
        item =>
          reviews.some(
            r =>
              String(
                r.orderId
              ) ===
                String(
                  orderId
                ) &&
              String(
                r.productId
              ) ===
                String(
                  item.productId
                )
          )
      );

    if (complete) {
      return {
        success: true,
        sent: false,
        completed: true,
        message:
          "Customer has already reviewed this order."
      };
    }

    const notes =
      await getCollection(
        "notifications"
      );

    const existing =
      notes.find(
        n =>
          String(
            n.orderId
          ) ===
            String(
              orderId
            ) &&
          n.type ===
            "REVIEW_REQUEST" &&
          !n.readAt
      );

    if (
      existing &&
      !forceResend
    ) {
      return {
        success: true,
        sent: false,
        alreadyNotified:
          true,
        notificationId:
          existing.notificationId ||
          existing.id,
        message:
          "Review notification is already waiting for the customer."
      };
    }

    if (
      forceResend &&
      existing
    ) {
      await f.updateDoc(
        f.doc(
          f.db,
          "notifications",
          existing.id
        ),
        {
          readAt:
            isoNow()
        }
      );
    }

    const nid =
      "NTF-" +
      Date.now() +
      "-" +
      Math.floor(
        Math.random() *
        10000
      );

    await f.setDoc(
      f.doc(
        f.db,
        "notifications",
        nid
      ),
      {
        notificationId:
          nid,

        userId:
          String(
            order.userId
          ),

        orderId:
          String(
            orderId
          ),

        type:
          "REVIEW_REQUEST",

        title:
          "🍜 Your ramen review is ready!",

        message:
          "Your order has been delivered. Please share your rating and review for the menu items you received.",

        createdAt:
          isoNow(),

        readAt:
          ""
      }
    );

    return {
      success: true,
      sent: true,
      resent:
        !!forceResend,
      notificationId:
        nid,
      message:
        forceResend
          ? "Review resent to the customer."
          : "Review notification sent to the customer."
    };
  }

  // ============================================================
  // PHILIPPINE ADDRESS API
  // ============================================================

  async function psgc(
    url
  ) {
    const r =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!r.ok) {
      throw makeError(
        "Unable to load Philippine location data."
      );
    }

    return r.json();
  }

  // ============================================================
  // DISPATCH
  // ============================================================

  async function dispatch(
    name,
    args
  ) {
    args =
      args || [];

    switch (name) {

      case "loginUser":
        return loginUser(
          args[0],
          args[1]
        );

      case "requestEmailVerification":
        return createAccount(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4]
        );

      case "verifyEmailCode":
        return verifyEmailCode(
          args[0],
          args[1]
        );

      case "getUserProfile":
        return getProfile(
          args[0]
        );

      case "updateUserProfile":
        return saveProfile(
          args[0]
        );

      case "getCheckoutCustomerById":
        return getProfile(
          args[0]
        );

      case "getCustomerAddresses":
        return addresses(
          args[0]
        );

      case "saveCustomerAddress":
        return saveAddress(
          args[0]
        );

      case "setDefaultCustomerAddress":
        return setDefaultAddress(
          args[0],
          args[1]
        );

      case "getProducts":
        return getProducts();

      case "getBrandAssets":
        return getBrandAssets();

      case "getRamenLoadingImage":
        return getRamenLoadingImage();

      case "recordCompletedCustomerOrder":
        return saveOrder(
          args[0],
          args[1]
        );

      case "recordOrder":
        return saveOrder(
          args[0],
          args[1]
        );

      case "getCustomerOrderHistory":
        return getOrdersForUser(
          args[0]
        );

      case "getCustomerPaymentHistory":
        return (
          await getOrdersForUser(
            args[0]
          )
        ).map(
          o => ({
            orderId:
              o.orderId,
            total:
              o.total,
            paymentMethod:
              o.paymentMethod,
            paymentStatus:
              o.paymentStatus,
            orderStatus:
              o.orderStatus,
            orderedAt:
              o.orderedAt
          })
        );

      case "confirmCustomerOrderReceived":
        return respondReceipt(
          args[0],
          args[1],
          true,
          ""
        );

      case "respondCustomerReceipt":
        return respondReceipt(
          args[0],
          args[1],
          String(
            args[2]
          ).toLowerCase() ===
            "true",
          args[3]
        );

      case "getCustomerReviewForm":
        return getReviewForm(
          args[0],
          args[1]
        );

      case "submitCustomerReview":
        return submitReview(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4]
        );

      case "getPublishedReviews":
        return getPublishedReviews();

      case "getCustomerNotifications":
        return getNotifications(
          args[0]
        );

      case "markCustomerNotificationRead":
        return markNotificationRead(
          args[0],
          args[1]
        );

      case "requestPasswordResetOtp":
        return sendPasswordReset(
          args[0]
        );

      case "requestPasswordResetOtpForUser": {
        const p =
          await getProfile(
            args[0]
          );

        return sendPasswordReset(
          p.email
        );
      }

      case "resetPasswordWithOtp":
        throw makeError(
          "Please use the password-reset link sent to your email."
        );

      case "changePassword":
        return changePassword(
          args[0],
          args[1],
          args[2]
        );

      case "getAddressRegions":
        return psgc(
          "https://psgc.cloud/api/regions"
        );

      case "getAddressProvinces":
        return psgc(
          "https://psgc.cloud/api/regions/" +
          encodeURIComponent(
            args[0]
          ) +
          "/provinces"
        );

      case "getAddressCities":
        return psgc(
          "https://psgc.cloud/api/provinces/" +
          encodeURIComponent(
            args[0]
          ) +
          "/cities-municipalities"
        );

      case "getAddressBarangays":
        return psgc(
          "https://psgc.cloud/api/cities-municipalities/" +
          encodeURIComponent(
            args[0]
          ) +
          "/barangays"
        );

      case "adminLogin": {
        const f =
          await READY;

        const cred =
          await f.signInWithEmailAndPassword(
            f.auth,
            String(
              args[0] || ""
            )
              .trim()
              .toLowerCase(),
            String(
              args[1] || ""
            )
          );

        if (
          !(await isAdmin())
        ) {

          await f.signOut(
            f.auth
          );

          throw makeError(
            "This Firebase account is not configured as the McKenzie admin."
          );
        }

        return {
          success: true,

          token:
            await cred.user
              .getIdToken(),

          email:
            cred.user.email
        };
      }

      case "adminGetProducts":
        return getAdminProducts();

      case "adminSaveProduct":
        return saveProduct(
          args[0]
        );

      case "adminDeleteProduct":
        return deleteProduct(
          args[1]
        );

      case "adminGetOrders":
        return adminOrders();

      case "adminUpdateOrderItemStatus":
        return updateOrderItemStatus(
          args[1],
          args[2],
          args[3]
        );

      case "adminUpdateOrderStatus":
        return updateOrderStatus(
          args[1],
          args[2]
        );

      case "adminGetReviews":
        return adminReviews();

      case "adminUpdateReviewStatus":
        return updateReviewStatus(
          args[1],
          args[2]
        );

      case "adminNotifyCustomerReview":
        return notifyCustomerReview(
          args[1],
          args[2]
        );

      default:
        throw makeError(
          "Standalone backend function not implemented: " +
          name
        );
    }
  }

  // ============================================================
  // GOOGLE SCRIPT RUN COMPATIBILITY
  // ============================================================

  const runner = {
    _success:
      null,

    _failure:
      null,

    withSuccessHandler(fn) {
      this._success =
        fn;

      return this;
    },

    withFailureHandler(fn) {
      this._failure =
        fn;

      return this;
    }
  };

  window.google =
    window.google ||
    {};

  window.google.script =
    window.google.script ||
    {};

  window.google.script.run =
    new Proxy(
      runner,
      {
        get(
          target,
          prop
        ) {

          if (
            prop in target
          ) {
            return target[
              prop
            ];
          }

          return function () {

            const args =
              Array.from(
                arguments
              );

            const ok =
              target._success;

            const fail =
              target._failure;

            target._success =
              null;

            target._failure =
              null;

            READY
              .then(
                () =>
                  dispatch(
                    String(
                      prop
                    ),
                    args
                  )
              )
              .then(
                v => {
                  if (ok) {
                    ok(v);
                  }
                }
              )
              .catch(
                e => {

                  console.error(
                    "McKenzie Firebase function error:",
                    prop,
                    e
                  );

                  if (fail) {
                    fail(e);
                  }
                }
              );

            return target;
          };
        }
      }
    );

  window.dispatchEvent(
    new Event(
      "mckenzie-firebase-ready"
    )
  );

})();
