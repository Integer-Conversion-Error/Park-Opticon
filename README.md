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

## ⚠️ Disclaimer

This repository contains only the web/mobile application for Parkopticon. The edge inference and autonomous reporting system is being developed in a separate repository.

## 🔮 Edge Inference System (Future Integration)

⭐ Smart Vehicle Sentinel & Enforcement Detection System — Project Summary (Resume-Ready)

I designed and implemented an AI-powered, low-power vehicle sentinel system that uses edge computing, mmWave radar, distributed IoT nodes, and cloud-based deep learning to detect nearby enforcement vehicles and pedestrian activity while maintaining strict power efficiency constraints for overnight operation.

The system integrates embedded hardware, computer vision, wireless networking, and microcontroller-driven event orchestration to provide real-time situational awareness around a parked vehicle.

⭐ Key Responsibilities & Technical Contributions
• Edge AI & Computer Vision Pipeline

Built an on-device inference pipeline using an Orange Pi 5 (RK3588S) with a 6-TOPS NPU, deploying quantized YOLO-based object detectors and MobileNet classifiers for vehicle and pedestrian identification.

Implemented a two-stage detection system combining NanoDet/YOLOv5n on edge and high-accuracy YOLOv8-L/Vision Transformer models in the cloud to classify enforcement vehicles with sub-0.1% false-negative rate.

Optimized inference for 1–3 frame wake events, reducing compute cost by >85% while maintaining accuracy.

• Embedded Systems & IoT Node Design

Architected a distributed mesh of ESP32-S3 microcontroller nodes equipped with:

mmWave radar for motion and vehicle signature detection

Ultra-low-power accelerometer (LIS3DH) for tamper and vibration sensing

Camera modules with rolling video buffers stored on microSD

Designed these nodes to operate at 0.3–0.6W, enabling continuous monitoring without draining the vehicle battery.

• Low-Power System Engineering

Engineered the core system to remain under a 50 Wh/12-hour power cap, using:

Suspend-to-RAM modes on the SBC

Interrupt-driven wake-on-GPIO

mmWave-triggered selective inference

ESP32-based rolling dashcam buffers to avoid keeping the SBC active

Modeled and validated energy usage across multiple operating states (idle, inference bursts, LTE upload).

• Sensor Fusion & Distributed Event Processing

Implemented a multi-sensor event pipeline combining:

mmWave radar signals

Motion classification

Vehicle silhouettes

Accelerometer tamper events

GPS/geolocation metadata

The system intelligently wakes the central compute module only when necessary, reducing noise and power consumption via edge-filtered events.

• Connectivity & Cloud Integration

Integrated LTE Cat-1/Cat-4 modem modules (SIMCom A7670/7600 series) with Canadian band support for secure image uploads and cloud verification.

Implemented a cloud inference API for high-precision confirmation of enforcement vehicle detections, transmitting only cropped frames for bandwidth efficiency.

Built fallback mechanisms to operate offline with local-only inference.

• Real-Time Analytics & Alerting

Developed logging, timestamping, sensor fusion, and event categorization for:

Enforcement vehicle detection

Pedestrian proximity alerts

Vehicle movement around the car

Impact and tampering events

Designed an extensible structure for future push notifications / mobile app integration.

⭐ Technologies Used

Edge AI: YOLOv5/8, NanoDet, MobileNetV3, RKNN Toolkit
Embedded Systems: ESP32-S3, mmWave radar, accelerometers, OV2640/OV5640 cameras, microSD storage
SBC & OS: Orange Pi 5, RK3588S NPU, Armbian/Linux, GPIO wake
Networking: LTE Cat-1/Cat-4 modules (SIMCom), UART/USB modems, ESP-NOW, Wi-Fi
Low-Power Design: Suspend-to-RAM, duty cycling, wake-on-interrupt, power budgeting
Cloud: ONNX Runtime, YOLOv8-L, API-driven verification pipeline
Other: GPS (u-blox NEO-8M), distributed IoT event orchestration, system-level integration

⭐ Impact

Engineered a system that provides 360° real-time sentry monitoring with <50 Wh overnight power usage.

Achieved high-precision enforcement vehicle detection using a hybrid edge/cloud inference architecture.

Built a novel distributed IoT + edge AI solution with applications in vehicle security, parking analytics, and privacy-centric autonomous monitoring.

It will connect to the app and act as an autonomous reporting node.

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
