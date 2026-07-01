# Guide for Adding the Collaboration Feature

## 1. Where to put the new files
```
techverse/
├── js/
│   ├── project-manager.js   ← new
│   ├── firestore-sync.js    ← replace the old one
│   └── share-ui.js          ← new
└── css/
    └── share.css            ← new
```

## 2. Add CSS in `<head>`
```html
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/toolbar.css">
<link rel="stylesheet" href="css/share.css">  ← Add this
```

## 3. Scripts before `</body>` (must be type module)
```html
<script type="module" src="js/project-manager.js"></script>
<script type="module" src="js/firestore-sync.js"></script>
<script src="js/share-ui.js"></script>  ← not module, normal script
```
> Make sure `project-manager.js` and `firestore-sync.js` come
> after `auth.js` and close to `editor.js` (since `IDBStore`,
> `reloadFsFromStorage`, `showToast` are in editor/idb-store).

## 4. Add two buttons to the toolbar/navbar
```html
<button id="btnMyProjects" title="My Projects"><i class="fa-solid fa-folder-open"></i></button>
<button id="btnShareProject" title="Share"><i class="fa-solid fa-user-group"></i></button>
<span id="cloudSyncBadge"></span>
<span id="reloadAvailableBadge" class="hidden" onclick="applyRemoteUpdate()">
  New update available — click to load
</span>
```

## 5. When creating a new project (e.g. right after the first sign-up)
```js
const currentFs   = await IDBStore.get('fs');
const projectId   = await createProject('My First Project', currentFs);
window.currentProjectId = projectId;
window.openProjectSync(projectId);
```

## 6. Upload the Firestore Rules
Paste the contents of the `firestore.rules` file into Firebase Console →
Firestore Database → Rules tab, then **Publish**.

---

## Why Firestore load stays low with this design

| Operation | How often | Firestore cost |
|---|---|---|
| Save (Ctrl+S) | Only when the user wants | 1 write |
| Watching live updates (`onSnapshot`) | Only when someone saves | 1 read/collaborator, 0 while idle |
| Joining via a share link | Just once | 2 writes, then 0 |
| "My Projects" list | When the modal is opened | 1 read (users doc) + 1 read per project |

➡️ There's no real-time keystroke sync, polling, or continuous listener
load — so even with 10-20 collaborators, there's no real risk of
straining Firestore, as long as people are saving normally with Ctrl+S.

### To reduce it further in the future
- You could add a 3-5 second debounce/cooldown on save (so pressing
  Ctrl+S multiple times in quick succession results in just one write).
- If you need live cursors/presence ("who's online now"), use
  **Firebase Realtime Database** instead of Firestore for that —
  it's cheaper and better suited for frequent small updates.
