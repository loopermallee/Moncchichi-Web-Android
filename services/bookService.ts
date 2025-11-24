

import { mockService } from './mockService';
import { storageService } from './storageService';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  description?: string;
  content?: string; // Actual text content (For Books)
  pages?: string[]; // Array of Image URLs (For Manga)
  downloadUrl?: string; // URL to fetch text from or View Link, OR MangaDex ID
  progress: number; // 0 to 100 (Reading)
  type: 'BOOK' | 'MANGA' | 'WEB'; // Added WEB for IFrame support
  source: 'LOCAL' | 'GUTENBERG' | 'GOOGLE' | 'STANDARD_EBOOKS' | 'OPEN_LIBRARY' | 'NLB' | 'MANGADEX';
  downloaded: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
  tags?: string[];
  readChapterIds?: string[]; // Track individual read chapters
}

export interface Chapter {
    id: string;
    chapter: string;
    title: string;
    pages: number;
    language: string;
}

class BookService {
  private library: Book[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.initLibrary();
  }

  private async initLibrary() {
    try {
        const books = await storageService.getAllItems<Book>('library');
        if (books && books.length > 0) {
            this.library = books;
        } else {
            const seedBook: Book = {
                id: 'manual-1',
                title: 'G1 Quick Start',
                author: 'Even Realities',
                description: 'Welcome to your new G1 glasses. This guide covers basic operations, HUD navigation, and safety information.',
                content: `Chapter 1: Introduction.\nWelcome to the future of eyewear.\n\nChapter 2: Navigation.\nLook up to activate the HUD. Use the touch bar to scroll.\n\nChapter 3: Safety.\nDo not use while operating heavy machinery.`,
                progress: 0,
                type: 'BOOK',
                source: 'LOCAL',
                downloaded: true,
                tags: ['Manual', 'System']
            };
            await this.addToLibrary(seedBook);
        }
        this.notifyListeners();
    } catch (e) {
        mockService.emitLog("BOOK", "ERROR", "Failed to load library from storage.");
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.push(callback);
    callback();
    return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
      this.listeners.forEach(l => l());
  }

  public async saveBook(book: Book) {
    try {
        const idx = this.library.findIndex(b => b.id === book.id);
        if (idx >= 0) this.library[idx] = book;
        else this.library.push(book);
        
        await storageService.saveItem('library', book);
        this.notifyListeners();
    } catch (e) {
        console.error("Save Book Error", e);
    }
  }

  public getLibrary(): Book[] {
    return this.library;
  }

  public getBookById(id: string): Book | undefined {
      return this.library.find(b => b.id === id);
  }

  public async addToLibrary(book: Book) {
      await this.saveBook(book);
  }

  public async updateProgress(id: string, progress: number) {
    const book = this.library.find(b => b.id === id);
    if (book) {
      book.progress = progress;
      await this.saveBook(book);
    }
  }

  // --- Read/Unread Management ---

  public async toggleChapterRead(bookId: string, chapterId: string, isRead: boolean) {
      // Find the book in library, if it exists. 
      // Note: In this architecture, "Manga Series" and "Downloaded Chapters" might be separate entries or merged.
      // We assume the Series ID holds the read state.
      
      let book = this.library.find(b => b.id === bookId);
      
      // If book isn't in library (just browsing), we might need to add it minimally to track read state,
      // OR we just ignore saving if not in library. 
      // Better UX: Add to library if user interacts with read state.
      if (!book) {
          // We need the full book object to save it. If the UI calls this, it should ensure book exists or pass it.
          // For now, we assume this is called on existing library items or we just return.
          // Ideally, the UI passes the full book object if it needs creation.
          return; 
      }

      const currentReads = new Set(book.readChapterIds || []);
      if (isRead) currentReads.add(chapterId);
      else currentReads.delete(chapterId);

      book.readChapterIds = Array.from(currentReads);
      await this.saveBook(book);
  }
  
  // Helper to sync read state if we are creating a book entry from scratch
  public async ensureBookInLibrary(book: Book) {
      if (!this.library.find(b => b.id === book.id)) {
          await this.saveBook(book);
      }
  }

  public isChapterRead(bookId: string, chapterId: string): boolean {
      const book = this.library.find(b => b.id === bookId);
      return book?.readChapterIds?.includes(chapterId) || false;
  }

  public async deleteBook(id: string) {
    this.library = this.library.filter(b => b.id !== id);
    await storageService.deleteItem('library', id);
    this.notifyListeners();
  }

  // --- ROBUST FETCHING (CORS FIX) ---
  private async fetchWithFallback(url: string, options: RequestInit = {}): Promise<Response> {
      // 1. Try CorsProxy.io (Fast, supports headers)
      try {
          // Note: encodeURIComponent is crucial for nested params
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
          const res = await fetch(proxyUrl, options);
          if (res.ok) return res;
      } catch (e) { /* continue to next fallback */ }

      // 2. Try AllOrigins (Get request only, returns JSON wrapper)
      try {
          if (!options.method || options.method === 'GET') {
              const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
              const res = await fetch(proxyUrl);
              if (res.ok) {
                  const data = await res.json();
                  if (data.contents) {
                      // Reconstruct a Response object so downstream code doesn't need to change
                      return new Response(data.contents, { 
                          status: 200, 
                          statusText: 'OK',
                          headers: { 'Content-Type': 'application/json' }
                      });
                  }
              }
          }
      } catch (e) { /* continue to next fallback */ }

      // 3. Try Direct (MangaDex sometimes works directly depending on browser/region)
      try {
          const res = await fetch(url, options);
          if (res.ok) return res;
      } catch (e) { /* continue */ }

      throw new Error(`Failed to load: ${url}`);
  }

  // --- MANGADEX SPECIFIC ---

  public async searchMangaDex(query: string): Promise<Book[]> {
      const cacheKey = `md_search_${query.trim().toLowerCase()}`;
      
      // Try Cache First
      const cached = await storageService.getCache<Book[]>(cacheKey);
      if (cached) return cached;

      try {
          const params = new URLSearchParams();
          params.append('title', query);
          params.append('limit', '15');
          params.append('includes[]', 'cover_art');
          params.append('contentRating[]', 'safe');
          params.append('order[relevance]', 'desc');
          // Add author includes to display artist
          params.append('includes[]', 'author');
          
          const url = `https://api.mangadex.org/manga?${params.toString()}`;
          const res = await this.fetchWithFallback(url);
          const data = await res.json();
          
          if (!data.data) return [];
          const results = data.data.map((m: any) => this.mapMangaDexItem(m));
          
          // Cache results for 30 minutes
          await storageService.setCache(cacheKey, results, 30);
          return results;
      } catch (e: any) { 
          mockService.emitLog("BOOK", "ERROR", `MangaDex Search Failed: ${e.message}`);
          throw e; // Rethrow so UI knows
      }
  }

  public async getPopularMangaDex(): Promise<Book[]> {
      const cacheKey = 'md_popular_manga';
      
      // Try Cache First
      const cached = await storageService.getCache<Book[]>(cacheKey);
      if (cached) return cached;

      try {
          const url = `https://api.mangadex.org/manga?limit=10&includes[]=cover_art&includes[]=author&order[followedCount]=desc&contentRating[]=safe`;
          const res = await this.fetchWithFallback(url);
          const data = await res.json();
          if (!data.data) return [];
          
          const results = data.data.map((m: any) => this.mapMangaDexItem(m));
          
          // Cache popular for 6 hours
          await storageService.setCache(cacheKey, results, 360);
          return results;
      } catch (e) { return []; }
  }

  private mapMangaDexItem(manga: any): Book {
      const attr = manga.attributes;
      const fileName = manga.relationships.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
      const authorName = manga.relationships.find((r: any) => r.type === 'author')?.attributes?.name || "Unknown Artist";
      
      const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : undefined;
      
      return {
          id: `md-${manga.id}`,
          title: attr.title?.en || Object.values(attr.title)[0] || "Unknown",
          author: authorName,
          description: attr.description?.en || "No description.",
          coverUrl: coverUrl,
          downloadUrl: manga.id, // Storing raw UUID here for fetching chapters
          progress: 0,
          type: 'MANGA',
          source: 'MANGADEX',
          downloaded: false,
          tags: attr.tags ? attr.tags.map((t: any) => t.attributes.name.en).slice(0, 3) : []
      };
  }

  public async getMangaChapters(mangaId: string): Promise<Chapter[]> {
      const cleanId = mangaId.replace('md-', ''); 
      const cacheKey = `md_chapters_${cleanId}`;

      // Try Cache First
      const cached = await storageService.getCache<Chapter[]>(cacheKey);
      if (cached) return cached;

      try {
          // Fetch English chapters, ordered by chapter number
          const url = `https://api.mangadex.org/manga/${cleanId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=50&includes[]=scanlation_group`;
          const res = await this.fetchWithFallback(url);
          const data = await res.json();
          
          const results = data.data.map((ch: any) => ({
              id: ch.id,
              chapter: ch.attributes.chapter || 'Oneshot',
              title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
              pages: ch.attributes.pages,
              language: ch.attributes.translatedLanguage
          }));

          // Cache chapters for 1 hour
          await storageService.setCache(cacheKey, results, 60);
          return results;
      } catch (e) {
          console.error("Chapter fetch failed", e);
          return [];
      }
  }

  public async getMangaChapterPages(chapterId: string): Promise<string[]> {
      const cacheKey = `md_pages_${chapterId}`;

      // Try Cache First
      const cached = await storageService.getCache<string[]>(cacheKey);
      if (cached) return cached;

      try {
          const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
          const res = await this.fetchWithFallback(url);
          const data = await res.json();
          
          const baseUrl = data.baseUrl;
          const hash = data.chapter.hash;
          // Use dataSaver for mobile/glasses bandwidth optimization
          const pages = data.chapter.dataSaver.map((file: string) => `${baseUrl}/data-saver/${hash}/${file}`);
          
          // Cache pages for 24 hours (links are stable)
          await storageService.setCache(cacheKey, pages, 1440);
          return pages;
      } catch (e) {
          console.error("Page fetch failed", e);
          return [];
      }
  }

  // --- EBOOK SOURCES ---

  public async searchOpenLibrary(query: string): Promise<Book[]> {
      try {
          const res = await this.fetchWithFallback(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
          const data = await res.json();
          return data.docs.map((item: any) => ({
              id: `ol-${item.key}`,
              title: item.title,
              author: item.author_name?.[0] || "Unknown",
              coverUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : undefined,
              description: `First published: ${item.first_publish_year}`,
              type: 'WEB', // Changed to WEB for iframe embedding
              source: 'OPEN_LIBRARY',
              progress: 0,
              downloaded: false,
              // Use archive.org viewer if possible, or openlibrary page
              downloadUrl: item.ia ? `https://archive.org/stream/${item.ia[0]}` : `https://openlibrary.org${item.key}`,
              tags: item.subject ? item.subject.slice(0, 3) : []
          }));
      } catch (e) { return []; }
  }

  public async searchStandardEbooks(query: string): Promise<Book[]> {
       try {
          // Gutendex Proxy
          const res = await this.fetchWithFallback(`https://gutendex.com/books?search=${encodeURIComponent(query)}`);
          const data = await res.json();
          return data.results.map((item: any) => ({
              id: `guten-${item.id}`,
              title: item.title,
              author: item.authors?.[0]?.name || "Unknown",
              coverUrl: item.formats['image/jpeg'],
              // Prefer text/plain for in-app reading, fallback to html or epub
              downloadUrl: item.formats['text/plain; charset=utf-8'] || item.formats['text/plain'] || item.formats['text/html'],
              description: "Project Gutenberg / Public Domain",
              type: 'BOOK',
              source: 'STANDARD_EBOOKS',
              progress: 0,
              downloaded: false,
              tags: item.subjects ? item.subjects.slice(0, 2) : []
          }));
      } catch (e) { return []; }
  }

  public async searchGoogleBooks(query: string): Promise<Book[]> {
    try {
      const res = await this.fetchWithFallback(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&filter=free-ebooks`);
      const data = await res.json();
      if (!data.items) return [];
      return data.items.map((item: any) => {
        const info = item.volumeInfo || {};
        return {
            id: item.id,
            title: info.title || "Untitled",
            author: info.authors?.join(', ') || 'Unknown',
            coverUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:'),
            description: info.description,
            content: item.searchInfo?.textSnippet, 
            progress: 0,
            type: 'WEB', // Google Books usually requires their viewer
            source: 'GOOGLE',
            downloaded: false,
            downloadUrl: info.previewLink,
            tags: info.categories || []
        };
      });
    } catch (e) { return []; }
  }

  // --- DOWNLOAD LOGIC ---

  public async downloadBook(book: Book, chapterId?: string): Promise<void> {
      if (book.isDownloading) return;

      // Create a persistent ID for library if this is a search result
      const libraryBook = { ...book, isDownloading: true, downloadProgress: 0 };
      
      // If adding from search, ensure ID is unique for the library
      // For Manga, we usually add the series, but if downloading a chapter we might need a distinct entry? 
      // Current logic: We save the SERIES as the book in library. When 'reading', we stream.
      // If 'downloading' a chapter, we save the series but cache the images.
      
      // FIX: If fetching text content for reading
      if (book.type === 'BOOK' && book.downloadUrl) {
          await this.saveBook(libraryBook);
          try {
             await this.downloadTextBook(libraryBook);
             libraryBook.downloaded = true;
             mockService.emitLog("BOOK", "INFO", `Downloaded text for "${libraryBook.title}"`);
          } catch(e) {
             console.error(e);
             mockService.emitLog("BOOK", "ERROR", "Failed to download text");
             libraryBook.isDownloading = false;
             await this.saveBook(libraryBook);
             throw e;
          }
      }
      
      // For Manga Chapter Download
      if (book.type === 'MANGA' && chapterId) {
          // We create a specific entry for this chapter in the library to access it offline
          // OR we append it to the series. For simplicity, we create a new entry "Series - Ch X"
          libraryBook.id = `${book.id}-ch${chapterId}`;
          await this.saveBook(libraryBook);
          
          try {
              await this.downloadMangaChapter(libraryBook, chapterId);
              libraryBook.downloaded = true;
              mockService.emitLog("BOOK", "INFO", `Downloaded chapter for "${libraryBook.title}"`);
          } catch(e) {
               mockService.emitLog("BOOK", "ERROR", "Failed to download chapter");
               await this.deleteBook(libraryBook.id);
               throw e;
          }
      }

      libraryBook.isDownloading = false;
      await this.saveBook(libraryBook);
  }

  public async fetchBookContent(book: Book): Promise<string> {
      if (book.content) return book.content;
      if (!book.downloadUrl) return "No content available.";
      
      try {
          const res = await this.fetchWithFallback(book.downloadUrl);
          const text = await res.text();
          return text;
      } catch (e) {
          return "Failed to load content. Please check internet connection.";
      }
  }

  private async downloadTextBook(book: Book) {
      if (!book.downloadUrl) throw new Error("No download URL");
      book.downloadProgress = 10; await this.saveBook(book);

      const response = await this.fetchWithFallback(book.downloadUrl);
      const text = await response.text();
      
      book.content = text;
      book.downloadProgress = 100;
  }

  private async downloadMangaChapter(book: Book, chapterId: string) {
       const pages = await this.getMangaChapterPages(chapterId);
       if (pages.length === 0) throw new Error("No pages found");

       const total = pages.length;
       
       // Cache all pages
       for (let i = 0; i < total; i++) {
          await storageService.cacheImage(pages[i]);
          book.downloadProgress = Math.round(((i + 1) / total) * 100);
          this.notifyListeners();
       }
       
       book.pages = pages;
       book.downloadUrl = chapterId; 
  }

  // Stubbing the rest to satisfy interface if called
  public async searchGutenberg(query: string): Promise<Book[]> { return this.searchStandardEbooks(query); }
  public async getPopularGutenberg(): Promise<Book[]> { return []; }
  public async getPopularGoogleBooks(): Promise<Book[]> { return []; }
  public async getPopularStandardEbooks(): Promise<Book[]> { return this.searchStandardEbooks("classic"); }
  public async getPopularOpenLibrary(): Promise<Book[]> { return this.searchOpenLibrary("trending"); }
  public async getBooksBySubject(subject: string): Promise<Book[]> { return this.searchOpenLibrary(subject); }
  public async uploadLocalBook(type: 'BOOK' | 'MANGA'): Promise<Book | null> { return null; }
}

export const bookService = new BookService();
