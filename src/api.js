/**
 * Tautulli API client using native fetch (Node 20+).
 */
export class TautulliAPI {
  /**
   * @param {string} baseUrl - e.g. "http://192.168.1.100:8181"
   * @param {string} apiKey
   */
  constructor(baseUrl, apiKey) {
    // Strip trailing slash from base URL
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  /**
   * Make a raw API call.
   * @param {string} cmd - The Tautulli API command
   * @param {Record<string, string|number>} [params] - Additional query parameters
   * @returns {Promise<any>} The response data
   */
  async _call(cmd, params = {}) {
    const url = new URL(`${this.baseUrl}/api/v2`);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set("cmd", cmd);
    url.searchParams.set("out_type", "json");

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Tautulli API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.response?.result !== "success") {
      const msg = json.response?.message || "Unknown API error";
      throw new Error(`Tautulli API error: ${msg}`);
    }

    return json.response.data;
  }

  /**
   * Get a list of configured notification agents.
   * @returns {Promise<Array<{id: number, agent_id: number, agent_name: string, agent_label: string, friendly_name: string, active: number}>>}
   */
  async getNotifiers() {
    return this._call("get_notifiers");
  }

  /**
   * Get a list of all users with server access.
   * @returns {Promise<Array<{user_id: string, username: string, friendly_name?: string}>>}
   */
  async getUsers() {
    return this._call("get_users");
  }

  /**
   * Get history entries within a date range, auto-paginating through all results.
   * @param {object} options
   * @param {string} options.after - "YYYY-MM-DD"
   * @param {string} options.before - "YYYY-MM-DD"
   * @param {number} [options.userId]
   * @param {number} [options.pageSize=100]
   * @returns {Promise<Array>} All history entries
   */
  async getHistoryAll({ after, before, userId, pageSize = 100 }) {
    const allData = [];
    let start = 0;

    while (true) {
      const params = {
        after,
        before,
        length: pageSize,
        start,
      };
      if (userId !== undefined) {
        params.user_id = userId;
      }

      const result = await this._call("get_history", params);
      const entries = result?.data || [];
      allData.push(...entries);

      // If we got fewer entries than pageSize, we've reached the end
      if (entries.length < pageSize) {
        break;
      }
      start += pageSize;
    }

    return allData;
  }

  /**
   * Send a notification via a configured notifier.
   * @param {number} notifierId
   * @param {string} subject
   * @param {string} body
   */
  async notify(notifierId, subject, body) {
    return this._call("notify", {
      notifier_id: notifierId,
      subject,
      body,
    });
  }
}
