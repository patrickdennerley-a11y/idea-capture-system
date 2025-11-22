# How to Install Neural Capture on Your iPhone 12

Your app is now a Progressive Web App (PWA) that can be installed on your iPhone 12 home screen!

## Installation Steps

### 1. Deploy Your App
First, you need to make your app accessible from your iPhone. You have several options:

#### Option A: Deploy to a hosting service (Recommended)
- **Vercel** (Easiest):
  ```bash
  npm install -g vercel
  vercel
  ```
- **Netlify**: Drag and drop the `dist` folder after running `npm run build`
- **GitHub Pages**: Push to GitHub and enable Pages

#### Option B: Use your local network (for testing)
1. Find your computer's local IP address:
   - Mac: System Preferences → Network
   - Windows: `ipconfig` in command prompt
   - Linux: `ip addr` or `hostname -I`

2. Start your dev server:
   ```bash
   npm run dev
   ```

3. Update `vite.config.js` to allow network access:
   ```js
   server: {
     host: '0.0.0.0',  // Add this line
     port: 3000,
     // ... rest of config
   }
   ```

4. Access from iPhone using your IP: `http://192.168.x.x:3000`

### 2. Install on iPhone

Once the app is accessible from your iPhone:

1. **Open Safari** on your iPhone 12 (must use Safari, not Chrome)

2. **Navigate to your app's URL**

3. **Tap the Share button** (the square with an arrow pointing up) at the bottom of the screen

4. **Scroll down and tap "Add to Home Screen"**

5. **Customize the name** if you want (default: "Neural Capture")

6. **Tap "Add"** in the top right corner

### 3. Launch the App

1. **Find the icon** on your home screen (it will have the purple neural network icon)

2. **Tap to open** - the app will launch in full-screen mode without Safari's UI

3. **Use like a native app** - it will remember your data locally on your iPhone

## Features You Get

✅ **Home Screen Icon** - Launch like any native app
✅ **Full Screen Mode** - No browser UI, feels native
✅ **Offline Capable** - Once loaded, works without internet
✅ **Fast Loading** - Cached for instant startup
✅ **Local Data Storage** - All your data stays on your device

## Important Notes

### Data Sync
- Currently, data is stored **locally on each device**
- If you use the app on multiple devices, they won't sync automatically
- To sync across devices, you'll need to integrate Supabase (future enhancement)

### Export/Backup
- Use the **Export** button in the app to save your data
- This creates a JSON file you can reimport later
- Good practice to export regularly as backup

### Browser Requirements
- **Installation**: Must use Safari on iOS
- **Usage**: Once installed, works as standalone app
- Chrome/Firefox on iOS can't install PWAs (Apple restriction)

## Troubleshooting

### "Add to Home Screen" option not showing?
- Make sure you're using **Safari** (not Chrome or Firefox)
- Some features require **HTTPS** - deploy to a hosting service for best results
- Try accessing the manifest directly: `your-url/manifest.json` - it should show the JSON

### App not opening in full screen?
- Delete the app from home screen
- Clear Safari cache: Settings → Safari → Clear History and Website Data
- Try installing again

### Icons not showing?
- Make sure you deployed the `public` folder
- Check browser console for 404 errors
- Verify files exist at `/icon-192.png`, `/apple-touch-icon.png`, etc.

### Data not persisting?
- Check iPhone Settings → Safari → Advanced → Website Data
- Don't use "Private Browsing" mode
- Make sure "Prevent Cross-Site Tracking" isn't blocking localStorage

## Next Steps

Consider these enhancements:

1. **Add a Service Worker** for better offline support
2. **Integrate Supabase** for cross-device sync
3. **Add push notifications** (requires backend + HTTPS)
4. **Create custom app icon** to replace the default purple neural one

## Questions?

If you need help:
1. Check browser console for errors (Safari → Develop → iPhone → your app)
2. Verify the manifest loads: visit `your-url/manifest.json`
3. Make sure all icons exist in the `public` folder

---

**Your app is now mobile-ready!** 📱✨
