
import { mockService } from './mockService';
import { GoogleGenAI } from "@google/genai";

export interface ArrivalInfo {
  mins: number;
  load: 'SEA' | 'SDA' | 'LSD' | string; // SEA=Seats Avail, SDA=Standing Avail, LSD=Limited Standing
  type: 'SD' | 'DD' | 'BD' | string;    // SD=Single, DD=Double, BD=Bendy
  feature: 'WAB' | string;              // WAB=Wheelchair Accessible
}

export interface BusServiceData {
  serviceNo: string;
  operator: string;
  next: ArrivalInfo | null;
  subsequent: ArrivalInfo | null;
  subsequent2: ArrivalInfo | null;
  stopName?: string;
  stopId?: string;
  insight?: string; // AI Crowd Prediction
}

export interface BusStopData {
  id: string;
  services: BusServiceData[];
}

export interface BusStopLocation {
    id: string;
    name: string;
    lat?: number; // Optional as manual lookup might not provide coords
    lng?: number;
    distance?: number;
}

export interface BusTiming {
    wd: string; // Weekday
    sat: string; // Saturday
    sun: string; // Sunday/PH
}

export interface BusSchedule {
    first: BusTiming;
    last: BusTiming;
}

export interface MRTStation {
    code: string;
    name: string;
}
  
export interface MRTLine {
    code: string;
    name: string;
    color: string;
    stations: MRTStation[];
}

// LTA Data Types
export interface TrainServiceAlert {
    Status: number; // 1 = Normal, 2 = Disrupted
    Line: string;
    Direction: string;
    Message: string;
}

export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface StationCrowdData {
    stationCode: string;
    current: CrowdLevel;
    trend: 'RISING' | 'FALLING' | 'STABLE';
    forecast: {
        time: string;
        level: CrowdLevel;
    }[];
}

export interface StationAccessibility {
    stationCode: string;
    liftMaintenance: boolean;
    details?: string;
}

// Using Arrivelah for Bus (CORS friendly)
const BASE_URL = 'https://arrivelah2.busrouter.sg';
// Using CORS Proxy for LTA DataMall (Direct calls block in browser)
const PROXY_URL = 'https://corsproxy.io/?'; 
const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';
const LTA_API_KEY = 'BDSwMqU/RVyzCbvR0iAFng==';
const STORAGE_KEY_FAV = 'moncchichi_fav_stops';

const MRT_DATA: MRTLine[] = [
    {
      code: 'NSL',
      name: 'North South Line',
      color: '#D42E12',
      stations: [
        { code: 'NS1', name: 'Jurong East' },
        { code: 'NS2', name: 'Bukit Batok' },
        { code: 'NS3', name: 'Bukit Gombak' },
        { code: 'NS4', name: 'Choa Chu Kang' },
        { code: 'NS5', name: 'Yew Tee' },
        { code: 'NS7', name: 'Kranji' },
        { code: 'NS8', name: 'Marsiling' },
        { code: 'NS9', name: 'Woodlands' },
        { code: 'NS10', name: 'Admiralty' },
        { code: 'NS11', name: 'Sembawang' },
        { code: 'NS12', name: 'Canberra' },
        { code: 'NS13', name: 'Yishun' },
        { code: 'NS14', name: 'Khatib' },
        { code: 'NS15', name: 'Yio Chu Kang' },
        { code: 'NS16', name: 'Ang Mo Kio' },
        { code: 'NS17', name: 'Bishan' },
        { code: 'NS18', name: 'Braddell' },
        { code: 'NS19', name: 'Toa Payoh' },
        { code: 'NS20', name: 'Novena' },
        { code: 'NS21', name: 'Newton' },
        { code: 'NS22', name: 'Orchard' },
        { code: 'NS23', name: 'Somerset' },
        { code: 'NS24', name: 'Dhoby Ghaut' },
        { code: 'NS25', name: 'City Hall' },
        { code: 'NS26', name: 'Raffles Place' },
        { code: 'NS27', name: 'Marina Bay' },
        { code: 'NS28', name: 'Marina South Pier' }
      ]
    },
    {
      code: 'EWL',
      name: 'East West Line',
      color: '#009645',
      stations: [
        { code: 'EW1', name: 'Pasir Ris' },
        { code: 'EW2', name: 'Tampines' },
        { code: 'EW3', name: 'Simei' },
        { code: 'EW4', name: 'Tanah Merah' },
        { code: 'EW5', name: 'Bedok' },
        { code: 'EW6', name: 'Kembangan' },
        { code: 'EW7', name: 'Eunos' },
        { code: 'EW8', name: 'Paya Lebar' },
        { code: 'EW9', name: 'Aljunied' },
        { code: 'EW10', name: 'Kallang' },
        { code: 'EW11', name: 'Lavender' },
        { code: 'EW12', name: 'Bugis' },
        { code: 'EW13', name: 'City Hall' },
        { code: 'EW14', name: 'Raffles Place' },
        { code: 'EW15', name: 'Tanjong Pagar' },
        { code: 'EW16', name: 'Outram Park' },
        { code: 'EW17', name: 'Tiong Bahru' },
        { code: 'EW18', name: 'Redhill' },
        { code: 'EW19', name: 'Queenstown' },
        { code: 'EW20', name: 'Commonwealth' },
        { code: 'EW21', name: 'Buona Vista' },
        { code: 'EW22', name: 'Dover' },
        { code: 'EW23', name: 'Clementi' },
        { code: 'EW24', name: 'Jurong East' },
        { code: 'EW25', name: 'Chinese Garden' },
        { code: 'EW26', name: 'Lakeside' },
        { code: 'EW27', name: 'Boon Lay' },
        { code: 'EW28', name: 'Pioneer' },
        { code: 'EW29', name: 'Joo Koon' },
        { code: 'EW30', name: 'Gul Circle' },
        { code: 'EW31', name: 'Tuas Crescent' },
        { code: 'EW32', name: 'Tuas West Road' },
        { code: 'EW33', name: 'Tuas Link' }
      ]
    }
];

class TransportService {
  private defaultStop = '09048'; // Orchard Stn
  private allStopsCache: BusStopLocation[] = [];
  private genAI: GoogleGenAI;

  constructor() {
      this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  getDefaultStop(): string {
    return this.defaultStop;
  }

  setDefaultStop(id: string) {
    this.defaultStop = id;
  }

  // --- BUS API ---

  async getArrivals(stopId: string): Promise<BusStopData> {
    // Strategy: Try LTA directly via CORS Proxy first using the User's Key (Live Data Priority)
    try {
        const headers = new Headers();
        headers.append('AccountKey', LTA_API_KEY);
        headers.append('accept', 'application/json');

        const proxyUrl = `${PROXY_URL}${encodeURIComponent(`${LTA_BASE_URL}/BusArrivalv2?BusStopCode=${stopId}`)}`;
        
        const res = await fetch(proxyUrl, {
            method: 'GET',
            headers: headers,
            cache: 'no-store'
        });

        if (!res.ok) throw new Error(`LTA API returned status: ${res.status}`);
        
        const data = await res.json();
        
        const services = (data.Services || []).map((s: any) => ({
            serviceNo: s.ServiceNo,
            operator: s.Operator,
            next: this.mapLtaArrival(s.NextBus),
            subsequent: this.mapLtaArrival(s.NextBus2),
            subsequent2: this.mapLtaArrival(s.NextBus3),
            stopId: stopId
        }));

        return {
            id: stopId,
            services: services
        };
    } catch (ltaError) {
        // Fallback: Use Arrivelah2 (Official Mirror) if LTA direct fails
        console.warn("LTA API failed, trying fallback...", ltaError);
        try {
             const response = await fetch(`${BASE_URL}/?id=${stopId}`);
             if (!response.ok) throw new Error('Arrivelah API failed');
             const data = await response.json();
             
             return {
                 id: stopId,
                 services: data.services.map((s: any) => ({
                     serviceNo: s.no,
                     operator: s.operator,
                     next: s.next,
                     subsequent: s.next2,
                     subsequent2: s.next3,
                     stopId: stopId
                 }))
             };
        } catch (fbError) {
             console.error("All Bus APIs failed for", stopId);
             throw ltaError; // Throw original error for debugging
        }
    }
  }

  private mapLtaArrival(bus: any): ArrivalInfo | null {
      if (!bus || !bus.EstimatedArrival) return null;
      
      const arrivalTime = new Date(bus.EstimatedArrival).getTime();
      const now = Date.now();
      const mins = Math.floor((arrivalTime - now) / 60000);

      return {
          mins: mins,
          load: bus.Load,
          type: bus.Type,
          feature: bus.Feature
      };
  }

  // Load all 5000+ bus stops for true geolocation searching
  async fetchAllBusStops(): Promise<BusStopLocation[]> {
      if (this.allStopsCache.length > 0) return this.allStopsCache;

      // Strategy:
      // 1. Try downloading static JSON from various sources/proxies (Fastest)
      // 2. If all static sources fail, fall back to LTA DataMall API loop (Robust but slower)

      const staticUrls = [
          // 1. Direct access (Fastest if CORS allows)
          'https://busrouter.sg/data/2/bus-stops.json', 
          // 2. Via CorsProxy (Primary)
          `${PROXY_URL}${encodeURIComponent('https://busrouter.sg/data/2/bus-stops.json')}`,
          // 3. Via AllOrigins (Secondary Proxy)
          `https://api.allorigins.win/raw?url=${encodeURIComponent('https://busrouter.sg/data/2/bus-stops.json')}`,
          // 4. GitHub Raw via Proxy
          `${PROXY_URL}${encodeURIComponent('https://raw.githubusercontent.com/cheeaun/busrouter-sg/master/data/2/bus-stops.json')}`
      ];

      for (const url of staticUrls) {
          try {
              mockService.emitLog("TRANSPORT", "INFO", `Fetching DB: ${url.substring(0, 30)}...`);
              const response = await fetch(url);
              if (response.ok) {
                  const data = await response.json();
                  return this.processBusStopData(data);
              }
          } catch (e) {
              console.warn(`Bus DB Source Failed: ${url}`);
          }
      }
      
      // Fallback to LTA DataMall API (Official Source)
      // This handles the case where all static file mirrors are blocked/down
      try {
          mockService.emitLog("TRANSPORT", "WARN", "Static DB failed. Switching to LTA API (Fallback)...");
          const ltaStops = await this.fetchStopsFromLTA();
          this.allStopsCache = ltaStops;
          return ltaStops;
      } catch (e) {
          mockService.emitLog("TRANSPORT", "ERROR", "Critical: All Bus DB sources failed.");
          throw new Error("Failed to fetch bus stop database");
      }
  }

  private async fetchStopsFromLTA(): Promise<BusStopLocation[]> {
      const allStops: BusStopLocation[] = [];
      let skip = 0;
      let fetching = true;
      const batchSize = 500;

      // LTA API requires AccountKey header. 
      // We must use a proxy that supports header forwarding (like corsproxy.io)
      
      while (fetching) {
          try {
              // LTA BusStops API (2.4 in Documentation)
              // Returns 500 records per call. Must loop using $skip.
              const target = `${LTA_BASE_URL}/BusStops?$skip=${skip}`;
              const proxy = `${PROXY_URL}${encodeURIComponent(target)}`;
              
              const res = await fetch(proxy, {
                  headers: {
                      'AccountKey': LTA_API_KEY,
                      'accept': 'application/json'
                  }
              });

              if (!res.ok) throw new Error(`LTA Status ${res.status}`);
              
              const data = await res.json();
              const items = data.value || [];
              
              if (items.length === 0) {
                  fetching = false;
              } else {
                  items.forEach((s: any) => {
                      allStops.push({
                          id: s.BusStopCode,
                          name: s.Description,
                          lat: s.Latitude,
                          lng: s.Longitude
                      });
                  });
                  skip += batchSize;
                  
                  // Log progress periodically
                  if (skip % 1000 === 0) {
                      mockService.emitLog("TRANSPORT", "INFO", `LTA Sync: ${allStops.length} stops loaded...`);
                  }

                  // Safety break (SG has approx 5000 stops, stop if we go way over)
                  if (allStops.length > 7000) fetching = false;
              }
          } catch (e) {
              console.error("LTA Loop Error", e);
              fetching = false; // Stop on error to prevent infinite retries on block
          }
      }
      
      if (allStops.length === 0) throw new Error("LTA API returned no stops");
      
      mockService.emitLog("TRANSPORT", "INFO", `LTA Sync Complete: ${allStops.length} stops.`);
      return allStops;
  }

  private processBusStopData(data: any): BusStopLocation[] {
      try {
          const stops: BusStopLocation[] = Object.keys(data).map(key => {
              const item = data[key];
              return {
                  id: key,
                  name: item.name,
                  lng: item.coords[0],
                  lat: item.coords[1]
              };
          });
          this.allStopsCache = stops;
          mockService.emitLog("TRANSPORT", "INFO", `DB Success: Loaded ${stops.length} stops`);
          return stops;
      } catch (e) {
          console.error("Error processing bus stop data", e);
          throw new Error("Data Malformed");
      }
  }

  async findNearestStops(lat: number, lng: number): Promise<BusStopLocation[]> {
    const stops = await this.fetchAllBusStops();
    
    const sorted = stops.map(stop => {
        if (stop.lat === undefined || stop.lng === undefined) return { ...stop, distance: 99999 };
        return {
            ...stop,
            distance: this.calculateDistance(lat, lng, stop.lat, stop.lng)
        };
    }).sort((a, b) => (a.distance || 9999) - (b.distance || 9999));

    return sorted.slice(0, 5);
  }

  async getBusStopInfo(id: string): Promise<BusStopLocation | undefined> {
      // 1. Try loaded cache first
      if (this.allStopsCache.length > 0) {
          const cached = this.allStopsCache.find(s => s.id === id);
          if (cached) return cached;
      } 
      
      // 2. Fallback: OneMap API (Official SG Data)
      try {
          const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${id}&returnGeom=Y&getAddrDetails=Y&pageNum=1`);
          if (res.ok) {
              const data = await res.json();
              const result = data.results?.find((r: any) => r.SEARCHVAL.includes(id) || r.SEARCHVAL.includes(id.toUpperCase()));
              
              if (result) {
                  let name = result.SEARCHVAL.replace(/\s*\(\d+\)$/, '');
                  name = name.replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

                  return {
                      id: id,
                      name: name,
                      lat: parseFloat(result.LATITUDE),
                      lng: parseFloat(result.LONGITUDE)
                  };
              }
          }
      } catch (e) {
          console.warn("OneMap lookup failed for", id);
      }
      return undefined;
  }

  // --- TRAIN / LTA API ---

  getMRTNetwork(): MRTLine[] {
      return MRT_DATA;
  }

  async getTrainServiceAlerts(): Promise<TrainServiceAlert[]> {
      try {
          const headers = new Headers();
          headers.append('AccountKey', LTA_API_KEY);
          headers.append('accept', 'application/json');
          
          // Must use Proxy for LTA
          const proxyUrl = `${PROXY_URL}${encodeURIComponent(`${LTA_BASE_URL}/TrainServiceAlerts`)}`;
          
          const res = await fetch(proxyUrl, {
              method: 'GET',
              headers: headers,
              cache: 'no-store'
          });

          if (res.ok) {
              const data = await res.json();
              return data.value || [];
          }
          throw new Error("LTA API Status " + res.status);
      } catch (e) {
          console.warn("Train alerts failed", e);
          return []; 
      }
  }

  // Removed mock data for Crowd - return null if no API available
  getStationCrowd(stationCode: string): StationCrowdData | null {
    return null;
  }

  // Removed mock data for Lift - return null if no API available
  getLiftStatus(stationCode: string): StationAccessibility | null {
      return null;
  }

  // Removed mock data for Bus Insights
  getBusRouteInsight(serviceNo: string): string | null {
      return null;
  }

  getBusTypeLabel(type: string): string {
      const map: Record<string, string> = {
          'SD': 'Single Deck',
          'DD': 'Double Deck',
          'BD': 'Bendy'
      };
      return map[type] || type;
  }

  // --- UTILS ---

  async getAddress(lat: number, lng: number): Promise<string> {
      try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
              headers: {
                  'Accept-Language': 'en'
              }
          });
          
          if (!res.ok) throw new Error("Nominatim API failed");
          
          const data = await res.json();
          const addr = data.address;
          
          if (addr) {
              const name = addr.amenity || addr.building || addr.shop || addr.tourism || addr.leisure;
              const road = addr.road || addr.pedestrian || addr.street || addr.footway;
              const area = addr.suburb || addr.neighbourhood || addr.district || addr.city || addr.town;
              
              if (name && road) return `${name}, ${road}`;
              if (name && area) return `${name}, ${area}`;
              if (road && area) return `${road}, ${area}`;
              if (road) return road;
              return area || data.display_name?.split(',')[0] || "Unknown Location";
          }
          
          return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      } catch (e) {
          return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getFavorites(): BusStopLocation[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_FAV);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
  }

  addFavorite(stop: BusStopLocation) {
      const favs = this.getFavorites();
      if (!favs.find(f => f.id === stop.id)) {
          favs.push(stop);
          localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favs));
      }
  }

  removeFavorite(id: string) {
      const favs = this.getFavorites().filter(f => f.id !== id);
      localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favs));
  }

  isFavorite(id: string): boolean {
      return !!this.getFavorites().find(f => f.id === id);
  }

  getFavorite(id: string): BusStopLocation | undefined {
      return this.getFavorites().find(f => f.id === id);
  }

  renameFavorite(id: string, newName: string) {
      const favs = this.getFavorites();
      const idx = favs.findIndex(f => f.id === id);
      if (idx >= 0) {
          favs[idx].name = newName;
          localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favs));
      }
  }

  formatHudMessage(bus: BusServiceData): string {
      if (!bus.next) return "NO SVC";
      const arr = bus.next.mins <= 0 ? "Arr" : `${bus.next.mins}m`;
      const load = bus.next.load === "SEA" ? "Seats" : (bus.next.load === "SDA" ? "Stand" : "Full");
      return `Bus ${bus.serviceNo}\n${arr} (${load})`;
  }

  formatTtsMessage(bus: BusServiceData): string {
      if (!bus.next) return `Bus ${bus.serviceNo} is not available.`;
      const minText = bus.next.mins <= 0 ? "arriving now" : `arriving in ${bus.next.mins} minutes`;
      return `Bus ${bus.serviceNo} is ${minText}.`;
  }

  getDayType(): 'wd' | 'sat' | 'sun' {
      const day = new Date().getDay();
      if (day === 0) return 'sun'; // Sunday
      if (day === 6) return 'sat'; // Saturday
      return 'wd'; // Weekday
  }

  async getStopSchedule(stopId: string): Promise<Record<string, BusSchedule>> {
      return {};
  }

  // --- NEW: Interval Calculation ---
  public getBusInterval(bus: BusServiceData): string | null {
      // Calculate interval based on live data gaps
      if (bus.next && bus.subsequent) {
          const diff1 = bus.subsequent.mins - bus.next.mins;
          if (bus.subsequent2) {
             const diff2 = bus.subsequent2.mins - bus.subsequent.mins;
             // If we have 3 data points, average them for stability
             const avg = Math.round((diff1 + diff2) / 2);
             if (avg > 0) return `${avg} min`;
          }
          if (diff1 > 0) return `${diff1} min`;
      }
      return null;
  }

  // --- NEW: AI Crowd Prediction ---
  public async generateCrowdInsight(bus: BusServiceData, stopName: string): Promise<string> {
      try {
          const now = new Date();
          const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const day = now.toLocaleDateString([], { weekday: 'long' });
          const load = bus.next?.load || "Unknown";
          
          const prompt = `
          Predict if Bus ${bus.serviceNo} at ${stopName} will be full/crowded.
          Context: Time: ${time}, Day: ${day} (Singapore).
          Live Status: ${load} (SEA=Seats, SDA=Standing, LSD=Limited Standing).
          Consider peak hours, holidays, and school hours.
          Reply in 1 short sentence (max 12 words). Start with "Prediction:".
          `;

          const response = await this.genAI.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
          });

          return response.text.trim();
      } catch (e) {
          return "Prediction unavailable.";
      }
  }
}

export const transportService = new TransportService();
