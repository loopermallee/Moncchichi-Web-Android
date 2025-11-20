
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { transportService, BusServiceData, BusStopLocation, ArrivalInfo, BusSchedule, MRTLine, MRTStation, TrainServiceAlert, StationCrowdData, StationAccessibility } from '../services/transportService';
import { mockService } from '../services/mockService';
import { Accessibility, Search, Star, ChevronDown, ChevronUp, MapPin, RotateCcw, Edit2, Check, X, Calendar, TrainFront, BusFront, Users, Info, AlertTriangle, TrendingUp } from 'lucide-react';

interface StopWithArrivals extends BusStopLocation {
    services: BusServiceData[];
}

type TransportMode = 'BUS' | 'TRAIN';

const Transport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  // View State
  const [transportMode, setTransportMode] = useState<TransportMode>('BUS');
  const [viewMode, setViewMode] = useState<'NEARBY' | 'FAVORITES'>('NEARBY');

  // Bus State
  const [nearbyStopsData, setNearbyStopsData] = useState<StopWithArrivals[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  // Favorites State
  const [favStopsData, setFavStopsData] = useState<StopWithArrivals[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [favoritesUpdated, setFavoritesUpdated] = useState(0);

  // Train State
  const [mrtData, setMrtData] = useState<MRTLine[]>([]);
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [trainAlerts, setTrainAlerts] = useState<TrainServiceAlert[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  
  // Train Station Details Cache
  const [stationDetails, setStationDetails] = useState<Record<string, { crowd: StationCrowdData, lift: StationAccessibility }>>({});
  const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({});

  // Manual Lookup State
  const [busStopId, setBusStopId] = useState(transportService.getDefaultStop());
  const [manualArrivals, setManualArrivals] = useState<BusServiceData[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Expansion State (Bus)
  const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});

  // THEME HELPERS
  // Returns classes based on active mode
  const getThemeColor = () => transportMode === 'BUS' ? 'text-moncchichi-accent' : 'text-cyan-400';
  const getBorderColor = () => transportMode === 'BUS' ? 'border-moncchichi-accent' : 'border-cyan-500';
  const getBgActive = () => transportMode === 'BUS' ? 'bg-moncchichi-accent' : 'bg-cyan-500';

  const toggleExpand = (stopId: string) => {
      setExpandedStops(prev => ({
          ...prev,
          [stopId]: !prev[stopId]
      }));
  };

  const toggleLineExpand = (lineCode: string) => {
      setExpandedLines(prev => ({
          ...prev,
          [lineCode]: !prev[lineCode]
      }));
  };

  const toggleStationExpand = (stationCode: string) => {
      setExpandedStations(prev => ({
          ...prev,
          [stationCode]: !prev[stationCode]
      }));
      
      // Fetch details if missing
      if (!stationDetails[stationCode]) {
          const crowd = transportService.getStationCrowd(stationCode);
          const lift = transportService.getLiftStatus(stationCode);
          setStationDetails(prev => ({
              ...prev,
              [stationCode]: { crowd, lift }
          }));
      }
  };

  const toggleFavorite = (stop: BusStopLocation) => {
      if (transportService.isFavorite(stop.id)) {
          transportService.removeFavorite(stop.id);
      } else {
          transportService.addFavorite(stop);
      }
      setFavoritesUpdated(Date.now());
      if (viewMode === 'FAVORITES') fetchFavoritesData();
  };

  const handleRename = (stopId: string, newName: string) => {
      transportService.renameFavorite(stopId, newName);
      setFavoritesUpdated(Date.now());
      if (viewMode === 'FAVORITES') fetchFavoritesData();
      if (viewMode === 'NEARBY') {
          setNearbyStopsData(prev => prev.map(s => s.id === stopId ? { ...s, name: newName } : s));
      }
  };

  const fetchManualBusData = async (stopId: string) => {
    if (!stopId || stopId.length < 5) {
        setManualError("Enter a valid 5-digit Stop ID");
        return;
    }
    setManualLoading(true);
    setManualError(null);
    setSearchPerformed(true);
    setManualArrivals([]); 
    try {
      const data = await transportService.getArrivals(stopId);
      if (!data.services || data.services.length === 0) {
          setManualError(`No services found for stop ${stopId}.`);
      } else {
          setManualArrivals(data.services);
          transportService.setDefaultStop(stopId);
      }
    } catch (err) {
      setManualError("Unable to fetch live data. Check connection/ID.");
    } finally {
      setManualLoading(false);
    }
  };

  const fetchNearbyData = async (lat: number, lng: number) => {
    setNearbyLoading(true);
    try {
        const stops = await transportService.findNearestStops(lat, lng);
        const promises = stops.map(stop => 
            transportService.getArrivals(stop.id)
                .then(data => ({ ...stop, services: data.services }))
                .catch(() => null)
        );
        const results = await Promise.all(promises);
        const validStops = results.filter((r): r is StopWithArrivals => r !== null);
        const enrichedStops = validStops.map(s => {
            const fav = transportService.getFavorite(s.id);
            return fav ? { ...s, name: fav.name } : s;
        });
        setNearbyStopsData(enrichedStops);
        setLastUpdated(Date.now());
    } catch (e) {
        mockService.emitLog("TRANSPORT", "ERROR", "Failed to get nearby data");
    } finally {
        setNearbyLoading(false);
    }
  };

  const fetchTrainAlerts = async () => {
      setAlertLoading(true);
      try {
          const alerts = await transportService.getTrainServiceAlerts();
          setTrainAlerts(alerts);
      } catch (e) {
          // handled in service
      } finally {
          setAlertLoading(false);
      }
  };

  const refreshLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
        mockService.emitLog("GPS", "INFO", "Updating location...");
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setLocation({ lat: latitude, lng: longitude });
                const address = await transportService.getAddress(latitude, longitude);
                setLocationName(address);
                fetchNearbyData(latitude, longitude);
                setIsLocating(false);
                mockService.emitLog("GPS", "INFO", `Location updated: ${address}`);
            },
            (err) => {
                mockService.emitLog("GPS", "WARN", "Location denied. Using demo location.");
                const demoLoc = { lat: 1.3040, lng: 103.8340 };
                setLocation(demoLoc);
                setLocationName("Orchard Stn/Lucky Plaza (Demo)");
                fetchNearbyData(demoLoc.lat, demoLoc.lng);
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        fetchManualBusData(busStopId);
        setIsLocating(false);
    }
  };

  const fetchFavoritesData = async () => {
      setFavLoading(true);
      try {
          const favs = transportService.getFavorites();
          if (location) {
              favs.forEach(f => {
                  if (f.lat && f.lng) {
                      f.distance = transportService.calculateDistance(f.lat, f.lng, location.lat, location.lng);
                  } else {
                      f.distance = 99999;
                  }
              });
              favs.sort((a, b) => (a.distance || 0) - (b.distance || 0));
          }
          const promises = favs.map(stop => 
              transportService.getArrivals(stop.id)
                  .then(data => ({ ...stop, services: data.services }))
                  .catch(() => ({ ...stop, services: [] }))
          );
          const results = await Promise.all(promises);
          setFavStopsData(results);
      } catch (e) {
          mockService.emitLog("TRANSPORT", "ERROR", "Failed to load favorites");
      } finally {
          setFavLoading(false);
      }
  };

  // Init Logic
  useEffect(() => {
    refreshLocation();
    setMrtData(transportService.getMRTNetwork());
    // Load initial train details to populate visible list (simulated batch load)
    const allStations: string[] = [];
    transportService.getMRTNetwork().forEach(l => l.stations.forEach(s => allStations.push(s.code)));
    
    // Preload some random data for visuals (in real app we might lazy load)
    const initialDetails: Record<string, any> = {};
    allStations.forEach(code => {
        initialDetails[code] = {
            crowd: transportService.getStationCrowd(code),
            lift: transportService.getLiftStatus(code)
        };
    });
    setStationDetails(initialDetails);
    fetchTrainAlerts();
  }, []);

  useEffect(() => {
      if (viewMode === 'FAVORITES') {
          fetchFavoritesData();
      }
  }, [viewMode, location]);

  const handleSendToHud = (bus: BusServiceData) => {
    const message = transportService.formatHudMessage(bus);
    mockService.sendCommand("CLEAR_SCREEN");
    mockService.emitLog("TX", "INFO", `[09] HUD_DRAW_TEXT: "${message.replace(/\n/g, '|')}"`);
    mockService.emitLog("TTS", "INFO", `Speaking: "${transportService.formatTtsMessage(bus)}"`);
  };

  const handleSendStationToHud = (line: MRTLine, station: MRTStation) => {
      const details = stationDetails[station.code];
      const message = `${line.code} | ${station.name}\nCrowd: ${details?.crowd.current || 'N/A'}`;
      mockService.sendCommand("CLEAR_SCREEN");
      mockService.emitLog("TX", "INFO", `[09] HUD_DRAW_TEXT: "${message.replace(/\n/g, '|')}"`);
      mockService.emitLog("TTS", "INFO", `Speaking: "Station ${station.name} is currently at ${details?.crowd.current || 'unknown'} crowd level."`);
  };

  const handleOpenMaps = () => {
      if (location) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`, '_blank');
      }
  };

  const LoadIndicator: React.FC<{ arrival: ArrivalInfo }> = ({ arrival }) => {
      const config = {
          'SEA': { color: 'bg-moncchichi-success', text: 'Seats Available' },
          'SDA': { color: 'bg-moncchichi-warning', text: 'Standing Available' },
          'LSD': { color: 'bg-moncchichi-error', text: 'Limited Standing' },
      }[arrival.load] || { color: 'bg-moncchichi-textSec', text: arrival.load };

      return (
          <div className="flex items-center gap-1.5">
             <div className={`w-2 h-2 rounded-full ${config.color}`} />
             <span className="text-[9px] text-moncchichi-textSec font-medium uppercase tracking-tight whitespace-nowrap">{config.text}</span>
          </div>
      );
  };

  const ArrivalItem: React.FC<{ bus: BusServiceData; schedule?: BusSchedule; showInsights?: boolean }> = ({ bus, schedule, showInsights }) => {
      const dayType = transportService.getDayType();
      const formatTime = (t?: string) => {
          if (!t || t === '-') return '-';
          if (t.includes(':')) return t;
          return t.length === 4 ? `${t.slice(0,2)}:${t.slice(2)}` : t;
      };
      const getFirst = () => schedule ? formatTime(schedule.first[dayType]) : '-';
      const getLast = () => schedule ? formatTime(schedule.last[dayType]) : '-';

      return (
        <div className="p-3 flex flex-col gap-2 hover:bg-moncchichi-surfaceAlt/30 transition-colors border-b border-moncchichi-border last:border-0 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-10 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg flex flex-col items-center justify-center shrink-0 shadow-sm">
                        <span className="font-bold text-moncchichi-text text-sm leading-none">{bus.serviceNo}</span>
                        <span className="text-[9px] text-moncchichi-textSec mt-0.5 scale-90">{bus.operator}</span>
                    </div>
                    <div className="flex-1">
                        {bus.next ? (
                            <div className="flex flex-col">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-moncchichi-text">
                                            {bus.next.mins <= 0 ? 'Arr' : bus.next.mins}
                                        </span>
                                        <span className="text-xs text-moncchichi-textSec">{bus.next.mins <= 0 ? '' : 'min'}</span>
                                    </div>
                                    <LoadIndicator arrival={bus.next} />
                                    
                                    {/* Explicit Bus Type */}
                                    <span className="text-[9px] text-moncchichi-textSec border border-moncchichi-border px-1.5 rounded bg-moncchichi-bg/50 uppercase font-medium tracking-tight whitespace-nowrap">
                                        {transportService.getBusTypeLabel(bus.next.type)}
                                    </span>
                                    
                                    {bus.next.feature === 'WAB' && (
                                        <Accessibility size={12} className="text-moncchichi-textSec" />
                                    )}
                                </div>

                                {/* Subsequent Buses */}
                                {bus.subsequent && (
                                    <div className="flex items-center gap-2 mt-1 opacity-70">
                                        <span className="text-xs text-moncchichi-textSec font-mono flex items-center gap-1">
                                            Next: {bus.subsequent.mins}m 
                                            <span className="text-[9px] border px-0.5 rounded border-moncchichi-border/50">{transportService.getBusTypeLabel(bus.subsequent.type)}</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs text-moncchichi-textSec italic">Not In Service</span>
                        )}
                    </div>
                </div>
                <button 
                    onClick={() => handleSendToHud(bus)}
                    className="p-2 text-moncchichi-textSec hover:text-moncchichi-accent active:scale-95 transition-transform rounded-full hover:bg-moncchichi-surfaceAlt"
                    title="Send to Glasses"
                >
                    {ICONS.Glasses}
                </button>
            </div>
            
            {/* Insights (Favorites Only) */}
            {showInsights && (
                <div className="mt-1 flex items-start gap-2 bg-moncchichi-accent/5 border border-moncchichi-accent/10 rounded p-2">
                    <TrendingUp size={14} className="text-moncchichi-accent shrink-0 mt-0.5" />
                    <span className="text-[10px] text-moncchichi-textSec leading-relaxed">
                        <strong className="text-moncchichi-accent">Analysis:</strong> {transportService.getBusRouteInsight(bus.serviceNo)}
                    </span>
                </div>
            )}

            {schedule && (
                <div className="flex items-center gap-4 pl-[60px] text-[10px] text-moncchichi-textSec opacity-80">
                    <div className="flex items-center gap-1 bg-moncchichi-bg px-1.5 py-0.5 rounded border border-moncchichi-border/50">
                        <Calendar size={10} />
                        <span className="uppercase font-bold">{dayType === 'wd' ? 'Weekday' : (dayType === 'sat' ? 'Saturday' : 'Sun/PH')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span>First: <span className="text-moncchichi-text font-mono">{getFirst()}</span></span>
                        <span>Last: <span className="text-moncchichi-text font-mono">{getLast()}</span></span>
                    </div>
                </div>
            )}
        </div>
      );
  };

  const BusStopCard: React.FC<{ stop: StopWithArrivals }> = ({ stop }) => {
    const isExpanded = !!expandedStops[stop.id];
    const isFav = transportService.isFavorite(stop.id);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(stop.name);
    const [schedules, setSchedules] = useState<Record<string, BusSchedule>>({});

    useEffect(() => {
        if (isExpanded && Object.keys(schedules).length === 0) {
            transportService.getStopSchedule(stop.id).then(setSchedules);
        }
    }, [isExpanded, stop.id]);

    const handleSaveName = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editName.trim()) {
            handleRename(stop.id, editName.trim());
        } else {
            setEditName(stop.name); 
        }
        setIsEditing(false);
    };

    return (
        <div className="bg-moncchichi-surface rounded-xl border border-moncchichi-border overflow-hidden shadow-sm transition-all">
            <div 
                className={`bg-moncchichi-surfaceAlt/50 p-3 border-b border-moncchichi-border flex justify-between items-center cursor-pointer select-none ${!isExpanded ? 'border-b-0' : ''}`}
                onClick={() => toggleExpand(stop.id)}
            >
                <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 h-6">
                        {isEditing ? (
                            <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="flex-1 bg-moncchichi-bg border border-moncchichi-accent rounded px-2 py-0.5 text-sm focus:outline-none"
                                    autoFocus
                                />
                                <button onClick={handleSaveName} className="p-1 text-moncchichi-success hover:bg-moncchichi-surfaceAlt rounded"><Check size={14} /></button>
                            </div>
                        ) : (
                            <>
                                <div className="font-bold text-sm text-moncchichi-text truncate">{stop.name}</div>
                                {isFav && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(stop.name); }}
                                        className="p-1 text-moncchichi-textSec hover:text-moncchichi-accent opacity-50 hover:opacity-100"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-[10px] text-moncchichi-textSec font-mono bg-moncchichi-bg px-1.5 rounded border border-moncchichi-border">{stop.id}</div>
                        {stop.distance !== undefined && stop.distance < 1000 && (
                            <div className="text-[10px] text-moncchichi-success flex items-center gap-0.5"><MapPin size={10} />{Math.round(stop.distance * 1000)}m</div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(stop); }}
                        className={`p-2 transition-colors rounded-full hover:bg-moncchichi-bg ${isFav ? 'text-moncchichi-warning' : 'text-moncchichi-textSec'}`}
                    >
                        <Star size={16} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    <div className="text-moncchichi-textSec">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    {stop.services.length === 0 ? (
                        <div className="p-4 text-center text-xs text-moncchichi-textSec italic">No services currently available</div>
                    ) : (
                        stop.services.map((bus, idx) => (
                            <ArrivalItem 
                                key={`${stop.id}-${bus.serviceNo}-${idx}`} 
                                bus={bus} 
                                schedule={schedules[bus.serviceNo]} 
                                showInsights={viewMode === 'FAVORITES'} // Pass true only for Favorites view
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
  };

  // Manual Search Result Renderer
  const manualFav = transportService.getFavorite(busStopId);
  const manualDisplayName = manualFav ? manualFav.name : `Stop ${busStopId}`;
  const [manualSchedules, setManualSchedules] = useState<Record<string, BusSchedule>>({});
  useEffect(() => {
      if (searchPerformed && manualArrivals.length > 0) {
          transportService.getStopSchedule(busStopId).then(setManualSchedules);
      }
  }, [searchPerformed, manualArrivals, busStopId]);

  // Crowd Color Helper
  const getCrowdColor = (level: string) => {
      switch(level) {
          case 'LOW': return 'bg-moncchichi-success text-moncchichi-bg';
          case 'MODERATE': return 'bg-moncchichi-warning text-moncchichi-bg';
          case 'HIGH': return 'bg-moncchichi-error text-white';
          default: return 'bg-moncchichi-surfaceAlt text-moncchichi-textSec';
      }
  };

  // === RENDER ===

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg transition-colors duration-500">
      {/* Header */}
      <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm z-30">
        <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
          {ICONS.Back}
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
            {ICONS.Bus} Griffin's Flight
          </h2>
        </div>
        
        {/* Mode Toggle Switch */}
        <div className="flex bg-moncchichi-surfaceAlt rounded-xl p-1.5 border border-moncchichi-border shadow-inner max-w-xs ml-auto">
            <button 
                onClick={() => setTransportMode('BUS')}
                className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-300 ${transportMode === 'BUS' ? 'bg-moncchichi-accent text-moncchichi-bg shadow-md' : 'text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-bg/50'}`}
            >
                <BusFront size={18} strokeWidth={2.5} />
                <span className="text-[10px] font-bold tracking-wider">BUS</span>
            </button>
            <button 
                onClick={() => setTransportMode('TRAIN')}
                className={`px-3 py-2 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-300 ${transportMode === 'TRAIN' ? 'bg-cyan-500 text-moncchichi-bg shadow-md' : 'text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-bg/50'}`}
            >
                <TrainFront size={18} strokeWidth={2.5} />
                <span className="text-[10px] font-bold tracking-wider">MRT</span>
            </button>
        </div>
      </div>

      {/* BUS VIEW */}
      {transportMode === 'BUS' && (
        <>
            {/* Bus Tabs */}
            <div className="px-4 pt-4">
                <div className="flex p-1 bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border">
                    <button 
                        onClick={() => setViewMode('NEARBY')}
                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'NEARBY' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                    >
                        Nearby
                    </button>
                    <button 
                        onClick={() => setViewMode('FAVORITES')}
                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'FAVORITES' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                    >
                        Favorites
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Location Header (Nearby) */}
                {viewMode === 'NEARBY' && (
                    <div className="bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-moncchichi-accent">{ICONS.MapPin}</div>
                        <div className="flex justify-between items-start">
                            <div className="flex-1 pr-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider">Location</h3>
                                    <button onClick={refreshLocation} disabled={isLocating} className="p-1 -my-1 text-moncchichi-textSec hover:text-moncchichi-text transition-colors rounded-full disabled:opacity-50">
                                        <RotateCcw size={12} className={isLocating ? "animate-spin" : ""} />
                                    </button>
                                </div>
                                {locationName ? (
                                    <div className="font-semibold text-sm text-moncchichi-text leading-tight">{locationName}</div>
                                ) : (
                                    <div className="text-sm text-moncchichi-textSec italic">{isLocating ? "Locating address..." : "Location unavailable"}</div>
                                )}
                            </div>
                            <button onClick={handleOpenMaps} disabled={!location} className="flex items-center gap-2 px-3 py-2 bg-moncchichi-surfaceAlt hover:bg-moncchichi-border rounded-lg border border-moncchichi-border text-xs font-bold transition-colors text-blue-400 shrink-0">
                                {ICONS.Map} <span>Map</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Switching */}
                {viewMode === 'NEARBY' ? (
                    <>
                        {nearbyStopsData.length > 0 ? (
                            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-end px-1">
                                    <h3 className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider">Nearby Stops</h3>
                                    <span className="text-[10px] text-moncchichi-textSec">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : ''}</span>
                                </div>
                                {nearbyStopsData.map((stop) => <BusStopCard key={stop.id} stop={stop} />)}
                            </div>
                        ) : (
                            !nearbyLoading && <div className="text-center py-8 text-moncchichi-textSec opacity-60"><p>No nearby stops found.</p></div>
                        )}
                    </>
                ) : (
                    <>
                        {favStopsData.length > 0 ? (
                            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-end px-1">
                                    <h3 className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider">Pinned Stops</h3>
                                    {location && <span className="text-[10px] text-moncchichi-success">Sorted by distance</span>}
                                </div>
                                {favStopsData.map((stop) => <BusStopCard key={stop.id} stop={stop} />)}
                            </div>
                        ) : (
                            !favLoading && (
                                <div className="flex flex-col items-center justify-center py-12 text-moncchichi-textSec opacity-60 gap-3">
                                    <Star size={32} strokeWidth={1} />
                                    <p className="text-sm">No favorite stops yet.</p>
                                </div>
                            )
                        )}
                    </>
                )}

                {/* Manual Lookup */}
                <div className="bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border mt-8 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider flex items-center gap-2"><Search size={14} /> Manual Lookup</label>
                        {manualLoading && <span className="text-[10px] text-moncchichi-accent animate-pulse font-bold">FETCHING...</span>}
                    </div>
                    <div className="flex gap-2 mb-2">
                        <input 
                            type="text" 
                            value={busStopId}
                            onChange={(e) => { setBusStopId(e.target.value.replace(/\D/g, '').slice(0, 5)); setManualError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && fetchManualBusData(busStopId)}
                            placeholder="Enter 5-digit Stop ID"
                            className={`flex-1 bg-moncchichi-bg border ${manualError ? 'border-moncchichi-error' : 'border-moncchichi-border'} rounded-lg px-3 py-2 font-mono text-sm focus:border-moncchichi-accent focus:outline-none transition-all`}
                        />
                        <button onClick={() => fetchManualBusData(busStopId)} disabled={manualLoading || busStopId.length < 5} className="bg-moncchichi-surfaceAlt text-moncchichi-text px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform border border-moncchichi-border whitespace-nowrap hover:bg-moncchichi-border">
                            {manualLoading ? '...' : 'Search'}
                        </button>
                    </div>
                    {manualError && (
                        <div className="p-3 bg-moncchichi-error/10 border border-moncchichi-error/20 rounded-lg mb-2 animate-in fade-in">
                            <p className="text-xs text-moncchichi-error flex items-center gap-2">{ICONS.XCircle}{manualError}</p>
                        </div>
                    )}
                    {searchPerformed && !manualLoading && !manualError && (
                        <div className="mt-4 pt-2 border-t border-moncchichi-border animate-in slide-in-from-bottom-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-moncchichi-text flex items-center gap-2"><div className="w-2 h-2 bg-moncchichi-success rounded-full animate-pulse" />{manualDisplayName}</span>
                                <button onClick={() => toggleFavorite({ id: busStopId, name: manualDisplayName })} className={`text-[10px] font-bold px-2 py-1 rounded border flex items-center gap-1 transition-colors ${transportService.isFavorite(busStopId) ? 'bg-moncchichi-warning text-moncchichi-bg border-moncchichi-warning' : 'bg-moncchichi-surfaceAlt text-moncchichi-textSec border-moncchichi-border'}`}>
                                    <Star size={10} fill={transportService.isFavorite(busStopId) ? "currentColor" : "none"} />{transportService.isFavorite(busStopId) ? 'Saved' : 'Save'}
                                </button>
                            </div>
                            <div className="rounded-lg border border-moncchichi-border overflow-hidden bg-moncchichi-surfaceAlt/20">
                                {manualArrivals.map((bus, idx) => <ArrivalItem key={`manual-${bus.serviceNo}-${idx}`} bus={bus} schedule={manualSchedules[bus.serviceNo]} showInsights={false} />)}
                            </div>
                        </div>
                    )}
                </div>
                <div className="h-8" />
            </div>
        </>
      )}

      {/* TRAIN VIEW */}
      {transportMode === 'TRAIN' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-in slide-in-from-right-4 duration-300">
              {/* Network Ticker */}
              <div className={`rounded-lg p-3 border flex items-start gap-3 shadow-sm ${trainAlerts.length > 0 ? 'bg-moncchichi-error/10 border-moncchichi-error/30' : 'bg-moncchichi-surface border-cyan-500/20'}`}>
                   <div className={`mt-0.5 ${trainAlerts.length > 0 ? 'text-moncchichi-error' : 'text-cyan-400'}`}>
                       {trainAlerts.length > 0 ? <AlertTriangle size={16} /> : <Check size={16} />}
                   </div>
                   <div className="flex-1">
                       <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${trainAlerts.length > 0 ? 'text-moncchichi-error' : 'text-cyan-400'}`}>
                           {trainAlerts.length > 0 ? 'Service Alert' : 'Network Normal'}
                       </h4>
                       <p className="text-xs text-moncchichi-text leading-relaxed">
                           {trainAlerts.length > 0 
                                ? trainAlerts.map(a => a.Message).join(' | ') 
                                : 'All train lines are operating normally. Lift maintenance scheduled for selected stations.'}
                       </p>
                   </div>
              </div>

              <div className="flex justify-between items-end px-1 pt-2">
                  <h3 className="text-xs font-medium text-cyan-500 uppercase tracking-wider">Lines & Stations</h3>
                  <span className="text-[10px] text-moncchichi-textSec">LTA DataMall</span>
              </div>
              
              {mrtData.map((line) => {
                  const isLineExpanded = expandedLines[line.code];
                  return (
                      <div key={line.code} className="bg-moncchichi-surface rounded-xl border border-moncchichi-border overflow-hidden shadow-sm">
                          <div 
                              className="p-4 flex items-center justify-between cursor-pointer bg-moncchichi-surfaceAlt/30 hover:bg-moncchichi-surfaceAlt/50 transition-colors"
                              onClick={() => toggleLineExpand(line.code)}
                              style={{ borderLeft: `4px solid ${line.color}` }}
                          >
                              <div>
                                  <div className="text-sm font-bold text-moncchichi-text">{line.name}</div>
                                  <div className="text-[10px] text-moncchichi-textSec font-mono">{line.code} • {line.stations.length} Stations</div>
                              </div>
                              <div className={`text-moncchichi-textSec transition-transform duration-300 ${isLineExpanded ? 'rotate-180' : ''}`}>
                                  <ChevronDown size={18} />
                              </div>
                          </div>

                          {isLineExpanded && (
                              <div className="border-t border-moncchichi-border">
                                  {line.stations.map((station) => {
                                      const details = stationDetails[station.code];
                                      const isStationExpanded = expandedStations[station.code];
                                      
                                      return (
                                      <div key={station.code} className="border-b border-moncchichi-border/50 last:border-0">
                                          <div 
                                            className="px-4 py-3 flex justify-between items-center hover:bg-moncchichi-surfaceAlt/20 cursor-pointer"
                                            onClick={() => toggleStationExpand(station.code)}
                                          >
                                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                                  <div 
                                                    className="w-8 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shadow-sm shrink-0"
                                                    style={{ backgroundColor: line.color }}
                                                  >
                                                      {station.code}
                                                  </div>
                                                  <div className="flex flex-col min-w-0">
                                                      <span className="text-sm text-moncchichi-text opacity-90 truncate">{station.name}</span>
                                                      {details?.lift.liftMaintenance && (
                                                          <div className="flex items-center gap-1 text-[9px] text-moncchichi-warning mt-0.5">
                                                              <Accessibility size={9} />
                                                              <span>Lift Maint.</span>
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              
                                              <div className="flex items-center gap-3 shrink-0">
                                                  {/* Crowd Pill */}
                                                  {details && (
                                                      <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tight ${getCrowdColor(details.crowd.current)}`}>
                                                          {details.crowd.current}
                                                      </div>
                                                  )}
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSendStationToHud(line, station); }}
                                                    className="p-2 text-cyan-500/50 hover:text-cyan-400 active:scale-95 transition-all rounded-full hover:bg-cyan-500/10"
                                                  >
                                                      {ICONS.Glasses}
                                                  </button>
                                              </div>
                                          </div>

                                          {/* Station Details (Crowd Forecast) */}
                                          {isStationExpanded && details && (
                                              <div className="bg-moncchichi-bg/50 p-3 animate-in slide-in-from-top-2">
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <Users size={12} className="text-moncchichi-textSec" />
                                                      <span className="text-[10px] font-bold text-moncchichi-textSec uppercase">Crowd Forecast</span>
                                                  </div>
                                                  
                                                  {/* Timeline */}
                                                  <div className="flex justify-between gap-1">
                                                      {details.crowd.forecast.map((item, i) => (
                                                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                              <div className={`w-full h-1.5 rounded-full ${getCrowdColor(item.level)} opacity-80`}></div>
                                                              <span className="text-[9px] text-moncchichi-textSec font-mono">{item.time}</span>
                                                          </div>
                                                      ))}
                                                  </div>

                                                  {/* Recommendation */}
                                                  <div className="mt-3 p-2 rounded bg-moncchichi-surface border border-moncchichi-border flex items-start gap-2">
                                                      <Info size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                                                      <div className="text-[10px] text-moncchichi-text leading-tight">
                                                          {details.crowd.trend === 'RISING' 
                                                            ? 'Crowds are building up. Recommend travelling now.' 
                                                            : (details.crowd.trend === 'FALLING' ? 'Crowds easing soon. Consider waiting 30 mins.' : 'Traffic is stable.')}
                                                      </div>
                                                  </div>

                                                  {/* Access Alerts */}
                                                  {details.lift.liftMaintenance && (
                                                      <div className="mt-2 p-2 rounded bg-moncchichi-warning/10 border border-moncchichi-warning/30 flex items-start gap-2">
                                                          <AlertTriangle size={12} className="text-moncchichi-warning mt-0.5 shrink-0" />
                                                          <div className="text-[10px] text-moncchichi-warning leading-tight">
                                                              {details.lift.details}
                                                          </div>
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  );
              })}
              <div className="h-8" />
          </div>
      )}
    </div>
  );
};

export default Transport;
