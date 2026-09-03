import { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { reverseGeocode } from "@/lib/google-maps";

interface LocationDisplayProps {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  className?: string;
  showIcon?: boolean;
  fallback?: string;
}

export function LocationDisplay({
  lat,
  lng,
  city,
  className = "",
  showIcon = false,
  fallback = "—",
}: LocationDisplayProps) {
  const hasCoords =
    lat != null &&
    lng != null &&
    lat !== ("" as unknown) &&
    lng !== ("" as unknown) &&
    !isNaN(Number(lat)) &&
    !isNaN(Number(lng));

  // If coordinates exist, prioritize reverse geocoding from coordinates over the static city string.
  // If no coordinates exist, fallback to static city string immediately.
  const [displayText, setDisplayText] = useState<string | null>(
    !hasCoords && city ? city : null
  );
  const [loading, setLoading] = useState(hasCoords);

  useEffect(() => {
    if (!hasCoords) {
      setDisplayText(city || null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    reverseGeocode(Number(lat), Number(lng))
      .then((res) => {
        if (isMounted) {
          if (res) {
            // Priority: city name or clean display name resolved from coordinates
            setDisplayText(res.city || res.displayName || res.formattedAddress);
          } else if (city) {
            // Fallback to static city if geocode returned nothing
            setDisplayText(city);
          } else {
            setDisplayText(`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setDisplayText(city || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lat, lng, city, hasCoords]);

  if (loading && !displayText) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
        <Loader2 className="size-3 animate-spin" />
        <span>Resolving location…</span>
      </span>
    );
  }

  if (!displayText) {
    return <span className={`text-muted-foreground ${className}`}>{fallback}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={displayText}>
      {showIcon && <MapPin className="size-3.5 shrink-0 text-primary" />}
      <span className="truncate">{displayText}</span>
    </span>
  );
}
