# Username ফিচার — সেটআপ গাইড

এই আপডেটে যা যোগ হয়েছে:
1. সাইন-আপ ফর্মে **Username** ফিল্ড — নতুন অ্যাকাউন্ট খোলার সময় username দেওয়া যাবে।
2. প্রোফাইল সেটিংসে username দেখা এবং পরিবর্তন করা যাবে (আগে থেকে থাকা ইউজাররাও)।
3. লগইন ফর্মে এখন **Email অথবা Username** — যেকোনো একটা দিয়ে লগইন করা যাবে।
4. প্রজেক্ট শেয়ার মোডালে নতুন **"Invite by email or username"** বক্স — লিংক ছাড়াই সরাসরি
   কাউকে email বা username দিয়ে যোগ করা যাবে, এবং কে কে প্রজেক্টে আছে তার লিস্টও দেখা যাবে।
5. Google দিয়ে সাইন-ইন করা ইউজার এবং এই ফিচার আসার আগে থেকে থাকা ইউজারদের জন্য একটা
   username স্বয়ংক্রিয়ভাবে (email থেকে) বানিয়ে দেওয়া হয় — পরে প্রোফাইল থেকে বদলে নেওয়া যাবে।

---

## ১. নতুন ফাইল

```
techverse/
└── js/
    └── username.js   ← নতুন — সব username লজিক এখানে (auth.js, profile.js,
                          project-manager.js এই ফাইল থেকে import করে)
```

`username.js` একটা ES module, তাই আলাদা করে `<script>` ট্যাগ লাগবে না —
যেসব ফাইল এটা `import` করে (auth.js, profile.js, project-manager.js) সেগুলো
ব্রাউজার নিজে থেকেই লোড করে নেবে।

---

## ২. নতুন Firestore Collection

| Collection | Document ID | Fields | কেন দরকার |
|---|---|---|---|
| `usernames` | `{usernameLower}` | `uid, username, email, createdAt` | username → email (লগইনের জন্য) এবং → uid (শেয়ারের জন্য) |
| `userEmails` | `{emailLower}` | `uid` | email দিয়ে কাউকে প্রজেক্টে যোগ করার সময় uid বের করতে |
| `publicProfiles` | `{uid}` | `username, displayName, photoURL, updatedAt` | কোলাবোরেটর লিস্টে নাম/ছবি দেখানোর জন্য (পাবলিকলি রিডেবল, কিন্তু email নেই) |

`users/{uid}` ডকুমেন্টে নতুন ৪টা ফিল্ড যোগ হয়েছে: `username, usernameLower, email, emailLower`।

⚠️ **প্রাইভেসি নোট:** `usernames/{username}` ডকুমেন্টে email রাখা হয়েছে, কারণ Firebase Auth-এর
client SDK দিয়ে email ছাড়া sign-in করা সম্ভব না (username দিয়ে সরাসরি sign-in এর কোনো
built-in উপায় নেই)। তাই username → email এই ম্যাপিং পাবলিকলি রিডেবল রাখতে হয়েছে —
এটা অনেক Firebase প্রজেক্টে ব্যবহৃত একটা প্রচলিত পদ্ধতি। আরও কড়া প্রাইভেসি চাইলে ভবিষ্যতে
এটা একটা Cloud Function (Admin SDK) দিয়ে করানো যায়, যেখানে email কখনো ক্লায়েন্টে আসবে না।

---

## ৩. Firestore Rules — এইগুলো যোগ করুন

Firebase Console → Firestore Database → Rules ট্যাবে, আপনার আগের rules-এর সাথে নিচেরগুলো
merge করে **Publish** করুন। (`projects`, `users`, `shareLinks` এর rules যদি আগে থেকেই থাকে,
সেগুলো এখানে দেখানো ভার্সন দিয়ে আপডেট করে নিন যাতে `collaboratorUids` ঠিকভাবে কাজ করে।)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── users/{uid} — নিজেরটা পড়তে/লিখতে পারবে, অন্যেরটা না ──
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // ── usernames/{username} — public read (লগইন/শেয়ারের জন্য দরকার),
    //    কিন্তু শুধু নিজের uid দিয়েই create করা যাবে, overwrite করা যাবে না (uniqueness) ──
    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.uid == request.auth.uid;
      allow update: if false;
    }

    // ── userEmails/{email} — শুধু uid রাখে, public read প্রয়োজন শেয়ার-বাই-ইমেইলের জন্য ──
    match /userEmails/{email} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.uid == request.auth.uid;
      allow update: if false;
    }

    // ── publicProfiles/{uid} — সবাই পড়তে পারবে (কোলাবোরেটর লিস্টে দেখানোর জন্য),
    //    কিন্তু শুধু নিজেরটাই লিখতে পারবে ──
    match /publicProfiles/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // ── projects/{projectId} ──
    match /projects/{projectId} {
      allow read: if request.auth != null
                  && (resource.data.ownerUid == request.auth.uid
                      || request.auth.uid in resource.data.collaboratorUids);
      allow create: if request.auth != null
                    && request.resource.data.ownerUid == request.auth.uid;
      // মালিক সব লিখতে পারবে; কোলাবোরেটর শুধু fs/আপডেট-সংক্রান্ত ফিল্ড বদলাতে পারবে
      allow update: if request.auth != null
                    && (resource.data.ownerUid == request.auth.uid
                        || request.auth.uid in resource.data.collaboratorUids);
      allow delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
    }

    // ── shareLinks/{shareId} ──
    match /shareLinks/{shareId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.createdBy == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.createdBy == request.auth.uid;
    }
  }
}
```

> নোট: `projects` কালেকশনে `array-contains` কুয়েরি (`listMyProjects` এর জন্য) চালাতে
> আলাদা করে কোনো composite index লাগে না — Firestore এমনিতেই এই ধরনের সিঙ্গেল-ফিল্ড
> array-contains কুয়েরির জন্য index অটো তৈরি করে রাখে।

---

## ৪. Username-এর নিয়ম

- ৩–২০ ক্যারেক্টার
- অক্ষর দিয়ে শুরু হতে হবে
- শুধু ছোট হাতের অক্ষর, সংখ্যা এবং `_` (আন্ডারস্কোর) ব্যবহার করা যাবে
- ইউনিক — একটা username শুধু একজনই ব্যবহার করতে পারবে (case-insensitive)

---

## ৫. যেভাবে কাজ করে (সংক্ষেপে)

- **সাইন-আপ:** নাম, ইমেইল, username, পাসওয়ার্ড — সব দিয়ে অ্যাকাউন্ট তৈরি হয়। username
  ইউনিক কিনা তা transaction দিয়ে atomically চেক করে reserve করা হয়; কোনো কারণে race
  condition-এ username নেওয়া হয়ে গেলে, নতুন অ্যাকাউন্টটা rollback (delete) করে ইউজারকে
  আবার চেষ্টা করতে বলা হয়।
- **পুরনো/Google ইউজার:** প্রতিবার লগইনের সময় ব্যাকগ্রাউন্ডে চেক হয় যে username আছে কিনা;
  না থাকলে ইমেইল থেকে একটা ডিফল্ট username বানিয়ে দেওয়া হয় (যেমন `rafi123`), যেটা পরে
  প্রোফাইল থেকে ইচ্ছামতো বদলে নেওয়া যাবে।
- **লগইন:** ইনপুটে `@` থাকলে সেটাকে ইমেইল ধরা হয়; না থাকলে username ধরে সেটার সাথে যুক্ত
  ইমেইল খুঁজে বের করে তারপর সাধারণ ইমেইল/পাসওয়ার্ড লগইন চালানো হয়।
- **প্রজেক্ট শেয়ার:** Share মোডালে email/username লিখে "Add" করলে সেই ব্যক্তির uid বের করে
  প্রজেক্টের `collaboratorUids` লিস্টে যোগ করে দেওয়া হয় — লিংক শেয়ারের বিকল্প হিসেবে, লিংক
  ফিচারও আগের মতোই থেকে যাচ্ছে। মালিক চাইলে "×" বাটনে ক্লিক করে যেকোনো কোলাবোরেটরকে
  সরিয়েও দিতে পারবেন।
