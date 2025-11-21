/**
 * Manages Server-Sent Events (SSE) connections for real-time progress updates.
 * Handles connection lifecycle, event parsing, and automatic cleanup.
 */
export default class SSEManager {
  #eventSourceByEndpoint = {};

  /**
   * Close a specific SSE connection by endpoint path.
   * @param {string} endpoint - The endpoint path (e.g., '/api/visualize/WindTurbine/stream')
   */
  closeEventSource(endpoint) {
    if (this.#eventSourceByEndpoint[endpoint]) {
      this.#eventSourceByEndpoint[endpoint].close();
      this.#eventSourceByEndpoint[endpoint] = null;
    }
  }

  /**
   * Close SSE connection by finding any endpoint containing the specified fragment.
   * @param {string} endpointFragment - Fragment to search for in endpoint URLs
   */
  closeEventSourceContaining(endpointFragment) {
    const key = Object.keys(this.#eventSourceByEndpoint).find(k => k.includes(endpointFragment));
    if (key) {
      this.closeEventSource(key);
    }
  }

  /**
   * Close all active SSE connections.
   */
  closeAllEventSources() {
    Object.keys(this.#eventSourceByEndpoint).forEach(endpoint => {
      this.closeEventSource(endpoint);
    });
  }

  /**
   * Start a new SSE stream connection.
   * @param {string} endpoint - The endpoint path (e.g., '/api/getcncoverview/stream')
   * @param {Object} parameters - Parameter groups to send as query params (e.g., {magnafpm: {...}, furling: {...}})
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onProgress - Called on progress events with (message: string, progress: number)
   * @param {Function} callbacks.onComplete - Called on completion with (result: any)
   * @param {Function} callbacks.onCancelled - Called when operation is cancelled with (message: string)
   * @param {Function} callbacks.onError - Called on error with (error: string)
   */
  startSSE(endpoint, parameters, callbacks) {
    const url = this.#buildSSEUrl(endpoint, parameters);
    const eventSource = new EventSource(url);
    this.#eventSourceByEndpoint[endpoint] = eventSource;
    
    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (callbacks.onProgress) {
          callbacks.onProgress(data.message, data.progress);
        }
      } catch (e) {
        console.warn('Failed to parse progress event data:', event.data);
      }
    });
    
    eventSource.addEventListener('complete', (event) => {
      try {
        const result = JSON.parse(event.data);
        if (callbacks.onComplete) {
          callbacks.onComplete(result);
        }
      } catch (e) {
        console.warn('Failed to parse complete event data:', event.data);
      }
      this.closeEventSource(endpoint);
    });
    
    eventSource.addEventListener('cancelled', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`SSE ${endpoint} cancelled:`, data.message);
        if (callbacks.onCancelled) {
          callbacks.onCancelled(data.message);
        }
      } catch (e) {
        console.warn('Failed to parse cancelled event data:', event.data);
      }
      this.closeEventSource(endpoint);
    });
    
    eventSource.addEventListener('error', (event) => {
      try {
        const error = JSON.parse(event.data);
        console.error(`SSE ${endpoint} error:`, error);
        if (callbacks.onError) {
          callbacks.onError(error.error);
        }
      } catch (e) {
        console.warn('Failed to parse error event data:', event.data);
      }
      this.closeEventSource(endpoint);
    });
    
    eventSource.onerror = (event) => {
      // Native EventSource errors (network issues, connection closed)
      console.error(`SSE ${endpoint} connection error`);
      if (callbacks.onError) {
        callbacks.onError('Connection error');
      }
      this.closeEventSource(endpoint);
    };
  }

  /**
   * Build SSE URL with prefixed query parameters.
   * Converts parameter groups into dot-notation query params (e.g., magnafpm.RotorDiskRadius=123).
   * @private
   * @param {string} endpoint - The base endpoint path
   * @param {Object} parameters - Parameter groups object
   * @returns {string} Complete URL with query parameters
   */
  #buildSSEUrl(endpoint, parameters) {
    const params = new URLSearchParams();
    
    // Add all parameter groups generically
    Object.entries(parameters).forEach(([group, groupParams]) => {
      Object.entries(groupParams).forEach(([key, value]) => {
        params.append(`${group}.${key}`, value);
      });
    });
    
    return `${endpoint}?${params.toString()}`;
  }
}
