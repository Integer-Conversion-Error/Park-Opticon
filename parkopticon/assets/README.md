# Asset Requirements for Parkopticon

**This folder will contain all images, icons, and other assets for your app.**

---

## 📦 Required Assets (To Be Created)

### App Icons
- **icon.png** - 1024 × 1024 px
  - Main app icon (rounded square)
  - Used on home screen and app stores
  
- **adaptive-icon.png** - 1024 × 1024 px
  - Android adaptive icon (foreground layer)
  - Design with safe area (inner 816 × 816 px)
  
- **splash.png** - 1242 × 2436 px
  - Launch screen image
  - Shows while app is loading

- **favicon.png** - 48 × 48 px
  - Web version icon (if using web)

### Feature Icons (Create in Figma → Export as PNG/SVG)

**Map Markers:**
- `parking-marker.png` (3 sizes: 1x, 2x, 3x)
- `enforcement-marker.png`
- `ticket-marker.png`
- `user-location-marker.png`

**Navigation Icons:**
- `map-icon.png`
- `alert-icon.png`
- `ticket-log-icon.png`
- `settings-icon.png`

**Action Icons:**
- `camera-icon.png`
- `location-icon.png`
- `notification-icon.png`
- `checkmark-icon.png`

---

## 🎨 Design Guidelines

### App Icon (`icon.png`)
- **Size**: 1024 × 1024 px
- **Format**: PNG with transparency
- **Style**: Simple, recognizable, works at small sizes
- **Color**: Use your primary brand color (#2196F3)
- **Suggestion**: Parking "P" symbol with location pin

### Splash Screen (`splash.png`)
- **Size**: 1242 × 2436 px (iPhone 12 Pro Max)
- **Format**: PNG
- **Background**: Solid color or simple gradient
- **Content**: App logo centered, no text
- **Safe area**: Keep important elements in center 50%

### Map Markers
- **Size**: 40 × 40 px (@1x), 80 × 80 (@2x), 120 × 120 (@3x)
- **Format**: PNG with transparency
- **Colors**:
  - Parking: Green (#4CAF50)
  - Enforcement: Red (#F44336)
  - Ticket: Orange (#FF9800)
  - User: Blue (#2196F3)

---

## 📁 Folder Organization

```
assets/
├── icons/
│   ├── map/
│   │   ├── parking-marker@1x.png
│   │   ├── parking-marker@2x.png
│   │   ├── parking-marker@3x.png
│   │   ├── enforcement-marker@1x.png
│   │   └── ...
│   ├── navigation/
│   │   ├── map-icon.png
│   │   ├── alert-icon.png
│   │   └── ...
│   └── actions/
│       ├── camera-icon.png
│       └── ...
├── images/
│   ├── onboarding/
│   │   ├── welcome-1.png
│   │   └── welcome-2.png
│   └── placeholders/
│       └── no-image.png
├── fonts/
│   └── (custom fonts if needed)
├── icon.png
├── adaptive-icon.png
├── splash.png
└── favicon.png
```

---

## 🎯 How to Create Assets

### Method 1: Design in Figma
1. Create icons in Figma (40 × 40 px artboards)
2. Export at 1x, 2x, 3x scales
3. Save to appropriate folder
4. Use in React Native:
   ```javascript
   <Image source={require('./assets/icons/parking-marker.png')} />
   ```

### Method 2: Use Icon Libraries (Easier!)
Instead of creating custom icons, use built-in icon sets:

```javascript
import { MaterialIcons } from '@expo/vector-icons';

<MaterialIcons name="local-parking" size={24} color="#4CAF50" />
```

**Popular icon sets included with Expo:**
- MaterialIcons
- FontAwesome
- Ionicons
- Feather

Browse all icons: https://icons.expo.fyi/

---

## 🖼️ Using Assets in Code

### Images
```javascript
import { Image } from 'react-native';

// Local asset
<Image 
  source={require('./assets/icon.png')} 
  style={{ width: 100, height: 100 }}
/>

// Remote image
<Image 
  source={{ uri: 'https://example.com/image.jpg' }}
  style={{ width: 100, height: 100 }}
/>
```

### SVG Icons (requires react-native-svg)
```javascript
import Svg, { Path } from 'react-native-svg';

<Svg width="24" height="24" viewBox="0 0 24 24">
  <Path d="M..." fill="#2196F3" />
</Svg>
```

### Expo Vector Icons
```javascript
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';

<MaterialIcons name="map" size={24} color="#2196F3" />
<FontAwesome name="car" size={24} color="#4CAF50" />
```

---

## 📝 Asset Optimization Tips

### File Size
- Compress PNGs: Use TinyPNG or ImageOptim
- Use WebP format for better compression (supported by React Native)
- Limit image dimensions to what's actually displayed

### Performance
- Use `@1x`, `@2x`, `@3x` for different screen densities
- React Native automatically picks the right size
- Don't use huge images that get scaled down

### Lazy Loading
For many images, load them lazily:
```javascript
import { Image } from 'expo-image';

<Image
  source={{ uri: 'https://...' }}
  placeholder={require('./assets/placeholder.png')}
  contentFit="cover"
/>
```

---

## 🎨 Quick Start: Use Icon Libraries First

**Recommendation**: Start with Expo Vector Icons, then create custom assets later if needed.

**Why?**
- ✅ Free and already included
- ✅ Thousands of icons available
- ✅ Scalable (vector-based)
- ✅ Easy to change colors
- ✅ No export/import workflow

**When to create custom assets:**
- Need specific branding
- Unique map markers
- Custom illustrations
- App icon and splash screen (required)

---

## 📚 Resources

- **Figma Export Guide**: https://help.figma.com/hc/en-us/articles/360040028114
- **Expo Assets**: https://docs.expo.dev/guides/assets/
- **Expo Vector Icons**: https://icons.expo.fyi/
- **App Icon Generator**: https://www.appicon.co/
- **Splash Screen Generator**: https://www.apetools.webprofusion.com/

---

## ✅ TODO: Create These Assets

- [ ] App icon (icon.png) - 1024 × 1024
- [ ] Adaptive icon (adaptive-icon.png) - 1024 × 1024
- [ ] Splash screen (splash.png) - 1242 × 2436
- [ ] Parking marker icon
- [ ] Enforcement marker icon
- [ ] Custom illustrations (optional)

**For now**: The app uses default Expo assets. Replace them when you're ready!

---

**Pro tip**: Focus on functionality first, polish assets later! 🎨
