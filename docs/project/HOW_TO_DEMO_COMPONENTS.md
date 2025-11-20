# 🎨 Component Demo Guide

**How to see and test all your React Native components**

---

## 🚀 Quick Start

### 1. Start the App
```powershell
cd parkopticon
npx expo start
```

### 2. Open on Your Device
- **Option A:** Scan QR code with Expo Go app on your phone
- **Option B:** Press `a` for Android emulator
- **Option C:** Press `i` for iOS simulator (Mac only)

### 3. Navigate to Demo Tab
Once the app loads, look at the bottom tab bar:
- 🗺️ Map
- 🚨 Alerts  
- 🎫 Tickets
- 👤 Profile
- **🎨 Demo** ← **TAP THIS!**

---

## 📱 What You'll See

### Component Demo Screen

The demo screen shows **every component** in your library:

#### 1. **Buttons Section**
- Primary button (blue)
- Secondary button (green)
- Outline button (blue border)
- Text button (no background)
- Danger button (red)
- Size variants (Small, Medium, Large)
- Loading state (with spinner)
- Disabled state (grayed out)

**Try:** Tap any button to see an alert!

---

#### 2. **Cards Section**
Shows all 4 card types with sample data:

**Parking Card** (Green indicator)
- Title: "Available Parking Spot"
- Location: Market St & 5th
- Reporter info and description
- Timestamp: "5 min ago"
- Distance: "0.3 mi"
- Badge: "AVAILABLE"

**Alert Card** (Red indicator)
- Title: "Enforcement Alert"
- Location: Mission St & 9th
- Description of officer activity
- Timestamp: "12 min ago"
- Distance: "0.8 mi"
- Badge: "TICKETING"

**Ticket Card** (Orange indicator)
- Title: "Parking Ticket"
- Location: Valencia St & 16th
- Fine amount and due date
- Timestamp: "2 days ago"
- Badge: "UNPAID"

**Generic Card** (No indicator)
- Flexible card for any content
- Can be customized fully

**Try:** Tap any card to see an alert!

---

#### 3. **Inputs Section**
Shows text input variants:

- **Basic Input** - Standard text field
- **Input with Error** - Shows error message in red
- **Multiline Input** - Tall textarea for long text
- **Disabled Input** - Grayed out, can't edit

**Try:** Type in the basic input field!

---

#### 4. **Floating Action Buttons (FABs)**
Shows the action buttons used on the map:

- **Report Spot** (Green with parking emoji)
- **Report Alert** (Red with officer emoji)
- **Icon Only** (Blue with plus icon)

**Try:** Tap any FAB to see an alert!

---

#### 5. **Color Palette**
Visual display of your theme colors:

- **Primary** - #2196F3 (Blue)
- **Success** - #4CAF50 (Green)
- **Error** - #F44336 (Red)
- **Warning** - #FFC107 (Yellow)

---

#### 6. **Typography**
Shows all text styles:

- **Heading 1** - 32px Bold
- **Heading 2** - 24px Bold
- **Heading 3** - 20px Semibold
- **Heading 4** - 18px Semibold
- **Body** - 16px Regular
- **Caption** - 12px Regular

---

#### 7. **Spacing**
Visual representation of the 8pt grid system:

- **XS** - 4px
- **SM** - 8px
- **MD** - 16px
- **LG** - 24px
- **XL** - 32px

---

## 🎯 Testing Checklist

### Visual Testing
- [ ] All buttons display correctly
- [ ] All cards show proper styling
- [ ] Inputs have proper borders
- [ ] Colors match the design system
- [ ] Typography is readable
- [ ] Spacing looks consistent

### Interaction Testing
- [ ] Buttons show press feedback
- [ ] Cards are tappable
- [ ] Inputs accept text
- [ ] FABs trigger alerts
- [ ] Loading spinner works
- [ ] Disabled state prevents interaction

### Layout Testing
- [ ] Scroll through entire demo
- [ ] Everything fits on screen
- [ ] No overlapping elements
- [ ] Proper padding/margins
- [ ] Responsive to screen size

---

## 🔄 Seeing Cards in Real Screens

### Map Screen (Tab 1)
- Shows parking spot markers (green)
- Shows enforcement markers (red)
- FABs for quick reporting

### Alerts Screen (Tab 2)
- **Uses AlertCard component**
- Shows list of enforcement alerts
- Filter by type (All, Ticketing, Chalking, Towing)
- Each card is tappable

### Tickets Screen (Tab 3)
- **Uses TicketCard component**
- Shows your parking tickets
- Status badges (Unpaid, Appealed, Paid)
- Pay/Appeal buttons on cards

### Profile Screen (Tab 4)
- Uses basic cards for stats
- Achievement badges
- Settings menu items

---

## 💡 Pro Tips

### Hot Reload
- Save any file to see changes instantly
- No need to restart the app
- Great for tweaking styles

### Component Editing
To customize components:
1. Open `src/components/Button.js` (or other component)
2. Change colors, sizes, or behavior
3. Save file
4. Watch changes appear in demo!

### Testing Real Data
The demo uses static data. To test with real data:
- Go to Map Screen - tap to add markers
- Go to Alerts Screen - see sample alerts
- Go to Tickets Screen - see sample tickets

### Screenshots
Take screenshots of the demo to:
- Share with team
- Document components
- Compare with Figma later
- Show progress

---

## 🐛 Troubleshooting

### Demo tab not showing?
- Make sure you restarted expo after adding ComponentDemoScreen
- Press `r` in terminal to reload
- Or shake device and press "Reload"

### Components look weird?
- Check theme files in `src/theme/`
- Verify colors.js, typography.js, spacing.js
- Restart metro bundler if needed

### Can't tap cards?
- Make sure onPress prop is set
- Check console for errors
- Verify TouchableOpacity is used

### Scroll not working?
- Demo uses ScrollView - should work
- Try scrolling with two fingers in simulator
- On real device, swipe normally

---

## 📂 File Locations

```
parkopticon/src/
├── screens/
│   └── ComponentDemoScreen.js    ← The demo screen
│
├── components/
│   ├── Button.js                 ← Button component
│   ├── Card.js                   ← All card variants
│   ├── Input.js                  ← Input component
│   ├── FAB.js                    ← FAB component
│   └── index.js                  ← Exports all
│
├── navigation/
│   └── AppNavigator.js           ← Added Demo tab here
│
└── theme/
    ├── colors.js                 ← Color palette
    ├── typography.js             ← Text styles
    └── spacing.js                ← Spacing values
```

---

## 🎨 Customization Examples

### Change Button Color
```javascript
// In Button.js
primary: {
  backgroundColor: theme.colors.primary,  // Change this!
}
```

### Change Card Style
```javascript
// In Card.js
card: {
  borderRadius: 12,  // Try 20 for more rounded
  padding: theme.spacing.md,  // Try lg for more padding
}
```

### Add New Component
1. Create new file in `src/components/`
2. Export in `src/components/index.js`
3. Import in `ComponentDemoScreen.js`
4. Add demo section

---

## 📱 Next Steps

### After reviewing components:
1. ✅ Verify all components work
2. ✅ Check styling matches expectations
3. ✅ Test on different screen sizes
4. 🔄 Customize colors/styles as needed
5. 🔄 Add more component variants
6. 🔄 Build report forms (next task)
7. 🔄 Add detail screens

### To remove demo tab later:
Just comment out or remove the Demo tab in `AppNavigator.js`

---

**Your component library is fully interactive and ready to explore! 🎉**

Tap the 🎨 Demo tab and start testing!
