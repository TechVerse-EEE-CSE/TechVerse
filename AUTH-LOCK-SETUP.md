# Guide: One Sign-In Method Per Account (Cloud Functions)

## কী করে এটা
- `functions/index.js`-এ ৩টা Cloud Function:
  1. **tagPrimaryProvider** — নতুন প্রতিটা account তৈরির সময় সে কোন provider
     (password / google.com / github.com) দিয়ে বানানো হলো, সেটা তার
     custom claim-এ লিখে রাখে (`primaryProvider`)।
  2. **enforceSingleProvider** — প্রতিটা sign-in attempt-এর সময়, আসল
     sign-in ঘটার *আগে*, চেক করে ব্যবহৃত provider আর account-এর
     `primaryProvider` মিলছে কিনা। না মিললে sign-in reject হয়ে যায় —
     এইটাই আসল enforcement, client-side কোনো bypass এখানে কাজ করবে না।
  3. **checkAccountBeforePasswordReset** — শুধু ভালো UX-এর জন্য: reset
     email পাঠানোর আগেই বলে দেয় "এই account Google/GitHub দিয়ে বানানো,
     reset করা যাবে না" — যাতে ইউজার অকারণে reset link ব্যবহার করে
     আটকে না যায়।

## ডিপ্লয় করার ধাপ

### ১. Blaze প্ল্যানে upgrade করো
Firebase Console → প্রজেক্ট সিলেক্ট → বামনিচে "Upgrade" → Blaze প্ল্যান
বেছে একটা billing account/card যোগ করো। Cloud Functions Spark (ফ্রি)
প্ল্যানে deploy করা যায় না — এটা Firebase-এর নিজস্ব নিয়ম।
(এই সাইজের ইউজারবেসে বিল কার্যত ০ থাকবে — মাসে ২০ লাখ invocation ফ্রি।)

### ২. Firebase CLI ইনস্টল থাকলে
```bash
npm install -g firebase-tools
firebase login
```
প্রজেক্ট root-এ (এই zip extract করা ফোল্ডারে) গিয়ে:
```bash
firebase use --add        # techverse-eee-cse সিলেক্ট করো
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules
```

### ৩. Deploy শেষে
Firebase Console → Authentication → Settings-এ "Blocking functions"
সেকশনে `tagPrimaryProvider` আর `enforceSingleProvider` দেখানো উচিত —
মানে ঠিকমতো hook হয়ে গেছে।

## ⚠️ যা জানা দরকার
- **আগের accounts** (deploy করার আগে যারা account বানিয়ে ফেলেছে)
  স্বয়ংক্রিয়ভাবে তাদের প্রথম sign-in-এই "tag" হয়ে যাবে — সেটাই তাদের
  চিরস্থায়ী `primaryProvider` হয়ে যাবে। এর মানে কারো যদি ইতিমধ্যে
  password-reset backdoor দিয়ে দুইটা method-ই কাজ করা থাকে, deploy-এর
  পর প্রথম যে method দিয়ে সে লগইন করবে সেটাই লক হয়ে যাবে, আরেকটা বন্ধ
  হয়ে যাবে।
- Cloud Function fail করলে (billing/permission issue) sign-in blocked
  হয়ে যেতে পারে — deploy-এর পর একবার নিজে test করে নিও (Google দিয়ে
  sign-in, তারপর password দিয়ে reset চেষ্টা — reject হওয়া উচিত)।
