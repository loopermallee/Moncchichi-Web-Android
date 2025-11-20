
import React, { useState, useEffect } from 'react';
import { realtimeWeatherService, UnifiedWeatherReport, Forecast4Day } from '../services/realtimeWeatherService';
import { ICONS } from '../constants';
import { RotateCcw, Info, ChevronDown, ChevronUp, MapPin, AlertTriangle, Wind, Droplets, Sun, Umbrella, CloudLightning, Thermometer, Activity, Sparkles, CalendarDays, X } from 'lucide-react';
import { mockService } from '../services/mockService';

const WeatherRealtime: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [weather, setWeather] = useState<UnifiedWeatherReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationName, setLocationName] = useState("Locating...");
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Hazard Alert State
    const [hazardsVisible, setHazardsVisible] = useState(true);

    useEffect(() => {
        fetchWeather();
    }, []);

    const fetchWeather = async () => {
        setIsRefreshing(true);
        setHazardsVisible(true); // Reset alert visibility on refresh
        
        if (!weather) setLoading(true); // Only full load on first render
        
        const handleSuccess = (data: UnifiedWeatherReport) => {
            setWeather(data);
            setLocationName(data.location);
            setLoading(false);
            setIsRefreshing(false);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const data = await realtimeWeatherService.getUnifiedWeather(latitude, longitude);
                    handleSuccess(data);
                },
                async (err) => {
                    mockService.emitLog("GPS", "WARN", "GPS denied/timeout, using default");
                    const data = await realtimeWeatherService.getUnifiedWeather(); // Default SG
                    handleSuccess(data);
                },
                { timeout: 5000, maximumAge: 0, enableHighAccuracy: true }
            );
        } else {
            const data = await realtimeWeatherService.getUnifiedWeather();
            handleSuccess(data);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- Helper Components ---

    const HazardAlerts: React.FC<{ alerts: { type: string; message: string }[] }> = ({ alerts }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        
        if (!hazardsVisible || alerts.length === 0) return null;

        return (
            <div className="mx-4 mt-4 rounded-xl border border-moncchichi-warning/30 bg-moncchichi-warning/10 overflow-hidden shadow-sm animate-in slide-in-from-top-2">
                {/* Header / Summary */}
                <div 
                    className="p-3 flex items-center justify-between cursor-pointer active:bg-moncchichi-warning/20 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-moncchichi-warning shrink-0" size={20} />
                        <div>
                            <h4 className="text-sm font-bold text-moncchichi-warning uppercase tracking-wide">
                                {alerts.length} Hazard{alerts.length > 1 ? 's' : ''} Detected
                            </h4>
                            {!isExpanded && (
                                <p className="text-xs text-moncchichi-text opacity-80 truncate max-w-[200px]">
                                    {alerts[0].message} {alerts.length > 1 ? `and ${alerts.length - 1} more` : ''}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-moncchichi-warning opacity-70">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        <div className="w-px h-6 bg-moncchichi-warning/30 mx-1"></div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setHazardsVisible(false); }}
                            className="p-1.5 hover:bg-moncchichi-warning/20 rounded-full text-moncchichi-warning transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Expanded List */}
                {isExpanded && (
                    <div className="px-3 pb-3 pt-0 space-y-2">
                        <div className="h-px bg-moncchichi-warning/20 mb-2"></div>
                        {alerts.map((alert, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded bg-moncchichi-bg/40">
                                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${alert.type === 'FLOOD' ? 'bg-moncchichi-error' : 'bg-moncchichi-warning'}`}></div>
                                <span className="text-moncchichi-text leading-relaxed">{alert.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const MetricCard: React.FC<{ 
        id: string;
        title: string;
        value: string | number;
        unitLabel: string;
        status?: string;
        description: string;
        icon: React.ReactNode;
        colorClass: string;
        detailContent?: React.ReactNode;
    }> = ({ 
        id, title, value, unitLabel, status, description, icon, colorClass, detailContent 
    }) => {
        const expanded = expandedCards[id];
        return (
            <div className={`bg-moncchichi-surface rounded-xl border border-moncchichi-border overflow-hidden transition-all duration-300 ${expanded ? 'shadow-md border-moncchichi-textSec/50' : ''}`}>
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(id)}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                            {React.cloneElement(icon as React.ReactElement, { className: colorClass.replace('bg-', 'text-') })}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider">{title}</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-moncchichi-text">{value}</span>
                                <span className="text-xs text-moncchichi-textSec">{unitLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        {status && <div className={`text-xs font-bold px-2 py-1 rounded-full bg-moncchichi-bg border border-moncchichi-border ${colorClass.replace('bg-', 'text-')}`}>{status}</div>}
                        <div className="mt-1 text-moncchichi-textSec opacity-50">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                    </div>
                </div>
                
                {expanded && (
                    <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2">
                        <div className="h-px bg-moncchichi-border mb-3 opacity-50" />
                        <p className="text-xs text-moncchichi-textSec leading-relaxed mb-3">{description}</p>
                        {detailContent}
                    </div>
                )}
            </div>
        );
    };

    const InsightCard: React.FC<{ text: string }> = ({ text }) => (
        <div className="mx-4 mt-4 p-4 bg-gradient-to-br from-moncchichi-surfaceAlt to-moncchichi-bg border border-moncchichi-accent/20 rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-moncchichi-accent"><Sparkles size={48} /></div>
            <div className="flex gap-3">
                <div className="p-2 bg-moncchichi-accent/10 rounded-full h-min">
                    <Sparkles size={18} className="text-moncchichi-accent" />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-moncchichi-accent uppercase tracking-wider mb-1">Today's Insight</h3>
                    <p className="text-sm text-moncchichi-text leading-relaxed font-medium">
                        {text}
                    </p>
                </div>
            </div>
        </div>
    );

    // Safe Date Formatter
    const formatDay = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) throw new Error("Invalid");
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        } catch {
            return "Day";
        }
    };

    const formatDateNum = (dateStr: string) => {
        try {
             const d = new Date(dateStr);
             if (isNaN(d.getTime())) throw new Error("Invalid");
             return d.getDate();
        } catch {
            return "--";
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-moncchichi-bg items-center justify-center space-y-4">
                <div className="w-8 h-8 border-4 border-moncchichi-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-moncchichi-accent animate-pulse">Locating & Analyzing...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
            {/* Header */}
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {ICONS.Back}
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-moncchichi-text tracking-tight">Weather Live</h2>
                    <div className="flex items-center gap-1 text-xs text-moncchichi-textSec">
                        <MapPin size={12} className="text-moncchichi-accent" />
                        <span className="font-medium text-moncchichi-text">{locationName}</span>
                    </div>
                </div>
                <button 
                    onClick={fetchWeather} 
                    disabled={isRefreshing}
                    className="p-2 bg-moncchichi-surfaceAlt hover:bg-moncchichi-border text-moncchichi-text rounded-full border border-moncchichi-border transition-all active:scale-95"
                >
                    <RotateCcw size={18} className={isRefreshing ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Content Scroll */}
            <div className="flex-1 overflow-y-auto pb-10">
                
                {/* Daily Insight Summary */}
                {weather?.dailyInsight && <InsightCard text={weather.dailyInsight} />}

                {/* Collapsible Hazards Alert */}
                {weather?.alerts && <HazardAlerts alerts={weather.alerts} />}

                {/* Main Grid */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* PM2.5 Card */}
                    <MetricCard 
                        id="pm25"
                        title="PM2.5"
                        value={weather?.pm25 || 0}
                        unitLabel="µg/m³"
                        status={(weather?.pm25 || 0) <= 55 ? "Normal" : "Elevated"}
                        description="PM2.5 refers to fine particulate matter. Values 0-55 are Normal. 56-150 is Elevated."
                        icon={<Wind />}
                        colorClass="bg-emerald-500"
                        detailContent={
                            <div className="text-[10px] text-moncchichi-textSec p-2 bg-moncchichi-bg rounded border border-moncchichi-border">
                                <span className="font-bold text-moncchichi-text">Health Tip:</span> {(weather?.pm25 || 0) > 55 ? "Reduce prolonged outdoor exertion." : "Air quality is good for outdoor activities."}
                            </div>
                        }
                    />

                    {/* PSI Card */}
                    <MetricCard 
                        id="psi"
                        title="PSI"
                        value={weather?.psi || 0}
                        unitLabel="Index"
                        status={(weather?.psi || 0) <= 50 ? "Good" : "Moderate"}
                        description="Pollutant Standards Index. Measures overall air quality based on 6 pollutants."
                        icon={<Activity />} // Using Activity as proxy for PSI
                        colorClass={(weather?.psi || 0) <= 50 ? "bg-emerald-500" : "bg-yellow-500"}
                    />

                    {/* UV Index Card */}
                    <MetricCard 
                        id="uv"
                        title="UV Index"
                        value={weather?.uv || 0}
                        unitLabel="Index"
                        status={(weather?.uv || 0) >= 8 ? "Very High" : ((weather?.uv || 0) >= 6 ? "High" : "Moderate")}
                        description="Measure of skin-damaging ultraviolet radiation. High values require sun protection."
                        icon={<Sun />}
                        colorClass="bg-orange-500"
                        detailContent={
                            (weather?.uv || 0) >= 6 && (
                                <div className="flex items-center gap-2 text-xs text-orange-400 font-bold">
                                    <Umbrella size={14} /> Recommend: Sunscreen & Hat
                                </div>
                            )
                        }
                    />

                    {/* Wind Speed Card */}
                    <MetricCard 
                        id="wind"
                        title="Wind Speed"
                        value={weather?.windSpeed || 0}
                        unitLabel="knots"
                        status="Variable"
                        description="Average wind speed recorded at nearby stations."
                        icon={<Wind />}
                        colorClass="bg-blue-400"
                    />
                </div>

                {/* 2-Hour Forecast Strip */}
                <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-moncchichi-surface to-moncchichi-surfaceAlt rounded-xl border border-moncchichi-border flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-moncchichi-textSec uppercase mb-1">2-Hour Forecast</div>
                        <div className="text-xl font-bold flex items-center gap-2">
                            {weather?.forecast2hr.includes("Rain") ? <CloudLightning className="text-moncchichi-accent" /> : <Sun className="text-moncchichi-warning" />}
                            {weather?.forecast2hr}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-moncchichi-textSec">
                            <Droplets size={12} /> Humidity
                        </div>
                        <div className="font-mono font-bold">{weather?.humidity}%</div>
                    </div>
                </div>

                {/* 4-Day Forecast List */}
                <div className="mx-4">
                    <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Thermometer size={14} /> 4-Day Outlook
                    </h3>
                    <div className="space-y-2">
                        {weather?.forecast4day.map((day, i) => (
                            <div key={i} className="bg-moncchichi-surface p-3 rounded-xl border border-moncchichi-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 text-center">
                                        <div className="text-[10px] font-bold text-moncchichi-textSec uppercase">{formatDay(day.date)}</div>
                                        <div className="text-xs font-bold">{formatDateNum(day.date)}</div>
                                    </div>
                                    <div className="h-8 w-px bg-moncchichi-border" />
                                    <div className="text-sm font-medium w-24 truncate">{day.forecast}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-[10px] text-moncchichi-textSec">Low</div>
                                        <div className="text-xs font-bold">{day.temperature.low}°</div>
                                    </div>
                                    <div className="w-12 h-1 bg-moncchichi-surfaceAlt rounded-full overflow-hidden flex">
                                        {/* Visual Temperature Bar Mockup */}
                                        <div className="h-full bg-transparent w-[20%]" />
                                        <div className="h-full bg-gradient-to-r from-blue-400 to-orange-400 flex-1 rounded-full opacity-70" />
                                        <div className="h-full bg-transparent w-[20%]" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] text-moncchichi-textSec">High</div>
                                        <div className="text-xs font-bold">{day.temperature.high}°</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherRealtime;
