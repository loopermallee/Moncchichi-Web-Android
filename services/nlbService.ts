
import { mockService } from './mockService';

export interface NLBLibrary {
  branchCode: string;
  branchName: string;
  type: 'Public' | 'Regional' | 'National';
  region: string;
  status: 'OPEN' | 'CLOSED';
  operatingHours: string;
  crowd?: 'Low' | 'Moderate' | 'High';
}

export interface NLBItem {
  id: string;
  title: string;
  author: string;
  format: 'Book' | 'EBook' | 'AudioBook';
  coverUrl?: string;
  availabilityStatus: 'Available' | 'On Loan' | 'Reference Only';
  branch?: string; // For physical
  callNumber?: string;
  url?: string; // For digital
}

class NlbService {
    // Mock Data for Libraries
    private libraries: NLBLibrary[] = [
        { branchCode: 'NL', branchName: 'National Library (Lee Kong Chian)', type: 'National', region: 'Central', status: 'OPEN', operatingHours: '10:00 AM - 09:00 PM', crowd: 'Moderate' },
        { branchCode: 'JRL', branchName: 'Jurong Regional Library', type: 'Regional', region: 'West', status: 'OPEN', operatingHours: '10:00 AM - 09:00 PM', crowd: 'High' },
        { branchCode: 'WRL', branchName: 'Woodlands Regional Library', type: 'Regional', region: 'North', status: 'OPEN', operatingHours: '10:00 AM - 09:00 PM', crowd: 'Low' },
        { branchCode: 'TRL', branchName: 'Tampines Regional Library', type: 'Regional', region: 'East', status: 'OPEN', operatingHours: '10:00 AM - 09:00 PM', crowd: 'Moderate' },
        { branchCode: 'LL', branchName: 'library@orchard', type: 'Public', region: 'Central', status: 'OPEN', operatingHours: '11:00 AM - 09:00 PM', crowd: 'High' },
        { branchCode: 'BPL', branchName: 'Bedok Public Library', type: 'Public', region: 'East', status: 'OPEN', operatingHours: '10:00 AM - 09:00 PM', crowd: 'Low' },
        { branchCode: 'TPPL', branchName: 'Toa Payoh Public Library', type: 'Public', region: 'Central', status: 'OPEN', operatingHours: '10:00 AM - 09:00 PM', crowd: 'Moderate' },
        { branchCode: 'MPPL', branchName: 'Marine Parade Public Library', type: 'Public', region: 'East', status: 'CLOSED', operatingHours: '10:00 AM - 09:00 PM', crowd: 'Low' },
    ];

    // Mock Data for Recommendations
    private recommendations: NLBItem[] = [
        { id: 'rec-1', title: 'Singapore: A Biography', author: 'Yu-Mei Balasingamchow', format: 'Book', availabilityStatus: 'Available', branch: 'National Library', callNumber: '959.57 SIN' },
        { id: 'rec-2', title: 'The Art of Charlie Chan Hock Chye', author: 'Sonny Liew', format: 'Book', availabilityStatus: 'On Loan', branch: 'Jurong Regional Library', callNumber: '741.5 LIE' },
        { id: 'rec-3', title: 'Ministry of Moral Panic', author: 'Amanda Lee Koe', format: 'EBook', availabilityStatus: 'Available', url: 'https://nlb.overdrive.com' },
        { id: 'rec-4', title: 'Puntino', author: 'Fellaini', format: 'AudioBook', availabilityStatus: 'Available', url: 'https://nlb.libbyapp.com' },
        { id: 'rec-5', title: 'The Singapore Story', author: 'Lee Kuan Yew', format: 'Book', availabilityStatus: 'Reference Only', branch: 'National Library', callNumber: '959.57 LEE' },
    ];

    // STUB: Get Libraries
    async getLibraries(query: string = ""): Promise<NLBLibrary[]> {
        mockService.emitLog('NLB', 'INFO', 'Fetching Library Branches...');
        await new Promise(r => setTimeout(r, 600)); // Sim delay
        if (!query) return this.libraries;
        const lower = query.toLowerCase();
        return this.libraries.filter(l => l.branchName.toLowerCase().includes(lower) || l.region.toLowerCase().includes(lower));
    }

    // STUB: Catalogue Search (Physical Items)
    async searchCatalogue(query: string): Promise<NLBItem[]> {
        mockService.emitLog('NLB', 'INFO', `Catalogue Search: "${query}"`);
        await new Promise(r => setTimeout(r, 800)); // Sim delay
        
        // Return synthetic results
        return [
            {
                id: `phys-${Date.now()}-1`,
                title: `${query}: A Complete Guide`,
                author: 'Dr. Alex Chen',
                format: 'Book',
                availabilityStatus: 'Available',
                branch: 'Jurong Regional Library',
                callNumber: '621.3 CHE',
            },
            {
                id: `phys-${Date.now()}-2`,
                title: `The History of ${query}`,
                author: 'Sarah Tan',
                format: 'Book',
                availabilityStatus: 'On Loan',
                branch: 'Tampines Regional Library',
                callNumber: '959.57 TAN',
            },
            {
                id: `phys-${Date.now()}-3`,
                title: `Advanced ${query} Techniques`,
                author: 'James Wong',
                format: 'Book',
                availabilityStatus: 'Available',
                branch: 'library@orchard',
                callNumber: '700 WON',
            }
        ];
    }

    // STUB: eResource Search (Digital Items)
    async searchEResources(query: string): Promise<NLBItem[]> {
        mockService.emitLog('NLB', 'INFO', `eResource Search: "${query}"`);
        await new Promise(r => setTimeout(r, 600)); // Sim delay

        return [
            {
                id: `ebook-${Date.now()}-1`,
                title: `Digital ${query} (2nd Ed.)`,
                author: 'Tech Press',
                format: 'EBook',
                availabilityStatus: 'Available',
                url: 'https://nlb.overdrive.com',
            },
            {
                id: `audio-${Date.now()}-1`,
                title: `${query} for Beginners`,
                author: 'Narrator John',
                format: 'AudioBook',
                availabilityStatus: 'Available',
                url: 'https://nlb.libbyapp.com',
            },
             {
                id: `ebook-${Date.now()}-2`,
                title: `Understanding ${query}`,
                author: 'Prof. Lim',
                format: 'EBook',
                availabilityStatus: 'On Loan',
                url: 'https://nlb.overdrive.com',
            }
        ];
    }

    // STUB: Recommendations
    async getRecommendations(): Promise<NLBItem[]> {
        mockService.emitLog('NLB', 'INFO', 'Fetching Recommendations...');
        await new Promise(r => setTimeout(r, 500));
        return this.recommendations;
    }
}

export const nlbService = new NlbService();
