
import React, { useState, useEffect, useRef } from 'react';
import { realtimeWeatherService, UnifiedWeatherReport, NewsSource } from '../services/realtimeWeatherService';
import { locationService } from '../services/locationService';
import { ICONS } from '../constants';
import { RotateCcw, ChevronDown, ChevronUp, MapPin, AlertTriangle, Wind, Droplets, Sun, CloudLightning, Thermometer, Activity, Sparkles, X, CloudRain, Cloud, Clock, Zap, Flame, Waves, CalendarDays, ExternalLink, Newspaper, Loader2, Info, Lightbulb } from 'lucide-react';
import { mockService } from '../services/mockService';

const WeatherRealtime: React.FC<{ onBack: () => void, onShowToast: (msg: string, type: any) => void }> = ({ onBack, onShowToast }) => {
    const [weather, setWeather] = useState<UnifiedWeatherReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [isInsightLoading, setIsInsightLoading] = useState(false); // New state for async AI
    const [locationName, setLocationName] = useState("Locating...");
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [hazardsVisible, setHazardsVisible] = useState(true);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        fetchWeather();
        return () => { isMounted.current = false; };
    }, []);

    const fetchWeather = async () => {
        setIsRefreshing(true);
        setHazardsVisible(true); 
        if (!weather) setLoading(true); 
        
        try {
            // 1. Get Location
            const loc = await locationService.getLocation();
            
            if (loc.isDefault) {
                onShowToast("GPS Signal weak. Using default location.", "info");
            }
            
            // 2. Fetch Basic Data (Fast)
            const data = await realtimeWeatherService.getUnifiedWeather(loc.lat, loc.lng);
            
            if (isMounted.current) {
                setWeather(data);
                setLocationName(data.location);
                setLoading(false); // Stop main spinner
                setIsRefreshing(false);
                setIsInsightLoading(true); // Start AI spinner in card
                
                if (!data.forecast4day || data.forecast4day.length === 0) {
                    onShowToast("Live forecast data unavailable.", "info");
                }
            }

            // 3. Generate AI Insights (Slow, Background)
            const insights = await realtimeWeatherService.generateWeatherInsights(data);
            
            if (isMounted.current) {
                setWeather(prev => prev ? { ...prev, ...insights } : null);
                setIsInsightLoading(false);
            }

        } catch (e) {
             if (isMounted.current) {
                 setLoading(false);
                 setIsRefreshing(false);
                 setIsInsightLoading(false);
                 onShowToast("Weather service failed.", "error");
             }
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleDayExpand = (index: number) => {
        setExpandedDays(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const getUvStatus = (uv: number) => {
        if (uv >= 11) return { label: "Extreme", color: "bg-purple-500", text: "bg-purple-500", insight: "Avoid sun exposure. Skin damage occurs in minutes." };
        if (uv >= 8) return { label: "Very High", color: "bg-red-500", text: "text-red-500", insight: "Extra protection required. Avoid mid-day sun." };
        if (uv >= 6) return { label: "High", color: "bg-orange-500", text: "text-orange-500", insight: "Protection required. Reduce time in direct sun." };
        if (uv >= 3) return { label: "Moderate", color: "bg-yellow-500", text: "text-yellow-500", insight: "Seek shade during midday hours." };
        return { label: "Low", color: "bg-green-500", text: "text-green-500", insight: "Safe for outdoor activities." };
    };

    const getWbgtStatus = (wbgt: number) => {
        if (wbgt >= 33) return { label: "High Risk", color: "bg-red-500", text: "text-red-500", insight: "High risk of heat stroke. Minimize outdoor exertion." };
        if (wbgt >= 31) return { label: "Moderate", color: "bg-orange-500", text: "text-orange-500", insight: "Drink water frequently. Take breaks in shade." };
        return { label: "Low Risk", color: "bg-green-500", text: "text-green-500", insight: "Thermal comfort is acceptable." };
    };

    const getPsiStatus = (psi: number) => {
        if (psi > 100) return { label: "Unhealthy", color: "bg-red-500", text: "text-red-500", insight: "Reduce prolonged outdoor exertion." };
        if (psi > 50) return { label: "Moderate", color: "bg-yellow-500", text: "text-yellow-500", insight: "Air quality is acceptable." };
        return { label: "Good", color: "bg-green-500", text: "text-green-500", insight: "Air quality is healthy." };
    };
    
    const getRainStatus = (mm: number) => {
        if (mm > 10) return { label: "Heavy", color: "bg-blue-600", text: "text-blue-600", insight: "Visibility reduced. Risk of ponding." };
        if (mm > 0.5) return { label: "Raining", color: "bg-blue-400", text: "text-blue-400", insight: "Carry an umbrella. Roads may be wet." };
        return { label: "Dry", color: "bg-gray-400", text: "text-moncchichi-textSec", insight: "No recent rainfall detected." };
    };

    const getHumidStatus = (val: number) => {
        if (val > 90) return { label: "Very High", color: "bg-blue-500", text: "text-blue-500", insight: "Sweat evaporation is inhibited. Feels warmer." };
        if (val > 60) return { label: "Normal", color: "bg-green-500", text: "text-green-500", insight: "Typical tropical humidity levels." };
        return { label: "Dry", color: "bg-yellow-500", text: "text-yellow-500", insight: "Unusually dry air." };
    };

    const getWeatherIcon = (forecast: string) => {
        const text = forecast.toLowerCase();
        if (text.includes('thunder') || text.includes('lightning')) return <CloudLightning size={24} className="text-moncchichi-warning" />;
        if (text.includes('shower') || text.includes('rain')) return <CloudRain size={24} className="text-blue-400" />;
        if (text.includes('cloud') || text.includes('haze')) return <Cloud size={24} className="text-gray-400" />;
        return <Sun size={24} className="text-orange-400" />;
    };

    const formatForecastText = (text: string) => {
        const timeRegex = /((?:late|early|mid|mid-|mainly in the |in the )?\s*(?:morning|afternoon|evening|night|day|noon))/gi;
        const parts = text.split(timeRegex);
        
        return (
            <div className="leading-relaxed">
                {parts.map((part, i) => {
                    if (part.match(timeRegex)) {
                        const label = part.replace(/^(mainly in the|in the|mainly)\s+/i, '').trim();
                        return (
                            <span key={i} className="inline-flex items-center gap-1.5 bg-moncchichi-accent/10 text-moncchichi-accent px-2 py-0.5 rounded border border-moncchichi-accent/20 text-xs font-bold mx-1 align-baseline translate-y-[-1px]">
                                <Clock size={10} />
                                <span className="uppercase tracking-wider">{label}</span>
                            </span>
                        );
                    }
                    if (!part.trim()) return null;
                    return <span key={i} className="text-moncchichi-text">{part}</span>;
                })}
            </div>
        );
    };

    const HazardAlerts: React.FC<{ alerts: { type: string; message: string }[] }> = ({ alerts }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        if (!hazardsVisible || alerts.length === 0) return null;
        
        const getIcon = (type: string) => {
             switch(type) {
                case 'FLOOD': return <Waves size={20} className="text-moncchichi-error" />;
                case 'LIGHTNING': return <Zap size={20} className="text-moncchichi-warning" />;
                case 'HEAT': return <Flame size={20} className="text-orange-500" />;
                case 'RAIN': return <CloudRain size={20} className="text-blue-400" />;
                default: return <AlertTriangle className="text-moncchichi-warning" size={20} />;
            }
        };

        return (
            <div className="mx-4 mt-4 rounded-xl border border-moncchichi-warning/30 bg-moncchichi-warning/10 overflow-hidden shadow-sm animate-in slide-in-from-top-2">
                <div 
                    className="p-3 flex items-center justify-between cursor-pointer active:bg-moncchichi-warning/20 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        {getIcon(alerts[0].type)}
                        <div>
                            <h4 className="text-sm font-bold text-moncchichi-warning uppercase tracking-wide">
                                {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
                            </h4>
                            {!isExpanded && (
                                <p className="text-xs text-moncchichi-text opacity-80 truncate max-w-[200px]">
                                    {alerts[0].message}
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
                {isExpanded && (
                    <div className="px-3 pb-3 pt-0 space-y-2">
                        <div className="h-px bg-moncchichi-warning/20 mb-2"></div>
                        {alerts.map((alert, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-xs p-2 rounded bg-moncchichi-bg/40">
                                <div className="mt-0.5 shrink-0 scale-75">{getIcon(alert.type)}</div>
                                <span className="text-moncchichi-text leading-relaxed font-medium">{alert.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const MetricCard: React.FC<any> = ({ id, title, value, unitLabel, statusLabel, statusColor, insight, description, icon, colorClass, detailContent }) => {
        const expanded = expandedCards[id];
        return (
            <div className={`bg-moncchichi-surface rounded-xl border border-moncchichi-border overflow-hidden transition-all duration-300 ${expanded ? 'shadow-md ring-1 ring-moncchichi-accent/30' : ''}`}>
                <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(id)}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                            {React.cloneElement(icon as React.ReactElement, { className: colorClass.replace('bg-', 'text-'), size: 18 })}
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-moncchichi-textSec uppercase tracking-wider">{title}</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-moncchichi-text">{value}</span>
                                {unitLabel && <span className="text-[10px] text-moncchichi-textSec">{unitLabel}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block bg-opacity-10 ${statusColor} bg-${statusColor.split('-')[1]}-500/10`}>
                            {statusLabel}
                        </div>
                    </div>
                </div>
                {expanded && (
                    <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2">
                        <div className="h-px bg-moncchichi-border mb-2 opacity-50" />
                        <div className="flex gap-2 mb-2 p-2 rounded bg-moncchichi-surfaceAlt/50 border border-moncchichi-border/30">
                            <Sparkles size={12} className="text-moncchichi-accent shrink-0 mt-0.5" />
                            <p className="text-[10px] text-moncchichi-text leading-relaxed font-medium">{insight}</p>
                        </div>
                        <p className="text-[10px] text-moncchichi-textSec leading-relaxed mb-2 opacity-80">{description}</p>
                        {detailContent}
                    </div>
                )}
            </div>
        );
    };

    const InsightCard: React.FC<{ 
        dailyInsight: string, 
        holisticSummary: string,
        newsSummary: string,
        monthly: string, 
        sources: NewsSource[], 
        forecast2hr: string,
        isLoading: boolean 
    }> = ({ dailyInsight, holisticSummary, newsSummary, monthly, sources, forecast2hr, isLoading }) => {
        const [expanded, setExpanded] = useState(false);

        return (
            <div 
                className={`mx-4 mt-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl shadow-sm relative overflow-hidden transition-all cursor-pointer group ${expanded ? 'ring-1 ring-moncchichi-accent/40' : 'hover:border-moncchichi-accent/50'}`}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-moncchichi-accent" />
                            <h3 className="text-xs font-bold text-moncchichi-accent uppercase tracking-wider">Today's Insight</h3>
                        </div>
                        <div className="text-moncchichi-textSec opacity-50 flex items-center gap-1 text-[10px]">
                            {expanded ? "Less" : "Expand"} {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className="flex items-center gap-2 py-2 text-moncchichi-textSec opacity-70">
                            <Loader2 size={16} className="animate-spin text-moncchichi-accent" />
                            <span className="text-xs">Retrieving real-time analysis...</span>
                        </div>
                    ) : (
                        <>
                            {/* Collapsed State: Natural Language Sentence */}
                            {!expanded && (
                                <div className="animate-in fade-in">
                                    <p className="text-sm font-medium text-moncchichi-text leading-relaxed">
                                        {dailyInsight || `${forecast2hr}`}
                                    </p>
                                </div>
                            )}

                            {/* Expanded State: Holistic Summary (Advice) + News Brief */}
                            {expanded && (
                                <div className="space-y-4 animate-in fade-in">
                                    
                                    {/* Collapsed text remains at top in bold */}
                                    <p className="text-sm font-bold text-moncchichi-text leading-relaxed mb-3 border-b border-moncchichi-border/50 pb-3">
                                        {dailyInsight || `${forecast2hr}`}
                                    </p>

                                    {/* Practical Advice */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-moncchichi-textSec uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Lightbulb size={12} className="text-yellow-500" /> Practical Advice
                                        </h4>
                                        <p className="text-sm text-moncchichi-text leading-relaxed whitespace-pre-wrap">
                                            {holisticSummary || "No detailed advice available."}
                                        </p>
                                    </div>
                                    
                                    {/* News Brief */}
                                    {newsSummary && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-moncchichi-textSec uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <Newspaper size={12} className="text-blue-400" /> Weather News
                                            </h4>
                                            <p className="text-xs text-moncchichi-text leading-relaxed bg-moncchichi-surfaceAlt/30 p-2 rounded border border-moncchichi-border/30">
                                                {newsSummary}
                                            </p>
                                        </div>
                                    )}

                                    {/* Seasonal Outlook */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-moncchichi-textSec uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <CalendarDays size={12} /> Seasonal Outlook
                                        </h4>
                                        <p className="text-xs text-moncchichi-textSec leading-relaxed opacity-80">
                                            {monthly}
                                        </p>
                                    </div>

                                    {/* News Sources */}
                                    {sources && sources.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-moncchichi-textSec uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <ExternalLink size={12} /> Sources
                                            </h4>
                                            <div className="space-y-1">
                                                {sources.map((source, idx) => (
                                                    <a 
                                                        key={idx} 
                                                        href={source.uri} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="block p-2 rounded bg-moncchichi-surfaceAlt/50 border border-moncchichi-border/50 hover:border-moncchichi-accent/50 transition-colors text-xs text-moncchichi-text truncate flex items-center gap-2 group/link"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <ExternalLink size={10} className="text-moncchichi-textSec group-hover/link:text-moncchichi-accent" />
                                                        <span className="truncate">{source.title}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const GroupSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
        <div className="px-4">
            <h3 className="text-[10px] font-bold text-moncchichi-textSec uppercase tracking-wider mb-2 mt-6 opacity-70 border-b border-moncchichi-border pb-1">
                {title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children}
            </div>
        </div>
    );

    const formatDay = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) throw new Error("Invalid");
            return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        } catch { return "DAY"; }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-moncchichi-bg items-center justify-center space-y-4">
                <div className="w-8 h-8 border-4 border-moncchichi-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-moncchichi-accent animate-pulse">Consulting the Elements...</span>
                <button onClick={() => { setLoading(false); }} className="mt-4 text-xs text-moncchichi-textSec underline hover:text-moncchichi-text">Cancel</button>
            </div>
        );
    }

    const uvInfo = getUvStatus(weather?.uv ?? 0);
    const wbgtInfo = getWbgtStatus(weather?.wbgt ?? 0);
    const rainInfo = getRainStatus(weather?.rain ?? 0);
    const humidInfo = getHumidStatus(weather?.humidity ?? 0);
    const psiInfo = getPsiStatus(weather?.psi ?? 0);

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
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
                <button onClick={fetchWeather} disabled={isRefreshing} className="p-2 bg-moncchichi-surfaceAlt hover:bg-moncchichi-border text-moncchichi-text rounded-full border border-moncchichi-border transition-all active:scale-95">
                    <RotateCcw size={18} className={isRefreshing ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-10">
                {weather && (
                    <InsightCard 
                        dailyInsight={weather.dailyInsight} 
                        holisticSummary={weather.holisticSummary}
                        newsSummary={weather.newsSummary}
                        monthly={weather.monthlyOutlook} 
                        sources={weather.newsSources} 
                        forecast2hr={weather.forecast2hr}
                        isLoading={isInsightLoading}
                    />
                )}
                {weather?.alerts && <HazardAlerts alerts={weather.alerts} />}
                
                <GroupSection title="Atmosphere">
                    <MetricCard id="temp" title="Temperature" value={weather?.temperature || 0} unitLabel="°C" statusLabel="Live" statusColor="text-orange-500" insight="Real-time air temperature." description="Core ambient temperature." icon={<Thermometer />} colorClass="bg-orange-500" />
                    <MetricCard id="humidity" title="Humidity" value={weather?.humidity || 0} unitLabel="%" statusLabel={humidInfo.label} statusColor={humidInfo.text} insight={humidInfo.insight} description="Relative humidity." icon={<Droplets />} colorClass="bg-blue-400" />
                    <MetricCard id="wind" title="Wind" value={weather?.windSpeed || 0} unitLabel="kn" statusLabel={weather?.windDirection ? `${weather.windDirection}°` : "Calm"} statusColor="text-gray-400" insight="Wind conditions." description="Wind speed/direction." icon={<Wind />} colorClass="bg-gray-400" />
                </GroupSection>

                <GroupSection title="Precipitation">
                    <MetricCard id="rain" title="Rainfall" value={weather?.rain || 0} unitLabel="mm" statusLabel={rainInfo.label} statusColor={rainInfo.text} insight={rainInfo.insight} description="Recent intensity." icon={<CloudRain />} colorClass="bg-cyan-500" />
                    <MetricCard id="lightning" title="Lightning" value={weather?.lightningCount ?? 0} unitLabel="Strikes" statusLabel={(weather?.lightningCount ?? 0) > 0 ? "Active" : "None"} statusColor={(weather?.lightningCount ?? 0) > 0 ? "text-yellow-400" : "text-green-500"} insight="Lightning activity." description="Cloud-to-ground strikes." icon={<Zap />} colorClass="bg-yellow-400" />
                    <MetricCard id="flood" title="Flood" value={weather?.activeFloods ?? 0} unitLabel="Areas" statusLabel={(weather?.activeFloods ?? 0) > 0 ? "Alert" : "Normal"} statusColor={(weather?.activeFloods ?? 0) > 0 ? "text-moncchichi-error" : "text-moncchichi-success"} insight="Flood sensor alerts." description="Drainage levels." icon={<Waves />} colorClass="bg-blue-600" />
                </GroupSection>

                <GroupSection title="Environment">
                     <MetricCard id="wbgt" title="Heat Stress" value={weather?.wbgt || 0} unitLabel="°C" statusLabel={wbgtInfo.label} statusColor={wbgtInfo.text} insight={wbgtInfo.insight} description="WBGT Index." icon={<Flame />} colorClass="bg-red-500" />
                    <MetricCard id="uv" title="UV Index" value={weather?.uv ?? 0} unitLabel="" statusLabel={uvInfo.label} statusColor={uvInfo.text} insight={uvInfo.insight} description="UV Radiation." icon={<Sun />} colorClass="bg-yellow-500" />
                    <MetricCard id="psi" title="PSI" value={weather?.psi || 0} unitLabel="" statusLabel={psiInfo.label} statusColor={psiInfo.text} insight={psiInfo.insight} description="Air Quality." icon={<Activity />} colorClass="bg-purple-500" />
                </GroupSection>

                <div className="mx-4 mb-8 mt-6">
                    <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Thermometer size={14} /> 4-Day Outlook
                    </h3>
                    <div className="space-y-3">
                        {(!weather?.forecast4day || weather.forecast4day.length === 0) ? (
                            <div className="p-4 bg-moncchichi-surface rounded-xl border border-moncchichi-border text-center text-xs text-moncchichi-textSec italic">No Data</div>
                        ) : (
                            weather.forecast4day.map((day, i) => {
                                const isExpanded = !!expandedDays[i];
                                return (
                                    <div key={i} onClick={() => toggleDayExpand(i)} className={`bg-moncchichi-surface rounded-xl border border-moncchichi-border flex flex-col gap-0 transition-all active:scale-[0.99] cursor-pointer ${isExpanded ? 'ring-1 ring-moncchichi-textSec/30' : ''}`}>
                                        <div className="p-4 flex gap-4 items-center">
                                            <div className="shrink-0 p-2 bg-moncchichi-surfaceAlt/50 rounded-lg border border-moncchichi-border/30">{getWeatherIcon(day.forecast)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-sm font-bold text-moncchichi-accent uppercase tracking-wider">{formatDay(day.date)}</span>
                                                    <span className="text-xs text-moncchichi-text font-medium truncate">{day.category || day.forecast}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-moncchichi-textSec w-6 text-right">{day.temperature.low}°</span>
                                                    <div className="w-16 h-1 bg-moncchichi-surfaceAlt rounded-full overflow-hidden relative border border-moncchichi-border/30"><div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-yellow-400 to-orange-500 opacity-80" /></div>
                                                    <span className="text-[10px] font-bold text-moncchichi-textSec w-6">{day.temperature.high}°</span>
                                                </div>
                                            </div>
                                            <div className="text-moncchichi-textSec/50">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                                                <div className="h-px bg-moncchichi-border/50 w-full mb-3" />
                                                <div className="mb-3 px-1"><div className="text-sm text-moncchichi-text">{formatForecastText(day.forecast)}</div></div>
                                                <div className="flex items-center gap-2 text-xs font-mono text-moncchichi-textSec bg-moncchichi-surfaceAlt/30 px-3 py-1.5 rounded border border-moncchichi-border/30 w-full">
                                                    <Thermometer size={14} className="opacity-70" />
                                                    <span className="font-bold text-moncchichi-text">{day.temperature.low} - {day.temperature.high}°C</span>
                                                    <div className="w-px h-3 bg-moncchichi-border/50 mx-2"/>
                                                    <Wind size={14} className="opacity-70" />
                                                    <span className="font-bold text-moncchichi-text">{day.wind.direction}</span>
                                                    <span className="opacity-80 ml-1">{day.wind.speed.low} - {day.wind.speed.high}km/h</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherRealtime;
