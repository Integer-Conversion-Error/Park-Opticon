# 🚀 Parkopticon Development Environment Setup Guide

**Complete guide for setting up your frontend development environment on Windows**

---

## 📋 Table of Contents

1. [Figma Setup](#1-figma-setup)
2. [React Native + Expo Setup](#2-react-native--expo-setup)
3. [VS Code Configuration](#3-vs-code-configuration)
4. [Android Emulation Setup](#4-android-emulation-setup)
5. [iOS Testing (Alternative Options)](#5-ios-testing-alternative-options)
6. [Design Integration](#6-design-integration)
7. [Verification Checklist](#7-verification-checklist)
8. [Common Troubleshooting](#8-common-troubleshooting)

---

## 1. Figma Setup

### 1.1 Create a Figma Account

1. **Go to**: [https://www.figma.com](https://www.figma.com)
2. **Sign up** with your email or Google account
3. **Choose the Free plan** (sufficient for solo development)
4. **Download Figma Desktop App** (optional but recommended for better performance)
   - Available at: [https://www.figma.com/downloads/](https://www.figma.com/downloads/)

### 1.2 Create Your Parkopticon Design Project

1. **Click "New Design File"** in Figma
2. **Rename** it to "Parkopticon Mobile App"
3. **Set up frames** for mobile screens:
   - Press `F` (Frame tool) or click the Frame icon
   - Choose **Phone** → **Android Large** (412 × 915 px) or **iPhone 14 Pro** (393 × 852 px)
   - Create multiple frames for different screens:
     - Home/Map View
     - Report Parking Spot
     - Report Enforcement
     - Alert Notifications
     - Ticket Log
     - Settings

### 1.3 Recommended Frame Sizes

For cross-platform compatibility:
- **Primary design target**: 375 × 812 px (iPhone 11/12/13 standard)
- **Android alternative**: 412 × 915 px (Pixel 5)
- **Safe area margins**: 
  - Top: 44px (status bar + notch)
  - Bottom: 34px (gesture bar)
  - Sides: 16px

### 1.4 Layout Grid Setup

1. **Select your frame** → **Right panel** → **Layout Grid** → **+**
2. **Recommended grid**:
   - Type: **Columns**
   - Count: **4 columns** (mobile standard)
   - Margin: **16px**
   - Gutter: **16px**
3. **Add a baseline grid** for vertical rhythm:
   - Type: **Rows**
   - Size: **8px** (8pt grid system)

### 1.5 Component Organization

Create a **Design System** page with:
- **Colors**: Primary (blue/green), Secondary, Error (red), Warning (yellow), Success (green)
- **Typography**: Heading styles (H1-H4), Body, Caption
- **Icons**: Map markers, enforcement icons, ticket icons, navigation icons
- **Buttons**: Primary, Secondary, Disabled states
- **Cards**: Parking spot cards, alert cards
- **Bottom sheets**: For report forms

**Tip**: Use Figma's **Component** feature (Ctrl+Alt+K) to create reusable UI elements.

### 1.6 Export Assets for React Native

**For icons/images**:
1. Select the layer/component
2. Right panel → **Export** → **+**
3. Choose format: **PNG** or **SVG**
4. Set scale: **1x, 2x, 3x** (for different screen densities)
5. Click **Export [name]**

**For color tokens**:
1. Use the **Styles** panel to define colors
2. Document hex codes in a separate "Design Tokens" frame
3. Example format:
   ```
   Primary Blue: #2196F3
   Success Green: #4CAF50
   Error Red: #F44336
   Background: #FFFFFF
   ```

**Pro tip**: Use [Figma Tokens](https://www.figma.com/community/plugin/843461159747178978/Figma-Tokens) plugin to export design tokens as JSON.

---

## 2. React Native + Expo Setup

### 2.1 Install Node.js

1. **Download Node.js**: [https://nodejs.org/](https://nodejs.org/)
   - Choose **LTS version** (20.x or later recommended)
2. **Run the installer** and follow the wizard
3. **Verify installation**:
   ```powershell
   node --version
   npm --version
   ```
   - Should show: `v20.x.x` and `10.x.x` (or similar)

### 2.2 Install Expo CLI

```powershell
npm install -g expo-cli
```

**Verify**:
```powershell
expo --version
```

**Alternative (newer method)**: Expo now recommends using `npx expo` instead of global install, but global install is still useful.

### 2.3 Create Parkopticon Project

```powershell
cd "k:\Self Improvement\Coding\Park-Opticon"
npx create-expo-app parkopticon --template blank
cd parkopticon
```

This creates a new Expo project with:
- `App.js` - Main entry point
- `package.json` - Dependencies
- `app.json` - Expo configuration

### 2.4 Install Key Libraries

```powershell
# Navigation
npx expo install react-native-screens react-native-safe-area-context
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs

# Maps
npx expo install react-native-maps

# Location services
npx expo install expo-location

# Camera for photos
npx expo install expo-camera expo-image-picker

# Notifications
npx expo install expo-notifications

# UI components
npm install react-native-paper

# Icons
npx expo install @expo/vector-icons

# Storage
npx expo install @react-native-async-storage/async-storage

# Date/time utilities
npm install date-fns
```

### 2.5 Run the App

**Start Metro bundler**:
```powershell
npx expo start
```

This will:
- Start the Metro bundler
- Open Expo Dev Tools in your browser
- Show a QR code for mobile testing

**Options**:
- Press `a` - Open on Android emulator
- Press `w` - Open in web browser
- Press `r` - Reload app
- Press `m` - Toggle menu

---

## 3. VS Code Configuration

### 3.1 Install VS Code

1. **Download**: [https://code.visualstudio.com/](https://code.visualstudio.com/)
2. **Install** with default options
3. **Launch VS Code**

### 3.2 Install Essential Extensions

Open VS Code → Extensions (Ctrl+Shift+X) → Search and install:

**Must-have**:
- ✅ **ES7+ React/Redux/React-Native snippets** (dsznajder.es7-react-js-snippets)
- ✅ **React Native Tools** (msjsdiag.vscode-react-native)
- ✅ **Prettier - Code formatter** (esbenp.prettier-vscode)
- ✅ **ESLint** (dbaeumer.vscode-eslint)
- ✅ **Path Intellisense** (christian-kohler.path-intellisense)

**Recommended**:
- ⭐ **GitLens** (eamodio.gitlens) - Git integration
- ⭐ **Auto Rename Tag** (formulahendry.auto-rename-tag)
- ⭐ **Bracket Pair Colorizer** (built into VS Code now)
- ⭐ **Material Icon Theme** (PKief.material-icon-theme) - Better file icons
- ⭐ **Color Highlight** (naumovs.color-highlight) - Visualize colors in code

### 3.3 Configure Settings

**File → Preferences → Settings** (or Ctrl+,)

Add these settings (search for each):
- **Format On Save**: ✅ Enabled
- **Default Formatter**: Prettier
- **Tab Size**: 2
- **Auto Save**: `afterDelay`

**Or edit `settings.json`** directly (Ctrl+Shift+P → "Preferences: Open Settings (JSON)"):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "files.autoSave": "afterDelay",
  "javascript.updateImportsOnFileMove.enabled": "always",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
```

### 3.4 Open Parkopticon Project

1. **File → Open Folder**
2. Navigate to: `k:\Self Improvement\Coding\Park-Opticon\parkopticon`
3. Click **Select Folder**

### 3.5 Running from VS Code

**Integrated Terminal** (Ctrl+`):
```powershell
npx expo start
```

**Or create a launch configuration**:
1. Click **Run and Debug** (Ctrl+Shift+D)
2. Click **"create a launch.json file"**
3. Select **React Native**
4. Choose **Debug Android** or **Debug iOS**

### 3.6 Multiple Terminal Windows

**For managing frontend + backend later**:
1. Terminal → **Split Terminal** (Ctrl+Shift+5)
2. Or click the **+** dropdown → **Split Terminal**
3. Each terminal can run different processes:
   - Terminal 1: `npx expo start` (frontend)
   - Terminal 2: `python main.py` (backend, later)
   - Terminal 3: Git commands

---

## 4. Android Emulation Setup

### 4.1 Install Android Studio

1. **Download**: [https://developer.android.com/studio](https://developer.android.com/studio)
2. **Run installer** (default options are fine)
3. **First launch**: Complete the setup wizard
   - Choose **Standard** installation
   - Accept licenses
   - Let it download SDK components (~3-5 GB)

### 4.2 Configure Android SDK

1. Open **Android Studio**
2. **More Actions** → **SDK Manager** (or **Settings → Appearance & Behavior → System Settings → Android SDK**)
3. **SDK Platforms** tab:
   - ✅ Check **Android 13.0 (Tiramisu)** - API Level 33
   - ✅ Check **Android 12.0 (S)** - API Level 31
   - ✅ Show Package Details → Check **Google APIs** for each
4. **SDK Tools** tab:
   - ✅ Android SDK Build-Tools
   - ✅ Android Emulator
   - ✅ Android SDK Platform-Tools
   - ✅ Intel x86 Emulator Accelerator (HAXM installer) - for faster emulation
5. Click **Apply** → Download/install components

### 4.3 Create a Virtual Device (AVD)

1. **More Actions** → **Virtual Device Manager** (or **Tools → Device Manager**)
2. Click **Create Device**
3. **Choose a device**:
   - Recommended: **Pixel 5** (good balance of size/performance)
   - Or **Pixel 6 Pro** (for larger screen testing)
4. **Select a system image**:
   - Choose **Tiramisu (Android 13.0)** with **Google APIs**
   - Click **Download** if needed
5. **Verify Configuration**:
   - Name: "Pixel_5_API_33" (or similar)
   - Startup orientation: Portrait
   - Graphics: **Hardware - GLES 2.0** (or Automatic)
6. Click **Finish**

### 4.4 Set Environment Variables

**Add to Windows PATH**:

1. **Search** → "Environment Variables" → **Edit system environment variables**
2. Click **Environment Variables**
3. Under **User variables**, click **New**:
   - Variable: `ANDROID_HOME`
   - Value: `C:\Users\[YourUsername]\AppData\Local\Android\Sdk`
4. Edit **Path** variable → **New** → Add:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
   - `%ANDROID_HOME%\tools`
   - `%ANDROID_HOME%\tools\bin`

5. **Restart VS Code** (for environment variables to take effect)

### 4.5 Test the Emulator

**From Android Studio**:
- Device Manager → Click ▶️ play button next to your AVD

**From Command Line**:
```powershell
emulator -list-avds
emulator -avd Pixel_5_API_33
```

**From Expo**:
```powershell
npx expo start
# Press 'a' to open on Android
```

### 4.6 Verify ADB Connection

```powershell
adb devices
```

Should show:
```
List of devices attached
emulator-5554   device
```

---

## 5. iOS Testing (Alternative Options)

### 5.1 iOS Simulator (macOS Only)

**If you have a Mac**:
1. Install **Xcode** from Mac App Store (~12 GB)
2. Open Xcode → **Preferences → Locations** → Set Command Line Tools
3. Run: `npx expo start` then press `i`

### 5.2 Expo Go on Real iPhone (Cross-Platform)

**Best option for Windows users**:

1. **Install Expo Go**:
   - App Store: Search "Expo Go"
   - Or visit: [https://expo.dev/client](https://expo.dev/client)

2. **Connect to same WiFi** as your development computer

3. **Run the app**:
   ```powershell
   npx expo start
   ```

4. **Scan QR code**:
   - iPhone: Open **Camera app** → Point at QR code → Tap notification
   - Or open **Expo Go** → **Scan QR Code**

5. **App loads** on your real device!

**Benefits**:
- ✅ Real device testing
- ✅ Test actual gestures, GPS, camera
- ✅ Fast hot reload
- ✅ No need for Mac or iOS Simulator

---

## 6. Design Integration

### 6.1 Keeping Figma and React Native in Sync

**Workflow**:
1. **Design in Figma first** → Get user feedback
2. **Export specs** → Dimensions, colors, fonts
3. **Code in React Native** → Implement designs
4. **Iterate** → Update Figma, update code

### 6.2 Export Color Tokens

**Create a theme file**: `src/theme/colors.js`
```javascript
export const colors = {
  primary: '#2196F3',      // From Figma
  secondary: '#FF9800',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FFC107',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
  },
};
```

### 6.3 Export Typography

**Create**: `src/theme/typography.js`
```javascript
export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal',
    lineHeight: 16,
  },
};
```

### 6.4 Export Icons and Images

**From Figma**:
1. Select icon → **Export** → **SVG**
2. Save to: `parkopticon/assets/icons/`

**Use in React Native**:
```javascript
import { Image } from 'react-native';

<Image source={require('./assets/icons/parking-icon.svg')} />
```

**Or use Expo Vector Icons** (easier):
```javascript
import { MaterialIcons } from '@expo/vector-icons';

<MaterialIcons name="local-parking" size={24} color="#2196F3" />
```

### 6.5 Measure Spacing from Figma

**Use the 8pt grid system**:
- Small: 8px
- Medium: 16px
- Large: 24px
- XLarge: 32px

**In React Native**:
```javascript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
```

---

## 7. Verification Checklist

Before you start coding, verify everything works:

### ✅ Development Tools
- [ ] Node.js installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Expo CLI works (`npx expo --version`)
- [ ] VS Code installed with extensions
- [ ] Git installed (optional but recommended)

### ✅ Project Setup
- [ ] Expo project created
- [ ] All dependencies installed (`npm install` completed)
- [ ] Project opens in VS Code
- [ ] No errors in `package.json`

### ✅ Android Emulation
- [ ] Android Studio installed
- [ ] AVD created and can launch
- [ ] ADB recognizes emulator (`adb devices`)
- [ ] Expo app opens on Android emulator

### ✅ iOS Testing
- [ ] Expo Go installed on iPhone (or iOS Simulator on Mac)
- [ ] QR code scans successfully
- [ ] App loads on iPhone

### ✅ Design Tools
- [ ] Figma account created
- [ ] Design file created with mobile frames
- [ ] Layout grids configured
- [ ] Color/typography styles defined

### ✅ Hot Reload
- [ ] Make a change in `App.js`
- [ ] Save file (Ctrl+S)
- [ ] App updates automatically on emulator/phone

---

## 8. Common Troubleshooting

### 🔧 "ADB not recognized" Error

**Fix**:
```powershell
# Check if in PATH
$env:Path -split ';' | Select-String Android

# If not, add temporarily
$env:Path += ";C:\Users\[YourUsername]\AppData\Local\Android\Sdk\platform-tools"

# Test
adb devices
```

**Permanent fix**: Add to Environment Variables (see Section 4.4)

### 🔧 "Metro bundler stuck at 'Loading...'"

**Fix**:
```powershell
# Clear cache
npx expo start -c

# Or manually
rm -rf node_modules
npm install
npx expo start
```

### 🔧 "Cannot connect to Metro" on phone

**Fix**:
- Ensure phone and computer are on **same WiFi network**
- Disable VPNs or firewalls temporarily
- Try USB connection: Enable USB Debugging on Android

### 🔧 Emulator is very slow

**Fix**:
- Install HAXM (Intel) or Hyper-V (AMD)
- Allocate more RAM to AVD (Device Manager → Edit → Advanced)
- Use a lower API level (Android 12 instead of 13)
- Close other heavy applications

### 🔧 "Cannot find module" errors

**Fix**:
```powershell
npm install
npx expo start
```

### 🔧 Port 8081 already in use

**Fix**:
```powershell
# Find process using port
netstat -ano | findstr :8081

# Kill process (replace PID with actual number)
taskkill /PID [PID] /F

# Or use different port
npx expo start --port 8082
```

### 🔧 VS Code terminal not opening

**Fix**:
- Ctrl+` (backtick) to toggle terminal
- Or **Terminal → New Terminal** from menu
- Check if PowerShell path is correct: Settings → Terminal → Integrated > Shell: Windows

---

## 🎉 Next Steps

Once everything is verified:

1. **Review the minimal example** in `App.js`
2. **Explore the project structure**
3. **Start designing in Figma** (create your screens)
4. **Begin implementing** the Map View screen
5. **Test frequently** on emulator and real device

---

## 📚 Additional Resources

- **Expo Docs**: [https://docs.expo.dev/](https://docs.expo.dev/)
- **React Native Docs**: [https://reactnative.dev/docs/getting-started](https://reactnative.dev/docs/getting-started)
- **React Navigation**: [https://reactnavigation.org/](https://reactnavigation.org/)
- **Figma Tutorials**: [https://www.figma.com/resources/learn-design/](https://www.figma.com/resources/learn-design/)
- **React Native Maps**: [https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps)

---

**Good luck building Parkopticon! 🚗🅿️**
