# index.html এ কোথায় কী যোগ করবেন

## ১. <head> এ CSS যোগ করুন
```html
<!-- আগের styles.css এর পরে -->
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/toolbar.css">  ← এটা যোগ করুন
```

---

## ২. </body> এর ঠিক আগে HTML যোগ করুন

toolbar-html.html ফাইলের সম্পূর্ণ কোড কপি করে
<!-- TOAST --> div এর পরে পেস্ট করুন:

```html
<!-- ══ TOAST ══ -->
<div class="toast-container" id="toastContainer"></div>

↓ এখানে toolbar-html.html এর কোড পেস্ট করুন ↓

<!-- ══════════════════════════════════════
     SCRIPTS
══════════════════════════════════════ -->
```

---

## ৩. Scripts এ toolbar.js যোগ করুন

```html
<!-- 4. Editor Core -->
<script src="js/editor.js"></script>

<!-- 5. Floating Toolbar -->
<script src="js/toolbar.js"></script>  ← এটা যোগ করুন

<!-- 6. PWA -->
<script> ... </script>
```

---

## সম্পূর্ণ ফাইল স্ট্রাকচার (আপডেটেড)

```
techverse/
├── index.html          ← HTML + toolbar HTML যোগ হবে
├── css/
│   ├── styles.css      ← আগের মতো
│   └── toolbar.css     ← নতুন ✅
├── js/
│   ├── auth.js
│   ├── auth-ui.js
│   ├── editor.js
│   └── toolbar.js      ← নতুন ✅
└── config/
    └── firebase-config.js
```
