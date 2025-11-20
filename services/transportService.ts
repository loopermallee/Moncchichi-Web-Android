
import { mockService } from './mockService';

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

const BASE_URL = 'https://arrivelah2.busrouter.sg';
const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';
const LTA_API_KEY = 'BDSwMqU/RVyzCbvR0iAFng==';
const STORAGE_KEY_FAV = 'moncchichi_fav_stops';

// Mock Database of Stops (Orchard/City Area)
const MOCK_STOPS: BusStopLocation[] = [
    { id: '09048', name: 'Orchard Stn/Lucky Plaza', lat: 1.3040, lng: 103.8340 },
    { id: '09038', name: 'Opp Orchard Stn/ION', lat: 1.3048, lng: 103.8317 },
    { id: '09022', name: 'Tang Plaza', lat: 1.3055, lng: 103.8325 },
    { id: '04168', name: 'Clarke Quay Stn', lat: 1.2885, lng: 103.8466 },
    { id: '01012', name: 'Hotel Grand Pacific', lat: 1.2968, lng: 103.8524 },
    { id: '04121', name: 'Hong Lim Park', lat: 1.2865, lng: 103.8460 },
    { id: '14119', name: 'Opp ARC 380', lat: 1.3133, lng: 103.8606 },
    { id: '05013', name: 'People\'s Pk Cplx', lat: 1.2848, lng: 103.8426 },
    { id: '10009', name: 'VivoCity', lat: 1.2646, lng: 103.8233 },
];

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
  private crowdCache: Record<string, StationCrowdData> = {};

  getDefaultStop(): string {
    return this.defaultStop;
  }

  setDefaultStop(id: string) {
    this.defaultStop = id;
  }

  // --- BUS API ---

  async getArrivals(stopId: string): Promise<BusStopData> {
    // Primary: Try LTA DataMall Official API
    try {
        const headers = new Headers();
        headers.append('AccountKey', LTA_API_KEY);
        headers.append('accept', 'application/json');

        const res = await fetch(`${LTA_BASE_URL}/BusArrivalv2?BusStopCode=${stopId}`, {
            method: 'GET',
            headers: headers
        });

        if (!res.ok) {
            throw new Error(`LTA API returned status: ${res.status}`);
        }
        
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

    } catch (error) {
        // Fallback: Arrivelah (Legacy / Proxy)
        // Essential for environments where direct LTA calls are CORS-blocked (like browsers)
        // console.warn("LTA Bus API failed (likely CORS), using fallback.", error);
        try {
            const response = await fetch(`${BASE_URL}/?id=${stopId}`);
            if (!response.ok) throw new Error('Fallback network response was not ok');
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
            mockService.emitLog("TRANSPORT", "ERROR", `API Error for ${stopId}`);
            throw error; // Throw the original error to indicate primary failure
        }
    }
  }

  private mapLtaArrival(bus: any): ArrivalInfo | null {
      if (!bus || !bus.EstimatedArrival) return null;
      
      const arrivalTime = new Date(bus.EstimatedArrival).getTime();
      const now = Date.now();
      const mins = Math.floor((arrivalTime - now) / 60000);

      return {
          mins: mins, // UI handles values <= 0 as "Arr"
          load: bus.Load,
          type: bus.Type,
          feature: bus.Feature
      };
  }

  async findNearestStops(lat: number, lng: number): Promise<BusStopLocation[]> {
    const sorted = MOCK_STOPS.map(stop => {
        if (!stop.lat || !stop.lng) return { ...stop, distance: 99999 };
        return {
            ...stop,
            distance: this.calculateDistance(lat, lng, stop.lat, stop.lng)
        };
    }).sort((a, b) => a.distance - b.distance);

    return sorted.slice(0, 5);
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
          
          // NOTE: Fetching directly from browser usually fails CORS with LTA DataMall.
          // We implement the fetch for correctness, but fallback to empty array (Normal status)
          // or mock alerts on error to ensure app stability in browser-only mode.
          const res = await fetch(`${LTA_BASE_URL}/TrainServiceAlerts`, {
              method: 'GET',
              headers: headers
          });

          if (res.ok) {
              const data = await res.json();
              return data.value || [];
          }
          throw new Error("LTA API Status " + res.status);
      } catch (e) {
          console.warn("LTA API Alert fetch failed (likely CORS). Using mock status.", e);
          // Mock a disruption for demo purposes occasionally
          // if (Math.random() > 0.8) return [{ Status: 2, Line: "NSL", Direction: "Both", Message: "Train delay from Ang Mo Kio to Bishan due to track fault." }];
          return []; 
      }
  }

  // Crowd Density & Accessibility Simulation
  // (As real-time LTA crowd/lift data often requires separate endpoints/approvals)
  getStationCrowd(stationCode: string): StationCrowdData {
    if (this.crowdCache[stationCode]) {
        // simple cache invalidation logic could go here
        return this.crowdCache[stationCode];
    }

    const hour = new Date().getHours();
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    
    // Bias random based on peak hours and "Interchange" status (roughly approximated)
    let bias = isPeak ? 0.6 : 0.2; 
    // Interchanges are busier
    if (['NS1', 'NS17', 'NS24', 'EW13', 'EW14', 'EW24'].includes(stationCode)) bias += 0.3;

    const rand = Math.random();
    let level: CrowdLevel = 'LOW';
    if (rand < bias * 0.5) level = 'MODERATE';
    if (rand < bias * 0.2) level = 'HIGH';

    // Generate forecast
    const forecast = [];
    for (let i = 1; i <= 4; i++) {
        const fTime = new Date(Date.now() + i * 30 * 60000);
        // Simple trend logic
        const fRand = Math.random();
        let fLevel: CrowdLevel = 'LOW';
        // Slightly smooth transitions
        if (level === 'HIGH') fLevel = fRand > 0.3 ? 'HIGH' : 'MODERATE';
        else if (level === 'MODERATE') fLevel = fRand > 0.5 ? 'MODERATE' : (fRand > 0.25 ? 'LOW' : 'HIGH');
        else fLevel = fRand > 0.8 ? 'MODERATE' : 'LOW';

        forecast.push({
            time: fTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            level: fLevel
        });
    }

    const data: StationCrowdData = {
        stationCode,
        current: level,
        trend: Math.random() > 0.5 ? 'STABLE' : (Math.random() > 0.5 ? 'RISING' : 'FALLING'),
        forecast
    };

    this.crowdCache[stationCode] = data;
    return data;
  }

  getLiftStatus(stationCode: string): StationAccessibility {
      // Simulate ~5% chance of lift maintenance
      const isMaintenance = Math.random() < 0.05;
      return {
          stationCode,
          liftMaintenance: isMaintenance,
          details: isMaintenance ? "Lift A (Concourse to Platform) under maintenance" : undefined
      };
  }

  // --- PASSENGER VOLUME INSIGHTS ---
  
  getBusRouteInsight(serviceNo: string): string {
      // Simulation of Passenger Volume (PV) by Bus / Origin-Destination (OD) analytics
      // Logic is deterministic based on service number for demo consistency
      const n = parseInt(serviceNo.replace(/\D/g, '')) || 0;
      
      if (n % 3 === 0) {
          return "🔥 High Volume Route. Busiest: 07:30-09:00. Calmest: 14:00-16:00.";
      } else if (n % 3 === 1) {
          return "⚖️ Moderate Flow. Peak: 18:00-19:30. Generally seats available off-peak.";
      } else {
          return "📉 Feeder Profile. Short peak spikes at 07:00 & 18:00. Low ridership mid-day.";
      }
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
      // Mock reverse geocoding
      return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
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
      // Mock schedule data
      return {};
  }
}

export const transportService = new TransportService();
