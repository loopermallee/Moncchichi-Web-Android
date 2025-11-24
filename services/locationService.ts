
import { mockService } from "./mockService";

class LocationService {
  private defaultLocation = { lat: 1.3521, lng: 103.8198 }; // Singapore
  private cachedLocation: { lat: number; lng: number } | null = null;
  private lastUpdated = 0;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes cache

  public async getLocation(): Promise<{ lat: number; lng: number; isDefault: boolean }> {
    const now = Date.now();
    
    // Return cached if valid
    if (this.cachedLocation && (now - this.lastUpdated < this.cacheDuration)) {
        return { ...this.cachedLocation, isDefault: false };
    }

    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            mockService.emitLog("GPS", "ERROR", "Geolocation not supported");
            resolve({ ...this.defaultLocation, isDefault: true });
            return;
        }

        mockService.emitLog("GPS", "INFO", "Requesting Position...");

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.cachedLocation = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                this.lastUpdated = Date.now();
                mockService.emitLog("GPS", "INFO", `Location acquired: ${this.cachedLocation.lat.toFixed(4)}, ${this.cachedLocation.lng.toFixed(4)}`);
                resolve({ ...this.cachedLocation, isDefault: false });
            },
            (err) => {
                // Determine specific error for logging
                let msg = "Unknown Error";
                if (err.code === err.PERMISSION_DENIED) msg = "Permission Denied";
                else if (err.code === err.POSITION_UNAVAILABLE) msg = "Position Unavailable";
                else if (err.code === err.TIMEOUT) msg = "Timeout";

                mockService.emitLog("GPS", "WARN", `GPS Failed (${msg}). Reverting to default.`);
                
                // On failure, return default but flag it
                resolve({ ...this.defaultLocation, isDefault: true });
            },
            { 
                timeout: 10000, 
                enableHighAccuracy: true, 
                maximumAge: 60000 
            }
        );
    });
  }

  // Force refresh ignoring cache
  public async refreshLocation(): Promise<{ lat: number; lng: number; isDefault: boolean }> {
      this.cachedLocation = null;
      return this.getLocation();
  }
}

export const locationService = new LocationService();
