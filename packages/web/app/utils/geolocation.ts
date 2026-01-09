/**
 * Geolocation utilities for frontend
 * Gets user's country code from browser geolocation API
 */

/**
 * Get country code from browser geolocation
 * This will trigger a browser permission popup
 */
export async function getCountryFromGeolocation(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Use reverse geocoding to get country code
          const countryCode = await reverseGeocode(latitude, longitude);
          resolve(countryCode);
        } catch (error) {
          console.error("Error getting country from geolocation:", error);
          resolve(null);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 3600000, // Cache for 1 hour
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get country code
 * Using a free reverse geocoding service
 */
async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    // Using OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Nowgai Payment System", // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }

    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase();

    return countryCode || null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    // Fallback: try using IP-based geolocation
    return await getCountryFromIP();
  }
}

/**
 * Fallback: Get country code from IP address
 * Using a free IP geolocation service
 */
async function getCountryFromIP(): Promise<string | null> {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) {
      throw new Error("IP geolocation failed");
    }
    const data = await response.json();
    return data.country_code || null;
  } catch (error) {
    console.error("IP geolocation error:", error);
    return null;
  }
}

/**
 * Get country code with fallback strategy:
 * 1. Try browser geolocation (requires permission)
 * 2. Fallback to IP-based geolocation
 */
export async function getCountryCode(): Promise<string | null> {
  // First try browser geolocation
  const countryFromGeo = await getCountryFromGeolocation();
  if (countryFromGeo) {
    return countryFromGeo;
  }

  // Fallback to IP-based geolocation
  return await getCountryFromIP();
}
