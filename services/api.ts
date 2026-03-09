import AsyncStorage from "@react-native-async-storage/async-storage";
import CookieManager from "@react-native-cookies/cookies";
import ReactNativeBlobUtil from "react-native-blob-util";

// region: --- Interface Definitions ---
export interface DoubanItem {
  id?: string;
  title: string;
  poster: string;
  rate?: string;
  year?: string;
}

export interface DoubanResponse {
  code: number;
  message: string;
  list: DoubanItem[];
}

export interface DoubanCategoryParams {
  kind: "movie" | "tv";
  category: string;
  type: string;
  limit?: number;
  start?: number;
}

export interface VideoDetail {
  id: string;
  title: string;
  poster: string;
  episodes: string[];
  source: string;
  source_name: string;
  desc?: string;
  type?: string;
  type_name?: string;
  class?: string;
  year?: string;
  area?: string;
  director?: string;
  actor?: string;
  remarks?: string;
}

export interface SearchResult {
  id: string | number;
  title: string;
  poster: string;
  episodes: string[];
  source: string;
  source_name: string;
  class?: string;
  year: string;
  desc?: string;
  type_name?: string;
}

export interface Favorite {
  cover: string;
  title: string;
  source_name: string;
  total_episodes: number;
  search_title: string;
  year: string;
  save_time?: number;
}

export interface PlayRecord {
  title: string;
  source_name: string;
  cover: string;
  index: number;
  total_episodes: number;
  play_time: number;
  total_time: number;
  save_time: number;
  year: string;
}

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

export interface ServerConfig {
  SiteName: string;
  StorageType: "localstorage" | "redis" | string;
}

interface SavedLoginCredentials {
  username: string;
  password: string;
}

const LOGIN_CREDENTIALS_STORAGE_KEY = "mytv_login_credentials";

export class API {
  public baseURL: string = "";

  private normalizeTitle(value: string): string {
    return value.replace(/\s+/g, "").trim().toLowerCase();
  }

  private extractCookieHeader(rawCookies: string): string {
    return rawCookies
      .split(/,(?=[^;,]+=)/)
      .map((cookie) => cookie.split(";")[0]?.trim() ?? "")
      .filter(Boolean)
      .join("; ");
  }

  private buildCookieHeaderFromStore(cookies: Record<string, { value?: string }>): string {
    return Object.entries(cookies)
      .map(([name, cookie]) => {
        if (!cookie?.value) {
          return "";
        }

        return `${name}=${cookie.value}`;
      })
      .filter(Boolean)
      .join("; ");
  }

  private getSetCookieHeaderFromRawHeaders(rawHeaders: string): string | null {
    const cookieLines = rawHeaders
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().startsWith("set-cookie:"))
      .map((line) => line.slice(line.indexOf(":") + 1).trim())
      .filter(Boolean);

    if (cookieLines.length === 0) {
      return null;
    }

    return cookieLines.join(", ");
  }

  private getSetCookieHeaderFromHeaderObject(headers: Record<string, string | string[] | undefined>): string | null {
    const mappedHeader = headers["set-cookie"] ?? headers["Set-Cookie"];
    if (Array.isArray(mappedHeader)) {
      return mappedHeader.join(", ");
    }

    return mappedHeader ?? null;
  }

  private async sendLoginRequest(body: string): Promise<{ status: number; responseText: string; setCookieHeader: string | null }> {
    const response = await ReactNativeBlobUtil.fetch("POST", `${this.baseURL}/api/login`, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }, body);

    const responseInfo = response.info();
    const setCookieHeader = this.getSetCookieHeaderFromHeaderObject(responseInfo.headers)
      ?? this.getSetCookieHeaderFromRawHeaders(responseInfo.headers?.toString?.() ?? "");

    return {
      status: responseInfo.status,
      responseText: await response.text(),
      setCookieHeader,
    };
  }

  private async getSavedLoginCredentials(): Promise<SavedLoginCredentials | null> {
    try {
      const rawValue = await AsyncStorage.getItem(LOGIN_CREDENTIALS_STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as Partial<SavedLoginCredentials>;
      if (!parsedValue.password) {
        return null;
      }

      return {
        username: parsedValue.username ?? "",
        password: parsedValue.password,
      };
    } catch {
      return null;
    }
  }

  private async tryReloginWithSavedCredentials(): Promise<boolean> {
    const savedCredentials = await this.getSavedLoginCredentials();
    if (!savedCredentials) {
      return false;
    }

    try {
      const loginResult = await this.login(savedCredentials.username, savedCredentials.password);
      return !!loginResult.ok;
    } catch {
      return false;
    }
  }

  private async blobRequestJson<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "DELETE";
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
      retryOnUnauthorized?: boolean;
    } = {}
  ): Promise<T> {
    if (!this.baseURL) {
      throw new Error("API_URL_NOT_SET");
    }

    if (options.signal?.aborted) {
      throw new Error("ABORTED");
    }

    let authCookies = await AsyncStorage.getItem("authCookies");
    if (!authCookies) {
      authCookies = await this.getNativeCookieHeader();
      if (authCookies) {
        await AsyncStorage.setItem("authCookies", authCookies);
      }
    }

    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      ...(options.headers ?? {}),
    };

    if (authCookies && !headers.Cookie) {
      await this.syncCookieHeaderToNative(authCookies);
      headers.Cookie = authCookies;
    }

    const method = options.method ?? "GET";
    const response = options.body === undefined
      ? await ReactNativeBlobUtil.fetch(method, `${this.baseURL}${path}`, headers)
      : await ReactNativeBlobUtil.fetch(method, `${this.baseURL}${path}`, headers, options.body);

    if (options.signal?.aborted) {
      throw new Error("ABORTED");
    }

    const responseInfo = response.info();
    const setCookieHeader = this.getSetCookieHeaderFromHeaderObject(responseInfo.headers)
      ?? this.getSetCookieHeaderFromRawHeaders(responseInfo.headers?.toString?.() ?? "");

    if (setCookieHeader) {
      await this.syncCookieHeaderToNative(setCookieHeader);
      await AsyncStorage.setItem("authCookies", this.extractCookieHeader(setCookieHeader));
    }

    if (responseInfo.status === 401) {
      await AsyncStorage.setItem("authCookies", "");
      await this.clearNativeCookies();

      if (options.retryOnUnauthorized !== false) {
        const reloginSucceeded = await this.tryReloginWithSavedCredentials();
        if (reloginSucceeded) {
          return this.blobRequestJson<T>(path, {
            ...options,
            retryOnUnauthorized: false,
          });
        }
      }

      throw new Error("UNAUTHORIZED");
    }

    if (responseInfo.status < 200 || responseInfo.status >= 300) {
      throw new Error(`HTTP error! status: ${responseInfo.status}`);
    }

    return JSON.parse(await response.text()) as T;
  }

  private async getNativeCookieHeader(): Promise<string> {
    try {
      const nativeCookies = await CookieManager.get(this.baseURL);
      return this.buildCookieHeaderFromStore(nativeCookies);
    } catch {
      return "";
    }
  }

  private async syncCookieHeaderToNative(cookieHeader: string): Promise<void> {
    if (!cookieHeader) {
      return;
    }

    try {
      await CookieManager.setFromResponse(this.baseURL, cookieHeader);
    } catch {
      return;
    }
  }

  private async clearNativeCookies(): Promise<void> {
    try {
      await CookieManager.clearAll();
    } catch {
      return;
    }
  }

  constructor(baseURL?: string) {
    if (baseURL) {
      this.baseURL = baseURL;
    }
  }

  public setBaseUrl(url: string) {
    this.baseURL = url;
  }

  async login(username?: string | undefined, password?: string): Promise<{ ok: boolean }> {
    if (!this.baseURL) {
      throw new Error("API_URL_NOT_SET");
    }

    const { status, responseText, setCookieHeader } = await this.sendLoginRequest(JSON.stringify({ username, password }));

    if (status === 401) {
      await AsyncStorage.setItem("authCookies", "");
      await this.clearNativeCookies();
      throw new Error("UNAUTHORIZED");
    }

    if (status < 200 || status >= 300) {
      throw new Error(`HTTP error! status: ${status}`);
    }

    if (setCookieHeader) {
      await this.syncCookieHeaderToNative(setCookieHeader);
      await AsyncStorage.setItem("authCookies", this.extractCookieHeader(setCookieHeader));
    }

    const nativeCookieHeader = await this.getNativeCookieHeader();
    if (nativeCookieHeader) {
      await AsyncStorage.setItem("authCookies", nativeCookieHeader);
    }

    return JSON.parse(responseText) as { ok: boolean };
  }

  async logout(): Promise<{ ok: boolean }> {
    const result = await this.blobRequestJson<{ ok: boolean }>("/api/logout", {
      method: "POST",
    });
    await AsyncStorage.setItem("authCookies", '');
    await this.clearNativeCookies();
    return result;
  }

  async getServerConfig(): Promise<ServerConfig> {
    return this.blobRequestJson<ServerConfig>("/api/server-config");
  }

  async getFavorites(key?: string): Promise<Record<string, Favorite> | Favorite | null> {
    const url = key ? `/api/favorites?key=${encodeURIComponent(key)}` : "/api/favorites";
    return this.blobRequestJson<Record<string, Favorite> | Favorite | null>(url);
  }

  async addFavorite(key: string, favorite: Omit<Favorite, "save_time">): Promise<{ success: boolean }> {
    return this.blobRequestJson<{ success: boolean }>("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, favorite }),
    });
  }

  async deleteFavorite(key?: string): Promise<{ success: boolean }> {
    const url = key ? `/api/favorites?key=${encodeURIComponent(key)}` : "/api/favorites";
    return this.blobRequestJson<{ success: boolean }>(url, { method: "DELETE" });
  }

  async getPlayRecords(): Promise<Record<string, PlayRecord>> {
    return this.blobRequestJson<Record<string, PlayRecord>>("/api/playrecords");
  }

  async savePlayRecord(key: string, record: Omit<PlayRecord, "save_time">): Promise<{ success: boolean }> {
    return this.blobRequestJson<{ success: boolean }>("/api/playrecords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, record }),
    });
  }

  async deletePlayRecord(key?: string): Promise<{ success: boolean }> {
    const url = key ? `/api/playrecords?key=${encodeURIComponent(key)}` : "/api/playrecords";
    return this.blobRequestJson<{ success: boolean }>(url, { method: "DELETE" });
  }

  async getSearchHistory(): Promise<string[]> {
    return this.blobRequestJson<string[]>("/api/searchhistory");
  }

  async addSearchHistory(keyword: string): Promise<string[]> {
    return this.blobRequestJson<string[]>("/api/searchhistory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
  }

  async deleteSearchHistory(keyword?: string): Promise<{ success: boolean }> {
    const url = keyword ? `/api/searchhistory?keyword=${keyword}` : "/api/searchhistory";
    return this.blobRequestJson<{ success: boolean }>(url, { method: "DELETE" });
  }

  getImageProxyUrl(imageUrl: string): string {
    return `${this.baseURL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  async getDoubanData(
    type: "movie" | "tv",
    tag: string,
    pageSize: number = 16,
    pageStart: number = 0
  ): Promise<DoubanResponse> {
    const url = `/api/douban?type=${type}&tag=${encodeURIComponent(tag)}&pageSize=${pageSize}&pageStart=${pageStart}`;
    return this.blobRequestJson<DoubanResponse>(url);
  }

  async getDoubanCategoryData({
    kind,
    category,
    type,
    limit = 16,
    start = 0,
  }: DoubanCategoryParams): Promise<DoubanResponse> {
    const url = `/api/douban/categories?kind=${kind}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}&limit=${limit}&start=${start}`;
    return this.blobRequestJson<DoubanResponse>(url);
  }

  async searchVideos(query: string): Promise<{ results: SearchResult[] }> {
    return this.blobRequestJson<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`);
  }

  async searchVideo(query: string, resourceId: string, signal?: AbortSignal): Promise<{ results: SearchResult[] }> {
    const url = `/api/search/one?q=${encodeURIComponent(query)}&resourceId=${encodeURIComponent(resourceId)}`;
    const { results } = await this.blobRequestJson<{ results: SearchResult[] }>(url, { signal });
    const normalizedQuery = this.normalizeTitle(query);
    const exactMatches = results.filter((item: SearchResult) => this.normalizeTitle(item.title) === normalizedQuery);

    if (exactMatches.length > 0) {
      return { results: exactMatches };
    }

    const partialMatches = results.filter((item: SearchResult) => {
      const normalizedTitle = this.normalizeTitle(item.title);
      return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
    });

    return { results: partialMatches.length > 0 ? partialMatches : results };
  }

  async getResources(signal?: AbortSignal): Promise<ApiSite[]> {
    const url = `/api/search/resources`;
    return this.blobRequestJson<ApiSite[]>(url, { signal });
  }

  async getVideoDetail(source: string, id: string): Promise<VideoDetail> {
    const url = `/api/detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`;
    return this.blobRequestJson<VideoDetail>(url);
  }
}

// 默认实例
export const api = new API();
