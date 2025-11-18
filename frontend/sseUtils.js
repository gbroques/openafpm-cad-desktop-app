/**
 * SSE (Server-Sent Events) utilities for real-time progress updates
 */

export class SSEManager {
  constructor() {
    this.eventSources = {
      visualize: null,
      cncoverview: null,
      dimensiontables: null
    };
  }

  /**
   * Close an SSE connection
   */
  closeEventSource(type) {
    if (this.eventSources[type]) {
      this.eventSources[type].close();
      this.eventSources[type] = null;
    }
  }

  /**
   * Close all SSE connections
   */
  closeAllEventSources() {
    Object.keys(this.eventSources).forEach(type => {
      this.closeEventSource(type);
    });
  }

  /**
   * Build SSE URL with prefixed parameters
   */
  buildSSEUrl(endpoint, parameters) {
    const params = new URLSearchParams();
    
    // Add magnafpm parameters
    Object.entries(parameters.magnafpm).forEach(([key, value]) => {
      params.append(`magnafpm.${key}`, value);
    });
    
    // Add furling parameters  
    Object.entries(parameters.furling).forEach(([key, value]) => {
      params.append(`furling.${key}`, value);
    });
    
    // Add user parameters
    Object.entries(parameters.user).forEach(([key, value]) => {
      params.append(`user.${key}`, value);
    });
    
    return `${endpoint}?${params.toString()}`;
  }

  /**
   * Start visualization SSE stream
   */
  startVisualizationSSE(assembly, parameters, callbacks) {
    const url = this.buildSSEUrl(`/api/visualize/${assembly}/stream`, parameters);
    const eventSource = new EventSource(url);
    this.eventSources.visualize = eventSource;
    
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
      this.closeEventSource('visualize');
    });
    
    eventSource.addEventListener('cancelled', (event) => {
      console.log('SSE visualize operation cancelled');
      if (callbacks.onCancelled) {
        callbacks.onCancelled();
      }
      this.closeEventSource('visualize');
    });
    
    eventSource.addEventListener('error', (event) => {
      // Check if this is a proper error event with data
      if (event.data) {
        try {
          const error = JSON.parse(event.data);
          console.error('SSE visualize error:', error);
          if (callbacks.onError) {
            callbacks.onError(error.error);
          }
        } catch (e) {
          console.warn('Failed to parse error event data:', event.data);
        }
      } else {
        // Connection closed without error data - likely normal close or cancellation
        console.log('SSE visualize connection closed (readyState:', eventSource.readyState, ')');
      }
      this.closeEventSource('visualize');
    });
  }

  /**
   * Start CNC overview SSE stream
   */
  startCNCOverviewSSE(parameters, callbacks) {
    const url = this.buildSSEUrl('/api/getcncoverview/stream', parameters);
    const eventSource = new EventSource(url);
    this.eventSources.cncoverview = eventSource;
    
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
      this.closeEventSource('cncoverview');
    });
    
    eventSource.addEventListener('cancelled', (event) => {
      console.log('SSE CNC operation cancelled');
      if (callbacks.onCancelled) {
        callbacks.onCancelled();
      }
      this.closeEventSource('cncoverview');
    });
    
    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        try {
          const error = JSON.parse(event.data);
          console.error('SSE CNC error:', error);
          if (callbacks.onError) {
            callbacks.onError(error.error);
          }
        } catch (e) {
          console.warn('Failed to parse error event data:', event.data);
        }
      } else {
        console.log('SSE CNC connection closed (readyState:', eventSource.readyState, ')');
      }
      this.closeEventSource('cncoverview');
    });
  }

  /**
   * Start dimension tables SSE stream
   */
  startDimensionTablesSSE(parameters, callbacks) {
    const url = this.buildSSEUrl('/api/getdimensiontables/stream', parameters);
    const eventSource = new EventSource(url);
    this.eventSources.dimensiontables = eventSource;
    
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
      this.closeEventSource('dimensiontables');
    });
    
    eventSource.addEventListener('cancelled', (event) => {
      console.log('SSE Dimensions operation cancelled');
      if (callbacks.onCancelled) {
        callbacks.onCancelled();
      }
      this.closeEventSource('dimensiontables');
    });
    
    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        try {
          const error = JSON.parse(event.data);
          console.error('SSE Dimensions error:', error);
          if (callbacks.onError) {
            callbacks.onError(error.error);
          }
        } catch (e) {
          console.warn('Failed to parse error event data:', event.data);
        }
      } else {
        console.log('SSE Dimensions connection closed (readyState:', eventSource.readyState, ')');
      }
      this.closeEventSource('dimensiontables');
    });
  }
}
