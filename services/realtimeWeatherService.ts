
import { mockService } from "./mockService";
import { GoogleGenAI } from "@google/genai";
import { locationService } from "./locationService";

export interface RegionData {
    north: number;
    south: number;
    east: number;
    west: number;
    central: number;
}

export interface Forecast4Day {
    date: string;
    forecast: string;
    category: string;
    relativeHumidity: { low: number; high: number };
    temperature: { low: number; high: number };
    wind: { speed: { low: number; high: number }; direction: string };
}

export interface NewsSource {
    title: string;
    uri: string;
}

export interface UnifiedWeatherReport {
    location: string;
    pm25: number;
    psi: number;
    uv: number;
    windSpeed: number;
    windDirection?: number;
    rain: number;
    humidity: number;
    temperature: number;
    forecast2hr: string;
    forecast24hr?: string; // Added for context
    forecast4day: Forecast4Day[];
    alerts: { type: 'FLOOD' | 'LIGHTNING' | 'FUTURE' | 'HEAT' | 'RAIN'; message: string }[];
    dailyInsight: string;   // Collapsed View: Coherent natural sentence
    holisticSummary: string; // Expanded View: Layman advice
    newsSummary: string;    // Expanded View: Brief news text
    newsSources: NewsSource[];
    monthlyOutlook: string;
    timestamp: number;
    lightningCount?: number;
    lightningDistance?: number;
    wbgt?: number;
    activeFloods: number;
}

class RealtimeWeatherService {
    private baseUrl = "https://api-open.data.gov.sg/v2/real-time/api";
    private genAI: GoogleGenAI;

    constructor() {
        this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    private safeString(val: any): string {
        if (typeof val === 'string') return val;
        if (typeof val === 'number') return String(val);
        if (val && typeof val === 'object') {
            if (val.text) return val.text;
            if (val.forecast) return val.forecast;
            if (val.summary) return val.summary;
            if (val.value) return String(val.value);
        }
        return "Unknown";
    }

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

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; 
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(`${this.baseUrl}/${endpoint}${params}`, { 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`API ${endpoint} failed`);
            const json = await res.json();
            return json.data;
        } catch (e) {
            console.warn(`Weather API Error [${endpoint}]:`, e);
            return null;
        }
    }

    private getNearestValue(apiData: any, lat: number, lng: number): number | null {
        if (!apiData || !apiData.stations || !apiData.readings || apiData.readings.length === 0) {
            return null;
        }

        let nearestStationId = null;
        let minDist = Infinity;

        for (const station of apiData.stations) {
            const loc = station.location || station.labelLocation;
            if (loc) {
                const dist = this.calculateDistance(lat, lng, loc.latitude, loc.longitude);
                if (dist < minDist) {
                    minDist = dist;
                    nearestStationId = station.id;
                }
            }
        }

        if (!nearestStationId) return null;

        const sortedReadings = [...apiData.readings].sort((a: any, b: any) => {
            return (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });

        const latestReadingGroup = sortedReadings[0]; 
        if (!latestReadingGroup || !latestReadingGroup.data) return null;

        const reading = latestReadingGroup.data.find((r: any) => 
            (r.stationId === nearestStationId) || (r.station_id === nearestStationId)
        );

        return reading ? reading.value : null;
    }

    private getRegionalValue(apiData: any, region: keyof RegionData, metricKey: string): number | null {
        if (!apiData) return null;
        const list = apiData.items || apiData.records || apiData.readings;
        
        if (list && list.length > 0) {
            const latest = list[0];
            if (latest.readings && latest.readings[metricKey]) {
                const regionVal = latest.readings[metricKey][region];
                if (regionVal !== undefined) return regionVal;
                if (latest.readings[metricKey]['national'] !== undefined) {
                    return latest.readings[metricKey]['national'];
                }
            }
        }
        return null;
    }

    private extractCategory(forecast: string): string {
        if (!forecast) return "";
        let simplified = forecast.replace(/\b((late|early|mid|mid-|mainly in the |in the )?\s*(?:morning|afternoon|evening|night|day|noon))\b/gi, '').trim();
        simplified = simplified.replace(/^and\s+/i, '').replace(/\b(mainly|in|the|and)\b/gi, ' ').trim();
        simplified = simplified.replace(/\s+/g, ' ').trim();
        if (simplified.length === 0) return forecast; 
        return simplified.charAt(0).toUpperCase() + simplified.slice(1);
    }

    private generateMonthlyOutlook(): string {
        const month = new Date().getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const currentMonthName = monthNames[month];

        let narrative = `Outlook for ${currentMonthName}: `;
        if (month === 11 || month === 0 || month === 1) { 
            narrative += "Northeast Monsoon Season. Expect wetter conditions with continuous moderate to heavy rain. Windy.";
        } else if (month === 2 || month === 3) {
            narrative += "Inter-monsoon Period. Light winds, strong land heating. Afternoon localized thunderstorms.";
        } else if (month >= 4 && month <= 8) {
            narrative += "Southwest Monsoon Season. Occasional \"Sumatra Squalls\" bringing gusty winds and rain in mornings.";
        } else {
            narrative += "Inter-monsoon Period. Sea breeze convergence often triggers afternoon thunderstorms.";
        }
        return narrative;
    }

    // Public method to fetch Insights separately (Slow)
    public async generateWeatherInsights(weather: UnifiedWeatherReport): Promise<{ dailyInsight: string; holisticSummary: string; newsSummary: string; newsSources: NewsSource[] }> {
        try {
            const timeNow = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
            
            // Construct detailed context for Holistic Understanding
            const context = `
            Time: ${timeNow}
            Location: ${weather.location}
            Current Condition: ${weather.forecast2hr}
            24H General Forecast: ${weather.forecast24hr || 'N/A'}
            Temperature: ${weather.temperature}°C
            Rainfall: ${weather.rain}mm (Last hr)
            Humidity: ${weather.humidity}%
            Wind: ${weather.windSpeed}km/h (Dir: ${weather.windDirection || 'Var'})
            UV Index: ${weather.uv}
            PSI: ${weather.psi}
            Active Floods: ${weather.activeFloods}
            Active Alerts: ${weather.alerts.map(a => a.message).join(', ') || 'None'}
            `;

            const prompt = `
            You are a real-time weather AI for smart glasses. 
            Using the context below, provide a 3-part update.
            Context: ${context}

            Structure your response EXACTLY as follows using the '|||' separator:
            [PART 1]|||[PART 2]|||[PART 3]

            [PART 1]: "Today's Insight" (Collapsed View). 
            Write a single, coherent, natural language sentence about the weather specifically for ${weather.location}.
            Mention the location name. Mention how the weather will progress based on the time (use the 24H Forecast).
            Example format: "Cloudy weather in ${weather.location}, however it will clear up with sunny weather at 2pm till 4pm."
            Keep it coherent, strictly under 35 words.

            [PART 2]: "Practical Advice" (Expanded View).
            Use simple layman language to provide advice based on the weather.
            Example: "Please bring an umbrella as it may rain", "Wear sunglasses", "Good for outdoor activities".
            IMPORTANT: Only mention hazards (like floods, heavy rain, haze) if they are EXPLICITLY present in the provided context (Active Floods > 0 or Alerts present). Do not hallucinate hazards.
            Max 25 words.

            [PART 3]: "News Brief" (Expanded View).
            Search for the latest Singapore weather news (monsoon, floods, heatwave) from the last 48 hours.
            Summarize it into 1 very short, brief sentence. If no major news, just say "No major weather alerts reported."
            `;

            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{googleSearch: {}}],
                }
            });

            const text = response.text || "Analysis Unavailable|||Conditions normal.|||No recent news.";
            const parts = text.split('|||');
            
            // Fallbacks
            const dailyInsight = parts[0] ? parts[0].trim() : `${weather.forecast2hr} in ${weather.location}.`;
            const holisticSummary = parts[1] ? parts[1].trim() : "Conditions normal.";
            const newsText = parts[2] ? parts[2].trim() : "";
            
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const sources: NewsSource[] = [];

            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri && chunk.web?.title) {
                    sources.push({
                        title: chunk.web.title,
                        uri: chunk.web.uri
                    });
                }
            });

            return { 
                dailyInsight: dailyInsight, 
                holisticSummary: holisticSummary,
                newsSummary: newsText, 
                newsSources: sources.slice(0, 3) 
            };

        } catch (e) {
            console.warn("AI Generation Failed", e);
            return { 
                dailyInsight: "Insight Unavailable", 
                holisticSummary: "Unable to retrieve detailed analysis.",
                newsSummary: "No news available.", 
                newsSources: [] 
            };
        }
    }

    public async getUnifiedWeather(lat?: number, lng?: number): Promise<UnifiedWeatherReport> {
        try {
            // Resolve location if not provided
            let latitude = lat;
            let longitude = lng;

            if (latitude === undefined || longitude === undefined) {
                 const loc = await locationService.getLocation();
                 latitude = loc.lat;
                 longitude = loc.lng;
            }

            const region = this.getRegion(latitude, longitude);
            
            // Parallel Fetch (Basic Data Only - Fast)
            const [pm25, psi, uv, wind, rain, humidityData, tempData, windDirData, forecast2hr, forecast4day, forecast24hr, floodData, lightningData, wbgtData] = await Promise.all([
                this.fetchData('pm25'),
                this.fetchData('psi'),
                this.fetchData('uv'),
                this.fetchData('wind-speed'),
                this.fetchData('rainfall'),
                this.fetchData('relative-humidity'),
                this.fetchData('air-temperature'),
                this.fetchData('wind-direction'),
                this.fetchData('two-hr-forecast'),
                this.fetchData('four-day-outlook'),
                this.fetchData('twenty-four-hr-forecast'),
                this.fetchData('weather/flood-alerts'),
                this.fetchData('weather', '?api=lightning'),
                this.fetchData('weather', '?api=wbgt')
            ]);

            const report: UnifiedWeatherReport = {
                location: region.charAt(0).toUpperCase() + region.slice(1) + " Region",
                pm25: 0,
                psi: 0,
                uv: 0,
                windSpeed: 0,
                rain: 0,
                humidity: 0,
                temperature: 0,
                forecast2hr: "Fair",
                forecast24hr: "",
                forecast4day: [],
                alerts: [],
                dailyInsight: "", // Filled later by AI
                holisticSummary: "", // Filled later by AI
                newsSummary: "",  // Filled later by AI
                newsSources: [],  // Filled later by AI
                monthlyOutlook: this.generateMonthlyOutlook(),
                timestamp: Date.now(),
                lightningCount: 0,
                lightningDistance: -1,
                wbgt: 0,
                activeFloods: 0
            };

            // Location Logic
            if (forecast2hr?.area_metadata && forecast2hr?.items?.[0]?.forecasts) {
                const metadata = forecast2hr.area_metadata;
                const forecasts = forecast2hr.items[0].forecasts;
                let minDistance = Infinity;
                let nearestArea = null;
                for (const area of metadata) {
                    const dist = this.calculateDistance(latitude, longitude, area.label_location.latitude, area.label_location.longitude);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestArea = area;
                    }
                }
                if (nearestArea) {
                    report.location = nearestArea.name;
                    const specificForecast = forecasts.find((f: any) => f.area === nearestArea.name);
                    if (specificForecast) report.forecast2hr = this.safeString(specificForecast.forecast);
                }
            } else if (forecast2hr?.items?.[0]?.forecasts) {
                report.forecast2hr = this.safeString(forecast2hr.items[0].forecasts[0]?.forecast) || "Fair";
            }

            // 24H Forecast text extraction (for AI context)
            if (forecast24hr && forecast24hr.items && forecast24hr.items.length > 0) {
                 const f = forecast24hr.items[0];
                 const periods = f.periods || [];
                 // Construct a simple string: "Morning: X. Afternoon: Y. Night: Z"
                 const periodStr = periods.map((p: any) => `${p.time_period?.text || 'Period'}: ${p.regions?.[region] || 'Unknown'}`).join('. ');
                 report.forecast24hr = periodStr;
            }

            // Readings
            report.temperature = this.getNearestValue(tempData, latitude, longitude) ?? 0;
            report.humidity = this.getNearestValue(humidityData, latitude, longitude) ?? 0;
            report.rain = this.getNearestValue(rain, latitude, longitude) ?? 0;
            report.windSpeed = this.getNearestValue(wind, latitude, longitude) ?? 0;
            report.windDirection = this.getNearestValue(windDirData, latitude, longitude) ?? undefined;
            if (wbgtData) report.wbgt = this.getNearestValue(wbgtData, latitude, longitude) ?? 0;

            // Regional
            report.pm25 = this.getRegionalValue(pm25, region, 'pm25_one_hourly') ?? 0;
            report.psi = this.getRegionalValue(psi, region, 'psi_twenty_four_hourly') ?? 0;
            if (uv?.records?.[0]?.index?.[0]?.value !== undefined) report.uv = uv.records[0].index[0].value;
            else if (uv?.index?.[0]?.value !== undefined) report.uv = uv.index[0].value;

            // Lightning
            if (lightningData && lightningData.readings) {
                const latest = lightningData.readings.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                if (latest && latest.data) {
                    report.lightningCount = latest.data.length;
                    if (report.lightningCount > 0) {
                        let minD = Infinity;
                        latest.data.forEach((strike: any) => {
                            const d = this.calculateDistance(latitude, longitude, strike.latitude, strike.longitude);
                            if (d < minD) minD = d;
                        });
                        report.lightningDistance = minD === Infinity ? -1 : minD;
                    }
                }
            }

            // Floods
            if (floodData && floodData.readings && floodData.readings.length > 0) {
                const latestFlood = floodData.readings.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                if (latestFlood && latestFlood.data) {
                    const activeFloods = latestFlood.data.filter((f: any) => f.status === 'Active');
                    report.activeFloods = activeFloods.length;
                    activeFloods.forEach((f: any) => report.alerts.push({ type: 'FLOOD', message: `Flood Warning: ${f.location || 'Unknown Area'}` }));
                }
            }

            // Alerts Generation
            if (report.rain > 10) report.alerts.push({ type: 'RAIN', message: `Heavy rain detected (${report.rain}mm).` });
            else if (report.rain > 50) report.alerts.push({ type: 'FLOOD', message: 'Torrential rain. Risk of flash floods.' });
            if (report.lightningDistance !== undefined && report.lightningDistance !== -1 && report.lightningDistance <= 10) report.alerts.push({ type: 'LIGHTNING', message: `Lightning strike ${report.lightningDistance.toFixed(1)}km away.` });
            if (report.wbgt && report.wbgt >= 33) report.alerts.push({ type: 'HEAT', message: `High Heat Stress (WBGT ${report.wbgt}°C).` });

            // 4-Day Forecast
            if (forecast4day?.records?.[0]?.forecasts) {
                report.forecast4day = forecast4day.records[0].forecasts.map((f: any, index: number) => {
                    const nextDate = new Date();
                    nextDate.setDate(nextDate.getDate() + index + 1);
                    return {
                        date: f.date || nextDate.toISOString().split('T')[0],
                        forecast: this.safeString(f.forecast),
                        category: this.extractCategory(this.safeString(f.forecast)),
                        relativeHumidity: f.relative_humidity || f.relativeHumidity,
                        temperature: f.temperature,
                        wind: f.wind
                    };
                });
            }

            return report;
        } catch (e) {
            console.error("Weather Gen Error", e);
            // Fallback object
            return {
                location: "Singapore",
                pm25: 0, psi: 0, uv: 0, windSpeed: 0, rain: 0, humidity: 0, temperature: 0,
                forecast2hr: "Unavailable", forecast4day: [], alerts: [],
                dailyInsight: "", holisticSummary: "", newsSummary: "", newsSources: [],
                monthlyOutlook: "", timestamp: Date.now(), activeFloods: 0
            };
        }
    }
}

export const realtimeWeatherService = new RealtimeWeatherService();
