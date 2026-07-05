# Where to add what in index.html

## 1. Add CSS in <head>
```html
<!-- After the earlier styles.css -->
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/toolbar.css">  ← Add this
```

---

## 2. Add HTML right before </body>

Copy the complete code from the toolbar-html.html file
and paste it after the <!-- TOAST --> div:

```html
<!-- ══ TOAST ══ -->
<div class="toast-container" id="toastContainer"></div>

↓ Paste the code from toolbar-html.html here ↓

<!-- ══════════════════════════════════════
     SCRIPTS
══════════════════════════════════════ -->
```

---

## 3. Add toolbar.js in Scripts

```html
<!-- 4. Editor Core -->
<script src="js/editor.js"></script>

<!-- 5. Floating Toolbar -->
<script src="js/toolbar.js"></script>  ← Add this

<!-- 6. PWA -->
<script> ... </script>
```

---

## Complete File Structure (Updated)

```
techverse/
├── index.html          ← HTML + toolbar HTML will be added
├── css/
│   ├── styles.css      ← as before
│   └── toolbar.css     ← new ✅
├── js/
│   ├── auth.js
│   ├── auth-ui.js
│   ├── editor.js
│   └── toolbar.js      ← new ✅
└── config/
    └── firebase-config.js
```
