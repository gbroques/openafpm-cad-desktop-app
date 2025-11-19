/**
 * SSE (Server-Sent Events) utilities for real-time progress updates
 */

export class SSEManager {
  #eventSourceByEndpoint = {};

  /**
   * Close an SSE connection
   */
  closeEventSource(endpoint) {
    if (this.#eventSourceByEndpoint[endpoint]) {
      this.#eventSourceByEndpoint[endpoint].close();
      this.#eventSourceByEndpoint[endpoint] = null;
    }
  }

  /**
   * Close visualize SSE connection
   */
  closeVisualizeEventSource() {
    const key = Object.keys(this.#eventSourceByEndpoint).find(k => k.includes('/api/visualize/'));
    if (key) {
      this.closeEventSource(key);
    }
  }

  /**
   * Close all SSE connections
   */
  closeAllEventSources() {
    Object.keys(this.#eventSourceByEndpoint).forEach(endpoint => {
      this.closeEventSource(endpoint);
    });
  }

  /**
   * Start SSE stream
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
      console.log(`SSE ${endpoint} operation cancelled`);
      if (callbacks.onCancelled) {
        callbacks.onCancelled();
      }
      this.closeEventSource(endpoint);
    });
    
    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        try {
          const error = JSON.parse(event.data);
          console.error(`SSE ${endpoint} error:`, error);
          if (callbacks.onError) {
            callbacks.onError(error.error);
          }
        } catch (e) {
          console.warn('Failed to parse error event data:', event.data);
        }
      } else {
        console.log(`SSE ${endpoint} connection closed (readyState:`, eventSource.readyState, ')');
      }
      this.closeEventSource(endpoint);
    });
  }

  /**
   * Build SSE URL with prefixed parameters
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
