
import { ChecklistItem, Subtask } from '../types';

const STORAGE_KEY = 'moncchichi_checklist';

class ChecklistService {
  private listeners: (() => void)[] = [];

  private getItemsFromStorage(): ChecklistItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  private saveItems(items: ChecklistItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.notifyListeners();
  }

  public subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public getItems(): ChecklistItem[] {
    return this.getItemsFromStorage().sort((a, b) => a.dueDate - b.dueDate);
  }

  public getActiveItems(): ChecklistItem[] {
    return this.getItems().filter(i => !i.completed);
  }

  public getCompletedItems(): ChecklistItem[] {
    // Sort completed by most recently completed/created (descending)
    return this.getItems()
      .filter(i => i.completed)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public addItem(text: string, daysOffset: number = 0): ChecklistItem {
    const now = new Date();
    if (daysOffset > 0) {
        now.setDate(now.getDate() + daysOffset);
    }
    // Default to Today end of day
    const dueDate = new Date(now);
    dueDate.setHours(23, 59, 59, 999);

    const newItem: ChecklistItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      text: text.trim(),
      description: '',
      completed: false,
      dueDate: dueDate.getTime(),
      createdAt: Date.now(),
      subtasks: []
    };

    const items = this.getItemsFromStorage();
    items.push(newItem);
    this.saveItems(items);
    return newItem;
  }

  public updateItemDetails(id: string, updates: Partial<ChecklistItem>) {
    const items = this.getItemsFromStorage();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...updates };
      this.saveItems(items);
    }
  }

  public toggleItem(id: string) {
    const items = this.getItemsFromStorage();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx].completed = !items[idx].completed;
      this.saveItems(items);
    }
  }
  
  public restoreItem(id: string) {
      const items = this.getItemsFromStorage();
      const idx = items.findIndex(i => i.id === id);
      if (idx !== -1) {
          items[idx].completed = false;
          this.saveItems(items);
      }
  }

  public deleteItem(id: string) {
    const items = this.getItemsFromStorage().filter(i => i.id !== id);
    this.saveItems(items);
  }

  public clearCompleted() {
    const items = this.getItemsFromStorage().filter(i => !i.completed);
    this.saveItems(items);
  }

  // --- Subtask Management ---

  public addSubtask(parentId: string, text: string) {
      const items = this.getItemsFromStorage();
      const parent = items.find(i => i.id === parentId);
      if (parent) {
          if (!parent.subtasks) parent.subtasks = [];
          parent.subtasks.push({
              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
              text: text.trim(),
              completed: false
          });
          this.saveItems(items);
      }
  }

  public toggleSubtask(parentId: string, subtaskId: string) {
      const items = this.getItemsFromStorage();
      const parent = items.find(i => i.id === parentId);
      if (parent && parent.subtasks) {
          const sub = parent.subtasks.find(s => s.id === subtaskId);
          if (sub) {
              sub.completed = !sub.completed;
              this.saveItems(items);
          }
      }
  }

  public deleteSubtask(parentId: string, subtaskId: string) {
      const items = this.getItemsFromStorage();
      const parent = items.find(i => i.id === parentId);
      if (parent && parent.subtasks) {
          parent.subtasks = parent.subtasks.filter(s => s.id !== subtaskId);
          this.saveItems(items);
      }
  }

  public parseTimeQuery(text: string): number {
    const t = text.toLowerCase();
    if (t.includes('tomorrow')) return 1;
    if (t.includes('next week')) return 7;
    return 0; // Default today
  }
}

export const checklistService = new ChecklistService();
