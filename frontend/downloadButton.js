import { LitElement, html, css, nothing } from "lit";

import "@material/web/fab/fab.js";
import "@material/web/icon/icon.js";
import "./windTurbineIcon.js";
import "./circularProgress.js";

class DownloadButton extends LitElement {
  static properties = {
    title: { type: String },
    loading: { type: Boolean },
    errorMessage: { type: String }
  };
  constructor() {
    super();
    this.title = 'Download';
  }
  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: calc(var(--spacing) * 2);
      right: calc(var(--spacing) * 2);
    }
    .error {
      --md-fab-container-color: var(--md-sys-color-error);
      --md-fab-icon-color: var(--md-sys-color-on-error);
    }
  `;
  render() {
    return html`
      <md-fab 
        variant="primary"
        class=${this.errorMessage ? 'error' : ''}
        .title=${this.loading ? "Loading..." : this.errorMessage ? this.errorMessage : this.title}>
        <md-icon slot="icon">
          ${this.loading ?
            html`
              <x-circular-progress size="24px">
              </x-circular-progress>
            ` :
            this.errorMessage ?
            html`
              <!-- error material icon -->
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            ` :
            html`
              <!-- file_download material icon -->
              <svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            `
          }
        </md-icon>
      </md-fab>
  `;
  }
}

customElements.define("x-download-button", DownloadButton);
