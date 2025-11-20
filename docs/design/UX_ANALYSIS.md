# 🎨 Parkopticon - Complete UX Analysis & View Breakdown

**Date:** November 7, 2025  
**Purpose:** Define all screens, user flows, and use-cases before designing in Figma

---

## 📱 Core User Personas

### 1. **The Parker** 🚗
- Needs to find available parking quickly
- Wants to avoid tickets
- Looking for street parking near destination
- Time-sensitive (late for meeting, appointment, etc.)

### 2. **The Community Helper** 🤝
- Reports open spots they're vacating
- Reports enforcement sightings to help others
- Active contributor to the community
- Wants reputation/karma points

### 3. **The Ticket Avoider** 🚨
- Parks frequently in enforcement zones
- Wants real-time alerts when enforcement is near their car
- Has received tickets before
- Willing to move car if alerted

### 4. **The Ticket Manager** 🎫
- Has received multiple tickets
- Wants to track ticket history
- Looking for appeal strategies
- Needs to manage payment deadlines

---

## 🗺️ Complete User Journey Map

### Journey 1: Finding Parking
```
User arrives at destination
    ↓
Opens app → Map View
    ↓
Sees green markers (available spots)
    ↓
Taps marker → Info popup (when reported, photo, distance)
    ↓
Navigates to spot
    ↓
Parks successfully
    ↓
(Optional) Reports when leaving
```

### Journey 2: Reporting a Parking Spot
```
User is leaving parking spot
    ↓
Opens app → Taps "Report Spot" button
    ↓
Report Spot Screen (GPS auto-captured)
    ↓
Takes photo (optional)
    ↓
Adds notes (optional: "2-hour limit", "meter parking")
    ↓
Submits → Spot appears on map
    ↓
Gets karma points
```

### Journey 3: Reporting Enforcement
```
User sees parking officer/meter maid
    ↓
Opens app → Taps "Report Enforcement"
    ↓
Report Enforcement Screen
    ↓
Selects type: Officer/Chalking/Ticketing
    ↓
Takes photo (optional)
    ↓
Submits → Alert sent to nearby parked users
```

### Journey 4: Getting Alerted
```
User parks car and walks away
    ↓
Marks location as "My Parked Car"
    ↓
App monitors enforcement reports in radius
    ↓
Enforcement reported within 500ft
    ↓
PUSH NOTIFICATION: "⚠️ Enforcement near your car!"
    ↓
User sees notification → Opens app
    ↓
Map shows enforcement location vs their car
    ↓
Decision: Move car or stay
```

### Journey 5: Logging a Ticket
```
User receives parking ticket
    ↓
Opens app → Ticket Log tab
    ↓
Taps "Add Ticket"
    ↓
Fills form: Amount, date, location, violation type
    ↓
Takes photo of ticket
    ↓
Submits → Ticket saved
    ↓
Views appeal tips specific to violation type
```

---

## 📲 Complete Screen Breakdown

### **PRIMARY SCREENS** (Main Navigation)

#### 1. **Map View (Home)** 🗺️
**Purpose:** Main interface - see parking spots and enforcement in real-time

**Components:**
- Full-screen map (covers 80% of screen)
- User location (blue dot)
- Parking spot markers (green pins with "P")
- Enforcement markers (red pins with "⚠️")
- Ticket location markers (orange pins with "🎫")
- "My Car" marker (blue car icon)
- Cluster groups when zoomed out

**Top Bar:**
- App logo/title
- Search location field
- Filter button (filter marker types)
- Settings icon

**Bottom Bar:**
- "Report Spot" button (green)
- "Report Enforcement" button (red)
- Center on location button
- Toggle "My Car" location

**Interactions:**
- Tap marker → Info popup
- Long press map → Quick report menu
- Pinch to zoom
- Drag to pan
- Tap info popup → Full details screen

**States:**
- Loading (skeleton markers)
- Empty (no reports nearby)
- Offline mode (cached data only)
- Location permission denied

---

#### 2. **Alerts Screen** 🚨
**Purpose:** View all enforcement alerts, filter by proximity and time

**Components:**
- List view of alerts
- Each alert card shows:
  - Type (Officer/Chalking/Ticketing)
  - Time (e.g., "5 minutes ago")
  - Distance from user (e.g., "0.3 miles away")
  - Distance from "My Car" if set (e.g., "⚠️ 200ft from your car!")
  - Thumbnail photo if available
  - Address/cross streets
  - Number of confirmations

**Top Bar:**
- "Alerts" title
- Filter dropdown (All/Active/Resolved)
- Sort by (Time/Distance)

**Filters:**
- Time range (Last 15min, 1hr, 6hrs, 24hrs)
- Distance (Within 0.5mi, 1mi, 5mi)
- Type (All/Officers/Chalking/Ticketing)
- Active only (hide old reports)

**Interactions:**
- Tap alert → Opens detail view with map
- Swipe to dismiss (mark as resolved)
- Pull to refresh
- "Confirm" button → +1 to report credibility

**Empty States:**
- No alerts nearby → "All clear! 🎉"
- No active alerts → "No recent enforcement reports"

---

#### 3. **Ticket Log Screen** 🎫
**Purpose:** Track received tickets, manage appeals, see payment deadlines

**Components:**
- Summary cards at top:
  - Total tickets received
  - Total amount owed
  - Tickets appealed
  - Tickets dismissed
  
- List of tickets:
  - Date received
  - Amount
  - Violation type
  - Location
  - Status (Unpaid/Paid/Appealed/Dismissed)
  - Photo of ticket

**Actions:**
- "Add Ticket" FAB (Floating Action Button)
- Sort by date/amount/status
- Filter by status

**Each Ticket Card:**
- Top: Date and amount (large, prominent)
- Violation type with icon
- Location/address
- Status badge (color-coded)
- Thumbnail of ticket photo
- Due date countdown
- "View Details" button

**Interactions:**
- Tap ticket → Full ticket details screen
- Long press → Options (Edit, Delete, Mark Paid)

---

#### 4. **Profile / Settings Screen** ⚙️
**Purpose:** User preferences, stats, app settings

**Sections:**

**User Stats:**
- Parking spots reported
- Enforcement reports submitted
- Karma points/reputation
- Helpful reports (confirmed by others)
- Account created date

**Notification Settings:**
- Enable enforcement alerts
- Alert radius (500ft, 1000ft, 0.5mi, 1mi)
- Sound/vibration
- Quiet hours
- Only alert when "My Car" is set

**App Settings:**
- Map style (Standard/Satellite/Hybrid)
- Show/hide marker types
- Auto-report expiration (spots older than X hours)
- Distance units (feet/miles or meters/km)
- Language

**Account:**
- Profile picture
- Username
- Email
- Change password
- Logout

**Legal/About:**
- Privacy policy
- Terms of service
- Report a bug
- App version
- Credits

---

### **SECONDARY SCREENS** (Accessed from Primary)

#### 5. **Report Parking Spot Screen** 🅿️
**Purpose:** Allow users to report available parking

**Flow:** Bottom sheet or full screen modal

**Components:**
- Map preview (shows pin location)
- GPS coordinates (auto-captured, editable)
- "Adjust location" button → Opens map selector

**Form Fields:**
- Photo (optional):
  - "Take Photo" button
  - "Choose from Gallery" button
  - Image preview

- Spot Type (optional):
  - Street parking (default)
  - Metered
  - Parking lot
  - Garage

- Time Limit (optional):
  - No limit
  - 1 hour
  - 2 hours
  - 4 hours
  - Custom

- Notes (optional):
  - Text field for details
  - Example: "Next to blue mailbox"
  - Character limit: 200

- Restriction Notes (optional):
  - "No parking during rush hour"
  - "Permit required"
  - "Meter until 6pm"

**Actions:**
- "Cancel" button (top left)
- "Submit" button (bottom, prominent)
- "Save as Draft" (optional)

**Validation:**
- GPS location required
- Prevents spam (max 10 reports per day)

**Success State:**
- "Spot Reported! 🎉"
- "+10 karma points"
- "Return to Map" button

---

#### 6. **Report Enforcement Screen** 👮
**Purpose:** Alert others to enforcement presence

**Flow:** Bottom sheet or full screen modal

**Components:**
- Map preview (shows enforcement location)
- GPS coordinates (auto-captured)

**Form Fields:**
- **Enforcement Type (required):**
  - ☑️ Officer Present (patrolling)
  - ☑️ Chalking Tires (marking cars)
  - ☑️ Actively Ticketing (writing tickets)
  - ☑️ Tow Truck Present

- Photo (highly encouraged):
  - "Take Photo" button
  - "Choose from Gallery"
  - Image preview (blurred faces automatically?)

- Direction (optional):
  - Heading: North/South/East/West
  - Helps users know if officer is approaching

- Additional Notes (optional):
  - "On foot" vs "In vehicle"
  - "Multiple officers"

**Actions:**
- "Cancel" button
- "Submit Alert" button (RED, prominent)

**Success State:**
- "Alert Sent! ⚠️"
- "Nearby parked users have been notified"
- "+15 karma points"

---

#### 7. **Marker Detail Screen** 📍
**Purpose:** Full details about a parking spot or enforcement alert

**For Parking Spot:**
- Large photo (if available)
- Reported time (e.g., "15 minutes ago")
- Distance from user
- Address/intersection
- Spot details:
  - Type (street/metered/lot)
  - Time limit
  - Restrictions
- Notes from reporter
- "Navigate" button (opens Maps app)
- "Report Spot Taken" button
- "This was helpful" thumbs up

**For Enforcement Alert:**
- Large photo (if available)
- Reported time
- Distance from user
- Distance from "My Car" (if set)
- Enforcement type with icon
- Address/intersection
- Direction/heading
- Reporter's notes
- Number of confirmations
- "Confirm" button (I see them too!)
- "Mark as Gone" button
- "Navigate" button

---

#### 8. **Add Ticket Screen** 📝
**Purpose:** Log a received parking ticket

**Form Fields:**
- **Photo of Ticket (encouraged):**
  - "Take Photo" button
  - Auto-extracts text with OCR (if possible)
  - Manual entry fallback

- **Ticket Number:**
  - Text field
  - Auto-filled from OCR

- **Amount:**
  - Currency input
  - Auto-filled from OCR

- **Date Received:**
  - Date picker
  - Defaults to today

- **Due Date:**
  - Date picker
  - Calculate from received date + typical window

- **Location:**
  - Map selector
  - Address field
  - Auto-filled from GPS

- **Violation Type:**
  - Dropdown menu:
    - Expired meter
    - No parking zone
    - Street cleaning
    - Fire hydrant
    - Handicap zone
    - Time limit exceeded
    - Other (specify)

- **Notes:**
  - Text area
  - Why you think it was unfair

- **Status:**
  - Unpaid (default)
  - Paid
  - Appealed
  - Dismissed

**Actions:**
- "Cancel"
- "Save Ticket"

**Success:**
- Ticket saved to log
- "View Appeal Tips" button
- Return to ticket log

---

#### 9. **Ticket Detail Screen** 🎫
**Purpose:** View full ticket information and appeal guidance

**Components:**
- Full ticket photo (zoomable)
- All ticket details (read-only)
- Status badge (large)

**Actions:**
- "Edit Ticket" button
- "Mark as Paid" button
- "Delete Ticket" confirmation

**Appeal Tips Section:**
- "How to Appeal This Ticket" heading
- Tips specific to violation type:
  - Common successful arguments
  - Required evidence (photos, etc.)
  - Where to file appeal
  - Typical success rate
  - Time limit to appeal

**Due Date Section:**
- Countdown timer
- "Pay Online" link
- "Add to Calendar" button
- Reminder notifications settings

---

#### 10. **Set "My Car" Location Screen** 🚗
**Purpose:** Mark where user parked for enforcement alerts

**Flow:** Quick action from map

**Components:**
- "You parked here" confirmation
- Map with car marker
- Address/intersection
- "Adjust location" (drag pin)

**Settings:**
- Alert radius (500ft - 1 mile)
- Auto-clear after X hours
- "Remember this spot" (for frequent locations)

**Actions:**
- "Confirm" button
- "Cancel" button
- "Clear My Car Location" (if already set)

**Confirmation:**
- "Car location saved! 🚗"
- "You'll be alerted if enforcement is nearby"
- Show radius circle on map

---

#### 11. **Onboarding Screens** 👋
**Purpose:** First-time user education (3-4 screens)

**Screen 1: Welcome**
- App logo/hero image
- "Welcome to Parkopticon!"
- Tagline: "Find parking. Avoid tickets. Stay informed."
- "Get Started" button

**Screen 2: Features**
- Icon + text for each feature:
  - 🗺️ "Find available parking in real-time"
  - 👮 "Get alerts when enforcement is nearby"
  - 🎫 "Track tickets and learn how to appeal"
- "Next" button

**Screen 3: Permissions**
- "To provide the best experience, we need:"
- Location permission (required):
  - "Show nearby parking and alerts"
- Notification permission (recommended):
  - "Alert you when enforcement is near your car"
- Camera permission (optional):
  - "Take photos for reports"
- "Enable Permissions" button

**Screen 4: Quick Tutorial**
- Interactive map demo
- "Tap markers to see details"
- "Use bottom buttons to report"
- "Start Exploring" button

---

#### 12. **Search Location Screen** 🔍
**Purpose:** Find parking in a different area than current location

**Components:**
- Search bar (prominent)
- Recent searches
- Saved locations:
  - Home
  - Work
  - Favorite spots
- Current location option

**Search Results:**
- Address suggestions (autocomplete)
- Points of interest
- Tap result → Centers map on location

---

#### 13. **Filter/Settings Overlay** 🔧
**Purpose:** Customize what shows on map

**Toggles:**
- Show parking spots ✅
- Show enforcement alerts ✅
- Show ticket locations ☑️
- Show my car ✅
- Show expired reports ☑️

**Time Filters:**
- Reports from last 15 min
- Reports from last 1 hour
- Reports from last 6 hours
- Show all

**Actions:**
- "Apply" button
- "Reset to Defaults"

---

#### 14. **User Profile Screen** 👤
**Purpose:** View another user's stats and reputation

**Components:**
- Profile picture
- Username
- Reputation score/karma
- Join date
- Stats:
  - Parking spots reported
  - Enforcement alerts sent
  - Helpful reports (confirmed)
  - Report accuracy %

**Actions:**
- "Block User" (if spam)
- "Report User" (if abuse)

---

#### 15. **Notification Center** 🔔
**Purpose:** See all past notifications

**List of Notifications:**
- Enforcement alerts
- Spot confirmations
- Karma earned
- Ticket due date reminders
- App updates

**Each Notification:**
- Icon (type-specific)
- Title
- Time
- Tap → Opens relevant screen

---

### **MODAL/OVERLAY SCREENS**

#### 16. **Quick Report Menu** ⚡
**Trigger:** Long press on map

**Options:**
- "Report Parking Spot Here"
- "Report Enforcement Here"
- "Set My Car Location Here"
- "Cancel"

---

#### 17. **Confirmation Dialogs** ✓
- Delete ticket confirmation
- Clear "My Car" location
- Mark alert as resolved
- Logout confirmation
- Delete account warning

---

#### 18. **Error States** ⚠️
- No internet connection
- GPS not available
- Camera permission denied
- API error (server down)
- Empty states (no data)

---

## 🎯 Use Case Matrix

| User Goal | Primary Screen | Secondary Screens | Success Metric |
|-----------|---------------|-------------------|----------------|
| Find parking near me | Map View | Marker Detail → Navigate | User finds spot |
| Report parking spot | Map View | Report Spot | Spot appears on map |
| Avoid parking ticket | Map View + Alerts | Set My Car → Receive alert | User moves car |
| Report enforcement | Map View | Report Enforcement | Alert sent to users |
| Log received ticket | Ticket Log | Add Ticket → Detail | Ticket saved |
| Appeal a ticket | Ticket Log | Ticket Detail (tips section) | User files appeal |
| Check if safe to park | Map View + Alerts | Filter by location | No recent enforcement |
| Track ticket deadlines | Ticket Log | Ticket Detail | Reminder set |
| Earn reputation | All screens | Profile | Karma points increase |

---

## 🔄 User Flows (Detailed)

### **Flow 1: New User First Session**
```
1. App opens
2. Onboarding Screen 1 (Welcome)
3. Swipe → Onboarding Screen 2 (Features)
4. Swipe → Onboarding Screen 3 (Permissions)
5. Tap "Enable Permissions"
   → iOS/Android permission prompts
6. Permissions granted
7. Onboarding Screen 4 (Tutorial)
8. Tap "Start Exploring"
9. → Map View (loaded with nearby reports)
10. Tutorial tooltips appear:
    - "These are available parking spots"
    - "Tap to report"
11. User ready to use app
```

### **Flow 2: Finding Parking**
```
1. User opens app → Map View
2. Sees current location on map
3. Zooms out to see wider area
4. Green markers (parking spots) visible
5. Taps green marker
   → Info popup appears
6. Reviews: Photo, time reported, distance
7. Taps "Navigate"
   → Opens Apple Maps / Google Maps
8. Follows directions
9. Parks in spot
10. (Optional) Returns to app
11. (Optional) Taps thumbs up "This was helpful"
12. (Optional) When leaving, reports spot
```

### **Flow 3: Getting Enforcement Alert**
```
1. User parks car on street
2. Opens app
3. Long press on map → "Set My Car Location Here"
4. Confirms location
5. Alert radius set to 1000ft
6. User walks away from car
7. App runs in background
8. Another user reports enforcement 800ft away
9. Backend checks: Is anyone parked within 1000ft?
10. User gets push notification:
    "⚠️ Enforcement Alert: 800ft from your car"
11. User opens notification
    → Opens app to Map View
12. Map shows red enforcement marker
13. User sees distance and time
14. Decides to move car
15. Returns to car and relocates
16. Taps "Clear My Car Location"
```

### **Flow 4: Reporting Enforcement**
```
1. User walking, sees parking officer
2. Opens app
3. Taps "Report Enforcement" button
4. Report Enforcement Screen opens
5. GPS location auto-captured
6. User selects type: "Officer Present"
7. Taps "Take Photo"
8. Camera opens
9. Takes photo of officer (from distance)
10. Adds note: "Heading north on Main St"
11. Taps "Submit Alert"
12. Success message appears
13. Backend: Finds users with cars within radius
14. Sends push notifications to those users
15. Reporter gets +15 karma points
16. Returns to map
17. Red marker now visible at that location
```

### **Flow 5: Logging & Appealing a Ticket**
```
1. User returns to car, finds ticket
2. Opens app
3. Navigates to Ticket Log tab
4. Taps "Add Ticket" button
5. Add Ticket Screen opens
6. Taps "Take Photo"
7. Takes photo of ticket
8. OCR extracts: Amount ($75), Date, Ticket #
9. User confirms/edits extracted info
10. Selects violation: "Expired Meter"
11. Adds note: "Meter was broken, display was blank"
12. Taps "Save Ticket"
13. Success: "Ticket saved"
14. Taps "View Appeal Tips"
15. Reads tips specific to expired meter:
    - "Take photo of broken meter"
    - "Note date/time meter was broken"
    - "File appeal within 21 days"
    - "Success rate: 35%"
16. User takes photos of broken meter
17. Files appeal online (external)
18. Returns to app
19. Edits ticket status: "Appealed"
```

---

## 📐 Design Considerations

### **Navigation Patterns**

**Bottom Tab Navigation (Primary):**
```
[ 🗺️ Map ] [ 🚨 Alerts ] [ 🎫 Tickets ] [ ⚙️ Profile ]
```

**Floating Action Buttons (Context-Specific):**
- Map View: "Report Spot" and "Report Enforcement"
- Ticket Log: "Add Ticket"

**Top Navigation:**
- Back button (when applicable)
- Screen title
- Action buttons (Filter, Search, etc.)

### **Color Psychology**

- **Green** 🟢: Available parking (positive, go)
- **Red** 🔴: Enforcement alerts (danger, stop)
- **Orange** 🟠: Tickets (warning, caution)
- **Blue** 🔵: User location, info (neutral, trust)
- **Gray** ⚫: Expired/resolved reports (inactive)

### **Accessibility**

- High contrast markers
- Color blind friendly (use icons + colors)
- Large tap targets (min 44x44pt)
- Screen reader support
- Dynamic text sizing
- Haptic feedback for alerts

### **Performance**

- Marker clustering (many markers → one cluster)
- Lazy loading (load reports as user pans)
- Image compression for photos
- Offline mode (cache recent reports)
- Background location limits (battery saving)

---

## 🎨 Next Step: Figma Frame Specification

Now that we have all screens defined, we can create the complete Figma frame structure:

**Total Screens to Design:** 18 main screens + variations

Would you like me to create:
1. **Detailed Figma frame specifications** (sizes, components, layout grids)
2. **Component library structure** (buttons, cards, markers, etc.)
3. **Screen-by-screen design requirements** (what goes on each frame)

Let me know and I'll create the complete Figma design guide! 🎨
