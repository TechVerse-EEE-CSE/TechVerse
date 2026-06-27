# Tech Verse Code Editor — File Structure

## 📁 প্রজেক্ট ফাইল বিভাজন

```
techverse/
│
├── index.html                  ← মূল HTML (শুধু কাঠামো)
│
├── css/
│   └── styles.css              ← সব CSS এখানে
│
├── js/
│   ├── auth.js                 ← Firebase Auth লজিক
│   ├── auth-ui.js              ← Login/Register UI হেল্পার
│   └── editor.js               ← CodeMirror + Editor লজিক
│
├── config/
│   └── firebase-config.js      ← 🔒 SECRET — GitHub এ দেবেন না!
│
└── .gitignore                  ← config/ ফাইল বাদ দেওয়া আছে
```

## 🔒 সিক্রেট ফাইল সুরক্ষা

`config/firebase-config.js` ফাইলে আপনার Firebase API Key আছে।

**.gitignore এ এটি যোগ করা হয়েছে**, তাই `git push` করলে এটি GitHub এ যাবে না।

### প্রডাকশনে আরও নিরাপদ করতে:
- Firebase Console → Project Settings → **Authorized Domains** এ শুধু আপনার domain রাখুন
- Firebase Console → **App Check** চালু করুন
- Firebase Security Rules সঠিকভাবে set করুন

## 📦 ফাইলের কাজ

| ফাইল | কাজ |
|------|-----|
| `index.html` | HTML structure, সব script/style লিঙ্ক |
| `css/styles.css` | সম্পূর্ণ CSS — Auth + Editor + UI |
| `js/auth.js` | Firebase login/register/logout (ES Module) |
| `js/auth-ui.js` | পাসওয়ার্ড দেখানো/লুকানো, tab switch, profile modal |
| `js/editor.js` | CodeMirror editor, file tree, tabs, settings, preview |
| `config/firebase-config.js` | 🔒 Firebase credentials (secret) |

## 🚀 কীভাবে চালাবেন

1. সব ফাইল একই server থেকে serve করুন (ES Module এর জন্য দরকার)
2. VS Code Live Server বা `npx serve .` চলবে
3. Firebase Console এ আপনার domain Authorized করুন
