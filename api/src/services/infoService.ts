interface WikipediaPage {
  title: string;
  extract: string;
  fullurl: string;
  missing?: boolean;
}

interface WikipediaApiResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
}

interface InfoResult {
  title: string;
  intro: string;
  url: string;
}

class InfoService {
  private static instance: InfoService;
  private readonly WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): InfoService {
    if (!InfoService.instance) {
      InfoService.instance = new InfoService();
    }
    return InfoService.instance;
  }

  /**
   * Fetch information from Wikipedia
   */
  public async getInfo(query: string): Promise<InfoResult> {
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string.');
    }

    const url = new URL(this.WIKIPEDIA_API_URL);
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('prop', 'extracts|info');
    url.searchParams.set('exintro', '1');
    url.searchParams.set('explaintext', '1');
    url.searchParams.set('titles', query);
    url.searchParams.set('inprop', 'url');
    url.searchParams.set('redirects', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TripTracker/1.0' },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data from Wikipedia.');
    }

    const data = (await response.json()) as WikipediaApiResponse;

    const pages = data.query?.pages;
    if (!pages) {
      throw new Error('No results found.');
    }

    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    if (!page || page.missing) {
      throw new Error('Page not found.');
    }

    return {
      title: page.title,
      intro: page.extract,
      url: page.fullurl,
    };
  }
}

export const infoService = InfoService.getInstance();
