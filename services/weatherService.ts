
export interface WeatherData {
    status: string;
    temp: number;
    rain: number;
}

export const getWeather = async (): Promise<WeatherData> => {
    // 1. Try Primary Source: CheckWeather.sg
    try {
        const res = await fetch('https://api.checkweather.sg/v2/weather');
        if (res.ok) {
            const data = await res.json();
            return {
                status: data.status || 'Unknown',
                temp: data.temp || 0,
                rain: data.rain || 0
            };
        }
    } catch (e) {
        // Silently fail primary, move to secondary
    }

    // 2. Try Fallback Source: Open-Meteo (Singapore)
    // reliable, free, no-key API for demo continuity
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current=temperature_2m,rain,weather_code&timezone=Asia%2FSingapore');
        if (!res.ok) throw new Error("Fallback API failed");
        
        const data = await res.json();
        const current = data.current;
        
        return {
            status: mapWmoCodeToStatus(current.weather_code),
            temp: current.temperature_2m,
            rain: current.rain
        };

    } catch (e) {
        console.warn("All weather services failed", e);
        // Return a safe fallback state to prevent UI crash
        return {
            status: 'Unavailable',
            temp: 0,
            rain: 0
        };
    }
};

// Helper to map WMO Weather Codes to simple status strings
function mapWmoCodeToStatus(code: number): string {
    if (code === 0) return "Clear";
    if (code <= 3) return "Cloudy";
    if (code <= 48) return "Fog";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
}
