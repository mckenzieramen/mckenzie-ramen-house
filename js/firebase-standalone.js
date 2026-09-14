rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn() && request.auth.uid == "OHDs2DV4jyO3eBrww8d0gUQkNli2";
    }

    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /brandAssets/{assetId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /users/{userId} {
      allow read, create, update: if signedIn() && request.auth.uid == userId;
      allow delete: if isAdmin();
    }

    match /addresses/{addressId} {
      allow read, update, delete: if signedIn() && resource.data.userId == request.auth.uid;
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
    }

    match /orders/{orderId} {
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
      allow read: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid);
      allow update: if isAdmin() || (
        signedIn() &&
        resource.data.userId == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'customerConfirmed','confirmedAt','closed','reviewCompleted','reviewCompletedAt'
        ])
      );
      allow delete: if isAdmin();
    }

    match /reviews/{reviewId} {
      allow read: if isAdmin() || resource.data.status == "Published" || (signedIn() && resource.data.customerId == request.auth.uid);
      allow create: if signedIn() && request.resource.data.customerId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    match /notifications/{notificationId} {
      allow read: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid);
      allow create: if isAdmin();
      allow update: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid);
      allow delete: if isAdmin();
    }

    match /supportChats/{chatId} {
      allow read: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid);
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin() || (
        signedIn() &&
        resource.data.userId == request.auth.uid &&
        request.resource.data.userId == resource.data.userId
      );
      allow delete: if isAdmin();
    }

    match /admins/{adminId} {
      allow read: if signedIn() && request.auth.uid == adminId;
      allow write: if isAdmin();
    }

    match /usernames/{usernameId} {
      allow get: if true;
      allow list: if false;
      allow create: if signedIn() && request.resource.data.uid == request.auth.uid && request.resource.data.usernameKey == usernameId;
      allow update: if signedIn() && resource.data.uid == request.auth.uid && request.resource.data.uid == request.auth.uid && request.resource.data.usernameKey == usernameId;
      allow delete: if signedIn() && request.resource.data.uid == request.auth.uid;
    }
  }
}
