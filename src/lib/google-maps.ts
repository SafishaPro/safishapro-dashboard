// Google Maps integration, reverse geocoding, and script loader

export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
  "AIzaSyCFYo031bQvr-MA91oHjFo7xV5OMShPvpU";

let googleMapsPromise: Promise<typeof google> | null = null;

/**
 * Dynamically loads the Google Maps JavaScript SDK with places and geometry libraries.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in a browser context"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script element already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          resolve(window.google);
        }
      }, 100);
      return;
    }

    const callbackName = `__initGoogleMapsCallback_${Date.now()}`;
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, () => void>)[callbackName];
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps SDK failed to initialize"));
      }
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete (window as unknown as Record<string, () => void>)[callbackName];
      googleMapsPromise = null;
      reject(new Error("Failed to load Google Maps script. Check network or API key permissions."));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export type GeocodedLocation = {
  formattedAddress: string;
  city: string | null;
  neighborhood: string | null;
  route: string | null;
  country: string | null;
  displayName: string;
};

// In-memory cache to avoid duplicate reverse geocoding queries
const geocodeCache = new Map<string, Promise<GeocodedLocation | null>>();

/**
 * Reverse geocodes coordinates (lat, lng) to a readable location/city name using:
 * 1. Direct Google Maps Geocode REST API (https://maps.googleapis.com/maps/api/geocode/json?latlng=lat,lng&key=key)
 * 2. Fallback to Google Maps JavaScript SDK Geocoder
 */
export async function reverseGeocode(
  lat: number | null | undefined,
  lng: number | null | undefined
): Promise<GeocodedLocation | null> {
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
    return null;
  }

  const numLat = Number(lat);
  const numLng = Number(lng);

  // Round key to 5 decimals (~1.1m precision) to maximize cache hits
  const cacheKey = `${numLat.toFixed(5)},${numLng.toFixed(5)}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const fetchPromise = (async (): Promise<GeocodedLocation | null> => {
    // 1. Try Direct HTTP Geocoding endpoint
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${numLat},${numLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
          return parseGeocodeResults(data.results);
        }
      }
    } catch {
      // If direct fetch fails (e.g. CORS or offline), proceed to SDK Geocoder
    }

    // 2. Fallback to Google Maps Client SDK Geocoder
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat: numLat, lng: numLng },
      });

      if (response.results && response.results.length > 0) {
        return parseGeocodeResults(response.results);
      }
    } catch (sdkErr) {
      console.warn("Reverse geocode error:", sdkErr);
    }

    return null;
  })();

  geocodeCache.set(cacheKey, fetchPromise);
  return fetchPromise;
}

interface AddressComponent {
  long_name: string;
  types: string[];
}

interface GeocodeResultItem {
  formatted_address: string;
  types?: string[];
  address_components: AddressComponent[];
}

function parseGeocodeResults(results: GeocodeResultItem[]): GeocodedLocation {
  const primary = results[0];

  // Helper to extract fields from a result item
  const extractFromItem = (item: GeocodeResultItem) => {
    let locality: string | null = null;
    let sublocality: string | null = null;
    let route: string | null = null;
    let neighborhood: string | null = null;
    let country: string | null = null;

    for (const comp of item.address_components) {
      const types = comp.types;
      if (
        !locality &&
        (types.includes("locality") ||
          types.includes("postal_town") ||
          types.includes("administrative_area_level_2"))
      ) {
        locality = comp.long_name;
      }
      if (
        !sublocality &&
        (types.includes("sublocality") || types.includes("sublocality_level_1"))
      ) {
        sublocality = comp.long_name;
      }
      if (!neighborhood && types.includes("neighborhood")) {
        neighborhood = comp.long_name;
      }
      if (!route && (types.includes("route") || types.includes("sublocality_level_2"))) {
        route = comp.long_name;
      }
      if (!country && types.includes("country")) {
        country = comp.long_name;
      }
    }

    return { locality, sublocality, route, neighborhood, country };
  };

  // 1. Check if we have route or specific place results in the list (e.g. 4th/5th entry or route type)
  // Look for a result with a route component (like "ICD Road")
  let bestRoute: string | null = null;
  let bestLocality: string | null = null;
  let bestSublocality: string | null = null;
  let bestNeighborhood: string | null = null;
  let bestCountry: string | null = null;

  // First inspect results with route / street_address / premise types
  for (const item of results) {
    const extracted = extractFromItem(item);
    if (!bestRoute && extracted.route) bestRoute = extracted.route;
    if (!bestLocality && extracted.locality) bestLocality = extracted.locality;
    if (!bestSublocality && extracted.sublocality) bestSublocality = extracted.sublocality;
    if (!bestNeighborhood && extracted.neighborhood) bestNeighborhood = extracted.neighborhood;
    if (!bestCountry && extracted.country) bestCountry = extracted.country;
  }

  // Format the city / location name:
  // e.g. "ICD Road, Nairobi" or "Embakasi, Nairobi" or "Nairobi"
  let displayName = "";
  if (bestRoute && bestLocality) {
    displayName = `${bestRoute}, ${bestLocality}`;
  } else if (bestSublocality && bestLocality) {
    displayName = `${bestSublocality}, ${bestLocality}`;
  } else if (bestNeighborhood && bestLocality) {
    displayName = `${bestNeighborhood}, ${bestLocality}`;
  } else if (bestLocality) {
    displayName = bestLocality;
  } else if (bestRoute) {
    displayName = bestRoute;
  } else {
    // Fallback to formatted_address without plus_code or country
    displayName = primary.formatted_address
      .replace(/^[A-Z0-9+]+\s*,?\s*/i, "")
      .replace(/,\s*Kenya$/i, "")
      .trim();
  }

  return {
    formattedAddress: primary.formatted_address,
    city: displayName || bestLocality || bestSublocality || "Nairobi",
    neighborhood: bestNeighborhood || bestSublocality,
    route: bestRoute,
    country: bestCountry,
    displayName: displayName || primary.formatted_address,
  };
}
