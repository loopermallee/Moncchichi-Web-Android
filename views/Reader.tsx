
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { bookService, Book } from '../services/bookService';
import { mockService } from '../services/mockService';
import { Search, BookOpen, Download, ChevronLeft, Settings, Type, Plus, Trash2, Cloud, Glasses, ArrowLeft, ArrowRight, CheckCircle, Loader2, Sparkles, Bookmark, History, Ghost, Globe, Heart } from 'lucide-react';

type ReaderMode = 'LIBRARY' | 'BROWSE' | 'READING';
type Theme = 'LIGHT' | 'DARK' | 'SEPIA';
type BrowseState = 'HOME' | 'RESULTS';

const GENRES = [
    { id: 'fiction', label: 'Fiction', icon: <BookOpen size={16} />, color: 'bg-blue-500' },
    { id: 'science fiction', label: 'Sci-Fi', icon: <Sparkles size={16} />, color: 'bg-purple-500' },
    { id: 'mystery', label: 'Mystery', icon: <Ghost size={16} />, color: 'bg-slate-600' },
    { id: 'history', label: 'History', icon: <History size={16} />, color: 'bg-amber-600' },
    { id: 'fantasy', label: 'Fantasy', icon: <Sparkles size={16} />, color: 'bg-emerald-500' },
    { id: 'romance', label: 'Romance', icon: <Heart size={16} />, color: 'bg-rose-500' },
    { id: 'travel', label: 'Travel', icon: <Globe size={16} />, color: 'bg-cyan-500' },
];

const Reader: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [mode, setMode] = useState<ReaderMode>('LIBRARY');
  const [library, setLibrary] = useState<Book[]>([]);
  
  // Browse / Search State
  const [browseState, setBrowseState] = useState<BrowseState>('HOME');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string>('Search Results');
  
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  
  // Reading State
  const [theme, setTheme] = useState<Theme>('DARK');
  const [fontSize, setFontSize] = useState(18);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    // Subscribe to library updates
    const unsub = bookService.subscribe(() => {
        setLibrary([...bookService.getLibrary()]);
    });
    // Load popular books for browse home
    bookService.getPopularGutenberg().then(setPopularBooks);
    return unsub;
  }, []);

  // --- Search & Browse Logic ---
  const handleSearch = async (query: string, isCategory: boolean = false) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setBrowseState('RESULTS');
    setCurrentCategory(isCategory ? query.charAt(0).toUpperCase() + query.slice(1) : `"${query}"`);

    try {
        let results: Book[] = [];
        if (isCategory) {
            // Category search logic
            const subjectBooks = await bookService.getBooksBySubject(query);
            results = subjectBooks;
        } else {
            // Direct text search logic (Mix)
            const [googleBooks, gutenBooks] = await Promise.all([
                bookService.searchGoogleBooks(query),
                bookService.searchGutenberg(query)
            ]);
            results = [...gutenBooks, ...googleBooks];
        }
        setSearchResults(results);
    } catch (e) {
        // Handled in service
    } finally {
        setIsSearching(false);
    }
  };

  const handleDownload = async (book: Book) => {
      if (downloadingId || library.some(b => b.id === book.id && b.isDownloading)) return;
      
      setDownloadingId(book.id);
      try {
          await bookService.downloadBook(book);
      } catch (e) {
          // Error logged in service
      } finally {
          setDownloadingId(null);
      }
  };

  const handleImport = async () => {
      const book = await bookService.uploadLocalBook();
      if (book) {
          mockService.emitLog("READER", "INFO", "Imported local EPUB");
      }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      bookService.deleteBook(id);
  };

  // --- Reader Engine Logic ---
  const openBook = (book: Book) => {
      if (book.isDownloading) return;

      setActiveBook(book);
      const content = book.content || book.description || "No content.";
      const charsPerPage = Math.floor(40000 / fontSize); 
      const chunks = [];
      for (let i = 0; i < content.length; i += charsPerPage) {
          chunks.push(content.substring(i, i + charsPerPage));
      }
      setPages(chunks);
      setTotalPages(chunks.length);
      const startPage = Math.floor((book.progress / 100) * (chunks.length - 1)) || 0;
      setCurrentPage(startPage);
      setMode('READING');
      setShowControls(true);
  };

  const handlePageChange = (delta: number) => {
      const newPage = Math.max(0, Math.min(totalPages - 1, currentPage + delta));
      setCurrentPage(newPage);
      if (activeBook) {
          const progress = Math.round((newPage / (totalPages || 1)) * 100);
          bookService.updateProgress(activeBook.id, progress);
      }
  };

  const sendToGlasses = () => {
      if (!pages[currentPage]) return;
      mockService.sendCommand("CLEAR_SCREEN");
      const textChunk = pages[currentPage].substring(0, 200) + "...";
      mockService.emitLog("TX", "INFO", `[READER] Casting Page ${currentPage + 1}`);
      mockService.sendCommand("TELEPROMPTER_INIT", textChunk); 
  };

  // --- Components ---

  const BookListCard: React.FC<{ book: Book }> = ({ book }) => {
      const libBook = library.find(b => b.id === book.id);
      const isDownloaded = libBook?.downloaded;
      const isDownloading = libBook?.isDownloading || downloadingId === book.id;

      return (
          <div className="flex gap-3 bg-moncchichi-surface border border-moncchichi-border p-3 rounded-xl animate-in slide-in-from-bottom-2">
              <div className="w-16 aspect-[2/3] bg-moncchichi-surfaceAlt rounded overflow-hidden shrink-0">
                  {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center"><BookOpen size={20} className="text-moncchichi-textSec"/></div>
                  )}
              </div>
              <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-moncchichi-text line-clamp-1">{book.title}</h4>
                  <p className="text-xs text-moncchichi-textSec mb-2">{book.author}</p>
                  
                  {isDownloaded ? (
                      <button onClick={() => openBook(libBook!)} className="text-xs font-bold text-moncchichi-success flex items-center gap-1 mt-auto">
                          <CheckCircle size={12} /> In Library
                      </button>
                  ) : isDownloading ? (
                      <span className="text-xs font-bold text-moncchichi-accent flex items-center gap-1 mt-auto">
                          <Loader2 size={12} className="animate-spin" /> {libBook?.downloadProgress || 0}%
                      </span>
                  ) : (
                      <button 
                        onClick={() => handleDownload(book)}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2 bg-moncchichi-surfaceAlt hover:bg-moncchichi-accent hover:text-moncchichi-bg border border-moncchichi-border text-moncchichi-text mt-auto"
                      >
                          <Download size={12} /> Download
                      </button>
                  )}
              </div>
          </div>
      );
  };

  const getThemeStyles = () => {
      switch(theme) {
          case 'LIGHT': return 'bg-white text-gray-900';
          case 'SEPIA': return 'bg-[#f4ecd8] text-[#5b4636]';
          case 'DARK': return 'bg-moncchichi-bg text-moncchichi-text';
      }
  };

  // === RENDER ===

  if (mode === 'READING' && activeBook) {
      return (
          <div className={`flex flex-col h-full ${getThemeStyles()} transition-colors duration-300 relative`}>
              {/* Reader Header */}
              <div className={`absolute top-0 w-full p-4 flex justify-between items-center z-10 transition-opacity duration-300 ${showControls ? 'opacity-100 bg-gradient-to-b from-black/50 to-transparent' : 'opacity-0 pointer-events-none'}`}>
                  <button onClick={() => setMode('LIBRARY')} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white">
                      <ChevronLeft />
                  </button>
                  <div className="flex gap-2">
                      <button onClick={sendToGlasses} className="p-2 bg-moncchichi-accent text-moncchichi-bg rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2 px-4 font-bold">
                          <Glasses size={18} /> Cast
                      </button>
                      <button onClick={() => setTheme(theme === 'DARK' ? 'LIGHT' : (theme === 'LIGHT' ? 'SEPIA' : 'DARK'))} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white">
                          {theme === 'DARK' ? <Settings size={20} /> : <Type size={20} />}
                      </button>
                  </div>
              </div>

              <div 
                className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col justify-start min-h-0 pt-20 pb-32"
                onClick={() => setShowControls(!showControls)}
              >
                  <p className="leading-loose font-serif whitespace-pre-wrap max-w-3xl mx-auto" style={{ fontSize: `${fontSize}px` }}>
                      {pages[currentPage]}
                  </p>
              </div>

              <div className={`absolute bottom-0 w-full p-4 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100 bg-gradient-to-t from-black/80 to-transparent' : 'opacity-0 pointer-events-none'}`}>
                  <div className="flex items-center justify-between text-white mb-2 max-w-3xl mx-auto">
                      <span className="text-xs font-mono truncate max-w-[150px]">{activeBook.title}</span>
                      <span className="text-xs font-mono">Page {currentPage + 1} / {totalPages}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 max-w-3xl mx-auto">
                      <button onClick={(e) => { e.stopPropagation(); handlePageChange(-1); }} disabled={currentPage === 0} className="p-3 bg-white/10 rounded-full disabled:opacity-30 hover:bg-white/20">
                          <ArrowLeft size={20} />
                      </button>
                      
                      <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-moncchichi-accent transition-all duration-300" style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }} />
                      </div>

                      <button onClick={(e) => { e.stopPropagation(); handlePageChange(1); }} disabled={currentPage === totalPages - 1} className="p-3 bg-white/10 rounded-full disabled:opacity-30 hover:bg-white/20">
                          <ArrowRight size={20} />
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 2. Library / Browse View
  return (
    <div className="flex flex-col h-full bg-moncchichi-bg text-moncchichi-text">
      {/* Header */}
      <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
          {ICONS.Back}
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
            <BookOpen size={20} className="text-moncchichi-accent"/> Grimoire
          </h2>
        </div>
        <div className="flex bg-moncchichi-surfaceAlt rounded-lg p-0.5 border border-moncchichi-border">
            <button 
                onClick={() => setMode('LIBRARY')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === 'LIBRARY' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec'}`}
            >
                My Books
            </button>
            <button 
                onClick={() => setMode('BROWSE')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === 'BROWSE' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec'}`}
            >
                Browse
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
          
          {mode === 'LIBRARY' && (
              <div className="space-y-4">
                  {/* Import Card */}
                  <button 
                    onClick={handleImport}
                    className="w-full p-4 border-2 border-dashed border-moncchichi-border hover:border-moncchichi-accent rounded-xl flex flex-col items-center justify-center gap-2 text-moncchichi-textSec hover:text-moncchichi-accent transition-colors group bg-moncchichi-surfaceAlt/30"
                  >
                      <div className="p-2 bg-moncchichi-surface rounded-full group-hover:scale-110 transition-transform">
                          <Plus size={24} />
                      </div>
                      <span className="text-sm font-bold">Import EPUB</span>
                      <span className="text-xs opacity-60">From device storage</span>
                  </button>

                  {/* Book Grid */}
                  <div className="grid grid-cols-2 gap-4">
                      {library.map(book => (
                          <div 
                            key={book.id}
                            onClick={() => openBook(book)}
                            className={`bg-moncchichi-surface border border-moncchichi-border rounded-xl overflow-hidden transition-all group relative ${book.isDownloading ? 'cursor-wait opacity-90' : 'hover:border-moncchichi-accent/50 cursor-pointer'}`}
                          >
                              <div className="aspect-[2/3] bg-moncchichi-surfaceAlt relative overflow-hidden">
                                  {book.coverUrl ? (
                                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-moncchichi-textSec">
                                          <BookOpen size={40} />
                                      </div>
                                  )}
                                  
                                  {/* Download Progress Overlay */}
                                  {book.isDownloading ? (
                                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10 p-4 backdrop-blur-sm">
                                          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
                                              <div className="h-full bg-moncchichi-accent transition-all duration-300 ease-out" style={{ width: `${book.downloadProgress || 0}%` }} />
                                          </div>
                                          <span className="text-xs font-bold text-white">{book.downloadProgress || 0}%</span>
                                          <span className="text-[9px] text-white/70 uppercase tracking-wider mt-1 animate-pulse">Downloading</span>
                                      </div>
                                  ) : (
                                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                          <div className="h-full bg-moncchichi-accent" style={{ width: `${book.progress}%` }} />
                                      </div>
                                  )}
                              </div>
                              
                              <div className="p-3">
                                  <h3 className="text-sm font-bold text-moncchichi-text line-clamp-1">{book.title}</h3>
                                  <p className="text-xs text-moncchichi-textSec line-clamp-1">{book.author}</p>
                                  <div className="flex justify-between items-center mt-2">
                                      <span className="text-[10px] bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded border border-moncchichi-border text-moncchichi-textSec">
                                          {book.isDownloading ? 'Wait...' : `${book.progress}% Read`}
                                      </span>
                                      {!book.isDownloading && (
                                          <button 
                                            onClick={(e) => handleDelete(book.id, e)}
                                            className="text-moncchichi-error opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-moncchichi-surfaceAlt rounded"
                                          >
                                              <Trash2 size={14} />
                                          </button>
                                      )}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {mode === 'BROWSE' && (
              <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex gap-2 sticky top-0 bg-moncchichi-bg z-10 py-2">
                      {browseState === 'RESULTS' && (
                          <button onClick={() => { setBrowseState('HOME'); setSearchQuery(''); }} className="p-2 bg-moncchichi-surface border border-moncchichi-border rounded-xl text-moncchichi-textSec">
                              <ChevronLeft size={20} />
                          </button>
                      )}
                      <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec" size={16} />
                          <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                            placeholder="Search Title, Author or Subject..."
                            className="w-full bg-moncchichi-surface border border-moncchichi-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-moncchichi-accent transition-colors text-moncchichi-text"
                          />
                      </div>
                      <button 
                        onClick={() => handleSearch(searchQuery)}
                        disabled={isSearching}
                        className="bg-moncchichi-accent text-moncchichi-bg px-4 rounded-xl font-bold text-sm disabled:opacity-50"
                      >
                          {isSearching ? '...' : 'Go'}
                      </button>
                  </div>

                  {/* Browse Home */}
                  {browseState === 'HOME' && (
                      <div className="space-y-6 animate-in fade-in">
                          
                          {/* Genres Grid */}
                          <div>
                              <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-3">Explore Genres</h3>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {GENRES.map(genre => (
                                      <button 
                                        key={genre.id}
                                        onClick={() => handleSearch(genre.id, true)}
                                        className="flex items-center gap-3 p-3 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt hover:border-moncchichi-accent/50 transition-all group"
                                      >
                                          <div className={`p-2 rounded-lg ${genre.color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
                                              {genre.icon}
                                          </div>
                                          <span className="text-sm font-bold">{genre.label}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* Top Downloads Slider */}
                          <div>
                              <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider">Top Grimoires</h3>
                                  <span className="text-[10px] text-moncchichi-textSec bg-moncchichi-surface px-2 py-1 rounded border border-moncchichi-border">Project Gutenberg</span>
                              </div>
                              <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 no-scrollbar snap-x">
                                  {popularBooks.length > 0 ? popularBooks.map(book => (
                                      <div 
                                        key={book.id} 
                                        className="snap-start shrink-0 w-32 flex flex-col gap-2 cursor-pointer group"
                                        onClick={() => handleDownload(book)}
                                      >
                                          <div className="w-32 h-48 bg-moncchichi-surfaceAlt rounded-lg overflow-hidden border border-moncchichi-border relative">
                                              {book.coverUrl ? <img src={book.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen className="text-moncchichi-textSec" /></div>}
                                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <Download className="text-white" />
                                              </div>
                                          </div>
                                          <span className="text-xs font-bold line-clamp-2 leading-tight">{book.title}</span>
                                      </div>
                                  )) : (
                                      <div className="w-full py-8 text-center text-xs text-moncchichi-textSec">Loading Popular Books...</div>
                                  )}
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Search Results */}
                  {browseState === 'RESULTS' && (
                      <div>
                          <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-3 flex items-center gap-2">
                              Results for <span className="text-moncchichi-accent">{currentCategory}</span>
                          </h3>
                          
                          <div className="space-y-3">
                              {searchResults.length === 0 && !isSearching && (
                                  <div className="text-center py-12 text-moncchichi-textSec opacity-50">
                                      <BookOpen size={48} className="mx-auto mb-3" />
                                      <p className="text-sm">No spells found in the archives.</p>
                                  </div>
                              )}
                              {searchResults.map(book => (
                                  <BookListCard key={book.id} book={book} />
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default Reader;
