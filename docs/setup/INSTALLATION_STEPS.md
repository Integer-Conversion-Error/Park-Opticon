# 🚀 Parkopticon Installation Steps

Follow these commands in order to set up your development environment.

---

## Step 1: Verify Prerequisites

Open PowerShell and verify you have these installed:

```powershell
# Check Node.js (should be v20+ or v18+)
node --version

# Check npm (should be v10+ or v9+)
npm --version
```

**If not installed**: Download from https://nodejs.org/ (LTS version)

---

## Step 2: Navigate to Project Directory

```powershell
cd "k:\Self Improvement\Coding\Park-Opticon\parkopticon"
```

---

## Step 3: Install Dependencies

This will take a few minutes (~200MB download):

```powershell
npm install
```

**Expected output**: 
- Installing packages...
- Added 1000+ packages
- No critical errors (warnings are OK)

---

## Step 4: Verify Installation

Check that key packages were installed:

```powershell
# List installed packages
npm list --depth=0
```

**You should see:**
- expo
- react
- react-native
- react-native-maps
- expo-location
- @react-navigation/native
- react-native-paper

---

## Step 5: Start the Development Server

```powershell
npx expo start
```

**What happens:**
- Metro bundler starts
- QR code appears in terminal
- Expo Dev Tools may open in browser
- Server runs at http://localhost:8081

**Keep this terminal open!**

---

## Step 6: Launch on Android Emulator

**Option A: From Terminal**
```powershell
# In the same terminal where expo is running, press:
a
```

**Option B: From Android Studio**
1. Open Android Studio
2. Device Manager → Launch your AVD
3. Go back to terminal → Press `a`

---

## Step 7: Test on Real Device (Optional)

**For Android:**
1. Install **Expo Go** from Play Store
2. Make sure phone and computer are on same WiFi
3. Open Expo Go → Scan QR code from terminal

**For iPhone:**
1. Install **Expo Go** from App Store
2. Open Camera app → Point at QR code → Tap notification
3. Or open Expo Go → Scan QR code

---

## Step 8: Verify Everything Works

**You should see:**
- ✅ App loads on emulator/device
- ✅ Header says "🅿️ Parkopticon"
- ✅ Map is visible and interactive
- ✅ Green and red markers on map
- ✅ Bottom buttons: "Report Spot" and "Report Officer"

**Test interactions:**
- Tap on map → Alert asking what to report
- Tap marker → Info popup appears
- Zoom in/out on map
- Pan around the map

---

## Step 9: Test Hot Reload

1. **Keep app running** on emulator/device
2. **Open** `App.js` in VS Code
3. **Change** the header text (line ~70):
   ```javascript
   <Text style={styles.headerTitle}>🅿️ My Parking App</Text>
   ```
4. **Save** file (Ctrl+S)
5. **Watch** app automatically update!

---

## Step 10: Setup Android Environment Variables (If ADB Not Working)

**If `adb devices` doesn't work:**

1. **Open System Properties**:
   - Press Windows key → Type "environment variables"
   - Click "Edit the system environment variables"

2. **Click "Environment Variables"**

3. **Add ANDROID_HOME** (User variables):
   - Click "New"
   - Variable name: `ANDROID_HOME`
   - Variable value: `C:\Users\[YourUsername]\AppData\Local\Android\Sdk`
   - Click OK

4. **Edit Path** (User variables):
   - Select "Path" → Click "Edit"
   - Click "New" → Add: `%ANDROID_HOME%\platform-tools`
   - Click "New" → Add: `%ANDROID_HOME%\emulator`
   - Click "New" → Add: `%ANDROID_HOME%\tools`
   - Click OK

5. **Restart VS Code** completely

6. **Test**:
   ```powershell
   adb devices
   ```

---

## Troubleshooting Common Issues

### Issue: "Cannot find module"
```powershell
# Solution: Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install
```

### Issue: Metro bundler stuck at "Loading..."
```powershell
# Solution: Clear cache
npx expo start -c
```

### Issue: "Port 8081 already in use"
```powershell
# Solution: Find and kill the process
netstat -ano | findstr :8081
# Note the PID (last column)
taskkill /PID [PID_NUMBER] /F

# Or use a different port
npx expo start --port 8082
```

### Issue: Android emulator won't start
```powershell
# Solution 1: Launch from Android Studio first
# Device Manager → Click play button

# Solution 2: Use command line
emulator -list-avds
emulator -avd [AVD_NAME]
```

### Issue: "Cannot connect to Metro" on device
```powershell
# Solution: Make sure on same WiFi
# Disable VPN if using one
# Try USB connection (Android only)
```

---

## Next Steps

Once everything is working:

1. ✅ **Check off items** in `CHECKLIST.md`
2. 📖 **Read** `PROJECT_STRUCTURE.md` to understand the codebase
3. 🎨 **Start designing** screens in Figma
4. 💻 **Begin coding** new features

---

## Useful Commands Reference

```powershell
# Start development server
npx expo start

# Start with cache cleared
npx expo start -c

# Launch on Android
npx expo start --android

# Launch on iOS (Mac only)
npx expo start --ios

# Install a new package
npm install package-name

# Install Expo package
npx expo install package-name

# Check for outdated packages
npm outdated

# Update all packages (careful!)
npm update

# Run on specific port
npx expo start --port 8082

# Check ADB devices
adb devices

# List Android emulators
emulator -list-avds

# Launch specific emulator
emulator -avd Pixel_5_API_33
```

---

## Resources

- **Expo Docs**: https://docs.expo.dev/
- **React Native Docs**: https://reactnative.dev/
- **React Navigation**: https://reactnavigation.org/
- **React Native Maps**: https://github.com/react-native-maps/react-native-maps

---

## Getting Help

**If stuck:**
1. Check `SETUP_GUIDE.md` Section 8 (Troubleshooting)
2. Search Expo documentation
3. Check the error message in terminal
4. Google the specific error
5. Check React Native community forums

---

**You're all set! Start building Parkopticon! 🎉**
