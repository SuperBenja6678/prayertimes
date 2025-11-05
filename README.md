# Prayer Times App

A beautiful, feature-rich web application that displays Islamic prayer times for any city.

## Features

- 📍 **City Selection**: Search for any city worldwide or use your current location
- ⏰ **Current Prayer Times**: Displays all five daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha)
- ⏳ **Next Prayer Countdown**: Real-time countdown to the next prayer
- 🌙 **Last Third of Night**: Calculates and displays the time when the last third of the night begins
- 🕐 **Live Clock**: Displays current time with seconds
- 📅 **Hijri Date**: Shows the current Islamic calendar date
- 🌓 **Dark Mode**: Toggle between light and dark themes
- 🎯 **Active Prayer Indicator**: Highlights which prayer time period you're currently in
- ⚙️ **Calculation Methods**: Choose from multiple prayer time calculation methods (Hanafi, Standard, etc.)
- 📱 **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices

## How to Use

1. Open `index.html` in your web browser
2. **Search by City**: Enter a city name (e.g., "London", "New York", "Cairo") and click "Search"
3. **Use Current Location**: Click the 📍 button to automatically detect your location
4. **Choose Calculation Method**: Select your preferred calculation method from the dropdown
5. **Toggle Dark Mode**: Click the 🌙 button in the top right to switch themes
6. View prayer times, countdown, and last third of night information

## Calculation Methods

- **Muslim World League (Standard)**: Default method
- **Muslim World League (Hanafi)**: Uses Hanafi school for Asr calculation
- **Egyptian General Authority**: Based on Egyptian calculations
- **Umm al-Qura, Makkah**: Used in Saudi Arabia
- **Islamic Society of North America**: Common in North America

## Settings & Preferences

- Your last searched city is automatically saved
- Your dark mode preference is remembered
- Your calculation method preference is saved
- All preferences are stored in browser localStorage

## Notes

- The app uses the Aladhan API (https://api.aladhan.com) for prayer times
- The last third of the night is calculated from Maghrib (sunset) to Fajr (dawn)
- Location detection requires browser permission
- Works offline after initial load (except for fetching new prayer times)

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled.

## Deployment to Vercel

### Quick Deploy (Easiest Method)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy via Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/Login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect it's a static site
   - Click "Deploy"
   - Done! Your app will be live in seconds 🎉

### Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

### Alternative Hosting

- **Netlify**: Drag and drop your folder or connect GitHub
- **GitHub Pages**: Push to `gh-pages` branch
- **Cloudflare Pages**: Connect GitHub repo
- **Any static hosting**: Just upload the files!

