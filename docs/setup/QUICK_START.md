# ⚡ Parkopticon Quick Start

**TL;DR version of the setup guide - for when you just want to get started fast**

---

## 📦 Prerequisites (Install These First)

1. **Node.js** (v20+): [https://nodejs.org/](https://nodejs.org/) → Download LTS
2. **Android Studio**: [https://developer.android.com/studio](https://developer.android.com/studio)
3. **VS Code**: [https://code.visualstudio.com/](https://code.visualstudio.com/)

---

## 🚀 Setup in 5 Minutes

### 1. Create Project
```powershell
cd "k:\Self Improvement\Coding\Park-Opticon"
npx create-expo-app parkopticon --template blank
cd parkopticon
```

### 2. Install Dependencies
```powershell
npx expo install react-native-maps expo-location react-native-screens react-native-safe-area-context
npm install @react-navigation/native @react-navigation/stack react-native-paper
```

### 3. Run the App
```powershell
npx expo start
```

Press `a` for Android emulator or scan QR with **Expo Go** app on your phone.

---

## 🎨 Figma Setup (5 minutes)

1. Go to [figma.com](https://figma.com) → Sign up (free)
2. New Design File → Press `F` → Choose "iPhone 14 Pro" frame
3. Set up layout grid: Select frame → Right panel → Layout Grid → Add 4 columns, 16px margins

Done! Start designing your screens.

---

## 📱 Android Emulator Setup

1. Open **Android Studio** → **More Actions** → **Virtual Device Manager**
2. **Create Device** → Choose **Pixel 5** → **Tiramisu (API 33)** → Finish
3. Click ▶️ to launch emulator
4. In your project: `npx expo start` → Press `a`

---

## ✅ Verify It Works

Run this in terminal:
```powershell
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x
adb devices       # Should show emulator-5554
```

Open `App.js`, change some text, save → App should update automatically!

---

## 🆘 Quick Fixes

**Emulator won't start?**
```powershell
npx expo start -c   # Clear cache
```

**ADB not found?**
- Add to PATH: `C:\Users\[YourName]\AppData\Local\Android\Sdk\platform-tools`
- Restart VS Code

**Metro bundler stuck?**
```powershell
rm -rf node_modules
npm install
```

---

## 📖 Full Guide

See **SETUP_GUIDE.md** for detailed explanations, troubleshooting, and design integration tips.

---

**Now you're ready to build Parkopticon! 🎉**
