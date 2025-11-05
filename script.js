// Prayer times API configuration
const API_BASE_URL = 'https://api.aladhan.com/v1/timingsByCity';
const TIME_API_URL = 'https://worldtimeapi.org/api/timezone';

// Cache for prayer times and geocoding results
let currentPrayerTimes = null;
let prayerTimesArray = [];
let timerInterval = null;
let currentTimeInterval = null;
let calculationMethod = 2; // Default: Muslim World League (Standard)
let currentTimezone = null; // Store timezone for online time
let geocodeCache = {}; // Cache geocoding results to reduce API calls
let searchDebounceTimer = null; // For debouncing city search
let currentSuggestions = []; // Store current suggestions

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const cityInput = document.getElementById('cityInput');
    const locationBtn = document.getElementById('locationBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const calculationMethodSelect = document.getElementById('calculationMethod');
    const locationName = document.getElementById('locationName');

    searchBtn.addEventListener('click', handleSearch);
    locationBtn.addEventListener('click', handleLocationClick);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    calculationMethodSelect.addEventListener('change', handleMethodChange);
    
    // Click city name to edit
    locationName.addEventListener('click', () => {
        const cityName = locationName.textContent;
        cityInput.value = cityName;
        cityInput.focus();
        document.getElementById('prayerTimes').classList.add('hidden');
        hideSuggestions();
    });

    // Autocomplete search as user types
    cityInput.addEventListener('input', handleCityInput);
    
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentSuggestions.length > 0) {
                // Select first suggestion
                selectCity(currentSuggestions[0]);
            } else {
                handleSearch();
            }
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.city-input-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Initialize dark mode from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }

    // Initialize calculation method from localStorage
    const savedMethod = localStorage.getItem('calculationMethod');
    if (savedMethod) {
        calculationMethod = parseInt(savedMethod);
        calculationMethodSelect.value = savedMethod;
    }

    // Start time display immediately (even without city)
    updateCurrentTime();
    currentTimeInterval = setInterval(updateCurrentTime, 1000);

    // Try to load saved city from localStorage
    const savedCity = localStorage.getItem('prayerTimesCity');
    if (savedCity) {
        cityInput.value = savedCity;
        handleSearch();
    }
});

async function handleCityInput(e) {
    const query = e.target.value.trim();
    
    // Clear suggestions if query is too short
    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    // Debounce API calls
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(async () => {
        await searchCities(query);
    }, 300); // 300ms delay
}

async function searchCities(query) {
    const suggestionsDiv = document.getElementById('citySuggestions');
    suggestionsDiv.classList.remove('hidden');
    suggestionsDiv.innerHTML = '<div class="suggestion-loading">Searching...</div>';

    try {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            addressdetails: '1',
            limit: '15', // Increased limit to find more cities
            'accept-language': 'en'
        });

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            {
                headers: {
                    'User-Agent': 'PrayerTimesApp/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();
        
        // More inclusive filtering - accept any place type, prioritize cities
        currentSuggestions = data
            .map(item => {
                const type = (item.type || '').toLowerCase();
                const classType = (item.class || '').toLowerCase();
                
                // Calculate priority score (higher = better match)
                let priority = 0;
                
                // High priority for actual cities/towns
                if (type.includes('city') || type.includes('town') || type.includes('village') || type.includes('municipality')) {
                    priority = 100;
                } else if (classType === 'place') {
                    priority = 50;
                } else if (type.includes('administrative') || type.includes('suburb') || type.includes('district') || type.includes('county')) {
                    priority = 30;
                } else if (type.includes('hamlet') || type.includes('locality') || type.includes('neighbourhood')) {
                    priority = 20;
                } else {
                    priority = 10; // Lower priority but still include everything
                }
                
                // Boost by importance score
                priority += (item.importance || 0) * 10;
                
                return {
                    name: item.name,
                    country: item.address?.country || '',
                    state: item.address?.state || item.address?.region || item.address?.county || '',
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon),
                    priority: priority,
                    type: type,
                    displayName: item.display_name
                };
            })
            .filter(item => {
                // Very inclusive - only exclude obvious non-locations
                // Accept almost anything that has valid coordinates
                const type = item.type.toLowerCase();
                const excludeTypes = ['building', 'house', 'road', 'street', 'path', 'bridge', 'tunnel'];
                
                // Only exclude if it's clearly not a location name
                const shouldExclude = excludeTypes.some(excludeType => type.includes(excludeType));
                
                return !shouldExclude && 
                       item.lat && item.lon && 
                       !isNaN(item.lat) && !isNaN(item.lon) &&
                       (item.importance || 0) > 0.05; // Lower importance threshold
            })
            .sort((a, b) => b.priority - a.priority) // Sort by priority
            .slice(0, 8); // Show more results (up to 8)
        
        // If no results after filtering, show all results (very permissive)
        if (currentSuggestions.length === 0 && data.length > 0) {
            currentSuggestions = data
                .filter(item => item.lat && item.lon && !isNaN(parseFloat(item.lat)) && !isNaN(parseFloat(item.lon)))
                .slice(0, 8)
                .map(item => ({
                    name: item.name,
                    country: item.address?.country || '',
                    state: item.address?.state || item.address?.region || item.address?.county || '',
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                }));
        } else {
            // Format the filtered results
            currentSuggestions = currentSuggestions.map(item => ({
                name: item.name,
                country: item.country,
                state: item.state,
                lat: item.lat,
                lon: item.lon
            }));
        }

        displaySuggestions(currentSuggestions);
    } catch (error) {
        console.warn('City search failed:', error);
        suggestionsDiv.innerHTML = '<div class="suggestion-loading">Search failed</div>';
    }
}

function displaySuggestions(suggestions) {
    const suggestionsDiv = document.getElementById('citySuggestions');
    
    if (suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-loading">No cities found - you can still search manually</div>';
        return;
    }

    suggestionsDiv.innerHTML = suggestions.map((city, index) => `
        <div class="suggestion-item" data-index="${index}">
            <div class="suggestion-item-info">
                <div class="suggestion-item-name">${city.name}</div>
                <div class="suggestion-item-location">${[city.state, city.country].filter(Boolean).join(', ') || 'Location'}</div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    suggestionsDiv.querySelectorAll('.suggestion-item').forEach((item, index) => {
        item.addEventListener('click', () => selectCity(suggestions[index]));
    });
}

function selectCity(city) {
    const cityInput = document.getElementById('cityInput');
    cityInput.value = city.name;
    hideSuggestions();
    
    // Show loading and hide prayer times
    showLoading();
    hideError();
    hidePrayerTimes();
    
    // Save to localStorage
    localStorage.setItem('prayerTimesCity', city.name);
    
    // Load prayer times for selected city
    fetchPrayerTimesByCoordinates(city.lat, city.lon, city.name, city.name);
}

function hideSuggestions() {
    const suggestionsDiv = document.getElementById('citySuggestions');
    suggestionsDiv.classList.add('hidden');
    currentSuggestions = [];
}

function updateCurrentTime() {
    if (!currentTimezone) {
        // Fallback to device time if no timezone available
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('currentTimeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
        return;
    }

    // Use JavaScript's built-in timezone support (no API calls needed!)
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: currentTimezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const parts = formatter.formatToParts(new Date());
        const hours = parts.find(p => p.type === 'hour').value;
        const minutes = parts.find(p => p.type === 'minute').value;
        const seconds = parts.find(p => p.type === 'second').value;
        
        document.getElementById('currentTimeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
    } catch (error) {
        // Fallback to device time if timezone is invalid
        console.warn('Invalid timezone, using device time:', error);
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('currentTimeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
}

function handleMethodChange(e) {
    calculationMethod = parseInt(e.target.value);
    localStorage.setItem('calculationMethod', calculationMethod);
    const cityInput = document.getElementById('cityInput');
    if (cityInput.value.trim()) {
        handleSearch();
    }
}

async function handleLocationClick() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    showLoading();
    hideError();
    hidePrayerTimes();

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                await fetchPrayerTimesByCoordinates(latitude, longitude, null, null);
            } catch (error) {
                showError('Failed to fetch prayer times for your location');
                console.error('Error:', error);
            }
        },
        (error) => {
            hideLoading();
            showError('Unable to get your location. Please allow location access or search by city name.');
            console.error('Geolocation error:', error);
        }
    );
}

async function handleSearch() {
    const cityInput = document.getElementById('cityInput');
    const city = cityInput.value.trim();

    if (!city) {
        showError('Please enter a city name');
        return;
    }

    // If there's a suggestion matching the input, use it
    const matchingSuggestion = currentSuggestions.find(s => 
        s.name.toLowerCase() === city.toLowerCase()
    );

    if (matchingSuggestion) {
        selectCity(matchingSuggestion);
        return;
    }

    // Save city to localStorage
    localStorage.setItem('prayerTimesCity', city);

    showLoading();
    hideError();
    hidePrayerTimes();
    hideSuggestions();

    try {
        await fetchPrayerTimes(city);
    } catch (error) {
        showError('Failed to fetch prayer times. Please check the city name and try again.');
        console.error('Error:', error);
    }
}

async function fetchPrayerTimes(city) {
    const today = new Date();
    const date = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    // Check cache first
    const cacheKey = city.toLowerCase().trim();
    if (geocodeCache[cacheKey] && Date.now() - geocodeCache[cacheKey].timestamp < 86400000) { // 24 hour cache
        const cached = geocodeCache[cacheKey];
        await fetchPrayerTimesByCoordinates(cached.lat, cached.lon, cached.cityName, city);
        return;
    }

    // Enhanced geocoding with better filtering for city accuracy
    try {
        // Use Nominatim with optimized parameters for city search
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(city)}&` +
            `format=json&` +
            `limit=5&` + // Get multiple results to find best match
            `addressdetails=1&` +
            `extratags=1&` +
            `namedetails=1&` +
            `countrycodes=`; // Empty to search globally
        
        const geoResponse = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0',
                'Accept-Language': 'en'
            }
        });
        
        if (!geoResponse.ok) {
            throw new Error('Geocoding failed');
        }
        
        const geoData = await geoResponse.json();
        
        if (geoData && geoData.length > 0) {
            // Smart filtering: prioritize actual cities/towns over other places
            let bestResult = geoData.find(result => {
                const type = (result.type || '').toLowerCase();
                const classType = (result.class || '').toLowerCase();
                const importance = result.importance || 0;
                
                // Prioritize places with city/town/village in type
                return (type.includes('city') || 
                       type.includes('town') || 
                       type.includes('village') || 
                       type.includes('municipality') ||
                       classType === 'place') &&
                       importance > 0.3; // Filter out very low importance results
            });
            
            // If no perfect match, find the best result
            if (!bestResult) {
                // Sort by importance and pick the best
                bestResult = geoData.sort((a, b) => (b.importance || 0) - (a.importance || 0))[0];
            }
            
            const lat = parseFloat(bestResult.lat);
            const lon = parseFloat(bestResult.lon);
            
            // Extract city name from address components (most reliable)
            let cityName = city; // Default to searched city
            if (bestResult.address) {
                const addr = bestResult.address;
                cityName = addr.city || 
                          addr.town || 
                          addr.village || 
                          addr.municipality ||
                          addr.county ||
                          addr.state_district ||
                          city;
            } else if (bestResult.display_name) {
                // Extract from display name if address not available
                const parts = bestResult.display_name.split(',');
                cityName = parts[0].trim();
            }
            
            // Cache the result
            geocodeCache[cacheKey] = {
                lat,
                lon,
                cityName,
                timestamp: Date.now()
            };
            
            // Use coordinates for accurate prayer times
            await fetchPrayerTimesByCoordinates(lat, lon, cityName, city);
            return;
        }
    } catch (geoError) {
        console.warn('Geocoding failed, trying API directly:', geoError);
    }

    // Fallback: Try API directly if geocoding fails
    const url = `${API_BASE_URL}/${date}?city=${encodeURIComponent(city)}&country=&method=${calculationMethod}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 200) {
        throw new Error('Invalid response from API');
    }

    const timings = data.data.timings;
    const location = data.data.meta.timezone;
    const hijriDate = data.data.date.hijri;

    // Store timezone for online time (keep forward slashes for API)
    currentTimezone = location;
    
    // Start online time updates (uses JavaScript built-in timezone, no API calls)
    if (currentTimeInterval) {
        clearInterval(currentTimeInterval);
    }
    updateCurrentTime();
    currentTimeInterval = setInterval(updateCurrentTime, 1000);

    // Store prayer times
    currentPrayerTimes = {
        fajr: timings.Fajr,
        dhuhr: timings.Dhuhr,
        asr: timings.Asr,
        maghrib: timings.Maghrib,
        isha: timings.Isha,
        location: location,
        hijriDate: hijriDate,
        searchedCity: city // Store what user searched for
    };

    // Create array of prayer times with names
    prayerTimesArray = [
        { name: 'Fajr', time: timings.Fajr, id: 'fajr' },
        { name: 'Dhuhr', time: timings.Dhuhr, id: 'dhuhr' },
        { name: 'Asr', time: timings.Asr, id: 'asr' },
        { name: 'Maghrib', time: timings.Maghrib, id: 'maghrib' },
        { name: 'Isha', time: timings.Isha, id: 'isha' }
    ];

    displayPrayerTimes();
    startCountdown();
}

async function fetchPrayerTimesByCoordinates(lat, lng, displayName = null, searchedCity = null) {
    const today = new Date();
    const date = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}&method=${calculationMethod}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 200) {
        throw new Error('Invalid response from API');
    }

    const timings = data.data.timings;
    const location = data.data.meta.timezone;
    const hijriDate = data.data.date.hijri;

    // Store timezone for online time (keep forward slashes for API)
    currentTimezone = location;
    
    // Start online time updates (uses JavaScript built-in timezone, no API calls)
    if (currentTimeInterval) {
        clearInterval(currentTimeInterval);
    }
    updateCurrentTime();
    currentTimeInterval = setInterval(updateCurrentTime, 1000);

    // Store prayer times - use searched city name or display name if available
    currentPrayerTimes = {
        fajr: timings.Fajr,
        dhuhr: timings.Dhuhr,
        asr: timings.Asr,
        maghrib: timings.Maghrib,
        isha: timings.Isha,
        location: location,
        hijriDate: hijriDate,
        searchedCity: searchedCity || displayName || null // Store what user searched for
    };

    // Create array of prayer times with names
    prayerTimesArray = [
        { name: 'Fajr', time: timings.Fajr, id: 'fajr' },
        { name: 'Dhuhr', time: timings.Dhuhr, id: 'dhuhr' },
        { name: 'Asr', time: timings.Asr, id: 'asr' },
        { name: 'Maghrib', time: timings.Maghrib, id: 'maghrib' },
        { name: 'Isha', time: timings.Isha, id: 'isha' }
    ];

    displayPrayerTimes();
    startCountdown();
}

function displayPrayerTimes() {
    hideLoading();
    
    // Display city as title - use searched city if available, otherwise extract from timezone
    let cityName;
    if (currentPrayerTimes.searchedCity) {
        cityName = currentPrayerTimes.searchedCity;
    } else {
        cityName = currentPrayerTimes.location.split('/').pop().replace(/_/g, ' ');
    }
    document.getElementById('locationName').textContent = cityName;
    
    // Display Hijri date (compact)
    if (currentPrayerTimes.hijriDate) {
        const hijri = currentPrayerTimes.hijriDate;
        document.getElementById('hijriDate').textContent = 
            `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
    }

    // Display prayer times
    document.getElementById('fajr').textContent = formatTime(currentPrayerTimes.fajr);
    document.getElementById('dhuhr').textContent = formatTime(currentPrayerTimes.dhuhr);
    document.getElementById('asr').textContent = formatTime(currentPrayerTimes.asr);
    document.getElementById('maghrib').textContent = formatTime(currentPrayerTimes.maghrib);
    document.getElementById('isha').textContent = formatTime(currentPrayerTimes.isha);

    // Calculate and display last third of night
    const lastThirdTime = calculateLastThirdOfNight();
    document.getElementById('lastThirdTime').textContent = lastThirdTime;

    // Update next prayer and active prayer indicator
    updateNextPrayer();
    updateActivePrayer();

    showPrayerTimes();
}

function formatTime(timeString) {
    // Convert 24-hour format to 12-hour format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function parseTime(timeString) {
    // Parse time string (HH:MM format) and return Date object for today
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
}

function calculateLastThirdOfNight() {
    // The night is from Maghrib to Fajr
    const maghribTime = parseTime(currentPrayerTimes.maghrib);
    const fajrTime = parseTime(currentPrayerTimes.fajr);

    // If Fajr is before Maghrib, it's the next day
    if (fajrTime < maghribTime) {
        fajrTime.setDate(fajrTime.getDate() + 1);
    }

    // Calculate night duration in milliseconds
    const nightDuration = fajrTime - maghribTime;
    
    // Last third starts 2/3 into the night
    const lastThirdStart = new Date(maghribTime.getTime() + (nightDuration * 2 / 3));

    return formatTime(`${String(lastThirdStart.getHours()).padStart(2, '0')}:${String(lastThirdStart.getMinutes()).padStart(2, '0')}`);
}

function updateNextPrayer() {
    const now = new Date();
    let nextPrayer = null;
    let minTimeDiff = Infinity;

    // Find the next prayer
    prayerTimesArray.forEach(prayer => {
        const prayerTime = parseTime(prayer.time);
        
        // If prayer time is before now, it's tomorrow
        if (prayerTime < now) {
            prayerTime.setDate(prayerTime.getDate() + 1);
        }

        const timeDiff = prayerTime - now;
        if (timeDiff < minTimeDiff && timeDiff > 0) {
            minTimeDiff = timeDiff;
            nextPrayer = { ...prayer, timeDate: prayerTime };
        }
    });

    if (nextPrayer) {
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        updateCountdown(nextPrayer.timeDate);
    }
}

function updateActivePrayer() {
    const now = new Date();
    
    // Remove active class from all prayer items
    document.querySelectorAll('.prayer-item-compact').forEach(item => {
        item.classList.remove('active');
    });

    // Check which prayer we're currently in (between this prayer and next)
    for (let i = 0; i < prayerTimesArray.length; i++) {
        const currentPrayer = prayerTimesArray[i];
        const nextPrayer = prayerTimesArray[(i + 1) % prayerTimesArray.length];
        
        const currentPrayerTime = parseTime(currentPrayer.time);
        const nextPrayerTime = parseTime(nextPrayer.time);
        
        // Adjust times if needed
        if (nextPrayerTime < currentPrayerTime) {
            nextPrayerTime.setDate(nextPrayerTime.getDate() + 1);
        }
        
        // Special case: if we're after Isha, we're between Isha and Fajr (next day)
        if (i === prayerTimesArray.length - 1) {
            const fajrTime = parseTime(prayerTimesArray[0].time);
            if (fajrTime < currentPrayerTime) {
                fajrTime.setDate(fajrTime.getDate() + 1);
            }
            
            if (now >= currentPrayerTime && now < fajrTime) {
                const prayerElement = document.getElementById(currentPrayer.id);
                if (prayerElement) {
                    prayerElement.closest('.prayer-item-compact').classList.add('active');
                }
                return;
            }
        }
        
        // Check if current time is between current prayer and next prayer
        if (now >= currentPrayerTime && now < nextPrayerTime) {
            const prayerElement = document.getElementById(currentPrayer.id);
            if (prayerElement) {
                prayerElement.closest('.prayer-item-compact').classList.add('active');
            }
            return;
        }
    }
}

function updateCountdown(targetTime) {
    // Clear existing interval
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // Update immediately
    const update = () => {
        const now = new Date();
        const diff = targetTime - now;

        if (diff <= 0) {
            // Prayer time has passed, update to next prayer
            updateNextPrayer();
            updateActivePrayer();
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let timeString = '';
        if (hours > 0) {
            timeString = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            timeString = `${minutes}m ${seconds}s`;
        } else {
            timeString = `${seconds}s`;
        }

        document.getElementById('nextPrayerTime').textContent = timeString;
        
        // Update active prayer indicator every minute
        if (seconds === 0) {
            updateActivePrayer();
        }
    };

    update();
    timerInterval = setInterval(update, 1000);
}

function startCountdown() {
    updateNextPrayer();
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function showPrayerTimes() {
    document.getElementById('prayerTimes').classList.remove('hidden');
}

function hidePrayerTimes() {
    document.getElementById('prayerTimes').classList.add('hidden');
}

