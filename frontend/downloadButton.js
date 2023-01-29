import { LitElement, html, css, nothing } from "lit";

import "./button.js"
import "./windTurbineIcon.js";
import "./circularProgress.js";

class DownloadButton extends LitElement {
  static properties = {
    disabled: { type: Boolean },
    loading: { type: Boolean },
    errorMessage: { type: String }
  };
  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: calc(var(--spacing) * 2);
      right: calc(var(--spacing) * 2);
    }
    x-button::part(button) {
      display: block;
      border-radius: 50%;
    }
    .svg {
      width: 24px;
      height: 24px;
      margin: 16px;
      fill: currentColor;
    }
  `;
  render() {
    const variant = this.errorMessage ? 'error' : 'primary';
    return html`
      <x-button
        .variant=${variant}
        ?disabled=${this.disabled}
        .title="${this.loading ? "Loading..." : this.errorMessage ? this.errorMessage : "Download"}">
        ${this.loading ?
          html`
            <x-circular-progress
              class="svg"
              size="24px"
              color=${this.disabled ? "currentColor" : nothing}>
            </x-circular-progress>
          ` :
          html`
            <svg class="svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>
            </svg>
          `
        }
      </x-button>
  `;
  }
}

customElements.define("x-download-button", DownloadButton);
