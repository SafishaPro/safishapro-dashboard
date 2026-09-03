import { useEffect, useRef, useState, useCallback } from "react";
import { Search, MapPin, Loader2, Navigation, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loadGoogleMaps, reverseGeocode } from "@/lib/google-maps";

export interface LocationPickerValue {
  latitude: number | null;
  longitude: number | null;
  city: string;
  address: string;
}

interface LocationPickerProps {
  latitude?: number | null | string;
  longitude?: number | null | string;
  city?: string | null;
  address?: string | null;
  onChange: (value: LocationPickerValue) => void;
  label?: string;
  placeholder?: string;
  showMapDefault?: boolean;
}

// Default center: Nairobi, Kenya
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

export function LocationPicker({
  latitude,
  longitude,
  city = "",
  address = "",
  onChange,
  label = "Location & Coordinates",
  placeholder = "Search location, area, or address…",
  showMapDefault = true,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(showMapDefault);
  const [searchText, setSearchText] = useState(address || city || "");
  const [currentLat, setCurrentLat] = useState<number | null>(
    latitude != null && latitude !== "" && !isNaN(Number(latitude)) ? Number(latitude) : null
  );
  const [currentLng, setCurrentLng] = useState<number | null>(
    longitude != null && longitude !== "" && !isNaN(Number(longitude)) ? Number(longitude) : null
  );
  const [resolvedCity, setResolvedCity] = useState(city || "");
  const [resolvedAddress, setResolvedAddress] = useState(address || "");

  // Update internal coordinates if props change from outside
  useEffect(() => {
    if (latitude != null && latitude !== "" && !isNaN(Number(latitude))) {
      setCurrentLat(Number(latitude));
    }
    if (longitude != null && longitude !== "" && !isNaN(Number(longitude))) {
      setCurrentLng(Number(longitude));
    }
  }, [latitude, longitude]);

  // Handle position selection from map click, marker drag, or place autocomplete
  const updatePosition = useCallback(
    async (lat: number, lng: number, placeName?: string) => {
      setCurrentLat(lat);
      setCurrentLng(lng);

      if (mapInstanceRef.current && markerRef.current) {
        const pos = { lat, lng };
        markerRef.current.setPosition(pos);
        mapInstanceRef.current.panTo(pos);
      }

      // Reverse geocode to get city and detailed address
      const geocoded = await reverseGeocode(lat, lng);
      const newCity = geocoded?.city || "";
      const newAddress = placeName || geocoded?.displayName || geocoded?.formattedAddress || "";

      setResolvedCity(newCity);
      setResolvedAddress(newAddress);
      setSearchText(newAddress);

      onChange({
        latitude: lat,
        longitude: lng,
        city: newCity,
        address: newAddress,
      });
    },
    [onChange]
  );

  // Initialize Google Maps and Places Autocomplete
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    loadGoogleMaps()
      .then((google) => {
        if (!isMounted) return;

        const initialPos =
          currentLat != null && currentLng != null
            ? { lat: currentLat, lng: currentLng }
            : DEFAULT_CENTER;

        // Init Map
        if (mapContainerRef.current && !mapInstanceRef.current) {
          const map = new google.maps.Map(mapContainerRef.current, {
            center: initialPos,
            zoom: currentLat != null && currentLng != null ? 15 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          mapInstanceRef.current = map;

          const marker = new google.maps.Marker({
            position: initialPos,
            map: map,
            draggable: true,
            title: "Drag to refine location",
          });
          markerRef.current = marker;

          // Click on map to move marker
          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              updatePosition(e.latLng.lat(), e.latLng.lng());
            }
          });

          // Drag marker
          marker.addListener("dragend", () => {
            const pos = marker.getPosition();
            if (pos) {
              updatePosition(pos.lat(), pos.lng());
            }
          });
        }

        // Init Places Autocomplete
        if (searchInputRef.current && !autocompleteRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["formatted_address", "geometry", "name", "address_components"],
          });
          autocompleteRef.current = autocomplete;

          // Prefer Kenya / local bounds if available
          autocomplete.setComponentRestrictions({ country: ["ke"] });

          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const name = place.name || place.formatted_address || "";

              // Extract city if present in address components
              let extractedCity = "";
              if (place.address_components) {
                for (const comp of place.address_components) {
                  if (
                    comp.types.includes("locality") ||
                    comp.types.includes("administrative_area_level_2")
                  ) {
                    extractedCity = comp.long_name;
                    break;
                  }
                }
              }

              setCurrentLat(lat);
              setCurrentLng(lng);
              setResolvedAddress(name);
              if (extractedCity) setResolvedCity(extractedCity);
              setSearchText(name);

              if (mapInstanceRef.current && markerRef.current) {
                const pos = { lat, lng };
                mapInstanceRef.current.setCenter(pos);
                mapInstanceRef.current.setZoom(16);
                markerRef.current.setPosition(pos);
              }

              onChange({
                latitude: lat,
                longitude: lng,
                city: extractedCity || resolvedCity,
                address: name,
              });
            }
          });
        }

        setIsLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setIsLoading(false);
          setLoadError(err instanceof Error ? err.message : "Failed to load Google Maps");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualCoordChange = (type: "lat" | "lng", val: string) => {
    const num = val === "" ? null : Number(val);
    const newLat = type === "lat" ? num : currentLat;
    const newLng = type === "lng" ? num : currentLng;

    if (type === "lat") setCurrentLat(num);
    if (type === "lng") setCurrentLng(num);

    if (newLat != null && newLng != null && !isNaN(newLat) && !isNaN(newLng)) {
      updatePosition(newLat, newLng);
    } else {
      onChange({
        latitude: newLat,
        longitude: newLng,
        city: resolvedCity,
        address: resolvedAddress,
      });
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        alert("Unable to get current location: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-3.5 bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="size-4 text-blue-900" />
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleUseCurrentLocation}
            title="Use current device location"
          >
            <Navigation className="mr-1 size-3" />
            My location
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setIsMapVisible(!isMapVisible)}
          >
            {isMapVisible ? "Hide Map" : "Show Map"}
          </Button>
        </div>
      </div>

      {/* Autocomplete Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={placeholder}
          className="pl-9 text-sm"
        />
      </div>

      {/* Interactive Map View */}
      {isMapVisible && (
        <div className="relative h-56 w-full overflow-hidden rounded-md border bg-muted">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Loading Google Maps…</span>
              </div>
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center bg-background/90">
              <p className="text-xs text-destructive">{loadError}</p>
            </div>
          )}
          <div ref={mapContainerRef} className="h-full w-full" />
          <div className="absolute bottom-2 left-2 z-10 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-xs backdrop-blur-xs">
            Click map or drag marker to set pinpoint
          </div>
        </div>
      )}

      {/* Coordinates and Resolved Location Summary */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div>
          <Label className="text-xs text-muted-foreground">Latitude</Label>
          <Input
            type="number"
            step="any"
            className="h-8 text-xs font-mono"
            placeholder="-1.2921"
            value={currentLat != null ? currentLat : ""}
            onChange={(e) => handleManualCoordChange("lat", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Longitude</Label>
          <Input
            type="number"
            step="any"
            className="h-8 text-xs font-mono"
            placeholder="36.8219"
            value={currentLng != null ? currentLng : ""}
            onChange={(e) => handleManualCoordChange("lng", e.target.value)}
          />
        </div>
      </div>

      {resolvedCity && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
          <Check className="size-3.5 text-emerald-600 shrink-0" />
          <span>Resolved City/Area: <strong className="text-foreground font-medium">{resolvedCity}</strong></span>
        </div>
      )}
    </div>
  );
}
