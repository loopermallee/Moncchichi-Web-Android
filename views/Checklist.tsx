
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { checklistService } from '../services/checklistService';
import { ChecklistItem, Subtask } from '../types';
import { Plus, Trash2, Square, CalendarDays, Archive, CheckSquare, Clock, AlertCircle, ChevronDown, ChevronUp, RotateCcw, Calendar as CalendarIcon, AlignLeft, X } from 'lucide-react';

// Extracted TaskCard to prevent re-renders causing focus loss
const TaskCard: React.FC<{ 
    item: ChecklistItem; 
    isHistory?: boolean;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
}> = ({ item, isHistory, isExpanded, onToggleExpand }) => {
    const [subtaskText, setSubtaskText] = useState("");
    
    const totalCount = (item.subtasks?.length || 0);
    const completedCount = (item.subtasks?.filter(s => s.completed).length || 0);
    
    const handleAddSubtask = () => {
        if(subtaskText.trim()) {
            checklistService.addSubtask(item.id, subtaskText);
            setSubtaskText("");
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        const date = new Date(e.target.value);
        // Preserve time if possible, or set to EOD
        date.setHours(23, 59, 59);
        checklistService.updateItemDetails(item.id, { dueDate: date.getTime() });
    };

    const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        checklistService.updateItemDetails(item.id, { description: e.target.value });
    };

    // Format date for input value (YYYY-MM-DD)
    const dateInputValue = new Date(item.dueDate).toISOString().split('T')[0];

    return (
        <div className={`bg-moncchichi-surface border ${isHistory ? 'border-moncchichi-border opacity-80' : 'border-moncchichi-border hover:border-moncchichi-accent/50'} rounded-xl overflow-hidden transition-all mb-3`}>
            {/* Summary View */}
            <div className="p-3 flex items-start gap-3">
                    {/* Checkbox (Main Task) */}
                    <button 
                    onClick={() => isHistory ? checklistService.restoreItem(item.id) : checklistService.toggleItem(item.id)}
                    className={`mt-0.5 transition-colors ${isHistory ? 'text-moncchichi-success' : 'text-moncchichi-textSec hover:text-moncchichi-success'}`}
                    title={isHistory ? "Restore to Active" : "Complete Task"}
                    >
                        {isHistory ? (
                            <div className="relative">
                                <CheckSquare size={20} />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-moncchichi-bg/80 rounded text-moncchichi-accent">
                                    <RotateCcw size={12} />
                                </div>
                            </div>
                        ) : (
                            <Square size={20} />
                        )}
                    </button>

                    {/* Main Content Area (Click to expand) */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onToggleExpand(item.id)}>
                        <div className="flex justify-between items-start">
                            <span className={`text-sm font-medium leading-tight break-words ${isHistory ? 'line-through text-moncchichi-textSec' : 'text-moncchichi-text'}`}>
                                {item.text}
                            </span>
                            {/* Counter Badge */}
                            {totalCount > 0 && (
                                <span className="ml-2 text-[10px] font-mono bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded border border-moncchichi-border text-moncchichi-textSec shrink-0">
                                    {completedCount}/{totalCount}
                                </span>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1.5">
                            {/* Due Date Badge */}
                            <div className={`flex items-center gap-1 text-[10px] ${item.dueDate < Date.now() && !isHistory ? 'text-moncchichi-error font-bold' : 'text-moncchichi-textSec'}`}>
                                <CalendarIcon size={10} />
                                <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                            </div>
                            {/* Has Desc Indicator */}
                            {item.description && (
                                <div className="flex items-center gap-1 text-[10px] text-moncchichi-textSec">
                                    <AlignLeft size={10} />
                                    <span className="truncate max-w-[100px]">Info</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2">
                        <button 
                            onClick={() => onToggleExpand(item.id)}
                            className="text-moncchichi-textSec"
                        >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
            </div>

            {/* Expanded View */}
            {isExpanded && (
                <div className="border-t border-moncchichi-border bg-moncchichi-surfaceAlt/30 p-4 space-y-4 animate-in slide-in-from-top-2">
                    
                    {/* 1. Date Editor */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-moncchichi-textSec uppercase">Due Date</label>
                        <input 
                            type="date" 
                            value={dateInputValue}
                            onChange={handleDateChange}
                            disabled={isHistory}
                            className="bg-moncchichi-bg border border-moncchichi-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-moncchichi-accent text-moncchichi-text disabled:opacity-50"
                        />
                    </div>

                    {/* 2. Subtasks (Moved Up) */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-moncchichi-textSec uppercase">Subtasks ({completedCount}/{totalCount})</label>
                        </div>
                        
                        {/* Subtask List */}
                        {item.subtasks?.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2 group">
                                <button 
                                onClick={() => !isHistory && checklistService.toggleSubtask(item.id, sub.id)}
                                disabled={isHistory}
                                className={`${sub.completed ? 'text-moncchichi-success' : 'text-moncchichi-textSec'} ${!isHistory && 'hover:text-moncchichi-accent'}`}
                                >
                                    {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                                <span className={`text-sm flex-1 ${sub.completed ? 'line-through text-moncchichi-textSec opacity-70' : 'text-moncchichi-text'}`}>
                                    {sub.text}
                                </span>
                                {!isHistory && (
                                    <button 
                                        onClick={() => checklistService.deleteSubtask(item.id, sub.id)}
                                        className="text-moncchichi-textSec hover:text-moncchichi-error opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}

                        {/* Add Subtask Input */}
                        {!isHistory && (
                            <div className="flex gap-2 mt-1">
                                <input 
                                    type="text" 
                                    value={subtaskText}
                                    onChange={(e) => setSubtaskText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                                    placeholder="Add subtask..."
                                    className="flex-1 bg-transparent border-b border-moncchichi-border py-1 text-sm focus:outline-none focus:border-moncchichi-accent placeholder-moncchichi-textSec/40"
                                />
                                <button 
                                    onClick={handleAddSubtask}
                                    disabled={!subtaskText.trim()}
                                    className="text-moncchichi-accent disabled:opacity-50"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 3. Description / Additional Info (Moved Down) */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-moncchichi-textSec uppercase">Additional Info</label>
                        <textarea 
                            value={item.description || ''}
                            onChange={handleDescChange}
                            disabled={isHistory}
                            placeholder="Add notes, details, or context..."
                            className="bg-moncchichi-bg border border-moncchichi-border rounded px-2 py-2 text-sm focus:outline-none focus:border-moncchichi-accent text-moncchichi-text resize-none h-20 disabled:opacity-50 placeholder-moncchichi-textSec/40"
                        />
                    </div>

                    {/* Delete Item Button */}
                    <div className="pt-2 border-t border-moncchichi-border flex justify-end">
                            <button 
                            onClick={() => checklistService.deleteItem(item.id)}
                            className="text-xs text-moncchichi-error flex items-center gap-1 hover:bg-moncchichi-error/10 px-2 py-1 rounded transition-colors"
                            >
                                <Trash2 size={14} /> Delete Task
                            </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Checklist: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeItems, setActiveItems] = useState<ChecklistItem[]>([]);
  const [completedItems, setCompletedItems] = useState<ChecklistItem[]>([]);
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [newItemText, setNewItemText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const refresh = () => {
      setActiveItems(checklistService.getActiveItems());
      setCompletedItems(checklistService.getCompletedItems());
    };

    refresh();
    const unsub = checklistService.subscribe(refresh);
    return unsub;
  }, []);

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    checklistService.addItem(newItemText);
    setNewItemText('');
  };

  const toggleExpand = (id: string) => {
      setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupItemsByStatus = (items: ChecklistItem[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const tomorrowTime = todayTime + 86400000;

    const groups: Record<string, ChecklistItem[]> = {
      'Expired': [],
      'Today': [],
      'Other Dates': []
    };

    items.forEach(item => {
      const itemDate = new Date(item.dueDate);
      itemDate.setHours(0, 0, 0, 0);
      const t = itemDate.getTime();
      
      if (t < todayTime) {
        groups['Expired'].push(item);
      } else if (t === todayTime) {
        groups['Today'].push(item);
      } else {
        groups['Other Dates'].push(item);
      }
    });
    
    // Sort Expired by oldest first (Chronological)
    groups['Expired'].sort((a, b) => a.dueDate - b.dueDate);
    // Sort others by soonest first
    groups['Today'].sort((a, b) => a.dueDate - b.dueDate);
    groups['Other Dates'].sort((a, b) => a.dueDate - b.dueDate);

    return groups;
  };

  const groupedItems = groupItemsByStatus(activeItems);
  const groupOrder = ['Expired', 'Today', 'Other Dates'];

  const getGroupColor = (group: string) => {
      switch(group) {
          case 'Expired': return 'text-moncchichi-error';
          case 'Today': return 'text-moncchichi-success';
          default: return 'text-moncchichi-textSec';
      }
  };

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
          {ICONS.Back}
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
            {ICONS.CheckList} Checklist
          </h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
         <div className="flex p-1 bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border">
            <button 
                onClick={() => setViewMode('ACTIVE')}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'ACTIVE' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
            >
                <CalendarDays size={14} /> Active ({activeItems.length})
            </button>
            <button 
                onClick={() => setViewMode('HISTORY')}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'HISTORY' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
            >
                <Archive size={14} /> History ({completedItems.length})
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
         
         {/* Add Item Input (Active View) */}
         {viewMode === 'ACTIVE' && (
             <div className="bg-moncchichi-surface rounded-xl p-3 border border-moncchichi-border shadow-sm">
                 <div className="flex gap-2">
                     <input 
                        type="text" 
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                        placeholder="Add a new main task..."
                        className="flex-1 bg-moncchichi-bg border border-moncchichi-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-moncchichi-accent transition-colors placeholder-moncchichi-textSec/50"
                     />
                     <button 
                        onClick={handleAddItem}
                        disabled={!newItemText.trim()}
                        className="bg-moncchichi-accent text-moncchichi-bg p-2 rounded-lg disabled:opacity-50 active:scale-95 transition-transform"
                     >
                         <Plus size={20} />
                     </button>
                 </div>
             </div>
         )}

         {/* Active List */}
         {viewMode === 'ACTIVE' && (
             <div className="space-y-4 pb-10">
                 {activeItems.length === 0 && (
                     <div className="text-center py-10 text-moncchichi-textSec opacity-50">
                         <CheckSquare size={48} className="mx-auto mb-3" />
                         <p className="text-sm">No active tasks.</p>
                     </div>
                 )}

                 {groupOrder.map(group => {
                     const items = groupedItems[group];
                     if (items.length === 0) return null;

                     return (
                         <div key={group} className="animate-in slide-in-from-bottom-2 duration-300">
                             <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${getGroupColor(group)}`}>
                                 {group === 'Expired' && <AlertCircle size={12} />}
                                 {group === 'Today' && <Clock size={12} />}
                                 {group} ({items.length})
                             </div>
                             <div>
                                 {items.map(item => (
                                     <TaskCard 
                                        key={item.id} 
                                        item={item} 
                                        isHistory={false} 
                                        isExpanded={!!expandedIds[item.id]}
                                        onToggleExpand={toggleExpand}
                                     />
                                 ))}
                             </div>
                         </div>
                     );
                 })}
             </div>
         )}

         {/* History List */}
         {viewMode === 'HISTORY' && (
             <div className="space-y-4 pb-10 animate-in fade-in">
                 {completedItems.length === 0 ? (
                     <div className="text-center py-10 text-moncchichi-textSec opacity-50">
                         <Archive size={48} className="mx-auto mb-3" />
                         <p className="text-sm">No completed history.</p>
                     </div>
                 ) : (
                     <>
                         <button 
                            onClick={() => checklistService.clearCompleted()}
                            className="w-full py-2 text-xs font-bold text-moncchichi-error border border-moncchichi-error/30 rounded-lg hover:bg-moncchichi-error/10 transition-colors flex items-center justify-center gap-2"
                         >
                             <Trash2 size={14} /> Clear History
                         </button>
                         {completedItems.map(item => (
                             <TaskCard 
                                key={item.id} 
                                item={item} 
                                isHistory={true}
                                isExpanded={!!expandedIds[item.id]}
                                onToggleExpand={toggleExpand}
                             />
                         ))}
                     </>
                 )}
             </div>
         )}
      </div>
    </div>
  );
};

export default Checklist;
