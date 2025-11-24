
import { ChatMessage } from "../types";

const MEMORY_KEY = 'moncchichi_assistant_memory';
const HISTORY_KEY = 'moncchichi_chat_history';
const MAX_HISTORY = 50;

class MemoryService {
    private memory: Record<string, string> = {};
    private history: ChatMessage[] = [];

    constructor() {
        this.load();
    }

    private load() {
        try {
            const mem = localStorage.getItem(MEMORY_KEY);
            const hist = localStorage.getItem(HISTORY_KEY);
            
            if (mem) this.memory = JSON.parse(mem);
            if (hist) this.history = JSON.parse(hist);
        } catch (e) {
            console.error("Failed to load assistant memory");
        }
    }

    private save() {
        try {
            localStorage.setItem(MEMORY_KEY, JSON.stringify(this.memory));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
        } catch (e) {
            console.error("Failed to save assistant memory");
        }
    }

    public getChatHistory(): ChatMessage[] {
        return this.history;
    }

    public addMessage(msg: ChatMessage) {
        this.history.push(msg);
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(this.history.length - MAX_HISTORY);
        }
        this.save();
    }

    public clearHistory() {
        this.history = [];
        this.save();
    }

    public setFact(key: string, value: string) {
        this.memory[key] = value;
        this.save();
    }

    public getFact(key: string): string | undefined {
        return this.memory[key];
    }

    public getContextSummary(): string {
        const facts = Object.entries(this.memory)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
        
        return facts ? `Known User Context:\n${facts}` : "";
    }
}

export const memoryService = new MemoryService();
