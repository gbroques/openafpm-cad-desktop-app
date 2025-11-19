/**
 * SSE (Server-Sent Events) utilities for real-time progress updates
 */

export class SSEManager {
  constructor() {
    this.eventSources = {
      visualize: null,
      getcncoverview: null,
      getdimensiontables: null
    };
  }

  /**
   * Close an SSE connection
   */
  closeEventSource(eventSourceKey) {
    if (this.eventSources[eventSourceKey]) {
      this.eventSources[eventSourceKey].close();
      this.eventSources[eventSourceKey] = null;
    }
  }

  /**
   * Close all SSE connections
   */
  closeAllEventSources() {
    Object.keys(this.eventSources).forEach(eventSourceKey => {
      this.closeEventSource(eventSourceKey);
    });
  }

  /**
   * Start visualization SSE stream
   */
  startVisualizationSSE(assembly, parameters, callbacks) {
    const url = this.#buildSSEUrl(`/api/visualize/${assembly}/stream`, parameters);
    this.#startSSE('visualize', url, callbacks);
  }

  /**
   * Start CNC overview SSE stream
   */
  startCNCOverviewSSE(parameters, callbacks) {
    const url = this.#buildSSEUrl('/api/getcncoverview/stream', parameters);
    this.#startSSE('getcncoverview', url, callbacks);
  }

  /**
   * Start dimension tables SSE stream
   */
  startDimensionTablesSSE(parameters, callbacks) {
    const url = this.#buildSSEUrl('/api/getdimensiontables/stream', parameters);
    this.#startSSE('getdimensiontables', url, callbacks);
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

  /**
   * Internal method to start SSE stream
   */
  #startSSE(eventSourceKey, endpoint, callbacks) {
    const eventSource = new EventSource(endpoint);
    this.eventSources[eventSourceKey] = eventSource;
    
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
      this.closeEventSource(eventSourceKey);
    });
    
    eventSource.addEventListener('cancelled', (event) => {
      console.log(`SSE ${eventSourceKey} operation cancelled`);
      if (callbacks.onCancelled) {
        callbacks.onCancelled();
      }
      this.closeEventSource(eventSourceKey);
    });
    
    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        try {
          const error = JSON.parse(event.data);
          console.error(`SSE ${eventSourceKey} error:`, error);
          if (callbacks.onError) {
            callbacks.onError(error.error);
          }
        } catch (e) {
          console.warn('Failed to parse error event data:', event.data);
        }
      } else {
        console.log(`SSE ${eventSourceKey} connection closed (readyState:`, eventSource.readyState, ')');
      }
      this.closeEventSource(eventSourceKey);
    });
  }
}
