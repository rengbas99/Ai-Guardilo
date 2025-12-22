# Git Repository Guide - AI Guardrail

## 📦 Repository Status

Your git repository is initialized and contains:

1. **Initial commit** (`d2b43cf`): Core extension functionality
2. **Preview UI commit** (`162068b`): Grammarly-style preview with Accept/Reject

## 🔍 Review Preview UI Changes

### View the changes:
```bash
git show 162068b
```

### See what changed in content.js:
```bash
git diff 79df8fb 162068b extension/src/content.js
```

### View the full diff:
```bash
git diff 79df8fb HEAD
```

## ↩️ Revert Preview UI (if needed)

If you want to go back to the simple Fix/Dismiss UI:

```bash
# Revert to previous commit (keeps preview UI in history)
git revert 162068b

# OR reset to previous commit (removes preview UI from history)
git reset --hard 79df8fb
```

## 🔄 Switch Between Versions

### Use Preview UI (current):
```bash
git checkout 162068b
npm run build
```

### Use Simple UI (previous):
```bash
git checkout 79df8fb
npm run build
```

### Go back to latest:
```bash
git checkout master
npm run build
```

## 🌐 Create Private Remote Repository

### Option 1: GitHub (Recommended)

1. **Create private repo on GitHub:**
   - Go to https://github.com/new
   - Name: `ai-guardrail` (or your choice)
   - Select "Private"
   - Don't initialize with README
   - Click "Create repository"

2. **Connect local repo:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ai-guardrail.git
   git branch -M main
   git push -u origin main
   ```

### Option 2: GitLab

1. **Create private repo on GitLab:**
   - Go to https://gitlab.com/projects/new
   - Name: `ai-guardrail`
   - Visibility: Private
   - Create project

2. **Connect local repo:**
   ```bash
   git remote add origin https://gitlab.com/YOUR_USERNAME/ai-guardrail.git
   git branch -M main
   git push -u origin main
   ```

### Option 3: Bitbucket

1. **Create private repo on Bitbucket:**
   - Go to https://bitbucket.org/repo/create
   - Name: `ai-guardrail`
   - Access level: Private
   - Create repository

2. **Connect local repo:**
   ```bash
   git remote add origin https://bitbucket.org/YOUR_USERNAME/ai-guardrail.git
   git branch -M main
   git push -u origin main
   ```

## 📝 Current Commit Structure

```
162068b (HEAD -> master) feat: Add Grammarly-style preview UI with Accept/Reject
79df8fb Initial commit: AI Guardrail Chrome Extension - Core functionality
d2b43cf Initial commit: Add .gitignore
```

## 🧪 Test Preview UI

After building, test the preview UI:

1. **Build extension:**
   ```bash
   npm run build
   ```

2. **Load in Chrome:**
   - `chrome://extensions/` → Reload extension
   - Go to `https://chatgpt.com/`

3. **Test:**
   - Paste: `Patient John Doe, SW1A 1AA, email: john@test.com`
   - You should see:
     - Preview panel with highlighted changes
     - Yellow highlights for original PII
     - Green highlights for replacements
     - Accept/Reject buttons

## 🔧 Modify Preview UI

If you want to customize the preview:

1. **Edit:** `extension/src/content.js`
2. **Find:** `showPill()` function
3. **Modify:** Preview HTML, colors, layout, etc.
4. **Test:** `npm run build` → Reload extension
5. **Commit:** `git commit -am "Customize preview UI"`

## 📊 Preview UI Features

Current implementation includes:
- ✅ Preview panel showing before/after
- ✅ Yellow highlights for detected PII
- ✅ Green highlights for replacements
- ✅ Accept/Reject buttons (replaces Fix/Dismiss)
- ✅ 15-second auto-dismiss (longer for review)
- ✅ Hover effects on buttons

## 🚀 Next Steps

1. **Review the preview UI** - Test it and see if you like it
2. **Customize if needed** - Adjust colors, layout, text
3. **Create remote repo** - Push to GitHub/GitLab for backup
4. **Continue development** - Add more features as needed

---

**Note:** The preview UI is in commit `162068b`. You can always revert or modify it!

