# ✅ Parkopticon Development Setup Checklist

Use this checklist to verify your development environment is fully configured.

---

## 📦 Phase 1: Prerequisites Installation

### Node.js & npm
- [ ] Downloaded Node.js LTS from [nodejs.org](https://nodejs.org/)
- [ ] Installed Node.js using the installer
- [ ] Verified Node.js: `node --version` shows v20.x.x or higher
- [ ] Verified npm: `npm --version` shows 10.x.x or higher
- [ ] npm global path is accessible from terminal

### Android Studio
- [ ] Downloaded Android Studio from [developer.android.com/studio](https://developer.android.com/studio)
- [ ] Installed Android Studio with default settings
- [ ] Completed the Android Studio setup wizard
- [ ] Downloaded SDK Platform 33 (Android 13)
- [ ] Downloaded SDK Build Tools
- [ ] Downloaded Android Emulator
- [ ] Installed HAXM (Intel) or configured Hyper-V (AMD)

### VS Code
- [ ] Downloaded VS Code from [code.visualstudio.com](https://code.visualstudio.com/)
- [ ] Installed VS Code
- [ ] Launched VS Code successfully

---

## 🔧 Phase 2: Development Tools Configuration

### VS Code Extensions
- [ ] Installed: **ES7+ React/Redux/React-Native snippets**
- [ ] Installed: **React Native Tools**
- [ ] Installed: **Prettier - Code formatter**
- [ ] Installed: **ESLint**
- [ ] Installed: **Path Intellisense**
- [ ] Installed: **GitLens** (optional)
- [ ] Installed: **Material Icon Theme** (optional)

### VS Code Settings
- [ ] Enabled: Format on Save
- [ ] Set default formatter to Prettier
- [ ] Set tab size to 2
- [ ] Enabled auto save (afterDelay)
- [ ] Configured integrated terminal to use PowerShell

### Android SDK Environment Variables
- [ ] Created `ANDROID_HOME` environment variable
- [ ] Path points to: `C:\Users\[YourUsername]\AppData\Local\Android\Sdk`
- [ ] Added `%ANDROID_HOME%\platform-tools` to PATH
- [ ] Added `%ANDROID_HOME%\emulator` to PATH
- [ ] Added `%ANDROID_HOME%\tools` to PATH
- [ ] Restarted VS Code after setting environment variables
- [ ] Verified ADB: `adb --version` works

---

## 📱 Phase 3: Android Emulator Setup

### AVD Creation
- [ ] Opened Android Studio Device Manager
- [ ] Created new Virtual Device
- [ ] Selected device: **Pixel 5** (or similar)
- [ ] Selected system image: **Tiramisu (API 33)** with Google APIs
- [ ] Downloaded system image if needed
- [ ] Configured AVD with hardware graphics acceleration
- [ ] Named AVD appropriately (e.g., "Pixel_5_API_33")

### Emulator Testing
- [ ] Launched emulator from Device Manager
- [ ] Emulator boots successfully to home screen
- [ ] Verified `adb devices` shows emulator
- [ ] Emulator responds to touch/clicks
- [ ] Emulator performance is acceptable (not too slow)

---

## 🎨 Phase 4: Figma Design Setup

### Account & Project
- [ ] Created Figma account at [figma.com](https://figma.com)
- [ ] Logged into Figma
- [ ] Created new design file: "Parkopticon Mobile App"
- [ ] (Optional) Downloaded Figma desktop app

### Frame Setup
- [ ] Created mobile frame: iPhone 14 Pro (393 × 852) or Android Large
- [ ] Set up layout grid: 4 columns, 16px margins, 16px gutters
- [ ] Added baseline grid: 8px rows
- [ ] Created frames for key screens:
  - [ ] Home/Map View
  - [ ] Report Parking Spot
  - [ ] Report Enforcement
  - [ ] Notifications/Alerts
  - [ ] Ticket Log

### Design System
- [ ] Created "Design System" page
- [ ] Defined color palette (Primary, Secondary, Success, Error, etc.)
- [ ] Created text styles (H1, H2, Body, Caption)
- [ ] Created button components (Primary, Secondary)
- [ ] Organized icon library
- [ ] Documented spacing system (8pt grid)

---

## 🚀 Phase 5: Project Creation

### Expo Project
- [ ] Navigated to: `k:\Self Improvement\Coding\Park-Opticon`
- [ ] Ran: `npx create-expo-app parkopticon --template blank`
- [ ] Project created successfully
- [ ] Changed directory: `cd parkopticon`
- [ ] Verified `package.json` exists

### Dependencies Installation
- [ ] Installed navigation: `npx expo install react-native-screens react-native-safe-area-context`
- [ ] Installed navigation libraries: `npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs`
- [ ] Installed maps: `npx expo install react-native-maps`
- [ ] Installed location: `npx expo install expo-location`
- [ ] Installed camera: `npx expo install expo-camera expo-image-picker`
- [ ] Installed notifications: `npx expo install expo-notifications`
- [ ] Installed UI components: `npm install react-native-paper`
- [ ] Installed icons: `npx expo install @expo/vector-icons`
- [ ] Installed storage: `npx expo install @react-native-async-storage/async-storage`
- [ ] Installed utilities: `npm install date-fns`
- [ ] All installations completed without errors

### Project Structure
- [ ] Opened project folder in VS Code
- [ ] Verified `App.js` exists
- [ ] Verified `app.json` exists
- [ ] Created `src/` folder structure
- [ ] Created `src/theme/` folder
- [ ] Created theme files (colors.js, typography.js, spacing.js, index.js)

---

## ▶️ Phase 6: Running the App

### First Launch
- [ ] Opened integrated terminal in VS Code (Ctrl+`)
- [ ] Ran: `npx expo start`
- [ ] Metro bundler started successfully
- [ ] QR code displayed in terminal
- [ ] Expo Dev Tools opened in browser (optional)

### Android Emulator Testing
- [ ] Emulator is running
- [ ] Pressed `a` in terminal to launch on Android
- [ ] App installed on emulator
- [ ] App launched successfully
- [ ] Map view is visible
- [ ] Header shows "Parkopticon"
- [ ] Bottom buttons are visible

### Real Device Testing (Optional)
- [ ] Downloaded **Expo Go** from Play Store (Android) or App Store (iOS)
- [ ] Opened Expo Go app
- [ ] Scanned QR code with Expo Go
- [ ] App loaded on physical device
- [ ] App functions correctly on real device

---

## 🔄 Phase 7: Hot Reload Verification

### Testing Hot Reload
- [ ] App is running on emulator/device
- [ ] Opened `App.js` in VS Code
- [ ] Made a small change (e.g., changed header text)
- [ ] Saved file (Ctrl+S)
- [ ] App automatically reloaded
- [ ] Change is visible in app
- [ ] No errors in terminal

---

## 🎯 Phase 8: Feature Testing

### Map Functionality
- [ ] Map loads and displays correctly
- [ ] Can zoom in/out on map
- [ ] Can pan/drag map around
- [ ] Sample markers are visible (green & red pins)
- [ ] Tapping marker shows info popup
- [ ] User location blue dot appears (if permissions granted)

### Location Permissions
- [ ] App requests location permission on first launch
- [ ] Granted location permission
- [ ] User location is shown on map
- [ ] "My Location" button works (centers on user)

### Interactive Features
- [ ] Tapped on map (not on marker)
- [ ] Alert dialog appears asking report type
- [ ] Selected "Parking Spot" → new green marker added
- [ ] Tapped map again → selected "Enforcement" → new red marker added
- [ ] Bottom buttons are clickable
- [ ] "Report Spot" button shows alert
- [ ] "Report Officer" button shows alert

---

## 🛠️ Phase 9: Troubleshooting Verification

### Common Issues Check
- [ ] ADB is recognized: `adb devices` shows device
- [ ] No "Metro bundler stuck" issues
- [ ] No "Cannot connect to Metro" on device
- [ ] Emulator performance is acceptable
- [ ] No "Cannot find module" errors
- [ ] Port 8081 is not blocked by other apps

### Error Recovery
- [ ] Know how to clear cache: `npx expo start -c`
- [ ] Know how to reinstall: `rm -rf node_modules; npm install`
- [ ] Know how to kill process on port 8081
- [ ] Know how to restart emulator
- [ ] Know where to find logs in VS Code terminal

---

## 📚 Phase 10: Resources & Documentation

### Documentation Access
- [ ] Bookmarked: [Expo Docs](https://docs.expo.dev/)
- [ ] Bookmarked: [React Native Docs](https://reactnative.dev/)
- [ ] Bookmarked: [React Navigation](https://reactnavigation.org/)
- [ ] Bookmarked: [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [ ] Read: `SETUP_GUIDE.md` in project folder
- [ ] Read: `QUICK_START.md` for quick reference

### Project Knowledge
- [ ] Understand project structure (src/, assets/, etc.)
- [ ] Know where theme files are located
- [ ] Know how to import colors/typography in components
- [ ] Understand how to add new screens
- [ ] Know how to test on emulator vs real device

---

## 🎉 Final Verification

### Complete System Check
- [ ] Can design mockups in Figma
- [ ] Can export assets from Figma
- [ ] Can create new React Native components
- [ ] Can run app on Android emulator
- [ ] Can run app on real device (optional)
- [ ] Hot reload works consistently
- [ ] Can debug using console.log
- [ ] No blocking errors or warnings
- [ ] Development environment is stable

### Ready to Build
- [ ] All checklist items above are completed
- [ ] Comfortable with the development workflow
- [ ] Know where to find help (documentation, guides)
- [ ] Ready to start implementing Parkopticon features
- [ ] Excited to build! 🚀

---

## 📝 Notes Section

**Issues encountered:**
- 
- 
- 

**Solutions found:**
- 
- 
- 

**Next steps:**
1. 
2. 
3. 

---

## 🆘 If Something Isn't Working

1. **Check the troubleshooting section** in `SETUP_GUIDE.md`
2. **Clear cache and restart**: `npx expo start -c`
3. **Reinstall dependencies**: `rm -rf node_modules; npm install`
4. **Restart emulator**
5. **Restart VS Code**
6. **Check environment variables** are set correctly
7. **Search Expo documentation** for specific error messages

---

**Once all items are checked, you're ready to start developing Parkopticon! 🎊**
