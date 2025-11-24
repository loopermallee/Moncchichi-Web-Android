

import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { bookService, Book, Chapter } from '../services/bookService';
import { nlbService, NLBLibrary, NLBItem } from '../services/nlbService';
import { mockService } from '../services/mockService';
import { GoogleGenAI } from "@google/genai";
import { Search, BookOpen, Download, ChevronLeft, ChevronRight, Settings, Type, Plus, Trash2, Cloud, Glasses, ArrowLeft, ArrowRight, CheckCircle, Loader2, Sparkles, Bookmark, History, Ghost, Globe, Heart, Lock, Building2, Smartphone, MapPin, Users, Clock, Filter, Library, LayoutGrid, SlidersHorizontal, Headphones, ExternalLink, FileText, FolderOpen, Image, List, AlertCircle, Eye, EyeOff, Play } from 'lucide-react';

type ReaderMode = 'HOME' | 'LIBRARY' | 'BROWSE' | 'NLB' | 'READING' | 'SUMMARY';
type Theme = 'LIGHT' | 'DARK' | 'SEPIA';
type BrowseState = 'HOME' | 'RESULTS';
type NlbTab = 'SEARCH' | 'LOCATIONS' | 'FOR_YOU';
type SourceType = 'GUTENBERG' | 'GOOGLE' | 'NLB' | 'LOCAL' | 'STANDARD_EBOOKS' | 'OPEN_LIBRARY' | 'MANGADEX';

const GENRES = [
    { id: 'fiction', label: 'Fiction', icon: <BookOpen size={16} />, color: 'bg-blue-500' },
    { id: 'science fiction', label: 'Sci-Fi', icon: <Sparkles size={16} />, color: 'bg-purple-500' },
    { id: 'mystery', label: 'Mystery', icon: <Ghost size={16} />, color: 'bg-slate-600' },
    { id: 'history', label: 'History', icon: <History size={16} />, color: 'bg-amber-600' },
    { id: 'fantasy', label: 'Fantasy', icon: <Sparkles size={16} />, color: 'bg-emerald-500' },
    { id: 'romance', label: 'Romance', icon: <Heart size={16} />, color: 'bg-rose-500' },
    { id: 'travel', label: 'Travel', icon: <Globe size={16} />, color: 'bg-cyan-500' },
    { id: 'manga', label: 'Manga', icon: <Image size={16} />, color: 'bg-pink-500' },
];

const SOURCE_STYLES: Record<string, { bg: string, text: string, label: string }> = {
    'MANGADEX': { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'MangaDex' },
    'STANDARD_EBOOKS': { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Std eBooks' },
    'OPEN_LIBRARY': { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Open Lib' },
    'GOOGLE': { bg: 'bg-blue-400/10', text: 'text-blue-400', label: 'Google' },
    'NLB': { bg: 'bg-red-500/10', text: 'text-red-500', label: 'NLB' },
    'LOCAL': { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Local' },
    'GUTENBERG': { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Gutenberg' }
};

const Reader: React.FC<{ onBack: () => void, onShowToast?: (msg: string, type: string) => void }> = ({ onBack, onShowToast }) => {
  const [mode, setMode] = useState<ReaderMode>('HOME');
  const [library, setLibrary] = useState<Book[]>([]);
  
  // Browse / Search State
  const [browseState, setBrowseState] = useState<BrowseState>('HOME');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Summary View State
  const [selectedSeries, setSelectedSeries] = useState<Book | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [aiReview, setAiReview] = useState<string>("");
  const [loadingReview, setLoadingReview] = useState(false);

  // NLB State
  const [nlbTab, setNlbTab] = useState<NlbTab>('SEARCH');
  const [nlbQuery, setNlbQuery] = useState('');
  const [nlbSearchType, setNlbSearchType] = useState<'CATALOGUE' | 'ERESOURCE'>('CATALOGUE');
  const [nlbResults, setNlbResults] = useState<NLBItem[]>([]);
  const [nlbLibraries, setNlbLibraries] = useState<NLBLibrary[]>([]);
  const [nlbRecommendations, setNlbRecommendations] = useState<NLBItem[]>([]);
  const [nlbLoading, setNlbLoading] = useState(false);

  const [activeBook, setActiveBook] = useState<Book | null>(null);
  
  // Reading State
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = bookService.subscribe(() => {
        setLibrary([...bookService.getLibrary()]);
    });
    
    // Load popular books
    const loadContent = async () => {
        setLoadingPopular(true);
        try {
            const [guten, google, std, openlib, manga] = await Promise.all([
                bookService.getPopularGutenberg(),
                bookService.getPopularGoogleBooks(),
                bookService.getPopularStandardEbooks(),
                bookService.getPopularOpenLibrary(),
                bookService.getPopularMangaDex()
            ]);

            // Interleave results for variety
            const combined = [];
            const maxLength = Math.max(guten.length, google.length, std.length, openlib.length, manga.length);
            for (let i = 0; i < maxLength; i++) {
                if (manga[i]) combined.push(manga[i]);
                if (std[i]) combined.push(std[i]);
                if (openlib[i]) combined.push(openlib[i]);
                if (google[i]) combined.push(google[i]);
            }
            setPopularBooks(combined);
        } catch (e) {
            mockService.emitLog("READER", "WARN", "Could not load Top Grimoires");
            if(onShowToast) onShowToast("Failed to load top grimoires", "error");
        } finally {
            setLoadingPopular(false);
        }
    };
    loadContent();
    nlbService.getLibraries().then(setNlbLibraries);
    nlbService.getRecommendations().then(setNlbRecommendations);
    
    return unsub;
  }, [onShowToast]);

  // AI Review Effect
  useEffect(() => {
    if (mode === 'SUMMARY' && selectedSeries) {
        setAiReview("");
        fetchMangaReview(selectedSeries);
    }
  }, [mode, selectedSeries]);

  const fetchMangaReview = async (book: Book) => {
      setLoadingReview(true);
      try {
          const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Provide a brief, 2-sentence review summary of the manga '${book.title}' by ${book.author}. Focus on themes and general reception. If unknown, describe the genre appeal. Keep it under 40 words.`;
          
          const result = await genAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt
          });
          setAiReview(result.text || "Review unavailable.");
      } catch (e) {
          setAiReview("");
      } finally {
          setLoadingReview(false);
      }
  };

  const handleNavigation = () => {
      if (mode === 'READING') {
          // If reading a manga chapter or temp book, return to summary if applicable
          if ((activeBook?.type === 'MANGA' || activeBook?.type === 'BOOK') && selectedSeries) {
              setMode('SUMMARY');
          } else {
              setMode('LIBRARY');
          }
          setWebViewUrl(null);
          return;
      }
      if (mode === 'SUMMARY') {
          // Clear selection to avoid stale state
          setSelectedSeries(null);
          setChapterList([]);
          if (browseState === 'RESULTS') {
              setMode('BROWSE');
          } else if (library.find(b => b.id === selectedSeries?.id)) {
               setMode('LIBRARY');
          } else {
              setMode('HOME');
          }
          return;
      }
      if (mode === 'BROWSE' && browseState === 'RESULTS') {
          setBrowseState('HOME');
          setSearchQuery('');
          return;
      }
      if (mode !== 'HOME') {
          setMode('HOME');
          return;
      }
      onBack();
  };

  const handleSearch = async (query: string, isCategory: boolean = false) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setBrowseState('RESULTS');
    if (mode !== 'BROWSE') setMode('BROWSE');

    try {
        let results: Book[] = [];
        const promises = [];

        if (isCategory && query.toLowerCase() === 'manga') {
            promises.push(bookService.getPopularMangaDex());
        } else {
            promises.push(bookService.searchMangaDex(query));
            promises.push(bookService.searchGoogleBooks(query));
            promises.push(bookService.searchStandardEbooks(query));
            promises.push(bookService.searchOpenLibrary(query));
        }

        const responses = await Promise.all(promises);
        results = responses.flat().sort(() => Math.random() - 0.5);
        setSearchResults(results);
        
        if (results.length === 0 && onShowToast) {
            onShowToast("No results found.", "info");
        }

    } catch (e: any) { 
        if (onShowToast) onShowToast("Search failed. Check connection.", "error");
    } finally {
        setIsSearching(false);
    }
  };
  
  const mapNlbToBook = (item: NLBItem): Book => ({
      id: item.id,
      title: item.title,
      author: item.author,
      coverUrl: item.coverUrl,
      description: `Format: ${item.format}. ${item.branch ? '@ ' + item.branch : ''}`,
      progress: 0,
      type: 'BOOK',
      source: 'NLB' as any,
      downloaded: false,
      tags: [item.format, item.availabilityStatus]
  });

  const handleNlbSearch = async () => {
      if (!nlbQuery.trim()) return;
      setNlbLoading(true);
      setNlbResults([]);
      try {
          let res;
          if (nlbSearchType === 'CATALOGUE') res = await nlbService.searchCatalogue(nlbQuery);
          else res = await nlbService.searchEResources(nlbQuery);
          setNlbResults(res);
      } catch(e) { 
          if(onShowToast) onShowToast("NLB Search failed", "error");
      } finally {
          setNlbLoading(false);
      }
  };

  const handleBookClick = async (book: Book) => {
      if (book.source === 'NLB' as any) {
          setMode('NLB');
          setNlbTab('SEARCH');
          setNlbQuery(book.title);
          return;
      }

      if (book.type === 'MANGA') {
          // Always go to summary for manga to show chapters
          setSelectedSeries(book);
          setMode('SUMMARY');
          setLoadingChapters(true);
          setChapterList([]);
          
          try {
              // Ensure book exists in library to track read state
              await bookService.ensureBookInLibrary(book);
              const chapters = await bookService.getMangaChapters(book.downloadUrl || book.id);
              setChapterList(chapters);
          } catch (e) {
              if(onShowToast) onShowToast("Could not load chapters", "error");
          } finally {
              setLoadingChapters(false);
          }
          return;
      }
      
      openBook(book);
  };

  const toggleChapterRead = async (chapter: Chapter) => {
      if (!selectedSeries) return;
      const isRead = bookService.isChapterRead(selectedSeries.id, chapter.id);
      await bookService.toggleChapterRead(selectedSeries.id, chapter.id, !isRead);
      // Force refresh library state
      setLibrary([...bookService.getLibrary()]);
  };

  const handleChapterAction = async (chapter: Chapter, action: 'READ' | 'DOWNLOAD') => {
      if (!selectedSeries) return;

      if (action === 'READ') {
          // Mark as read immediately when opening
          await bookService.toggleChapterRead(selectedSeries.id, chapter.id, true);
          
          setMode('READING');
          setShowControls(true);
          setPages([]); 
          setTotalPages(0);
          setWebViewUrl(null);
          
          const tempBook: Book = {
              ...selectedSeries,
              id: `${selectedSeries.id}-ch${chapter.id}`,
              title: `${selectedSeries.title} - ${chapter.title}`,
              type: 'MANGA',
              progress: 0,
              downloaded: false
          };
          setActiveBook(tempBook);

          try {
              const pgs = await bookService.getMangaChapterPages(chapter.id);
              setPages(pgs);
              setTotalPages(pgs.length);
              setCurrentPage(0);
          } catch (e) {
              if(onShowToast) onShowToast("Failed to load pages", "error");
              setMode('SUMMARY'); 
          }
      } else {
          bookService.downloadBook(selectedSeries, chapter.id);
          if(onShowToast) onShowToast("Download started", "info");
      }
  };

  const handleReadFromBeginning = () => {
      if (chapterList.length > 0) {
          // Typically API returns desc, so last is first
          const firstChapter = chapterList[chapterList.length - 1];
          handleChapterAction(firstChapter, 'READ');
      }
  };

  const handleDownloadAll = () => {
      if (!selectedSeries || chapterList.length === 0) return;
      if (chapterList.length > 20) {
          if(onShowToast) onShowToast(`Queuing ${chapterList.length} chapters. This may take a while.`, "info");
      } else {
          if(onShowToast) onShowToast(`Downloading ${chapterList.length} chapters...`, "info");
      }
      
      // Queue downloads with a small staggering to avoid instant rate limiting
      chapterList.forEach((ch, index) => {
          setTimeout(() => {
              bookService.downloadBook(selectedSeries, ch.id).catch(e => console.warn(e));
          }, index * 200);
      });
  };

  const openBook = async (book: Book) => {
      if (book.isDownloading) return;
      
      setActiveBook(book);
      setMode('READING');
      setShowControls(true);
      setIsLoadingContent(true);
      setWebViewUrl(null);
      setPages([]);

      try {
          if (book.type === 'WEB' && book.downloadUrl) {
              setWebViewUrl(book.downloadUrl);
              setIsLoadingContent(false);
              return;
          }

          if (book.type === 'MANGA') {
              const pgs = book.pages || [];
              setPages(pgs);
              setTotalPages(pgs.length);
              const start = Math.floor((book.progress / 100) * (pgs.length - 1)) || 0;
              setCurrentPage(start);
              setIsLoadingContent(false);
          } else {
              let content = book.content;
              if (!content && book.downloadUrl) {
                  content = await bookService.fetchBookContent(book);
              }
              content = content || book.description || "No content found.";
              
              const fontSize = 18;
              const charsPerPage = Math.floor(40000 / fontSize); 
              const chunks = [];
              for (let i = 0; i < content.length; i += charsPerPage) {
                  chunks.push(content.substring(i, i + charsPerPage));
              }
              setPages(chunks);
              setTotalPages(chunks.length);
              const start = Math.floor((book.progress / 100) * (chunks.length - 1)) || 0;
              setCurrentPage(start);
              setIsLoadingContent(false);
          }
      } catch (e) {
          if(onShowToast) onShowToast("Failed to open book", "error");
          setIsLoadingContent(false);
          setMode('HOME');
      }
  };

  const handlePageChange = (delta: number) => {
      const newPage = Math.max(0, Math.min(totalPages - 1, currentPage + delta));
      setCurrentPage(newPage);
      if (activeBook && activeBook.id) {
          const progress = Math.round((newPage / (totalPages || 1)) * 100);
          bookService.updateProgress(activeBook.id, progress);
      }
  };

  const sendToGlasses = () => {
      if (!pages[currentPage]) return;
      mockService.sendCommand("CLEAR_SCREEN");
      
      if (activeBook?.type === 'MANGA') {
          mockService.emitLog("TX", "INFO", `[READER] Casting Page ${currentPage + 1}`);
          mockService.sendCommand("TELEPROMPTER_INIT", `[MANGA] ${activeBook.title}\nPage ${currentPage + 1}\n(Image content not supported on HUD)`);
      } else {
          const textChunk = pages[currentPage].substring(0, 200) + "...";
          mockService.emitLog("TX", "INFO", `[READER] Casting Page ${currentPage + 1}`);
          mockService.sendCommand("TELEPROMPTER_INIT", textChunk); 
      }
      if(onShowToast) onShowToast("Sent to Glasses", "info");
  };

  // --- Components ---

  const BookSkeleton = () => (
      <div className="flex gap-4 p-3 rounded-xl border border-dashed border-moncchichi-border bg-moncchichi-surface/50 animate-pulse">
          <div className="w-20 aspect-[2/3] bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border/30 flex items-center justify-center">
              <BookOpen className="text-moncchichi-border" size={24} />
          </div>
          <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-moncchichi-surfaceAlt rounded w-3/4"></div>
              <div className="h-3 bg-moncchichi-surfaceAlt rounded w-1/2"></div>
              <div className="h-3 bg-moncchichi-surfaceAlt rounded w-1/3 mt-2"></div>
          </div>
      </div>
  );

  const SummaryView = () => (
      <div className="flex flex-col h-full bg-moncchichi-bg animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
              <button onClick={handleNavigation} className="p-2 bg-black/40 backdrop-blur rounded-full text-white border border-white/10 hover:bg-white/20 transition-colors">
                  <ArrowLeft size={20}/>
              </button>
              <button onClick={() => {}} className="p-2 bg-black/40 backdrop-blur rounded-full text-white border border-white/10 hover:bg-white/20 transition-colors">
                  <Bookmark size={20}/>
              </button>
          </div>

          <div className="relative h-64 w-full bg-moncchichi-surfaceAlt shrink-0">
              {selectedSeries?.coverUrl ? (
                  <>
                    <img src={selectedSeries.coverUrl} className="w-full h-full object-cover opacity-30 blur-md" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-moncchichi-bg via-transparent to-transparent" />
                    <div className="absolute top-16 left-4 flex gap-4 right-4 items-end">
                        <img src={selectedSeries.coverUrl} className="h-40 w-28 object-cover rounded-lg shadow-2xl border border-moncchichi-border/50" referrerPolicy="no-referrer" />
                        <div className="flex-1 pb-1 drop-shadow-lg">
                             <h2 className="text-xl font-bold line-clamp-2 leading-tight mb-1 text-white">{selectedSeries?.title}</h2>
                             <p className="text-sm text-moncchichi-primary opacity-90 mb-2 font-medium">{selectedSeries?.author}</p>
                             <div className="flex gap-1.5 flex-wrap">
                                 {selectedSeries?.tags?.slice(0, 3).map(t => <span key={t} className="px-2 py-0.5 bg-moncchichi-accent/20 border border-moncchichi-accent/30 rounded text-[10px] font-bold text-moncchichi-accent">{t}</span>)}
                             </div>
                        </div>
                    </div>
                  </>
              ) : (
                  <div className="w-full h-full flex items-center justify-center bg-pink-900/20"><Image size={64} className="text-pink-500 opacity-50" /></div>
              )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-10">
              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                  <button 
                      onClick={handleReadFromBeginning}
                      className="flex items-center justify-center gap-2 bg-moncchichi-accent text-moncchichi-bg font-bold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-moncchichi-accent/20"
                  >
                      <BookOpen size={18} /> Start Reading
                  </button>
                  <button 
                      onClick={handleDownloadAll}
                      className="flex items-center justify-center gap-2 bg-moncchichi-surface border border-moncchichi-border text-moncchichi-text font-bold py-3 rounded-xl hover:bg-moncchichi-surfaceAlt active:scale-95 transition-all"
                  >
                      <Download size={18} /> Download All
                  </button>
              </div>

              {/* Synopsis */}
              <div className="text-sm text-moncchichi-textSec leading-relaxed mb-4 bg-moncchichi-surface/50 p-4 rounded-xl border border-moncchichi-border">
                  <h3 className="font-bold text-moncchichi-text uppercase text-xs mb-2 flex items-center gap-2 opacity-80">
                      <FileText size={14}/> Synopsis
                  </h3>
                  <div className="line-clamp-6 hover:line-clamp-none transition-all">{selectedSeries?.description || "No description available."}</div>
              </div>

              {/* AI Review */}
              {(aiReview || loadingReview) && (
                  <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10"><Sparkles size={40} className="text-purple-400" /></div>
                      <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Sparkles size={12} /> AI Insight
                      </h3>
                      {loadingReview ? (
                          <div className="flex items-center gap-2 text-xs text-moncchichi-textSec">
                              <Loader2 size={12} className="animate-spin" /> Analyzing reception...
                          </div>
                      ) : (
                          <p className="text-xs text-moncchichi-text leading-relaxed italic opacity-90">"{aiReview}"</p>
                      )}
                  </div>
              )}

              {/* Chapter List */}
              <div className="flex items-center justify-between mb-3 border-b border-moncchichi-border pb-2">
                  <h3 className="font-bold text-moncchichi-text uppercase text-sm flex items-center gap-2">
                      <List size={16}/> Chapters
                  </h3>
                  <span className="text-xs text-moncchichi-textSec font-mono bg-moncchichi-surfaceAlt px-2 py-0.5 rounded">{chapterList.length}</span>
              </div>

              {loadingChapters ? (
                  <div className="space-y-3">
                      <BookSkeleton />
                      <BookSkeleton />
                      <BookSkeleton />
                  </div>
              ) : (
                  <div className="space-y-2 pb-10">
                      {chapterList.map(ch => {
                          const isDownloaded = library.some(b => b.id === `${selectedSeries?.id}-ch${ch.id}` && b.downloaded);
                          const isDownloading = library.some(b => b.id === `${selectedSeries?.id}-ch${ch.id}` && b.isDownloading);
                          const isRead = bookService.isChapterRead(selectedSeries?.id || '', ch.id);
                          
                          return (
                              <div key={ch.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${isRead ? 'bg-moncchichi-bg border-moncchichi-border/50 opacity-60' : 'bg-moncchichi-surface border-moncchichi-border hover:border-moncchichi-accent/50'}`}>
                                  <div 
                                      className="flex-1 min-w-0 mr-4 cursor-pointer" 
                                      onClick={() => handleChapterAction(ch, 'READ')}
                                  >
                                      <div className={`font-bold text-sm truncate transition-colors ${isRead ? 'text-moncchichi-textSec' : 'text-moncchichi-text'}`}>{ch.title}</div>
                                      <div className="text-[10px] text-moncchichi-textSec flex items-center gap-2">
                                          <span>{ch.pages} pages</span>
                                          {isRead && <span className="text-moncchichi-success font-bold flex items-center gap-0.5"><CheckCircle size={10}/> Read</span>}
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <button 
                                          onClick={() => toggleChapterRead(ch)}
                                          className={`p-2 rounded-full transition-colors ${isRead ? 'text-moncchichi-textSec hover:text-moncchichi-text' : 'text-moncchichi-text hover:text-moncchichi-accent'}`}
                                      >
                                          {isRead ? <EyeOff size={16} /> : <Eye size={16} />}
                                      </button>
                                      
                                      {isDownloaded ? (
                                          <div className="p-2 text-moncchichi-success"><CheckCircle size={16} /></div>
                                      ) : isDownloading ? (
                                          <div className="p-2"><Loader2 size={16} className="animate-spin text-moncchichi-accent"/></div>
                                      ) : (
                                          <button 
                                            onClick={() => handleChapterAction(ch, 'DOWNLOAD')}
                                            className="p-2 bg-moncchichi-surfaceAlt rounded-lg text-moncchichi-textSec hover:text-moncchichi-text border border-moncchichi-border active:scale-95"
                                          >
                                              <Download size={16} />
                                          </button>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>
  );

  const BookListCard: React.FC<{ book: Book }> = ({ book }) => {
      const isDownloaded = library.some(b => b.id === book.id && b.downloaded);
      const isManga = book.type === 'MANGA';
      const style = SOURCE_STYLES[book.source] || { bg: 'bg-gray-500/10', text: 'text-gray-400', label: book.source };
      
      return (
          <div onClick={() => handleBookClick(book)} className="flex gap-4 bg-moncchichi-surface border border-moncchichi-border p-3 rounded-xl cursor-pointer hover:bg-moncchichi-surfaceAlt/30 transition-all group">
              <div className="w-20 aspect-[2/3] bg-moncchichi-surfaceAlt rounded-lg overflow-hidden shrink-0 relative shadow-sm border border-moncchichi-border/30">
                  {book.coverUrl ? (
                      <img src={book.coverUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" loading="lazy" alt={book.title} />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-moncchichi-textSec bg-moncchichi-surfaceAlt">
                          {isManga ? <Image size={24} className="opacity-50"/> : <BookOpen size={24} className="opacity-50"/>}
                      </div>
                  )}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                      <h4 className="font-bold text-sm text-moncchichi-text line-clamp-2 leading-tight mb-1 group-hover:text-moncchichi-accent transition-colors">{book.title}</h4>
                      <p className="text-xs text-moncchichi-textSec line-clamp-1">{book.author}</p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                      {book.tags && book.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                              {book.tags.slice(0, 3).map((tag, i) => (
                                  <span key={i} className="text-[9px] font-bold text-moncchichi-textSec bg-moncchichi-surfaceAlt/80 px-2 py-0.5 rounded-[4px] border border-moncchichi-border/50 truncate max-w-[100px]">
                                      {tag}
                                  </span>
                              ))}
                          </div>
                      )}

                      <div className="flex justify-between items-center border-t border-moncchichi-border/30 pt-2 mt-auto">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                              {style.label}
                          </span>
                          
                          {isDownloaded ? (
                              <span className="text-xs text-moncchichi-success font-bold flex items-center gap-1"><CheckCircle size={12}/> Saved</span>
                          ) : (
                              <span className="text-xs text-moncchichi-textSec font-bold flex items-center gap-1 group-hover:text-moncchichi-text transition-colors">
                                  {isManga ? "Chapters" : "Read"} {isManga ? <List size={12}/> : (book.type === 'WEB' ? <ExternalLink size={12}/> : <BookOpen size={12}/>)}
                              </span>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // --- Reading View ---
  if (mode === 'READING' && activeBook) {
      return (
          <div className="flex flex-col h-full bg-black relative">
              <div className={`absolute top-0 w-full p-4 flex justify-between items-center z-20 transition-opacity bg-gradient-to-b from-black/80 to-transparent ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button onClick={handleNavigation} className="p-2 bg-black/40 backdrop-blur rounded-full text-white"><ChevronLeft/></button>
                  <div className="text-white text-xs font-bold opacity-80 truncate px-4">{activeBook.title}</div>
                  <button onClick={sendToGlasses} className="p-2 bg-moncchichi-accent text-moncchichi-bg rounded-full font-bold flex gap-2 px-4"><Glasses size={18}/> Cast</button>
              </div>
              
              <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-[#1a1a1a]" onClick={() => setShowControls(!showControls)}>
                  {isLoadingContent ? (
                      <div className="flex flex-col items-center gap-3">
                           <Loader2 className="animate-spin text-moncchichi-accent" size={32}/>
                           <span className="text-xs text-moncchichi-textSec">Loading Content...</span>
                      </div>
                  ) : webViewUrl ? (
                      <iframe 
                        src={webViewUrl} 
                        className="w-full h-full border-0 bg-white"
                        title="Web Reader"
                        sandbox="allow-scripts allow-same-origin allow-popups" // Security
                      />
                  ) : activeBook.type === 'MANGA' ? (
                      pages[currentPage] ? 
                      <img 
                          src={pages[currentPage]} 
                          className="max-w-full max-h-full object-contain" 
                          referrerPolicy="no-referrer"
                      /> 
                      : <div className="text-white/50 text-xs">Page {currentPage+1} not found</div>
                  ) : (
                      <div className="w-full h-full overflow-y-auto p-8 pt-16 pb-16">
                          <div className="max-w-2xl mx-auto text-gray-300 text-lg leading-loose font-serif whitespace-pre-wrap">
                             {pages[currentPage]}
                          </div>
                      </div>
                  )}
              </div>

              {!webViewUrl && (
                  <div className={`absolute bottom-0 w-full p-4 z-20 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <div className="flex items-center gap-4 text-white">
                          <button onClick={(e) => {e.stopPropagation(); handlePageChange(-1)}} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft/></button>
                          <span className="flex-1 text-center text-xs font-mono">{currentPage+1} / {totalPages}</span>
                          <button onClick={(e) => {e.stopPropagation(); handlePageChange(1)}} className="p-2 hover:bg-white/10 rounded-full"><ArrowRight/></button>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  if (mode === 'SUMMARY') return <SummaryView />;

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg text-moncchichi-text">
      {/* Header */}
      <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-40 shadow-sm">
        <button onClick={handleNavigation} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
            {mode === 'HOME' ? ICONS.Back : <ChevronLeft size={20} />}
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
            <BookOpen size={20} className="text-moncchichi-accent"/> Grimoire
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
          {mode === 'HOME' && (
              <div className="p-4 space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setMode('LIBRARY')} className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex flex-col gap-2 transition-colors group">
                          <Library className="text-moncchichi-accent group-hover:scale-110 transition-transform" />
                          <div><div className="font-bold text-sm">Library</div><div className="text-[10px] text-moncchichi-textSec">{library.length} Downloaded</div></div>
                      </button>
                      <button onClick={() => { setMode('BROWSE'); setBrowseState('HOME'); }} className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex flex-col gap-2 transition-colors group">
                          <Globe className="text-blue-400 group-hover:scale-110 transition-transform" />
                          <div><div className="font-bold text-sm">Browse</div><div className="text-[10px] text-moncchichi-textSec">Search Online</div></div>
                      </button>
                      <button onClick={() => setMode('NLB')} className="col-span-2 p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex items-center gap-4 transition-colors group">
                          <Building2 className="text-red-500 group-hover:scale-110 transition-transform" />
                          <div><div className="font-bold text-sm">NLB Gateway</div><div className="text-[10px] text-moncchichi-textSec">National Library Board Services</div></div>
                      </button>
                  </div>

                  <div>
                      <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Sparkles size={12} className="text-yellow-500"/> Top Grimoires
                      </h3>
                      {loadingPopular ? (
                          <div className="flex gap-4 overflow-hidden">
                              <div className="shrink-0 w-28"><BookSkeleton /></div>
                              <div className="shrink-0 w-28"><BookSkeleton /></div>
                              <div className="shrink-0 w-28"><BookSkeleton /></div>
                          </div>
                      ) : (
                          <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 no-scrollbar">
                                {popularBooks.map((book, i) => (
                                    <div key={i} onClick={() => handleBookClick(book)} className="shrink-0 w-28 cursor-pointer group">
                                        <div className="w-28 h-40 bg-moncchichi-surfaceAlt rounded mb-2 overflow-hidden border border-moncchichi-border relative shadow-sm">
                                            {book.coverUrl && <img src={book.coverUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />}
                                            <div className="absolute bottom-1 left-1 bg-black/60 px-1 rounded text-[9px] text-white font-bold backdrop-blur-sm">{book.source}</div>
                                        </div>
                                        <div className="text-xs font-bold line-clamp-2 group-hover:text-moncchichi-accent transition-colors">{book.title}</div>
                                    </div>
                                ))}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {mode === 'LIBRARY' && (
              <div className="p-4 grid grid-cols-2 gap-4 animate-in fade-in">
                  {library.map(book => (
                      <div key={book.id} onClick={() => openBook(book)} className="bg-moncchichi-surface border border-moncchichi-border rounded-xl overflow-hidden cursor-pointer relative group">
                          <div className="aspect-[2/3] bg-moncchichi-surfaceAlt relative overflow-hidden">
                              {book.coverUrl && <img src={book.coverUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />}
                              <div className="absolute bottom-0 left-0 h-1 bg-moncchichi-accent" style={{width: `${book.progress}%`}}/>
                          </div>
                          <div className="p-3">
                              <h3 className="font-bold text-xs line-clamp-1 group-hover:text-moncchichi-accent transition-colors">{book.title}</h3>
                              <p className="text-[10px] text-moncchichi-textSec">{book.author}</p>
                          </div>
                      </div>
                  ))}
                  {library.length === 0 && (
                      <div className="col-span-2 text-center py-10 opacity-50 text-xs">Your library is empty.</div>
                  )}
              </div>
          )}

          {mode === 'BROWSE' && (
              <div className="flex flex-col min-h-full">
                  <div className="sticky top-0 z-[60] bg-moncchichi-bg/95 backdrop-blur-sm px-4 py-3 border-b border-moncchichi-border/50 flex gap-2">
                      <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec" size={16} />
                          <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                            placeholder="Search Manga, Books..."
                            className="w-full bg-moncchichi-surface border border-moncchichi-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-moncchichi-accent text-moncchichi-text"
                          />
                      </div>
                      <button onClick={() => handleSearch(searchQuery)} className="bg-moncchichi-accent text-moncchichi-bg px-4 rounded-xl font-bold text-sm">Go</button>
                  </div>

                  <div className="p-4 flex-1">
                      {browseState === 'HOME' ? (
                          <div className="grid grid-cols-2 gap-3">
                              {GENRES.map(g => (
                                  <button key={g.id} onClick={() => handleSearch(g.id, true)} className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl flex items-center gap-3 hover:bg-moncchichi-surfaceAlt transition-colors">
                                      <div className={`p-2 rounded-full ${g.color} text-white`}>{g.icon}</div>
                                      <span className="font-bold text-sm">{g.label}</span>
                                  </button>
                              ))}
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {isSearching ? (
                                  <div className="space-y-3">
                                      <BookSkeleton />
                                      <BookSkeleton />
                                      <BookSkeleton />
                                  </div>
                              ) : (
                               searchResults.map((b, i) => <BookListCard key={i} book={b} />)
                              )}
                          </div>
                      )}
                  </div>
              </div>
          )}
          
          {mode === 'NLB' && (
              <div className="flex flex-col min-h-full animate-in fade-in">
                   <div className="px-4 pt-4 pb-2 bg-moncchichi-surface border-b border-moncchichi-border sticky top-0 z-30">
                       <div className="flex p-1 bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border">
                           <button onClick={() => setNlbTab('SEARCH')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${nlbTab === 'SEARCH' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}>Search</button>
                           <button onClick={() => setNlbTab('LOCATIONS')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${nlbTab === 'LOCATIONS' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}>Locations</button>
                           <button onClick={() => setNlbTab('FOR_YOU')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${nlbTab === 'FOR_YOU' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}>For You</button>
                       </div>
                   </div>

                   <div className="p-4 flex-1 space-y-4">
                       {nlbTab === 'SEARCH' && (
                           <>
                               <div className="flex gap-2">
                                   <input 
                                      value={nlbQuery}
                                      onChange={(e) => setNlbQuery(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleNlbSearch()}
                                      placeholder="Search catalogue..."
                                      className="flex-1 bg-moncchichi-surface border border-moncchichi-border rounded-xl px-3 py-2 text-sm focus:border-moncchichi-accent focus:outline-none text-moncchichi-text"
                                   />
                                   <button onClick={handleNlbSearch} className="bg-moncchichi-accent text-moncchichi-bg px-4 rounded-xl font-bold text-sm active:scale-95 transition-transform">Go</button>
                               </div>
                               <div className="flex gap-4 text-xs font-bold text-moncchichi-textSec justify-center">
                                   <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded hover:bg-moncchichi-surfaceAlt"><input type="radio" checked={nlbSearchType === 'CATALOGUE'} onChange={() => setNlbSearchType('CATALOGUE')} className="accent-moncchichi-accent" /> Physical Items</label>
                                   <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded hover:bg-moncchichi-surfaceAlt"><input type="radio" checked={nlbSearchType === 'ERESOURCE'} onChange={() => setNlbSearchType('ERESOURCE')} className="accent-moncchichi-accent" /> Digital / eBooks</label>
                               </div>
                               
                               {nlbLoading ? (
                                   <div className="space-y-3"><BookSkeleton /><BookSkeleton /></div>
                               ) : (
                                   <div className="space-y-3">
                                       {nlbResults.length === 0 && nlbQuery && <div className="text-center text-moncchichi-textSec text-xs">No results found.</div>}
                                       {nlbResults.map(item => <BookListCard key={item.id} book={mapNlbToBook(item)} />)}
                                   </div>
                               )}
                           </>
                       )}
                       
                       {nlbTab === 'LOCATIONS' && (
                           <div className="space-y-3">
                               {nlbLibraries.map(lib => (
                                   <div key={lib.branchCode} className="p-3 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:border-moncchichi-accent/30 transition-colors">
                                       <div className="font-bold text-sm text-moncchichi-text mb-1">{lib.branchName}</div>
                                       <div className="text-xs text-moncchichi-textSec flex justify-between items-center">
                                           <div className="flex gap-2">
                                               <span className={`px-1.5 py-0.5 rounded ${lib.status === 'OPEN' ? 'bg-moncchichi-success/10 text-moncchichi-success' : 'bg-moncchichi-error/10 text-moncchichi-error'}`}>{lib.status}</span>
                                               <span className="border border-moncchichi-border px-1.5 py-0.5 rounded">{lib.region}</span>
                                           </div>
                                           <span className="font-mono opacity-80">{lib.crowd} Crowd</span>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       )}

                        {nlbTab === 'FOR_YOU' && (
                            <div className="space-y-3">
                                {nlbRecommendations.map(item => <BookListCard key={item.id} book={mapNlbToBook(item)} />)}
                            </div>
                        )}
                   </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default Reader;
