
import React, { useState, useEffect, useCallback } from 'react';
import { ICONS } from '../constants';
import { transportService, BusServiceData, BusStopLocation, ArrivalInfo, MRTLine, MRTStation, TrainServiceAlert, StationCrowdData, StationAccessibility } from '../services/transportService';
import { mockService } from '../services/mockService';
import { locationService } from '../services/locationService';
import { Accessibility, Search, Star, ChevronDown, ChevronUp, MapPin, RotateCcw, Edit2, Check, BusFront, TrainFront, Users, AlertTriangle, Clock, Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface StopWithArrivals extends BusStopLocation {
    services: BusServiceData[];
}

type TransportMode = 'BUS' | 'TRAIN';

interface TransportProps {
  onBack: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const Transport: React.FC<TransportProps> = ({ onBack, onShowToast }) => {
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
  const [timeAgo, setTimeAgo] = useState<string>("Just now");
  
  // Favorites State
  const [favStopsData, setFavStopsData] = useState<StopWithArrivals[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  
  // Train State
  const [mrtData, setMrtData] = useState<MRTLine[]>([]);
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [trainAlerts, setTrainAlerts] = useState<TrainServiceAlert[]>([]);
  
  // Train Station Details Cache
  const [stationDetails, setStationDetails] = useState<Record<string, { crowd: StationCrowdData | null, lift: StationAccessibility | null }>>({});
  const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({});

  // Manual Lookup State
  const [busStopId, setBusStopId] = useState(transportService.getDefaultStop());
  const [manualArrivals, setManualArrivals] = useState<BusServiceData[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [manualStopName, setManualStopName] = useState<string | null>(null);

  // Expansion State (Bus)
  const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});

  // --- Time Ago Timer ---
  useEffect(() => {
      const interval = setInterval(() => {
          if (!lastUpdated) {
              setTimeAgo("");
              return;
          }
          const diff = Math.floor((Date.now() - lastUpdated) / 60000);
          if (diff < 1) setTimeAgo("Just now");
          else if (diff === 1) setTimeAgo("1 min ago");
          else setTimeAgo(`${diff} mins ago`);
      }, 10000);
      return () => clearInterval(interval);
  }, [lastUpdated]);

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
      if (viewMode === 'FAVORITES') fetchFavoritesData();
  };

  const handleRename = (stopId: string, newName: string) => {
      transportService.renameFavorite(stopId, newName);
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

    transportService.getBusStopInfo(stopId).then(info => {
        if (info) setManualStopName(info.name);
        else setManualStopName(null);
    });

    try {
      const data = await transportService.getArrivals(stopId);
      if (!data.services || data.services.length === 0) {
          setManualError(`No services found for stop ${stopId}.`);
      } else {
          setManualArrivals(data.services);
          transportService.setDefaultStop(stopId);
          setLastUpdated(Date.now());
          setTimeAgo("Just now");
      }
    } catch (err) {
      setManualError("Unable to fetch live data. Check connection/ID.");
      onShowToast("Network error. Verify internet connection.", "error");
    } finally {
      setManualLoading(false);
    }
  };

  const fetchNearbyData = useCallback(async (lat: number, lng: number) => {
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
        setTimeAgo("Just now");
    } catch (e: any) {
        mockService.emitLog("TRANSPORT", "ERROR", "Failed to get nearby data");
        onShowToast("Unable to retrieve nearby stops.", "error");
        setNearbyStopsData([]); 
    } finally {
        setNearbyLoading(false);
    }
  }, [onShowToast]);

  const fetchTrainAlerts = async () => {
      try {
          const alerts = await transportService.getTrainServiceAlerts();
          setTrainAlerts(alerts);
      } catch (e) {
          // handled in service
      }
  };

  const refreshLocation = async (force: boolean = false) => {
    setIsLocating(true);
    if (!locationName) setLocationName("Locating...");

    try {
        const loc = force ? await locationService.refreshLocation() : await locationService.getLocation();
        
        setLocation({ lat: loc.lat, lng: loc.lng });
        
        if (loc.isDefault && force) {
             onShowToast("GPS Signal weak. Using default location.", "info");
        }

        // Fetch Data
        fetchNearbyData(loc.lat, loc.lng);
        
        // Reverse Geocode
        try {
            const address = await transportService.getAddress(loc.lat, loc.lng);
            setLocationName(address);
        } catch {
            setLocationName(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
        }

    } catch (e) {
        setLocationName("Location Error");
        onShowToast("Location Service Unavailable", "error");
    } finally {
        setIsLocating(false);
    }
  };

  const fetchFavoritesData = useCallback(async () => {
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
          setLastUpdated(Date.now());
          setTimeAgo("Just now");
      } catch (e) {
          onShowToast("Failed to load favorite stops.", "error");
      } finally {
          setFavLoading(false);
      }
  }, [location, onShowToast]);

  // Trigger Manual Refresh based on current view
  const handleManualRefresh = () => {
      if (viewMode === 'NEARBY' && location) {
          fetchNearbyData(location.lat, location.lng);
      } else if (viewMode === 'FAVORITES') {
          fetchFavoritesData();
      } else if (busStopId) {
          fetchManualBusData(busStopId);
      }
  };

  // Init Logic
  useEffect(() => {
    refreshLocation();
    setMrtData(transportService.getMRTNetwork());
    
    // Preload details
    const allStations: string[] = [];
    transportService.getMRTNetwork().forEach(l => l.stations.forEach(s => allStations.push(s.code)));
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
  }, [viewMode, location, fetchFavoritesData]);

  const handleSendToHud = (bus: BusServiceData) => {
    const message = transportService.formatHudMessage(bus);
    mockService.sendCommand("CLEAR_SCREEN");
    mockService.emitLog("TX", "INFO", `[09] HUD_DRAW_TEXT: "${message.replace(/\n/g, '|')}"`);
    mockService.emitLog("TTS", "INFO", `Speaking: "${transportService.formatTtsMessage(bus)}"`);
    onShowToast(`Sent Bus ${bus.serviceNo} to Glasses`, 'success');
  };

  const handleSendStationToHud = (line: MRTLine, station: MRTStation) => {
      const details = stationDetails[station.code];
      const message = `${line.code} | ${station.name}\nCrowd: ${details?.crowd?.current || 'N/A'}`;
      mockService.sendCommand("CLEAR_SCREEN");
      mockService.emitLog("TX", "INFO", `[09] HUD_DRAW_TEXT: "${message.replace(/\n/g, '|')}"`);
      mockService.emitLog("TTS", "INFO", `Speaking: "Station ${station.name} is currently at ${details?.crowd?.current || 'unknown'} crowd level."`);
      onShowToast(`Sent ${station.name} Info to Glasses`, 'success');
  };

  const handleOpenMaps = () => {
      if (location) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`, '_blank');
      }
  };

  const TimingBadge: React.FC<{ arrival: ArrivalInfo | null, label?: string }> = ({ arrival, label }) => {
      if (!arrival) return (
          <div className="flex flex-col items-center w-12 opacity-30">
              <span className="text-[10px] text-moncchichi-textSec font-bold uppercase">{label}</span>
              <span className="text-lg font-bold text-moncchichi-textSec">--</span>
          </div>
      );

      const loadColors = {
          'SEA': 'border-moncchichi-success text-moncchichi-success',
          'SDA': 'border-moncchichi-warning text-moncchichi-warning',
          'LSD': 'border-moncchichi-error text-moncchichi-error',
      }[arrival.load] || 'border-moncchichi-textSec text-moncchichi-textSec';

      return (
          <div className="flex flex-col items-center w-12">
              <span className="text-[9px] text-moncchichi-textSec font-bold uppercase mb-0.5">{label}</span>
              <div className={`w-full h-8 flex items-center justify-center rounded border-b-2 bg-moncchichi-surfaceAlt ${loadColors}`}>
                  <span className="text-sm font-bold text-moncchichi-text">
                      {arrival.mins <= 0 ? 'Arr' : arrival.mins}
                  </span>
              </div>
              <span className="text-[8px] text-moncchichi-textSec mt-0.5 scale-90">{arrival.type === 'DD' ? 'Double' : 'Single'}</span>
          </div>
      );
  };

  const ArrivalItem: React.FC<{ bus: BusServiceData; stopName?: string; showInsights?: boolean }> = ({ bus, stopName, showInsights }) => {
      const [aiInsight, setAiInsight] = useState<string | null>(bus.insight || null);
      const [isAiLoading, setIsAiLoading] = useState(false);
      
      const interval = transportService.getBusInterval(bus);

      useEffect(() => {
          if (showInsights && !aiInsight && !isAiLoading && stopName) {
              setIsAiLoading(true);
              transportService.generateCrowdInsight(bus, stopName).then(text => {
                  setAiInsight(text);
                  setIsAiLoading(false);
              });
          }
      }, [showInsights, aiInsight, stopName]);

      return (
        <div className="p-3 flex flex-col gap-2 hover:bg-moncchichi-surfaceAlt/30 transition-colors border-b border-moncchichi-border last:border-0 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                
                {/* Service Info */}
                <div className="flex items-center gap-3 mr-2">
                    <div className="w-12 h-12 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg flex flex-col items-center justify-center shrink-0 shadow-sm">
                        <span className="font-bold text-moncchichi-text text-base leading-none">{bus.serviceNo}</span>
                        <span className="text-[9px] text-moncchichi-textSec mt-0.5 scale-90 uppercase">{bus.operator}</span>
                    </div>
                </div>

                {/* Timings Grid */}
                <div className="flex-1 grid grid-cols-3 gap-2 justify-items-center">
                    <TimingBadge arrival={bus.next} label="Next" />
                    <TimingBadge arrival={bus.subsequent} label="2nd" />
                    <TimingBadge arrival={bus.subsequent2} label="3rd" />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 items-end ml-2">
                    <button 
                        onClick={() => handleSendToHud(bus)}
                        className="p-2 text-moncchichi-textSec hover:text-moncchichi-accent active:scale-95 transition-transform rounded-full hover:bg-moncchichi-surfaceAlt"
                        title="Send to Glasses"
                    >
                        {ICONS.Glasses}
                    </button>
                    {interval && (
                        <span className="text-[9px] font-mono text-moncchichi-textSec bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded-full border border-moncchichi-border/50">
                            ~{interval}
                        </span>
                    )}
                </div>
            </div>
            
            {/* AI Crowd Insight (Favorites Only) */}
            {showInsights && (
                <div className="mt-1 flex items-start gap-2 bg-gradient-to-r from-moncchichi-accent/10 to-transparent border-l-2 border-moncchichi-accent rounded-r p-2">
                    <Sparkles size={12} className="text-moncchichi-accent shrink-0 mt-0.5" />
                    {isAiLoading ? (
                        <div className="flex items-center gap-2">
                             <Loader2 size={10} className="text-moncchichi-accent animate-spin" />
                             <span className="text-[10px] text-moncchichi-textSec italic">Analyzing crowd levels...</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-moncchichi-text leading-relaxed font-medium">
                            {aiInsight || "Prediction unavailable."}
                        </span>
                    )}
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
                                stopName={stop.name}
                                showInsights={viewMode === 'FAVORITES'} 
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
  };

  const manualFav = transportService.getFavorite(busStopId);
  const manualDisplayName = manualFav ? manualFav.name : (manualStopName || `Stop ${busStopId}`);

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg transition-colors duration-500">
      {/* Header */}
      <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-30 shadow-sm">
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
                {viewMode === 'NEARBY' && (
                    <div className="bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-moncchichi-accent">{ICONS.MapPin}</div>
                        <div className="flex justify-between items-start">
                            <div className="flex-1 pr-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider">Location</h3>
                                    <button onClick={() => refreshLocation(true)} disabled={isLocating} className="p-1 -my-1 text-moncchichi-textSec hover:text-moncchichi-text transition-colors rounded-full disabled:opacity-50">
                                        <RotateCcw size={12} className={isLocating ? "animate-spin" : ""} />
                                    </button>
                                </div>
                                {locationName ? (
                                    <div className="font-semibold text-sm text-moncchichi-text leading-tight">{locationName}</div>
                                ) : (
                                    <div className="text-sm text-moncchichi-textSec italic">{isLocating ? "Locating..." : "Location unavailable"}</div>
                                )}
                            </div>
                            <button onClick={handleOpenMaps} disabled={!location} className="flex items-center gap-2 px-3 py-2 bg-moncchichi-surfaceAlt hover:bg-moncchichi-border rounded-lg border border-moncchichi-border text-xs font-bold transition-colors text-blue-400 shrink-0">
                                {ICONS.Map} <span>Map</span>
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === 'NEARBY' ? (
                    <>
                        {isLocating && nearbyStopsData.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-8 opacity-70">
                                 <div className="w-6 h-6 border-2 border-moncchichi-accent border-t-transparent rounded-full animate-spin mb-2" />
                                 <span className="text-xs text-moncchichi-accent font-bold">Scanning...</span>
                             </div>
                        ) : (
                             nearbyStopsData.length > 0 && (
                                <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center px-1">
                                        <h3 className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider">Nearby Stops</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-moncchichi-textSec font-medium opacity-80">
                                                Updated {timeAgo}
                                            </span>
                                            <button 
                                                onClick={handleManualRefresh} 
                                                disabled={nearbyLoading}
                                                className="p-1.5 bg-moncchichi-surfaceAlt rounded-full border border-moncchichi-border text-moncchichi-textSec hover:text-moncchichi-text active:scale-90 transition-all"
                                            >
                                                <RefreshCw size={10} className={nearbyLoading ? "animate-spin" : ""} />
                                            </button>
                                        </div>
                                    </div>
                                    {nearbyStopsData.map((stop) => <BusStopCard key={stop.id} stop={stop} />)}
                                </div>
                            )
                        )}
                        {!isLocating && nearbyStopsData.length === 0 && (
                             <div className="flex flex-col items-center justify-center py-8 text-moncchichi-textSec opacity-50 gap-2">
                                <BusFront size={24} />
                                <span className="text-xs">No stops nearby.</span>
                             </div>
                        )}
                    </>
                ) : (
                    <>
                        {favStopsData.length > 0 ? (
                            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-xs font-medium text-moncchichi-textSec uppercase tracking-wider">Pinned Stops</h3>
                                        {location && <span className="text-[9px] text-moncchichi-success bg-moncchichi-success/10 px-1.5 rounded border border-moncchichi-success/20">Sorted by distance</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-moncchichi-textSec font-medium opacity-80">
                                            Updated {timeAgo}
                                        </span>
                                        <button 
                                            onClick={handleManualRefresh} 
                                            disabled={favLoading}
                                            className="p-1.5 bg-moncchichi-surfaceAlt rounded-full border border-moncchichi-border text-moncchichi-textSec hover:text-moncchichi-text active:scale-90 transition-all"
                                        >
                                            <RefreshCw size={10} className={favLoading ? "animate-spin" : ""} />
                                        </button>
                                    </div>
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
                                {manualArrivals.map((bus, idx) => (
                                    <ArrivalItem key={`manual-${bus.serviceNo}-${idx}`} bus={bus} showInsights={false} />
                                ))}
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
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {trainAlerts.length > 0 ? (
                  <div className="bg-moncchichi-error/10 border border-moncchichi-error/30 rounded-xl p-4 animate-in slide-in-from-top-2">
                      <h3 className="text-sm font-bold text-moncchichi-error flex items-center gap-2 mb-2">
                          <AlertTriangle size={16} /> Service Disruptions
                      </h3>
                      <div className="space-y-2">
                          {trainAlerts.map((alert, idx) => (
                              <div key={idx} className="text-xs text-moncchichi-text leading-relaxed">
                                  <span className="font-bold">{alert.Line} ({alert.Direction}):</span> {alert.Message}
                              </div>
                          ))}
                      </div>
                  </div>
              ) : (
                  <div className="bg-moncchichi-success/5 border border-moncchichi-success/20 rounded-xl p-3 flex items-center gap-3">
                      <div className="p-1.5 bg-moncchichi-success/10 rounded-full text-moncchichi-success"><Check size={14} /></div>
                      <span className="text-xs text-moncchichi-text opacity-90">All train services are running normally.</span>
                  </div>
              )}

              <div className="space-y-3">
                  {mrtData.map(line => (
                      <div key={line.code} className="bg-moncchichi-surface border border-moncchichi-border rounded-xl overflow-hidden">
                          <div 
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-moncchichi-surfaceAlt/50 transition-colors"
                              onClick={() => toggleLineExpand(line.code)}
                          >
                               <div className="flex items-center gap-3">
                                   <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: line.color }} />
                                   <div>
                                       <div className="font-bold text-sm">{line.name}</div>
                                       <div className="text-[10px] text-moncchichi-textSec">{line.stations.length} Stations</div>
                                   </div>
                               </div>
                               <div className="text-moncchichi-textSec">
                                   {expandedLines[line.code] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                               </div>
                          </div>
                          
                          {expandedLines[line.code] && (
                              <div className="border-t border-moncchichi-border bg-moncchichi-surfaceAlt/10">
                                  {line.stations.map((station, idx) => {
                                      const details = stationDetails[station.code];
                                      const isStationExpanded = !!expandedStations[station.code];
                                      
                                      return (
                                          <div key={station.code} className="border-b border-moncchichi-border/50 last:border-0">
                                              <div 
                                                  className="p-3 pl-6 flex items-center justify-between cursor-pointer hover:bg-moncchichi-surfaceAlt/30"
                                                  onClick={() => toggleStationExpand(station.code)}
                                              >
                                                  <div className="flex items-center gap-3">
                                                      <span className="font-mono text-[10px] text-moncchichi-textSec w-8">{station.code}</span>
                                                      <span className="text-sm font-medium">{station.name}</span>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-2">
                                                       {details?.crowd?.current && (
                                                           <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                               details.crowd.current === 'HIGH' ? 'bg-moncchichi-error text-moncchichi-bg' : 
                                                               (details.crowd.current === 'MODERATE' ? 'bg-moncchichi-warning text-moncchichi-bg' : 'bg-moncchichi-success text-moncchichi-bg')
                                                           }`}>
                                                               {details.crowd.current}
                                                           </span>
                                                       )}
                                                       <button 
                                                           onClick={(e) => { e.stopPropagation(); handleSendStationToHud(line, station); }}
                                                           className="p-1.5 text-moncchichi-textSec hover:text-moncchichi-accent transition-colors"
                                                       >
                                                           {ICONS.Glasses}
                                                       </button>
                                                  </div>
                                              </div>
                                              {isStationExpanded && (
                                                  <div className="px-6 pb-3 pt-0 text-xs text-moncchichi-textSec space-y-1">
                                                       <div className="flex items-center gap-2">
                                                           <Users size={12} /> Crowd Level: {details?.crowd?.current || 'N/A'}
                                                       </div>
                                                       <div className="flex items-center gap-2">
                                                           <Accessibility size={12} /> Lift Status: {details?.lift?.liftMaintenance ? 'Maintenance' : 'Operational'}
                                                       </div>
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
           </div>
      )}
    </div>
  );
};

export default Transport;
