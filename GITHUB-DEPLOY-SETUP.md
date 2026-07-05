# GitHub Connect + Deploy ফিচার — সেটআপ গাইড

এই আপডেটে যা যোগ হয়েছে:
1. Sidebar মেনুতে **"Deploy to GitHub"** — এখান থেকে ইউজার নিজের GitHub একাউন্ট
   কানেক্ট করে তার প্রজেক্ট একটা GitHub রিপোজিটরিতে push করতে পারবে।
2. প্রতিটা ইউজারের **নিজের GitHub একাউন্টেই** রিপো তৈরি হয় (কোনো central/shared
   রিপো নেই) — Deploy চাপলে ইউজারকে রিপোর নাম দিতে হয়, তারপর app সেটা তৈরি করে
   এবং ফাইলগুলো push করে।
3. Push শেষে **GitHub Pages** নিজে থেকেই চালু হয়ে যায়, এবং একটা live link
   (`https://username.github.io/repo-name/`) দেখানো হয়।
4. পুরোটাই ব্রাউজার থেকে সরাসরি হয় — আলাদা কোনো backend সার্ভার লাগে না। GitHub-এর
   access token শুধু ওই ট্যাবের মেমোরিতে/sessionStorage-এ থাকে, কোথাও সেভ হয় না।

⚠️ **এই ফিচার কাজ করার আগে GitHub-এর দিক থেকে একটা One-time সেটআপ করতে হবে,
নিচে ধাপে ধাপে দেওয়া আছে।**

---

## ১. নতুন ফাইল

```
techverse/
├── js/
│   └── github-deploy.js      ← নতুন — connect + push + Pages enable এর সব লজিক
├── css/
│   └── github-deploy.css     ← নতুন — Deploy মোডালের স্টাইল
└── GITHUB-DEPLOY-SETUP.md    ← এই ফাইল
```

`github-deploy.js` একটা ES module (`type="module"`), `index.html`-এ এভাবে যোগ
করা আছে:

```html
<script type="module" src="js/github-deploy.js"></script>
```

`editor.js`-এ একটা ছোট্ট এক্সপোর্ট ফাংশনও যোগ করা হয়েছে:

```js
window.getProjectFiles = function () { ... }
```

এটা চলতি প্রজেক্টের সব ফাইল (path → content) একটা প্লেইন object হিসেবে রিটার্ন
করে, যা `downloadAsZip`/`exportProject` যেভাবে কাজ করে ঠিক সেভাবেই — শুধু GitHub
push-এর জন্য।

---

## ২. GitHub-এর দিকে যা করতে হবে (One-time)

### ধাপ ১: একটা GitHub OAuth App তৈরি করুন

1. GitHub-এ লগইন করে যান: **Settings → Developer settings → OAuth Apps → New OAuth App**
   (সরাসরি লিংক: `https://github.com/settings/developers`)
2. ফর্মটা পূরণ করুন:
   - **Application name:** `Tech Verse Editor` (বা যেকোনো নাম)
   - **Homepage URL:** আপনার সাইটের URL (যেমন `https://yourapp.web.app`)
   - **Authorization callback URL:** এটা **Firebase প্রজেক্ট আইডি অনুযায়ী** বসাতে হবে:
     ```
     https://<YOUR_FIREBASE_PROJECT_ID>.firebaseapp.com/__/auth/handler
     ```
     (এই URL টা Firebase Console-এর Authentication → Sign-in method → GitHub
     সেকশনেই দেখানো থাকবে, ওখান থেকে কপি করে বসালে সবচেয়ে নিরাপদ)
3. **Register application** চাপুন।
4. একটা **Client ID** পাবেন, আর **Generate a new client secret** চেপে একটা
   **Client Secret**-ও বানিয়ে নিন। দুটোই কপি করে রাখুন।

### ধাপ ২: Firebase-এ GitHub Sign-in চালু করুন

1. Firebase Console → আপনার প্রজেক্ট → **Authentication → Sign-in method**
2. **Add new provider → GitHub** সিলেক্ট করুন
3. আগের ধাপের **Client ID** আর **Client Secret** বসিয়ে **Enable** করে **Save** করুন
4. এখানেই যে callback URL দেখাবে সেটা ধাপ ১-এর সাথে মিলিয়ে নিন (না মিললে GitHub
   OAuth App-এর callback URL আপডেট করে দিন)

ব্যাস — `config/firebase-config.js`-এ আলাদা কিছু বদলাতে হবে না, Firebase নিজে
থেকেই এটা হ্যান্ডেল করে।

---

## ৩. `repo` scope নিয়ে একটা কথা

Connect করার সময় GitHub একটা পারমিশন স্ক্রিন দেখাবে যেখানে **"repo" (Full
control of private repositories)** স্কোপ চাওয়া হয়। এটা ইচ্ছাকৃত — নতুন রিপো
তৈরি করা এবং ফাইল push করার জন্য এই স্কোপটা লাগেই। ইউজার চাইলে যেকোনো সময়
তার GitHub একাউন্টের **Settings → Applications** থেকে এই অ্যাক্সেস revoke
করে দিতে পারবে।

---

## ৪. ব্যবহার-প্রবাহ (User Flow)

1. Sidebar → **Deploy to GitHub**
2. প্রথমবার হলে **Connect GitHub** — GitHub পপ-আপে লগইন/অনুমতি দিতে হবে
3. রিপোর নাম লিখুন (ডিফল্ট হিসেবে `index.html`-এর `<title>` থেকে suggest করা
   হয়) — অ্যাপ নিজে থেকেই চেক করে দেখায় নামটা নতুন নাকি আগে থেকেই আছে
4. **Deploy** চাপলে:
   - রিপো না থাকলে তৈরি হয় (আপনার একাউন্টেই)
   - সব ফাইল একটা কমিটে push হয়
   - GitHub Pages চালু হয়ে যায়
5. শেষে একটা লাইভ লিংক দেখানো হয় (প্রথমবার লাইভ হতে GitHub-এর সাইড থেকে
   ১-২ মিনিট সময় লাগতে পারে, এটা স্বাভাবিক)

---

## ৫. সীমাবদ্ধতা (এখনকার ভার্সনে)

- ফাইল কন্টেন্ট টেক্সট হিসেবে ধরে নেওয়া হয় (HTML/CSS/JS) — বাইনারি ফাইল
  (ইমেজ ইত্যাদি) push করে না, কারণ এডিটরের `fs` এ শুধু টেক্সট ফাইল থাকে।
- GitHub token শুধু ওই ব্রাউজার ট্যাবের সেশনে থাকে — ট্যাব বন্ধ করলে বা রিফ্রেশ
  করলে আবার Connect করতে হতে পারে (নিরাপত্তার জন্যই এটা ইচ্ছাকৃত)।
- প্রতিটা Deploy পুরো প্রজেক্ট আবার নতুন করে একটা কমিটে push করে (partial/diff
  push নয়) — ছোট প্রজেক্টের জন্য এটাই যথেষ্ট দ্রুত।
