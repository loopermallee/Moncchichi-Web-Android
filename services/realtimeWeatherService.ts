
import { mockService } from "./mockService";

export interface RegionData {
    north: number;
    south: number;
    east: number;
    west: number;
    central: number;
}

export interface WeatherReading<T> {
    value: T;
    timestamp: string;
}

export interface Forecast2Hr {
    area: string;
    forecast: string;
}

export interface Forecast4Day {
    date: string;
    forecast: string;
    relativeHumidity: { low: number; high: number };
    temperature: { low: number; high: number };
    wind: { speed: { low: number; high: number }; direction: string };
}

export interface UnifiedWeatherReport {
    location: string;
    pm25: number;
    psi: number;
    uv: number;
    windSpeed: number; // knots
    windDirection?: string;
    rain: number; // mm
    humidity: number; // % (derived or mocked if missing)
    forecast2hr: string;
    forecast4day: Forecast4Day[];
    alerts: { type: 'FLOOD' | 'LIGHTNING' | 'FUTURE'; message: string }[];
    dailyInsight: string;
    timestamp: number;
}

class RealtimeWeatherService {
    private baseUrl = "https://api-open.data.gov.sg/v2/real-time/api";

    // Helper to safely extract string from potential object or undefined
    private safeString(val: any): string {
        if (typeof val === 'string') return val;
        if (typeof val === 'number') return String(val);
        if (val && typeof val === 'object') {
            // Check for common keys if API returns an object wrapper
            if (val.text) return val.text;
            if (val.forecast) return val.forecast;
            if (val.summary) return val.summary;
            if (val.value) return String(val.value);
        }
        return "Unknown";
    }

    // Helper to determine region from lat/lng for regional stats (PSI/PM2.5)
    private getRegion(lat: number, lng: number): keyof RegionData {
        if (lat > 1.40) return 'north';
        if (lat < 1.30) return 'south';
        if (lng > 103.90) return 'east';
        if (lng < 103.70) return 'west';
        return 'central';
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    // Haversine distance calculation
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private async fetchData(endpoint: string, params: string = ""): Promise<any> {
        try {
            const res = await fetch(`${this.baseUrl}/${endpoint}${params}`);
            if (!res.ok) throw new Error(`API ${endpoint} failed`);
            const json = await res.json();
            return json.data;
        } catch (e) {
            console.warn(`Weather API Error [${endpoint}]:`, e);
            return null;
        }
    }

    async getUnifiedWeather(lat: number = 1.3521, lng: number = 103.8198): Promise<UnifiedWeatherReport> {
        const region = this.getRegion(lat, lng);
        
        // Execute all fetches in parallel
        const [pm25, psi, uv, wind, rain, forecast2hr, forecast4day, flood, lightning] = await Promise.all([
            this.fetchData('pm25'),
            this.fetchData('psi'),
            this.fetchData('uv'),
            this.fetchData('wind-speed'),
            this.fetchData('rainfall'),
            this.fetchData('two-hr-forecast'),
            this.fetchData('four-day-outlook'),
            this.fetchData('weather/flood-alerts'),
            this.fetchData('weather', '?api=lightning')
        ]);

        const report: UnifiedWeatherReport = {
            // Default to regional name, will overwrite with specific town if available
            location: region.charAt(0).toUpperCase() + region.slice(1) + " Region",
            pm25: 0,
            psi: 0,
            uv: 0,
            windSpeed: 0,
            rain: 0,
            humidity: 75, // Default/Mock as specific humidity API is rare
            forecast2hr: "Fair",
            forecast4day: [],
            alerts: [],
            dailyInsight: "Gathering data...",
            timestamp: Date.now()
        };

        // --- Process Location & Forecast (Precision Update) ---
        if (forecast2hr?.area_metadata && forecast2hr?.records?.[0]?.forecasts) {
            const metadata = forecast2hr.area_metadata;
            const forecasts = forecast2hr.records[0].forecasts;

            let minDistance = Infinity;
            let nearestArea = null;

            // Find nearest area from forecast metadata
            for (const area of metadata) {
                const dist = this.calculateDistance(lat, lng, area.label_location.latitude, area.label_location.longitude);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestArea = area;
                }
            }

            if (nearestArea) {
                // Use specific area name (e.g. "Bukit Batok")
                report.location = nearestArea.name;
                
                // Get forecast for that specific area
                const specificForecast = forecasts.find((f: any) => f.area === nearestArea.name);
                if (specificForecast) {
                    report.forecast2hr = this.safeString(specificForecast.forecast);
                }
            }
        } else if (forecast2hr?.records?.[0]?.forecasts) {
             // Fallback if metadata missing: just take first available (rare)
             const forecasts = forecast2hr.records[0].forecasts;
             report.forecast2hr = this.safeString(forecasts[0]?.forecast) || "Fair";
        }

        // --- Process Readings ---

        // PM2.5
        if (pm25?.records?.[0]?.readings?.pm25_one_hourly) {
            report.pm25 = pm25.records[0].readings.pm25_one_hourly[region] || 0;
        }

        // PSI
        if (psi?.records?.[0]?.readings?.psi_twenty_four_hourly) {
            report.psi = psi.records[0].readings.psi_twenty_four_hourly[region] || 0;
        }

        // UV (Single value for SG usually)
        if (uv?.records?.[0]?.index?.[0]?.value) {
            report.uv = uv.records[0].index[0].value;
        }

        // Wind Speed (Use closest station or average)
        if (wind?.records?.[0]?.readings) {
            // Simple average for now as mapping every station ID is complex
            const readings = wind.records[0].readings;
            const total = readings.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
            report.windSpeed = readings.length ? Math.round((total / readings.length) * 10) / 10 : 0;
        }

        // Rainfall
        if (rain?.records?.[0]?.readings) {
            // Max rain in region to be safe
            const readings = rain.records[0].readings;
            report.rain = Math.max(...readings.map((r: any) => r.value || 0));
        }

        // Forecast 4 Day
        if (forecast4day?.records?.[0]?.forecasts) {
            report.forecast4day = forecast4day.records[0].forecasts.map((f: any, index: number) => {
                // Calculate incremental date starting from tomorrow
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + index + 1);
                const fallbackDate = nextDate.toISOString().split('T')[0];

                return {
                    date: fallbackDate, // Use strictly the calculated incremental date to fix static date bug
                    // Ensure string using safeString to prevent #31 error
                    forecast: this.safeString(f.forecast),
                    relativeHumidity: f.relative_humidity,
                    temperature: f.temperature,
                    wind: f.wind
                };
            });
        } else {
            // Mock data if API fails completely
            report.forecast4day = Array.from({length: 4}).map((_, i) => {
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + i + 1);
                return {
                    date: nextDate.toISOString().split('T')[0],
                    forecast: "Partly Cloudy",
                    relativeHumidity: { low: 60, high: 90 },
                    temperature: { low: 26, high: 32 },
                    wind: { speed: { low: 10, high: 20 }, direction: "NE" }
                };
            });
        }

        // --- Alerts & Hazards ---

        // Real Alerts
        if (flood?.records?.length > 0) { 
            // Data.gov flood API usually returns empty array if no flood
        }
        if (lightning?.records?.[0]?.lightning_alert_status) {
             // Assuming status structure
        }
        // Demo Simulated Alerts
        if (report.rain > 50) {
            report.alerts.push({ type: 'FLOOD', message: 'Heavy rainfall. Risk of flash floods.' });
        }

        // Future Hazards Scan (Keep detailed)
        report.forecast4day.forEach(day => {
            const f = day.forecast.toLowerCase();
            let d = "Upcoming";
            try {
                d = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            } catch (e) { d = "Upcoming"; }

            if (f.includes('thunder') || f.includes('lightning')) {
                report.alerts.push({ type: 'FUTURE', message: `${d}: Thundery showers expected.` });
            } else if (f.includes('heavy rain')) {
                report.alerts.push({ type: 'FUTURE', message: `${d}: Heavy rain forecast.` });
            }
        });


        // --- Daily Insight Generation (Strictly Today) ---
        const parts = [];
        
        // 1. Air Quality & Safety (Priority)
        if (report.psi > 100) {
            parts.push(`Haze Alert (PSI ${report.psi}).`);
        } else if (report.pm25 > 55) {
            parts.push(`Air quality is moderate (PM2.5: ${report.pm25}).`);
        } else {
            parts.push("Air quality is good.");
        }

        if (report.uv >= 8) {
            parts.push("UV is extreme, stay indoors.");
        } else if (report.uv >= 6) {
            parts.push("UV is high, use protection.");
        }

        // 2. Current Weather & Immediate Forecast
        const weatherDesc = report.forecast2hr.toLowerCase();
        if (weatherDesc.includes('rain') || weatherDesc.includes('shower')) {
             parts.push(`It is currently raining (${report.forecast2hr}).`);
        } else if (weatherDesc.includes('cloud')) {
             parts.push("It's cloudy right now.");
        } else if (weatherDesc.includes('fair') || weatherDesc.includes('sunny')) {
             parts.push("Conditions are fair.");
        } else {
             parts.push(`Expect ${report.forecast2hr} conditions.`);
        }

        if (report.rain > 0) {
            parts.push(`${report.rain}mm of rain recorded recently.`);
        }

        report.dailyInsight = parts.join(" ");

        return report;
    }
}

export const realtimeWeatherService = new RealtimeWeatherService();
