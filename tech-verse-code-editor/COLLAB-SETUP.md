# Collaboration ফিচার যোগ করার গাইড

## ১. নতুন ফাইল কোথায় রাখবেন
```
techverse/
├── js/
│   ├── project-manager.js   ← নতুন
│   ├── firestore-sync.js    ← replace করুন পুরনোটাকে
│   └── share-ui.js          ← নতুন
└── css/
    └── share.css            ← নতুন
```

## ২. `<head>` এ CSS যোগ করুন
```html
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/toolbar.css">
<link rel="stylesheet" href="css/share.css">  ← এটা যোগ করুন
```

## ৩. `</body>` এর আগে scripts (টাইপ module হতে হবে)
```html
<script type="module" src="js/project-manager.js"></script>
<script type="module" src="js/firestore-sync.js"></script>
<script src="js/share-ui.js"></script>  ← module না, normal script
```
> খেয়াল রাখুন `project-manager.js` ও `firestore-sync.js` অবশ্যই
> `auth.js` এর পরে এবং `editor.js` এর কাছাকাছি (যেহেতু `IDBStore`,
> `reloadFsFromStorage`, `showToast` — এগুলো editor/idb-store এ আছে)।

## ৪. টুলবার/নেভবারে দুটো বাটন যোগ করুন
```html
<button id="btnMyProjects" title="আমার প্রজেক্ট"><i class="fa-solid fa-folder-open"></i></button>
<button id="btnShareProject" title="শেয়ার করুন"><i class="fa-solid fa-user-group"></i></button>
<span id="cloudSyncBadge"></span>
<span id="reloadAvailableBadge" class="hidden" onclick="applyRemoteUpdate()">
  নতুন আপডেট আছে — ক্লিক করে লোড করুন
</span>
```

## ৫. নতুন প্রজেক্ট তৈরি করার সময় (যেমন প্রথমবার সাইন-আপের পর)
```js
const currentFs   = await IDBStore.get('fs');
const projectId   = await createProject('My First Project', currentFs);
window.currentProjectId = projectId;
window.openProjectSync(projectId);
```

## ৬. Firestore Rules আপলোড করুন
`firestore.rules` ফাইলের কন্টেন্ট Firebase Console →
Firestore Database → Rules ট্যাবে পেস্ট করে **Publish** করুন।

---

## এই ডিজাইনে Firestore লোড কম থাকে কেন

| অপারেশন | কতবার হয় | Firestore কস্ট |
|---|---|---|
| Save (Ctrl+S) | ইউজার চাইলে যখন | ১ write |
| লাইভ আপডেট দেখা (`onSnapshot`) | শুধু কেউ save করলে | ১ read/collaborator, idle অবস্থায় ০ |
| শেয়ার লিংকে জয়েন | একবার মাত্র | ২ write, এরপর ০ |
| "আমার প্রজেক্ট" লিস্ট | মোডাল খুললে | ১ read (users doc) + প্রতি প্রজেক্ট ১ read |

➡️ কোনো রিয়েল-টাইম কী-স্ট্রোক সিঙ্ক, পোলিং, বা continuous listener
লোড নেই — তাই ১০-২০ জন কোলাবোরেটর থাকলেও Firestore-এ চাপ পড়ার
সম্ভাবনা নেই, যতক্ষণ মানুষ স্বাভাবিকভাবে Ctrl+S দিয়ে সেভ করছে।

### ভবিষ্যতে আরও কমাতে চাইলে
- Save-এ ৩-৫ সেকেন্ড debounce/cooldown যোগ করতে পারেন (একই সাথে
  একাধিকবার Ctrl+S চাপলে একটাই write হবে)।
- যদি লাইভ কার্সর/প্রেজেন্স ("কে এখন অনলাইন") দরকার হয়, সেটা
  Firestore-এ না রেখে **Firebase Realtime Database** ব্যবহার করুন —
  ওটা frequent ছোট আপডেটের জন্য সস্তা ও উপযোগী।
