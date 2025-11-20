# 🎨 Parkopticon - Complete Figma Design Specification

**Date:** November 7, 2025  
**Purpose:** Complete guide for designing all Parkopticon screens in Figma

---

## 📱 Frame Setup & Specifications

### **Device Targets**

**Primary Design Frame:**
- **iPhone 14 Pro**: 393 × 852 px
  - Safe area top: 59px (status bar + notch)
  - Safe area bottom: 34px (home indicator)
  - Why: Most common modern iPhone size

**Secondary Test Frames:**
- **iPhone SE**: 375 × 667 px (smaller phones)
- **Android (Pixel 5)**: 393 × 851 px (Android standard)
- **iPhone 14 Pro Max**: 430 × 932 px (larger phones)

---

## 🎨 Figma File Structure

### **Page Organization**

```
Parkopticon Mobile App (Figma File)
│
├── 📄 1. Design System
│   ├── Colors
│   ├── Typography
│   ├── Icons
│   ├── Components
│   └── Patterns
│
├── 📄 2. Primary Screens
│   ├── Map View
│   ├── Alerts Screen
│   ├── Ticket Log
│   └── Profile/Settings
│
├── 📄 3. Secondary Screens
│   ├── Report Parking Spot
│   ├── Report Enforcement
│   ├── Marker Details
│   ├── Add Ticket
│   ├── Ticket Details
│   └── Set My Car
│
├── 📄 4. Onboarding & Auth
│   ├── Welcome
│   ├── Features
│   ├── Permissions
│   └── Tutorial
│
├── 📄 5. Modals & Overlays
│   ├── Quick Report Menu
│   ├── Filter Overlay
│   ├── Confirmation Dialogs
│   └── Error States
│
├── 📄 6. User Flows
│   ├── Finding Parking Flow
│   ├── Reporting Flow
│   ├── Alert Flow
│   └── Ticket Management Flow
│
└── 📄 7. Prototypes
    ├── Happy Path Prototype
    └── Edge Cases Prototype
```

---

## 🎨 Design System (Page 1)

### **1. Colors Palette**

Create color styles in Figma (Styles → Color Styles):

#### **Brand Colors**
```
Primary Blue
#2196F3
RGB: 33, 150, 243
Use: Headers, CTAs, links, user location

Primary Dark
#1976D2
RGB: 25, 118, 210
Use: Pressed states, shadows

Primary Light
#E3F2FD
RGB: 227, 242, 253
Use: Backgrounds, subtle highlights
```

#### **Status Colors**
```
Success Green (Parking Available)
#4CAF50
RGB: 76, 175, 80
Use: Parking spot markers, positive actions

Error Red (Enforcement)
#F44336
RGB: 244, 67, 54
Use: Enforcement markers, destructive actions

Warning Orange (Tickets)
#FF9800
RGB: 255, 152, 0
Use: Ticket markers, warnings, caution states

Info Blue
#2196F3
RGB: 33, 150, 243
Use: Informational messages
```

#### **Neutral Colors**
```
Background White
#FFFFFF
RGB: 255, 255, 255

Surface Gray
#F5F5F5
RGB: 245, 245, 245
Use: Card backgrounds, subtle sections

Surface Dark
#E0E0E0
RGB: 224, 224, 224
Use: Disabled states, dividers
```

#### **Text Colors**
```
Text Primary (Dark)
#212121
RGB: 33, 33, 33
Use: Headings, body text

Text Secondary (Medium)
#757575
RGB: 117, 117, 117
Use: Subtitles, captions, meta info

Text Disabled (Light)
#BDBDBD
RGB: 189, 189, 189
Use: Disabled text

Text Inverse (On Dark BG)
#FFFFFF
RGB: 255, 255, 255
Use: Text on colored backgrounds
```

#### **Border Colors**
```
Border Light
#E0E0E0

Border Medium
#BDBDBD

Border Dark
#9E9E9E
```

---

### **2. Typography System**

Create text styles in Figma (Styles → Text Styles):

#### **Headings**
```
H1 - Screen Titles
Font: SF Pro Display / Roboto
Weight: Bold (700)
Size: 32px
Line Height: 40px
Letter Spacing: 0px
Use: Main screen headers

H2 - Section Titles
Font: SF Pro Display / Roboto
Weight: Bold (700)
Size: 24px
Line Height: 32px
Letter Spacing: 0px
Use: Card headers, modal titles

H3 - Subsection Titles
Font: SF Pro Display / Roboto
Weight: Semibold (600)
Size: 20px
Line Height: 28px
Letter Spacing: 0px
Use: List headers, card subtitles

H4 - Small Headers
Font: SF Pro Display / Roboto
Weight: Semibold (600)
Size: 18px
Line Height: 24px
Letter Spacing: 0px
Use: Small section headers
```

#### **Body Text**
```
Body 1 - Primary Text
Font: SF Pro Text / Roboto
Weight: Regular (400)
Size: 16px
Line Height: 24px
Letter Spacing: 0.5px
Use: Main body text, descriptions

Body 2 - Secondary Text
Font: SF Pro Text / Roboto
Weight: Regular (400)
Size: 14px
Line Height: 20px
Letter Spacing: 0.25px
Use: Smaller descriptions, list items
```

#### **Utility Text**
```
Caption - Small Text
Font: SF Pro Text / Roboto
Weight: Regular (400)
Size: 12px
Line Height: 16px
Letter Spacing: 0.4px
Use: Timestamps, meta info, hints

Overline - Labels
Font: SF Pro Text / Roboto
Weight: Medium (500)
Size: 10px
Line Height: 16px
Letter Spacing: 1.5px
Transform: UPPERCASE
Use: Category labels, tags

Button Text
Font: SF Pro Text / Roboto
Weight: Semibold (600)
Size: 14px
Line Height: 20px
Letter Spacing: 1.25px
Transform: UPPERCASE (for major actions)
Use: All button text
```

---

### **3. Layout Grid System**

Set up layout grids for each frame:

#### **Mobile Grid (393px width)**
```
Type: Columns
Count: 4 columns
Width: Auto
Gutter: 16px
Margin: 16px (left/right)

PLUS

Type: Rows
Height: 8px
Gutter: 0px
Use: Vertical rhythm, 8pt grid system
```

#### **Safe Areas**
```
Top Safe Area (iPhone 14 Pro):
59px from top (status bar + notch)

Bottom Safe Area:
34px from bottom (home indicator)

Horizontal Safe Area:
16px from left/right edges
```

---

### **4. Spacing System**

Create components with spacing tokens:

```
XS: 4px   - Tight spacing (icon + text)
SM: 8px   - Close related items
MD: 16px  - Standard spacing (cards, sections)
LG: 24px  - Section breaks
XL: 32px  - Major section breaks
XXL: 48px - Large gaps (between major sections)
```

**Apply to:**
- Padding inside cards
- Margins between elements
- Gap between list items
- Section separators

---

### **5. Component Library**

#### **Buttons**

**Primary Button**
```
Size: Auto-layout horizontal
Padding: 12px (vertical) × 24px (horizontal)
Fill: Primary Blue (#2196F3)
Corner Radius: 8px
Text: Button Text style, White (#FFFFFF)
Shadow: 0px 2px 4px rgba(0,0,0,0.2)

States:
- Default
- Hover (darker blue)
- Pressed (Primary Dark #1976D2)
- Disabled (Surface Gray #E0E0E0, text #BDBDBD)
```

**Secondary Button**
```
Same size as Primary
Fill: Transparent
Border: 2px solid Primary Blue
Text: Button Text style, Primary Blue
```

**Destructive Button**
```
Same size as Primary
Fill: Error Red (#F44336)
Text: White
Use: Delete, remove actions
```

**Icon Button**
```
Size: 44px × 44px (tap target)
Icon size: 24px
Fill: Transparent
Use: Toolbar icons, close buttons
```

**Floating Action Button (FAB)**
```
Size: 56px × 56px
Corner Radius: 28px (circle)
Fill: Success Green or Error Red
Icon: 24px, White
Shadow: 0px 4px 8px rgba(0,0,0,0.3)
Position: Bottom right, 16px from edges
```

---

#### **Cards**

**Parking Spot Card**
```
Width: Fill container (361px with 16px margins)
Height: Auto
Padding: 16px
Fill: White (#FFFFFF)
Border: 1px solid Border Light (#E0E0E0)
Corner Radius: 12px
Shadow: 0px 2px 8px rgba(0,0,0,0.1)

Content:
- Icon: 40px green parking pin
- Title: H3 style
- Meta: Caption style (time, distance)
- Photo (if available): 100% width, 160px height
- Action button: Text button
```

**Alert Card**
```
Same as Parking Card but:
- Icon: 40px red warning icon
- Left border: 4px solid Error Red
- Background: Error Red 5% tint (#FEF5F5)
```

**Ticket Card**
```
Width: Fill container
Padding: 16px
Fill: White
Border: 1px solid Border Medium
Corner Radius: 12px

Content Layout:
Top: Amount (H2) + Status Badge
Middle: Violation type + Date
Bottom: Location
Right: Ticket photo thumbnail (80px × 80px)
```

---

#### **Map Markers**

**Parking Spot Marker**
```
Size: 40px × 48px (pin shape)
Fill: Success Green (#4CAF50)
Icon: White "P" or parking icon
Shadow: 0px 2px 4px rgba(0,0,0,0.3)
```

**Enforcement Marker**
```
Size: 40px × 48px
Fill: Error Red (#F44336)
Icon: White warning triangle "⚠️"
```

**Ticket Location Marker**
```
Size: 40px × 48px
Fill: Warning Orange (#FF9800)
Icon: White ticket icon
```

**My Car Marker**
```
Size: 48px × 48px (square)
Fill: Primary Blue (#2196F3)
Icon: White car icon
Corner Radius: 24px (circle)
Border: 3px solid White (for visibility)
```

**User Location Dot**
```
Size: 20px × 20px
Fill: Primary Blue (#2196F3)
Border: 3px solid White
Corner Radius: 10px (circle)
Pulse animation (in prototype)
```

---

#### **Input Fields**

**Text Input**
```
Width: Fill container
Height: 48px
Padding: 12px (vertical) × 16px (horizontal)
Fill: Surface Gray (#F5F5F5)
Border: 1px solid Border Light (normal)
Border: 2px solid Primary Blue (focused)
Corner Radius: 8px
Text: Body 1 style
Placeholder: Text Secondary

States:
- Default
- Focused (blue border)
- Error (red border, error text below)
- Disabled (gray)
```

**Text Area**
```
Same as Text Input but:
Height: 120px (multi-line)
Vertical resize: Yes
```

**Search Field**
```
Height: 40px
Icon: Magnifying glass (left, 16px from edge)
Padding: 8px 16px 8px 48px (space for icon)
Corner Radius: 20px (pill shape)
```

---

#### **Bottom Sheet / Modal**

**Bottom Sheet**
```
Width: 393px (full screen width)
Height: Auto (content-based)
Corner Radius: 20px (top corners only)
Fill: White
Shadow: 0px -4px 16px rgba(0,0,0,0.2)
Handle: 36px × 4px gray bar at top center

Animation: Slide up from bottom
```

**Full Screen Modal**
```
Width: 393px
Height: 852px
Fill: White
Top Bar: H2 title + close button
Content: Scrollable body
Bottom: Action buttons (sticky)
```

---

#### **Navigation**

**Bottom Tab Bar**
```
Height: 80px (includes safe area)
Width: 393px
Fill: White
Border Top: 1px solid Border Light
Shadow: 0px -2px 8px rgba(0,0,0,0.05)

Each Tab:
- Icon: 24px (selected color or gray)
- Label: Caption style
- Active state: Primary Blue
- Inactive: Text Secondary
- Width: 98px (393px ÷ 4 tabs)
```

**Top Navigation Bar**
```
Height: 102px (includes safe area)
Width: 393px
Fill: Primary Blue (or transparent for map)
Text: White (or dark for transparent)

Content:
- Back button (44px × 44px)
- Title (H2 style, centered or left-aligned)
- Actions (44px × 44px icons, right side)
```

---

#### **Status Badges**

**Pill Badge**
```
Height: 24px
Padding: 4px 12px
Corner Radius: 12px
Text: Caption style, Bold

Variants:
- Unpaid: Error Red background, White text
- Paid: Success Green background, White text
- Appealed: Warning Orange background, White text
- Dismissed: Border Medium, Text Secondary
```

---

#### **Info Popup (Map Marker)**

**Callout Bubble**
```
Width: 280px
Height: Auto
Padding: 12px
Fill: White
Corner Radius: 12px
Shadow: 0px 4px 12px rgba(0,0,0,0.25)
Pointer: 12px triangle pointing down

Content:
- Title: H4 style
- Meta: Caption (time, distance)
- Thumbnail: 60px × 60px (if photo)
- "View Details" link
```

---

## 📐 Screen-by-Screen Frame Specifications

### **FRAME 1: Map View (Home)**

**Frame Size:** 393 × 852px  
**Background:** Map image (use satellite/street map screenshot)

**Layout:**

```
Top Bar (102px height, includes safe area):
├─ App Logo (32px × 32px, left)
├─ Search field (center, 200px width)
└─ Filter icon (right, 44px × 44px)

Map Area (646px height):
├─ User location dot (blue, center initially)
├─ 3-4 parking markers (green)
├─ 2-3 enforcement markers (red)
├─ 1 "My Car" marker (optional)
├─ Zoom controls (right side, 80px from top)
└─ Center on location FAB (right bottom corner)

Bottom Action Bar (104px height):
├─ Padding top: 8px
├─ Two buttons side-by-side:
│   ├─ "Report Spot" (green, 50% width - 8px gap)
│   └─ "Report Enforcement" (red, 50% width - 8px gap)
└─ Bottom safe area: 34px
```

**Annotations:**
- "Tap markers to see details"
- "Long press to quick report"

---

### **FRAME 2: Alerts Screen**

**Frame Size:** 393 × 852px

**Layout:**

```
Top Bar (102px):
├─ Back button (optional)
├─ "Alerts" title (H1)
└─ Filter icon (right)

Filter Chips (48px):
├─ Horizontal scroll
├─ "Active" (selected)
├─ "Last Hour"
└─ "Near Me"

Alert Cards List (scrollable):
├─ Card 1: Officer Alert
│   ├─ Red warning icon (40px)
│   ├─ "Officer Present" (H3)
│   ├─ "5 min ago • 0.3 mi away" (Caption)
│   ├─ "⚠️ 200ft from your car!" (Warning badge)
│   ├─ Thumbnail image (80px × 80px)
│   └─ "Confirm" button
├─ Gap (16px)
├─ Card 2: Chalking Alert
├─ Gap (16px)
└─ Card 3: Ticketing Alert

Bottom Tab Bar (80px)
```

---

### **FRAME 3: Ticket Log Screen**

**Frame Size:** 393 × 852px

**Layout:**

```
Top Bar (102px):
├─ "Tickets" title (H1)
└─ Sort icon (right)

Summary Cards (120px):
├─ Two cards side-by-side:
│   ├─ Total Tickets: "8" (H1)
│   └─ Total Owed: "$645" (H1)

Ticket List (scrollable):
├─ Ticket Card 1
│   ├─ Amount: "$75" (H2, prominent)
│   ├─ Status badge: "UNPAID" (red)
│   ├─ Date: "Oct 28, 2025"
│   ├─ Violation: "Expired Meter"
│   ├─ Location: "Main St & 5th"
│   ├─ Due: "18 days left" (countdown)
│   └─ Thumbnail (80px × 80px)
├─ Gap (16px)
├─ Ticket Card 2 (APPEALED status)
└─ ...

FAB: "Add Ticket" (bottom right)
Bottom Tab Bar (80px)
```

---

### **FRAME 4: Profile/Settings Screen**

**Frame Size:** 393 × 852px

**Layout:**

```
Top Bar (102px):
└─ "Profile" title (H1)

Profile Header (180px):
├─ Profile picture (80px circle)
├─ Username (H2)
├─ Karma: "1,247 points" (Body 1)
└─ Member since (Caption)

Stats Section (120px):
├─ Three stat cards:
│   ├─ Spots Reported: "42"
│   ├─ Alerts Sent: "28"
│   └─ Helpful: "91%"

Settings List (scrollable):
├─ Section: "Notifications"
│   ├─ Toggle: Enforcement alerts
│   ├─ Dropdown: Alert radius
│   └─ Toggle: Quiet hours
├─ Section: "Map Settings"
├─ Section: "Account"
└─ Section: "Legal"

Bottom Tab Bar (80px)
```

---

### **FRAME 5: Report Parking Spot (Bottom Sheet)**

**Frame Size:** 393 × 680px (partial screen)

**Layout:**

```
Handle (36px × 4px, centered, 12px from top)

Header (60px):
├─ Close button (left)
└─ "Report Parking Spot" (H2)

Content (scrollable, 520px):
├─ Map Preview (200px height)
│   └─ Shows pin at location
├─ Gap (16px)
├─ Photo Section:
│   ├─ "Add Photo" button (100px × 100px)
│   └─ Preview (if taken)
├─ Gap (16px)
├─ Spot Type Selector:
│   ├─ Radio: Street Parking (selected)
│   ├─ Radio: Metered
│   └─ Radio: Parking Lot
├─ Gap (16px)
├─ Time Limit Dropdown
├─ Gap (16px)
└─ Notes Text Area (120px)

Bottom Actions (80px):
└─ "Submit Report" button (full width, green)
```

---

### **FRAME 6: Report Enforcement (Bottom Sheet)**

**Frame Size:** 393 × 640px

**Layout:**

```
Handle + Header (72px):
├─ Close button
└─ "Report Enforcement" (H2)

Content (scrollable, 468px):
├─ Map Preview (160px)
├─ Gap (16px)
├─ Type Selection (Required):
│   ├─ Checkbox: Officer Present ✓
│   ├─ Checkbox: Chalking Tires
│   ├─ Checkbox: Actively Ticketing
│   └─ Checkbox: Tow Truck
├─ Gap (16px)
├─ Photo Section (encouraged):
│   └─ "Take Photo" button
├─ Gap (16px)
├─ Direction Dropdown
└─ Notes Text Area

Bottom Actions (100px):
├─ "Cancel" (secondary button)
└─ "Send Alert" (primary button, RED)
```

---

### **FRAME 7: Marker Detail Screen**

**Frame Size:** 393 × 852px

**Layout:**

```
Top Bar (102px):
├─ Back button
└─ "Parking Spot" title

Photo (240px):
└─ Full width image (if available)

Details Card (auto):
├─ Reported: "15 minutes ago" (Caption)
├─ Distance: "0.2 miles away" (Caption)
├─ Address: "123 Main St" (Body 1)
├─ Divider
├─ Type: "Street Parking"
├─ Time Limit: "2 hours"
├─ Restrictions: "None"
├─ Divider
└─ Notes: "Next to blue mailbox"

Actions Section (120px):
├─ "Navigate" button (primary, full width)
├─ Gap (8px)
├─ "Report Spot Taken" button (secondary)
└─ "👍 This was helpful (23)" link

Bottom Tab Bar (80px)
```

---

### **FRAME 8: Add Ticket Screen**

**Frame Size:** 393 × 852px (scrollable)

**Layout:**

```
Top Bar (102px):
├─ Back button
└─ "Add Ticket" title

Form (scrollable):
├─ Photo Section:
│   ├─ "Take Photo of Ticket" button
│   └─ Image preview (if taken)
├─ Gap (16px)
├─ Ticket Number field
├─ Gap (12px)
├─ Amount field (currency)
├─ Gap (12px)
├─ Date Received picker
├─ Gap (12px)
├─ Due Date picker
├─ Gap (12px)
├─ Location field + map icon
├─ Gap (12px)
├─ Violation Type dropdown
├─ Gap (12px)
├─ Notes text area
├─ Gap (16px)
└─ Status dropdown

Bottom Actions (sticky, 80px):
├─ "Cancel" (secondary)
└─ "Save Ticket" (primary)
```

---

### **FRAME 9: Ticket Detail Screen**

**Frame Size:** 393 × 852px (scrollable)

**Layout:**

```
Top Bar (102px):
├─ Back button
└─ "Ticket Details" title

Ticket Photo (300px):
└─ Full width, zoomable image

Amount Card (100px):
├─ "$75" (H1, prominent)
└─ Status badge: "UNPAID"

Details List (auto):
├─ Row: Ticket Number
├─ Row: Date Received
├─ Row: Due Date (countdown)
├─ Row: Violation Type
├─ Row: Location
└─ Row: Notes

Actions (120px):
├─ "Mark as Paid" (success button)
├─ Gap (8px)
├─ "Edit Ticket" (secondary)
└─ "Delete Ticket" (destructive, text only)

Appeal Tips Section (auto):
├─ "📋 How to Appeal" (H3)
├─ Tips list (bullets)
├─ Success rate badge
└─ "File Appeal Online" link

Bottom Tab Bar (80px)
```

---

### **FRAME 10-13: Onboarding Screens**

**Frame Size:** 393 × 852px (each)

**Frame 10: Welcome**
```
Hero Image (400px)
App Logo (120px × 120px)
"Welcome to Parkopticon" (H1, centered)
Tagline (Body 1, centered)
Bottom: "Get Started" button
```

**Frame 11: Features**
```
3 Feature Cards:
├─ Icon + Title + Description (each 200px)
Bottom: "Next" button + Page dots
```

**Frame 12: Permissions**
```
Title: "We need permissions"
3 Permission Cards:
├─ Location (required)
├─ Notifications (recommended)
└─ Camera (optional)
Bottom: "Enable Permissions" button
```

**Frame 13: Tutorial**
```
Interactive map demo (500px)
Speech bubbles with tips
Bottom: "Start Exploring" button
```

---

### **FRAME 14-15: Modals**

**Frame 14: Quick Report Menu**
```
Overlay: Dark 50% opacity
Menu (bottom, 300px):
├─ "Report Parking Spot Here"
├─ "Report Enforcement Here"
├─ "Set My Car Here"
└─ "Cancel"
```

**Frame 15: Filter Overlay**
```
Overlay from right
Width: 300px
Height: Full screen
├─ Toggle list (marker types)
├─ Time filter radios
└─ "Apply" button (bottom)
```

---

## 🎨 Component Creation Order

**Start with these (foundational):**
1. Color styles
2. Text styles
3. Layout grid
4. Buttons (all variants)
5. Input fields
6. Cards

**Then create:**
7. Map markers
8. Bottom sheets
9. Navigation bars
10. Badges
11. Lists

**Finally assemble:**
12. Complete screens using components
13. Create variants for states
14. Build prototypes

---

## 🔗 Prototyping Connections

### **Main Flow Prototype:**
```
Map View
├─→ Tap marker → Marker Detail
├─→ Tap "Report Spot" → Report Spot Bottom Sheet
├─→ Tap "Report Enforcement" → Report Enforcement
├─→ Long press → Quick Report Menu
└─→ Bottom tabs → Other screens

Alerts Screen
└─→ Tap alert → Alert Detail

Tickets Screen
├─→ Tap ticket → Ticket Detail
└─→ Tap FAB → Add Ticket

Profile Screen
└─→ Tap settings → Settings screens
```

### **Interactions to Prototype:**
- Button hover states
- Text input focus
- Bottom sheet slide up
- Tab switching
- Pull to refresh
- Swipe to dismiss
- Modal open/close

---

## ✅ Design Checklist

Before development:
- [ ] All 18 screens designed
- [ ] All components created
- [ ] All states shown (normal, pressed, disabled)
- [ ] All error states designed
- [ ] Empty states designed
- [ ] Loading states designed
- [ ] Dark mode considered (optional)
- [ ] Prototype flows working
- [ ] Design tokens documented
- [ ] Assets exported for development

---

## 📤 Export Guidelines

**For Developers:**
- Export color hex codes → `colors.js`
- Export spacing values → `spacing.js`
- Export font sizes → `typography.js`
- Export icons as SVG (24px)
- Export images as PNG @1x, @2x, @3x

**Handoff:**
- Use Figma's "Inspect" panel
- Provide prototype link
- Document interactions
- Export asset files

---

**Ready to start designing! Open Figma and follow this guide. 🎨**
