# 🅿️ Parkopticon

**Find parking. Avoid tickets. Stay informed.**

Parkopticon is a cross-platform mobile app that helps drivers find open street parking and avoid parking enforcement through crowdsourced, real-time user reports.

---

## 🎯 What is Parkopticon?

Parkopticon empowers drivers with community-driven intelligence about:

- 🅿️ **Available Parking Spots** - Real-time reports of open street parking
- 👮 **Enforcement Alerts** - Warnings when parking officers are nearby
- 🚗 **Parked Car Protection** - Get notified if enforcement approaches your vehicle
- 🎫 **Ticket Management** - Log tickets and get tips for appealing them

---

## ✨ Key Features

### For Drivers
- **Interactive Map View** - See available spots and enforcement in real-time
- **Report Parking Spots** - Share open spaces with optional photos
- **Report Enforcement** - Alert others to officer sightings, chalking, or ticketing
- **Smart Notifications** - Get push alerts if enforcement is near your parked car
- **Ticket Logger** - Track your tickets and learn how to appeal them

### Technical Features
- **Cross-Platform** - Works on both Android and iOS
- **Real-Time Updates** - Live map with crowdsourced data
- **GPS Integration** - Accurate location-based reporting
- **Photo Upload** - S3-style cloud storage for spot photos
- **Push Notifications** - Background location monitoring for alerts

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v20+)
- **Android Studio** (for Android emulation)
- **VS Code** (recommended)
- **Expo Go** app (for testing on real devices)

### Quick Setup

```powershell
# Clone or navigate to the project
cd "k:\Self Improvement\Coding\Park-Opticon\parkopticon"

# Install dependencies
npm install

# Start the development server
npx expo start

# Press 'a' for Android emulator or scan QR code with Expo Go
```

### Detailed Setup
See **[docs/setup/SETUP_GUIDE.md](docs/setup/SETUP_GUIDE.md)** for complete installation instructions including:
- Figma design setup
- Android/iOS emulation
- VS Code configuration
- Troubleshooting tips

For all documentation, see **[docs/README.md](docs/README.md)**

---

## 📁 Project Structure

```
parkopticon/
├── App.js                      # Main app entry point
├── app.json                    # Expo configuration
├── package.json                # Dependencies
│
├── assets/                     # Images, icons, fonts
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
│
└── src/                        # Source code
    ├── theme/                  # Design system (colors, typography, spacing)
    ├── screens/                # App screens
    ├── components/             # Reusable UI components
    ├── navigation/             # Navigation setup
    ├── services/               # API & external services
    └── utils/                  # Helper functions
```

See **[docs/development/PROJECT_STRUCTURE.md](docs/development/PROJECT_STRUCTURE.md)** for detailed explanation.

---

## 🛠️ Tech Stack

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo** - Development tooling and managed workflow
- **React Navigation** - Screen navigation
- **React Native Maps** - Interactive map interface
- **React Native Paper** - Material Design components

### Services
- **Expo Location** - GPS and geolocation
- **Expo Camera** - Photo capture
- **Expo Notifications** - Push notifications
- **AsyncStorage** - Local data persistence

### Backend (Future Phase)
- **FastAPI** - Python REST API
- **PostGIS** - Geospatial database
- **PostgreSQL** - Data storage
- **AWS S3** - Photo storage

---

## 📱 Current Status

**Phase 1: Frontend Development Environment ✅**
- [x] Project setup with Expo
- [x] Basic map view with markers
- [x] Theme system (colors, typography, spacing)
- [x] Location permissions
- [x] Interactive reporting (tap to add markers)
- [x] Development documentation

**Phase 2: Core Features (In Progress)**
- [ ] Navigation system (Bottom tabs)
- [ ] Report screens (Parking spots & Enforcement)
- [ ] Camera integration for photos
- [ ] Local data storage
- [ ] Notification system

**Phase 3: Backend Integration (Planned)**
- [ ] FastAPI backend server
- [ ] PostGIS geospatial queries
- [ ] Real-time data synchronization
- [ ] User authentication
- [ ] Cloud photo storage

**Phase 4: Advanced Features (Planned)**
- [ ] User profiles and reputation system
- [ ] Historical data and patterns
- [ ] Smart notifications (ML-based)
- [ ] Ticket appeal guidance
- [ ] Community moderation

---

## 🎨 Design

### Figma
Design files are maintained in Figma. The app follows:
- **8pt grid system** for consistent spacing
- **Material Design principles** for familiarity
- **Accessibility standards** for inclusive design

### Color Palette
- **Primary**: #2196F3 (Blue) - Trust and reliability
- **Success**: #4CAF50 (Green) - Available parking
- **Error**: #F44336 (Red) - Enforcement alerts
- **Warning**: #FFC107 (Yellow) - Caution

---

## 🧪 Testing

### Running on Android Emulator
```powershell
npx expo start
# Press 'a' to launch on Android
```

### Running on Real Device
1. Install **Expo Go** from App Store/Play Store
2. Start dev server: `npx expo start`
3. Scan QR code with Expo Go

### Testing Location Features
- Android Emulator: Use "Extended Controls" → Location to set GPS coordinates
- Real Device: Enable location services and grant permissions

---

## 📚 Documentation

**Complete documentation:** [docs/README.md](docs/README.md)

### Quick Links
- **[docs/setup/SETUP_GUIDE.md](docs/setup/SETUP_GUIDE.md)** - Complete environment setup
- **[docs/setup/QUICK_START.md](docs/setup/QUICK_START.md)** - 5-minute quick setup
- **[docs/design/DESIGN_QUICK_REF.md](docs/design/DESIGN_QUICK_REF.md)** - Design overview
- **[docs/development/PROJECT_STRUCTURE.md](docs/development/PROJECT_STRUCTURE.md)** - Code organization
- **[docs/setup/CHECKLIST.md](docs/setup/CHECKLIST.md)** - Setup verification

---

## 🤝 Contributing

This is currently a solo project, but suggestions and ideas are welcome!

### Development Workflow
1. Design screens in Figma
2. Implement UI in React Native
3. Test on emulator and real device
4. Iterate based on feedback

---

## 🐛 Troubleshooting

### Common Issues

**"Cannot connect to Metro bundler"**
```powershell
npx expo start -c  # Clear cache
```

**"ADB not recognized"**
- Add Android SDK to PATH (see SETUP_GUIDE.md)

**Emulator is slow**
- Install HAXM (Intel) or enable Hyper-V
- Allocate more RAM in AVD settings

See **[docs/setup/SETUP_GUIDE.md](docs/setup/SETUP_GUIDE.md)** Section 8 for more troubleshooting tips.

---

## 📄 License

This project is for educational and personal use.

---

## 🙏 Acknowledgments

- **Expo** for excellent development tools
- **React Native Maps** for map integration
- **Material Design** for UI guidelines
- The open-source community for amazing libraries

---

## 📞 Contact

Questions or suggestions? Open an issue or reach out!

---

**Happy coding! Let's make parking easier for everyone. 🚗🅿️**
