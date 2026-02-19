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

    const response = await fetch(
      `${this.WIKIPEDIA_API_URL}?action=query&format=json&prop=extracts|info&exintro&explaintext&titles=${encodeURIComponent(
        query
      )}&inprop=url`
    );

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

