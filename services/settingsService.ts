
import { mockService } from "./mockService";

export interface AppSettings {
    isSimulating: boolean;
    userName: string;
    theme: 'light' | 'dark' | 'system';
    soundEnabled: boolean;
    lastAssistantTab: string;
}

const SETTINGS_KEY = 'moncchichi_settings';

const DEFAULT_SETTINGS: AppSettings = {
    isSimulating: false,
    userName: 'Traveler',
    theme: 'dark',
    soundEnabled: true,
    lastAssistantTab: 'PHONE'
};

class SettingsService {
    private settings: AppSettings;

    constructor() {
        this.settings = this.loadSettings();
        this.applySideEffects();
    }

    private loadSettings(): AppSettings {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    }

    private saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }

    private applySideEffects() {
        // Apply simulation mode to mockService
        mockService.setSimulationMode(this.settings.isSimulating);
    }

    public get<K extends keyof AppSettings>(key: K): AppSettings[K] {
        return this.settings[key];
    }

    public set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
        this.settings[key] = value;
        this.saveSettings();
        
        if (key === 'isSimulating') {
             mockService.setSimulationMode(value as boolean);
        }
    }

    public getAll(): AppSettings {
        return { ...this.settings };
    }
}

export const settingsService = new SettingsService();
