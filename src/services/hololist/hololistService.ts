import axios from "axios";
import * as cheerio from "cheerio";

class HololistService {
  private BASE_URL = "https://hololist.net"

  /**
   * Searches for VTuber links based on the provided parameters.
   * @param params - Partial object containing search parameters.
   * @returns A promise that resolves to an array of VTuberLink objects.
   */
  async search(params: Partial<SearchParams> = {}): Promise<VTuberLink[]> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value);
      });

      const url = `${this.BASE_URL}/?${searchParams.toString()}`;
      const response = await axios.get(url, {
        responseType: "text",
        headers: {
          Accept: "text/html",
        },
      });

      const $ = cheerio.load(response.data);
      const links: VTuberLink[] = [];

      // Extracting VTuber links from the page
      $(".vtuber-card a").each((_, element) => {
        const $link = $(element);
        const href = $link.attr("href");
        if (href) {
          links.push({
            url: href.replace(`${this.BASE_URL}/`, "").replace("/", ""),
            name: $link.attr("title") || "",
          });
        }
      });

      return links;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.message);
      }
      throw new Error("Internal Server Error");
    }
  }
}
export default new HololistService();

// TODO: Define the SearchParams interface to match the expected query parameters
export interface SearchParams {
  s?: string;
  type?: string;
  category_name?: string;
  group?: string;
  link?: string;
  content?: string;
  language?: string;
  gender?: string;
  zodiac?: string;
  model?: string;
  status?: string;
  sort?: string;
}

interface VTuberLink {
  url: string;
  name: string;
}
