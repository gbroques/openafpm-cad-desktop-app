import { LitElement, html, css } from "lit";

import "./typography.js";
import "./windTurbineIcon.js";

class ErrorBanner extends LitElement {
  static properties = {
    message: { type: String }
  };
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: #e53935;
      color: white;
      box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      padding: calc(var(--spacing) * 2);
    }
    .error-icon {
      width: 24px;
      height: 24px;
      min-width: 24px;
      margin-right: calc(var(--spacing) * 1);
      fill: #ffffff;
    }
  `;
  handleClose() {
    this.dispatchEvent(new Event('close', { bubbles: true, composed: true }));
  }
  render() {
    return html`
      <div style="display: flex; align-items: center">
        <svg class="error-icon" focusable="false" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
        </svg>
        <x-typography variant="p">
          ${this.message}
        </x-typography>
      </div>
      <button style="border: none; background: transparent; cursor: pointer;" @click=${this.handleClose}>
        <svg fill="#ffffff" width="24" height="24" focusable="false" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
        </svg>
      </button>
    `;
  }
}

customElements.define("x-error-banner", ErrorBanner);
