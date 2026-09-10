/*
  McKenzie Ramen House — STANDALONE Firebase bridge
  --------------------------------------------------
  Firebase backend for the GitHub Pages customer/admin website.

  This file keeps compatibility with the existing
  google.script.run calls used by the original UI.

  IMPORTANT:
  - Uses the official Firebase Console configuration.
  - Does NOT use the old Google Apps Script backend.
  - Products are publicly readable, matching Firestore Rules.
  - Admin-only operations still require the configured admin UID.
*/

(function () {
  "use strict";

  // ============================================================
  // OFFICIAL FIREBASE CONFIG
  // ============================================================

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDnLMhAhkAw1JMlbTxN4u8vB6poip5dt94",
    authDomain: "mckenzie-ramen-house.firebaseapp.com",
    projectId: "mckenzie-ramen-house",
    storageBucket: "mckenzie-ramen-house.firebasestorage.app",
    messagingSenderId: "1048288418639",
    appId: "1:1048288418639:web:85e0148036179259c8033a",
    measurementId: "G-C2KDRE88ZW"
  };

  const ADMIN_UID =
    "OHDs2DV4jyO3eBrww8d0gUQkNli2";

  // Always use the verified project configuration.
  window.MCKENZIE_FIREBASE_CONFIG =
    FIREBASE_CONFIG;

  window.MCKENZIE_ADMIN_UID =
    ADMIN_UID;


  // ============================================================
  // FIREBASE INITIALIZATION
  // ============================================================

  const READY = (async function () {
    try {
      const [
        appMod,
        authMod,
        fsMod
      ] = await Promise.all([
        import(
          "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"
        ),

        import(
          "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"
        ),

        import(
          "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"
        )
      ]);

      const app =
        appMod.initializeApp(
          FIREBASE_CONFIG,
          "mckenzie-ramen-house"
        );

      const auth =
        authMod.getAuth(app);

      const db =
        fsMod.getFirestore(app);

      console.log(
        "McKenzie Ramen House Firebase initialized.",
        {
          projectId:
            FIREBASE_CONFIG.projectId,
          authDomain:
            FIREBASE_CONFIG.authDomain
        }
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


  window.MckenzieFirebaseReady =
    READY;


  // ============================================================
  // HELPERS
  // ============================================================

  function makeError(message) {
    const error =
      new Error(
        String(
          message ||
          "Firebase request failed."
        )
      );

    return error;
  }


  function isoNow() {
    return new Date().toISOString();
  }


  async function currentUser(
    required
  ) {

    const firebase =
      await READY;

    const user =
      firebase.auth.currentUser;

    if (user) {
      return user;
    }

    if (!required) {
      return null;
    }

    throw makeError(
      "Please log in again."
    );
  }


  async function isAdmin() {

    const firebase =
      await READY;

    const user =
      firebase.auth.currentUser;

    if (!user) {
      return false;
    }

    return (
      user.uid ===
      ADMIN_UID
    );
  }


  async function requireAdmin() {

    const admin =
      await isAdmin();

    if (!admin) {
      throw makeError(
        "Admin access is not configured for this account."
      );
    }

    return true;
  }


  function cleanTimestamp(value) {

    if (!value) {
      return "";
    }

    if (
      typeof value ===
      "string"
    ) {
      return value;
    }

    if (
      value &&
      typeof value.toDate ===
        "function"
    ) {
      return value
        .toDate()
        .toISOString();
    }

    if (
      value instanceof Date
    ) {
      return value.toISOString();
    }

    return String(value);
  }


  function docData(snapshot) {

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }


  async function getDocById(
    collectionName,
    id
  ) {

    const firebase =
      await READY;

    const reference =
      firebase.doc(
        firebase.db,
        collectionName,
        String(id)
      );

    const snapshot =
      await firebase.getDoc(
        reference
      );

    return docData(snapshot);
  }


  async function getCollection(
    collectionName,
    queryConstraint
  ) {

    const firebase =
      await READY;

    const reference =
      firebase.collection(
        firebase.db,
        collectionName
      );

    let snapshot;

    if (queryConstraint) {

      snapshot =
        await firebase.getDocs(
          firebase.query(
            reference,
            queryConstraint
          )
        );

    } else {

      snapshot =
        await firebase.getDocs(
          reference
        );
    }

    return snapshot.docs.map(
      document => ({
        id: document.id,
        ...document.data()
      })
    );
  }


  // ============================================================
  // USER PROFILE
  // ============================================================

  function profileFromUser(
    user,
    data
  ) {

    const profile =
      data || {};

    return {

      success: true,

      userId:
        user.uid,

      username:
        profile.username ||
        "",

      email:
        user.email ||
        profile.email ||
        "",

      mobile:
        profile.mobile ||
        "",

      fullName:
        profile.fullName ||
        user.displayName ||
        "",

      houseUnit:
        profile.houseUnit ||
        "",

      street:
        profile.street ||
        "",

      barangay:
        profile.barangay ||
        "",

      city:
        profile.city ||
        "",

      province:
        profile.province ||
        "",

      postalCode:
        profile.postalCode ||
        "",

      country:
        profile.country ||
        "Philippines",

      region:
        profile.region ||
        "",

      additionalInstruction:
        profile.additionalInstruction ||
        ""
    };
  }


  async function getProfile(
    userId
  ) {

    const user =
      await currentUser(true);

    if (
      String(userId) !==
      String(user.uid)
    ) {

      throw makeError(
        "You can only access your own profile."
      );
    }

    const profile =
      await getDocById(
        "users",
        user.uid
      );

    return profileFromUser(
      user,
      profile || {}
    );
  }


  async function saveProfile(
    data
  ) {

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    data =
      data || {};

    if (
      String(
        data.userId || ""
      ) !==
      String(user.uid)
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
        user.email ||
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

    await firebase.setDoc(
      firebase.doc(
        firebase.db,
        "users",
        user.uid
      ),
      {

        username:
          data.username ||
          "",

        email,

        fullName,

        mobile,

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

        region:
          String(
            data.region ||
            ""
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
      user.uid
    );
  }


  // ============================================================
  // AUTHENTICATION
  // ============================================================

  async function loginUser(
    identifier,
    password
  ) {

    const firebase =
      await READY;

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

    const credential =
      await firebase
        .signInWithEmailAndPassword(
          firebase.auth,
          identifier,
          password
        );

    const profile =
      await getDocById(
        "users",
        credential.user.uid
      );

    return profileFromUser(
      credential.user,
      profile || {}
    );
  }


  async function createAccount(
    fullName,
    email,
    username,
    password,
    mobile
  ) {

    const firebase =
      await READY;

    const credential =
      await firebase
        .createUserWithEmailAndPassword(
          firebase.auth,
          String(email)
            .trim()
            .toLowerCase(),
          String(password)
        );

    await firebase.setDoc(
      firebase.doc(
        firebase.db,
        "users",
        credential.user.uid
      ),
      {

        username:
          String(
            username || ""
          ).trim(),

        email:
          credential.user.email ||
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

      await firebase
        .sendEmailVerification(
          credential.user
        );

    } catch (error) {

      console.warn(
        "Verification email could not be sent:",
        error
      );
    }

    return {

      success: true,

      message:
        "Account created. Please verify your email, then log in.",

      verificationToken:
        credential.user.uid,

      email:
        credential.user.email ||
        email,

      expiresInSeconds:
        600
    };
  }


  async function verifyEmailCode(
    token,
    code
  ) {

    const firebase =
      await READY;

    await currentUser(true);

    await firebase.auth.currentUser.reload();

    if (
      !firebase.auth
        .currentUser
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

    const firebase =
      await READY;

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

    await firebase
      .sendPasswordResetEmail(
        firebase.auth,
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

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    if (
      user.uid !==
      String(userId)
    ) {

      throw makeError(
        "Invalid customer account."
      );
    }

    if (
      !newPassword ||
      String(newPassword)
        .length < 6
    ) {

      throw makeError(
        "Password must be at least 6 characters."
      );
    }

    if (!user.email) {

      throw makeError(
        "Your account has no email address."
      );
    }

    const credential =
      firebase.EmailAuthProvider
        .credential(
          user.email,
          String(
            oldPassword || ""
          )
        );

    await firebase
      .reauthenticateWithCredential(
        user,
        credential
      );

    await firebase
      .updatePassword(
        user,
        String(newPassword)
      );

    return {
      success: true
    };
  }


  // ============================================================
  // ADDRESSES
  // ============================================================

  async function addresses(
    userId
  ) {

    const user =
      await currentUser(true);

    if (
      user.uid !==
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
        address =>
          String(
            address.userId
          ) ===
          String(user.uid)
      )
      .sort(
        (a, b) =>
          Number(
            !!b.isDefault
          ) -
          Number(
            !!a.isDefault
          )
      )
      .map(
        address => ({

          addressId:
            address.id,

          userId:
            address.userId,

          label:
            address.label ||
            "Saved Address",

          houseUnit:
            address.houseUnit ||
            "",

          street:
            address.street ||
            "",

          barangay:
            address.barangay ||
            "",

          city:
            address.city ||
            "",

          province:
            address.province ||
            "",

          region:
            address.region ||
            "",

          postalCode:
            address.postalCode ||
            "",

          country:
            address.country ||
            "Philippines",

          additionalInstruction:
            address.additionalInstruction ||
            "",

          isDefault:
            !!address.isDefault,

          createdAt:
            cleanTimestamp(
              address.createdAt
            ),

          updatedAt:
            cleanTimestamp(
              address.updatedAt
            )
        })
      );
  }


  async function saveAddress(
    data
  ) {

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    data =
      data || {};

    if (
      String(
        data.userId || ""
      ) !==
      String(user.uid)
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
      const [
        key,
        label
      ] of required
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

    const existing =
      await addresses(
        user.uid
      );

    const id =
      String(
        data.addressId || ""
      ).trim() ||
      (
        "ADDR-" +
        Date.now() +
        "-" +
        Math.floor(
          Math.random() *
          10000
        )
      );

    if (
      data.isDefault !== false
    ) {

      for (
        const address of existing
      ) {

        if (
          address.isDefault
        ) {

          await firebase.updateDoc(
            firebase.doc(
              firebase.db,
              "addresses",
              address.addressId
            ),
            {
              isDefault:
                false,

              updatedAt:
                isoNow()
            }
          );
        }
      }
    }

    await firebase.setDoc(
      firebase.doc(
        firebase.db,
        "addresses",
        id
      ),
      {

        userId:
          user.uid,

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

    return addresses(
      user.uid
    );
  }


  async function setDefaultAddress(
    userId,
    addressId
  ) {

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    if (
      user.uid !==
      String(userId)
    ) {

      throw makeError(
        "Invalid customer account."
      );
    }

    const list =
      await addresses(
        user.uid
      );

    const selected =
      list.find(
        address =>
          address.addressId ===
          String(addressId)
      );

    if (!selected) {

      throw makeError(
        "Address not found."
      );
    }

    for (
      const address of list
    ) {

      await firebase.updateDoc(
        firebase.doc(
          firebase.db,
          "addresses",
          address.addressId
        ),
        {

          isDefault:
            address.addressId ===
            selected.addressId,

          updatedAt:
            isoNow()
        }
      );
    }

    return addresses(
      user.uid
    );
  }


  // ============================================================
  // PRODUCTS
  // ============================================================

  async function getProducts() {

    // IMPORTANT:
    // Products are publicly readable according to Firestore Rules.
    // Do NOT require admin authentication here.

    const list =
      await getCollection(
        "products"
      );

    return list
      .filter(
        product =>
          product.name
      )
      .map(
        product => ({

          id:
            product.id,

          name:
            product.name,

          category:
            product.category ||
            "Ramen",

          price:
            Number(
              product.price || 0
            ),

          image:
            product.image ||
            "",

          description:
            product.description ||
            "",

          available:
            product.available !==
            false,

          bestSeller:
            !!product.bestSeller,

          newProduct:
            !!product.newProduct
        })
      );
  }


  async function getBrandAssets() {

    const assets =
      await getDocById(
        "brandAssets",
        "main"
      );

    return assets || {};
  }


  async function getRamenLoadingImage() {

    const assets =
      await getBrandAssets();

    return (
      assets.ramenLoadingImage ||
      ""
    );
  }


  // ============================================================
  // ORDERS
  // ============================================================

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
        value =>
          String(
            value || ""
          ).trim()
      )
      .filter(Boolean)
      .join(", ");
  }


  async function saveOrder(
    orderId,
    payload
  ) {

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    payload =
      payload || {};

    if (
      String(
        payload.userId || ""
      ) !==
      String(user.uid)
    ) {

      throw makeError(
        "Please log in again."
      );
    }

    const items =
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
              item =>
                item.quantity > 0
            )
        : [];

    if (!items.length) {

      throw makeError(
        "The order contains no items."
      );
    }

    const total =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.subtotal,
        0
      );

    const reference =
      firebase.doc(
        firebase.db,
        "orders",
        String(orderId)
      );

    const existing =
      await firebase.getDoc(
        reference
      );

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

    await firebase.setDoc(
      reference,
      {

        orderId:
          String(orderId),

        userId:
          user.uid,

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
          user.email ||
          "",

        mobile:
          String(
            payload.mobile ||
            ""
          ),

        items,

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


  function normalizeOrder(
    order
  ) {

    if (!order) {
      return null;
    }

    return {

      orderId:
        String(
          order.orderId ||
          order.id ||
          ""
        ),

      userId:
        String(
          order.userId ||
          ""
        ),

      customerName:
        order.customerName ||
        order.fullName ||
        "Customer",

      fullName:
        order.fullName ||
        order.customerName ||
        "Customer",

      email:
        order.email ||
        "",

      mobile:
        order.mobile ||
        "",

      items:
        Array.isArray(
          order.items
        )
          ? order.items.map(
              (
                item,
                index
              ) => ({

                itemIndex:
                  index,

                productId:
                  String(
                    item.productId ||
                    item.id ||
                    ""
                  ),

                productName:
                  item.productName ||
                  item.name ||
                  "Ramen item",

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
                  String(
                    item.itemStatus ||
                    "Preparing"
                  )
              })
            )
          : [],

      total:
        Number(
          order.total || 0
        ),

      paymentMethod:
        order.paymentMethod ||
        "",

      paymentStatus:
        order.paymentStatus ||
        "Pending",

      orderStatus:
        order.orderStatus ===
        "Pending"
          ? "Preparing"
          : (
              order.orderStatus ||
              "Preparing"
            ),

      address:
        order.address ||
        "",

      instruction:
        order.instruction ||
        order.additionalInstruction ||
        "",

      orderedAt:
        cleanTimestamp(
          order.orderedAt
        ),

      customerConfirmed:
        !!order.customerConfirmed,

      confirmedAt:
        cleanTimestamp(
          order.confirmedAt
        ),

      deliveredAt:
        cleanTimestamp(
          order.deliveredAt
        ),

      closed:
        !!order.closed,

      canRate:
        order.orderStatus ===
          "Delivered" &&
        !!order.customerConfirmed
    };
  }


  async function getOrdersForUser(
    userId
  ) {

    const user =
      await currentUser(true);

    if (
      user.uid !==
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
        order =>
          String(
            order.userId
          ) ===
          String(user.uid)
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


  // ============================================================
  // REVIEWS
  // ============================================================

  async function getReviewsForOrder(
    orderId,
    userId
  ) {

    const list =
      await getCollection(
        "reviews"
      );

    return list.filter(
      review =>
        String(
          review.orderId
        ) ===
          String(orderId) &&
        String(
          review.customerId ||
          review.userId
        ) ===
          String(userId)
    );
  }


  async function getReviewForm(
    userId,
    orderId
  ) {

    const user =
      await currentUser(true);

    if (
      user.uid !==
      String(userId)
    ) {

      throw makeError(
        "Invalid customer account."
      );
    }

    const orders =
      await getOrdersForUser(
        user.uid
      );

    const order =
      orders.find(
        item =>
          item.orderId ===
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
        user.uid
      );

    const reviewed =
      {};

    reviews.forEach(
      review => {

        reviewed[
          String(
            review.productId
          )
        ] = review;

      }
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
              !!reviewed[
                item.productId
              ],

            existingRating:
              reviewed[
                item.productId
              ]?.rating || 0,

            existingReview:
              reviewed[
                item.productId
              ]?.review || ""
          })
        ),

      completed:
        order.items.every(
          item =>
            !!reviewed[
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

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    if (
      user.uid !==
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
        user.uid,
        orderId
      );

    const item =
      form.items.find(
        current =>
          String(
            current.productId
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

    await firebase.setDoc(
      firebase.doc(
        firebase.db,
        "reviews",
        id
      ),
      {

        reviewId:
          id,

        orderId:
          String(orderId),

        customerId:
          user.uid,

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
        review =>
          String(
            review.status ||
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
        review => ({

          reviewId:
            review.reviewId ||
            review.id,

          orderId:
            review.orderId,

          productId:
            review.productId,

          productName:
            review.productName,

          rating:
            review.rating,

          review:
            review.review,

          customerName:
            review.customerName,

          submittedAt:
            cleanTimestamp(
              review.submittedAt
            )
        })
      );
  }


  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  async function getNotifications(
    userId
  ) {

    const user =
      await currentUser(true);

    if (
      user.uid !==
      String(userId)
    ) {

      throw makeError(
        "Invalid customer account."
      );
    }

    const list =
      await getCollection(
        "notifications"
      );

    return list
      .filter(
        notification =>
          String(
            notification.userId
          ) ===
            String(user.uid) &&
          !notification.readAt
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
        notification => ({

          ...notification,

          notificationId:
            notification.notificationId ||
            notification.id,

          createdAt:
            cleanTimestamp(
              notification.createdAt
            ),

          readAt:
            cleanTimestamp(
              notification.readAt
            )
        })
      );
  }


  async function markNotificationRead(
    userId,
    notificationId
  ) {

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    if (
      user.uid !==
      String(userId)
    ) {

      throw makeError(
        "Invalid customer account."
      );
    }

    const reference =
      firebase.doc(
        firebase.db,
        "notifications",
        String(notificationId)
      );

    const snapshot =
      await firebase.getDoc(
        reference
      );

    if (
      !snapshot.exists()
    ) {

      throw makeError(
        "Notification not found."
      );
    }

    if (
      String(
        snapshot.data().userId
      ) !==
      String(user.uid)
    ) {

      throw makeError(
        "Notification not found."
      );
    }

    await firebase.updateDoc(
      reference,
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

    const firebase =
      await READY;

    const user =
      await currentUser(true);

    if (
      user.uid !==
      String(userId)
    ) {

      throw makeError(
        "Invalid customer account."
      );
    }

    const reference =
      firebase.doc(
        firebase.db,
        "orders",
        String(orderId)
      );

    const snapshot =
      await firebase.getDoc(
        reference
      );

    if (
      !snapshot.exists() ||
      String(
        snapshot.data().userId
      ) !==
      String(user.uid)
    ) {

      throw makeError(
        "Order not found."
      );
    }

    const order =
      snapshot.data();

    if (
      order.orderStatus !==
      "Delivered"
    ) {

      throw makeError(
        "The order has not been marked as delivered yet."
      );
    }

    const now =
      isoNow();

    await firebase.updateDoc(
      reference,
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
          user.uid,
          notificationId
        );

      } catch (error) {}
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
  // ADMIN — PRODUCTS
  // ============================================================

  async function adminGetProducts() {

    // Products are publicly readable.
    // Admin authentication is NOT needed just to read them.

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

    const firebase =
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
        data.description ||
        ""
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

    const image =
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

      throw makeError(
        "This standalone version uses an image URL. Upload the image to the GitHub images folder, then paste its URL here."
      );
    }

    const id =
      String(
        data.id || ""
      ).trim() ||
      (
        "PROD-" +
        Date.now()
      );

    await firebase.setDoc(
      firebase.doc(
        firebase.db,
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

    const firebase =
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

    await firebase.deleteDoc(
      firebase.doc(
        firebase.db,
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
  // ADMIN — ORDERS
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

    const notifications =
      await getCollection(
        "notifications"
      );

    orders.forEach(
      order => {

        const orderReviews =
          reviews.filter(
            review =>
              String(
                review.orderId
              ) ===
              String(
                order.orderId
              )
          );

        const productIds =
          new Set(
            orderReviews.map(
              review =>
                String(
                  review.productId
                )
            )
          );

        order.reviewTotal =
          order.items.length;

        order.reviewedCount =
          order.items.filter(
            item =>
              productIds.has(
                String(
                  item.productId
                )
              )
          ).length;

        order.reviewCompleted =
          order.reviewTotal > 0 &&
          order.reviewedCount >=
            order.reviewTotal;

        order.reviewRequested =
          notifications.some(
            notification =>
              String(
                notification.orderId
              ) ===
                String(
                  order.orderId
                ) &&
              notification.type ===
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

    const firebase =
      await READY;

    await requireAdmin();

    const reference =
      firebase.doc(
        firebase.db,
        "orders",
        String(orderId)
      );

    const snapshot =
      await firebase.getDoc(
        reference
      );

    if (
      !snapshot.exists()
    ) {

      throw makeError(
        "Order not found."
      );
    }

    const order =
      snapshot.data();

    if (
      order.orderStatus ===
        "Delivered" ||
      order.closed
    ) {

      throw makeError(
        "This order is already closed and can no longer be changed."
      );
    }

    const items =
      Array.isArray(
        order.items
      )
        ? order.items.map(
            item => ({
              ...item
            })
          )
        : [];

    const itemIndex =
      Number(index);

    if (!items[itemIndex]) {

      throw makeError(
        "Order item not found."
      );
    }

    items[
      itemIndex
    ].itemStatus =
      String(status) ===
      "Ready"
        ? "Ready"
        : "Preparing";

    await firebase.updateDoc(
      reference,
      {

        items,

        updatedAt:
          isoNow()
      }
    );

    const fresh =
      await firebase.getDoc(
        reference
      );

    return {

      success: true,

      order:
        normalizeOrder(
          fresh.data()
        )
    };
  }


  async function updateOrderStatus(
    orderId,
    status
  ) {

    const firebase =
      await READY;

    await requireAdmin();

    const reference =
      firebase.doc(
        firebase.db,
        "orders",
        String(orderId)
      );

    const snapshot =
      await firebase.getDoc(
        reference
      );

    if (
      !snapshot.exists()
    ) {

      throw makeError(
        "Order not found."
      );
    }

    const order =
      snapshot.data();

    const current =
      order.orderStatus ===
      "Pending"
        ? "Preparing"
        : (
            order.orderStatus ||
            "Preparing"
          );

    if (
      current ===
        "Delivered" ||
      order.closed
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
          order.items
        ) ||
        !order.items.length ||
        !order.items.every(
          item =>
            String(
              item.itemStatus ||
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
    }

    else if (
      next ===
        "On the Way" &&
      current !==
        "Ready"
    ) {

      throw makeError(
        "Order must be Ready before it can be moved On the Way."
      );
    }

    else if (
      next ===
        "Delivered" &&
      current !==
        "On the Way"
    ) {

      throw makeError(
        "Order must be On the Way before it can be marked Delivered."
      );
    }

    const update = {

      orderStatus:
        next,

      updatedAt:
        isoNow()
    };

    if (
      next ===
      "Delivered"
    ) {

      update.deliveredAt =
        isoNow();

      update.customerConfirmed =
        false;

      update.closed =
        false;
    }

    await firebase.updateDoc(
      reference,
      update
    );

    if (
      next ===
        "Delivered" &&
      order.userId
    ) {

      const notificationId =
        "NTF-" +
        Date.now() +
        "-" +
        Math.floor(
          Math.random() *
          10000
        );

      await firebase.setDoc(
        firebase.doc(
          firebase.db,
          "notifications",
          notificationId
        ),
        {

          notificationId,

          userId:
            order.userId,

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

    const fresh =
      await firebase.getDoc(
        reference
      );

    return {

      success: true,

      order:
        normalizeOrder(
          fresh.data()
        )
    };
  }


  // ============================================================
  // ADMIN — REVIEWS
  // ============================================================

  async function adminReviews() {

    await requireAdmin();

    const reviews =
      await getCollection(
        "reviews"
      );

    const published =
      reviews.filter(
        review =>
          String(
            review.status ||
            "Published"
          ).toLowerCase() ===
          "published"
      );

    const average =
      published.length
        ? published.reduce(
            (
              sum,
              review
            ) =>
              sum +
              Number(
                review.rating ||
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
            review => ({

              reviewId:
                review.reviewId ||
                review.id,

              orderId:
                review.orderId,

              customerId:
                review.customerId,

              productId:
                review.productId,

              productName:
                review.productName,

              rating:
                review.rating,

              review:
                review.review,

              customerName:
                review.customerName,

              submittedAt:
                cleanTimestamp(
                  review.submittedAt
                ),

              status:
                review.status ||
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
            average * 10
          ) / 10
      }
    };
  }


  async function updateReviewStatus(
    id,
    status
  ) {

    const firebase =
      await READY;

    await requireAdmin();

    status =
      String(
        status || ""
      );

    if (
      ![
        "Published",
        "Hidden"
      ].includes(
        status
      )
    ) {

      throw makeError(
        "Invalid review status."
      );
    }

    const reference =
      firebase.doc(
        firebase.db,
        "reviews",
        String(id)
      );

    const snapshot =
      await firebase.getDoc(
        reference
      );

    if (
      !snapshot.exists()
    ) {

      throw makeError(
        "Review not found."
      );
    }

    await firebase.updateDoc(
      reference,
      {
        status
      }
    );

    return {

      success: true,

      status
    };
  }


  async function notifyCustomerReview(
    orderId,
    forceResend
  ) {

    const firebase =
      await READY;

    await requireAdmin();

    const orderReference =
      firebase.doc(
        firebase.db,
        "orders",
        String(orderId)
      );

    const orderSnapshot =
      await firebase.getDoc(
        orderReference
      );

    if (
      !orderSnapshot.exists()
    ) {

      throw makeError(
        "Order not found."
      );
    }

    const order =
      orderSnapshot.data();

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
            review =>
              String(
                review.orderId
              ) ===
                String(
                  orderId
                ) &&
              String(
                review.productId
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

    const notifications =
      await getCollection(
        "notifications"
      );

    const existing =
      notifications.find(
        notification =>
          String(
            notification.orderId
          ) ===
            String(
              orderId
            ) &&
          notification.type ===
            "REVIEW_REQUEST" &&
          !notification.readAt
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

      await firebase.updateDoc(
        firebase.doc(
          firebase.db,
          "notifications",
          existing.id
        ),
        {
          readAt:
            isoNow()
        }
      );
    }

    const notificationId =
      "NTF-" +
      Date.now() +
      "-" +
      Math.floor(
        Math.random() *
        10000
      );

    await firebase.setDoc(
      firebase.doc(
        firebase.db,
        "notifications",
        notificationId
      ),
      {

        notificationId,

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

      notificationId,

      message:
        forceResend
          ? "Review resent to the customer."
          : "Review notification sent to the customer."
    };
  }


  // ============================================================
  // ADMIN LOGIN
  // ============================================================

  async function adminLogin(
    email,
    password
  ) {

    const firebase =
      await READY;

    email =
      String(
        email || ""
      )
        .trim()
        .toLowerCase();

    password =
      String(
        password || ""
      );

    if (
      !email ||
      !password
    ) {

      throw makeError(
        "Email and password are required."
      );
    }

    const credential =
      await firebase
        .signInWithEmailAndPassword(
          firebase.auth,
          email,
          password
        );

    if (
      credential.user.uid !==
      ADMIN_UID
    ) {

      await firebase.signOut(
        firebase.auth
      );

      throw makeError(
        "This Firebase account is not authorized as McKenzie Ramen House Admin."
      );
    }

    const token =
      await credential.user
        .getIdToken();

    return {

      success: true,

      token,

      email:
        credential.user.email,

      uid:
        credential.user.uid
    };
  }


  // ============================================================
  // PHILIPPINE ADDRESS API
  // ============================================================

  async function psgc(
    url
  ) {

    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!response.ok) {

      throw makeError(
        "Unable to load Philippine location data."
      );
    }

    return response.json();
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
          order => ({

            orderId:
              order.orderId,

            total:
              order.total,

            paymentMethod:
              order.paymentMethod,

            paymentStatus:
              order.paymentStatus,

            orderStatus:
              order.orderStatus,

            orderedAt:
              order.orderedAt
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

        const profile =
          await getProfile(
            args[0]
          );

        return sendPasswordReset(
          profile.email
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


      // --------------------------------------------------------
      // ADMIN
      // --------------------------------------------------------

      case "adminLogin":

        return adminLogin(
          args[0],
          args[1]
        );


      case "adminGetProducts":

        return adminGetProducts();


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


    withSuccessHandler(
      callback
    ) {

      this._success =
        callback;

      return this;
    },


    withFailureHandler(
      callback
    ) {

      this._failure =
        callback;

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
          property
        ) {

          if (
            property in
            target
          ) {

            return target[
              property
            ];
          }

          return function () {

            const args =
              Array.from(
                arguments
              );

            const success =
              target._success;

            const failure =
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
                      property
                    ),
                    args
                  )
              )
              .then(
                result => {

                  if (
                    success
                  ) {

                    success(
                      result
                    );
                  }
                }
              )
              .catch(
                error => {

                  console.error(
                    "McKenzie Firebase function error:",
                    property,
                    error
                  );

                  if (
                    failure
                  ) {

                    failure(
                      error
                    );
                  }
                }
              );

            return target;
          };
        }
      }
    );


  // ============================================================
  // READY EVENT
  // ============================================================

  READY
    .then(
      function () {

        window.dispatchEvent(
          new Event(
            "mckenzie-firebase-ready"
          )
        );

      }
    )
    .catch(
      function (error) {

        console.error(
          "McKenzie Firebase is unavailable:",
          error
        );

        window.dispatchEvent(
          new CustomEvent(
            "mckenzie-firebase-error",
            {
              detail:
                error
            }
          )
        );
      }
    );

})();
