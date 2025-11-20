
import { mockService } from './mockService';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  description?: string;
  content?: string; // Actual text content
  downloadUrl?: string; // URL to fetch text from
  progress: number; // 0 to 100 (Reading)
  source: 'LOCAL' | 'GUTENBERG' | 'GOOGLE';
  downloaded: boolean;
  // New fields for tracking download state
  isDownloading?: boolean;
  downloadProgress?: number; 
}

const STORAGE_KEY = 'moncchichi_library';

class BookService {
  private library: Book[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadLibrary();
  }

  private loadLibrary() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const loaded = JSON.parse(stored) as Book[];
        // Clean up interrupted downloads on load to prevent stuck UI
        this.library = loaded.filter(b => !b.isDownloading);
      } else {
        // Seed with a manual
        this.library = [{
          id: 'manual-1',
          title: 'G1 Quick Start',
          author: 'Even Realities',
          description: 'Welcome to your new G1 glasses. This guide covers basic operations, HUD navigation, and safety information.',
          content: `Chapter 1: Introduction.\nWelcome to the future of eyewear. The Even Realities G1 glasses are designed to seamlessly integrate digital information into your physical world.\n\nChapter 2: Navigation.\nLook up to activate the HUD. Use the touch bar on the right temple to scroll. Tap to select.\n\nChapter 3: Safety.\nDo not use while operating heavy machinery. Ensure the lenses are clean for optimal projection clarity.`,
          progress: 0,
          source: 'LOCAL',
          downloaded: true
        }];
      }
    } catch (e) {
      this.library = [];
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.push(callback);
    // Initial sync
    callback();
    return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
      this.listeners.forEach(l => l());
  }

  private saveLibrary() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.library));
        this.notifyListeners();
    } catch (e) {
        mockService.emitLog("BOOK", "ERROR", "Storage quota exceeded. Delete books to free space.");
    }
  }

  public getLibrary(): Book[] {
    return this.library;
  }

  public addToLibrary(book: Book) {
    const existingIndex = this.library.findIndex(b => b.id === book.id);
    if (existingIndex >= 0) {
        this.library[existingIndex] = book;
    } else {
        this.library.push(book);
    }
    this.saveLibrary();
  }
  
  // Update state in memory and notify UI, but skip heavy localStorage writes for high-frequency updates (like progress)
  private updateBookState(book: Book) {
      const idx = this.library.findIndex(b => b.id === book.id);
      if (idx !== -1) {
          this.library[idx] = book;
          this.notifyListeners(); 
      }
  }

  public updateProgress(id: string, progress: number) {
    const book = this.library.find(b => b.id === id);
    if (book) {
      book.progress = progress;
      this.saveLibrary();
    }
  }

  public async deleteBook(id: string) {
    this.library = this.library.filter(b => b.id !== id);
    this.saveLibrary();
  }

  public async searchGoogleBooks(query: string): Promise<Book[]> {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&filter=free-ebooks`);
      const data = await res.json();
      
      if (!data.items) return [];

      return data.items.map((item: any) => ({
        id: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown',
        coverUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
        description: item.volumeInfo.description || 'No description available.',
        content: item.volumeInfo.description ? `${item.volumeInfo.title}\n\n${item.volumeInfo.description}\n\n[Note: Full text API access restricted by Google Books. Try Gutenberg for full books.]` : 'Preview not available.', 
        progress: 0,
        source: 'GOOGLE',
        downloaded: false
      }));
    } catch (e) {
      mockService.emitLog('BOOK', 'ERROR', 'Google Books search failed');
      return [];
    }
  }

  public async searchGutenberg(query: string): Promise<Book[]> {
    try {
      const res = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!data.results) return [];

      return this.mapGutendexResults(data.results);
    } catch (e) {
      mockService.emitLog('BOOK', 'ERROR', 'Gutenberg search failed');
      return [];
    }
  }

  // New: Get Popular from Gutenberg
  public async getPopularGutenberg(): Promise<Book[]> {
      try {
          const res = await fetch(`https://gutendex.com/books?sort=popular`);
          const data = await res.json();
          if (!data.results) return [];
          return this.mapGutendexResults(data.results).slice(0, 10);
      } catch (e) {
          return [];
      }
  }

  // New: Search by Subject (Google Books)
  public async getBooksBySubject(subject: string): Promise<Book[]> {
      try {
          const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(subject)}&filter=free-ebooks&orderBy=newest`);
          const data = await res.json();
          if (!data.items) return [];

          return data.items.map((item: any) => ({
              id: item.id,
              title: item.volumeInfo.title,
              author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown',
              coverUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
              description: item.volumeInfo.description || 'No description.',
              content: undefined,
              progress: 0,
              source: 'GOOGLE',
              downloaded: false
          }));
      } catch (e) {
          return [];
      }
  }

  private mapGutendexResults(results: any[]): Book[] {
      return results.map((item: any) => {
        const formats = item.formats;
        let textUrl = formats['text/plain; charset=utf-8'] || 
                      formats['text/plain'] || 
                      formats['text/plain; charset=us-ascii'];
                      
        if (!textUrl) {
            const possibleKey = Object.keys(formats).find(k => k.includes('text/plain'));
            if (possibleKey) textUrl = formats[possibleKey];
        }
        
        if (!textUrl) {
            textUrl = Object.values(formats).find((v: any) => typeof v === 'string' && v.endsWith('.txt'));
        }

        const coverUrl = formats['image/jpeg'] || formats['image/png'];

        return {
            id: `guten-${item.id}`,
            title: item.title,
            author: item.authors.length > 0 ? item.authors[0].name : 'Unknown',
            coverUrl: coverUrl,
            description: `Public Domain eBook. Downloads: ${item.download_count}`,
            downloadUrl: textUrl, 
            content: undefined, 
            progress: 0,
            source: 'GUTENBERG',
            downloaded: false
        };
      });
  }

  public async downloadBook(book: Book): Promise<Book> {
      // 1. Check if already downloaded
      const existing = this.library.find(b => b.id === book.id);
      if (existing && existing.downloaded) return existing;

      // 2. Init downloading state and add to library immediately
      const downloadingBook: Book = {
          ...book,
          isDownloading: true,
          downloadProgress: 0,
          downloaded: false,
      };
      this.addToLibrary(downloadingBook);

      if (book.source === 'GUTENBERG' && book.downloadUrl) {
          try {
              mockService.emitLog("BOOK", "INFO", `Downloading ${book.title}...`);
              
              const fetchWithProgress = async (url: string) => {
                  const response = await fetch(url);
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  
                  const contentLength = response.headers.get('content-length');
                  const total = contentLength ? parseInt(contentLength, 10) : 0;
                  
                  // Fallback if streams aren't supported or body is missing
                  if (!response.body) {
                      const text = await response.text();
                      downloadingBook.downloadProgress = 50;
                      this.updateBookState(downloadingBook);
                      return text;
                  }
                  
                  const reader = response.body.getReader();
                  let received = 0;
                  const chunks = [];
                  
                  while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      
                      chunks.push(value);
                      received += value.length;
                      
                      if (total > 0) {
                          downloadingBook.downloadProgress = Math.min(99, Math.floor((received / total) * 100));
                      } else {
                          // Simulated progress increment if no content-length available
                          const current = downloadingBook.downloadProgress || 0;
                          downloadingBook.downloadProgress = Math.min(95, current + 2);
                      }
                      // Update UI frequently
                      this.updateBookState(downloadingBook);
                  }
                  
                  const allChunks = new Uint8Array(received);
                  let pos = 0;
                  for (const chunk of chunks) {
                      allChunks.set(chunk, pos);
                      pos += chunk.length;
                  }
                  
                  return new TextDecoder("utf-8").decode(allChunks);
              };

              let text = '';
              try {
                  text = await fetchWithProgress(`https://api.allorigins.win/raw?url=${encodeURIComponent(book.downloadUrl)}`);
              } catch (e) {
                  mockService.emitLog("BOOK", "WARN", "Primary proxy failed, trying fallback...");
                  text = await fetchWithProgress(`https://corsproxy.io/?${encodeURIComponent(book.downloadUrl)}`);
              }

              // Validate
              if (!text || text.length < 500) {
                  throw new Error("Download failed: Content empty or too short.");
              }
              
              // Truncate if too large for local storage
              const MAX_CHARS = 300000; 
              const cleanText = text.length > MAX_CHARS
                ? text.substring(0, MAX_CHARS) + "\n\n[...Book truncated due to browser storage limits...]" 
                : text;

              // Finalize
              downloadingBook.content = cleanText;
              downloadingBook.downloaded = true;
              downloadingBook.isDownloading = false;
              downloadingBook.downloadProgress = 100;
              
              this.addToLibrary(downloadingBook);
              return downloadingBook;

          } catch (e: any) {
              mockService.emitLog("BOOK", "ERROR", `Failed to download ${book.title}`);
              this.deleteBook(book.id); // Remove failed download from library
              throw e;
          }
      } else {
          // Google Books or others without direct text download
          const newBook = { 
              ...book, 
              downloaded: true, 
              content: book.content || book.description || "No content.",
              isDownloading: false,
              downloadProgress: 100
          };
          this.addToLibrary(newBook);
          return newBook;
      }
  }

  public async uploadLocalBook(): Promise<Book | null> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const newBook: Book = {
                id: `local-${Date.now()}`,
                title: "Imported Document",
                author: "User Upload",
                description: "Locally imported EPUB file.",
                content: "This content was imported from a local file. The Reader engine handles pagination and text reflow automatically.",
                progress: 0,
                source: 'LOCAL',
                downloaded: true,
                isDownloading: false,
                downloadProgress: 100
            };
            this.addToLibrary(newBook);
            resolve(newBook);
        }, 1000);
    });
  }
}

export const bookService = new BookService();
