import { LitElement, html, css, nothing } from "lit";

import "./button.js"
import "./windTurbineIcon.js";
import "./circularProgress.js";

class DownloadButton extends LitElement {
  static properties = {
    disabled: { type: Boolean },
    loading: { type: Boolean }
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
  handleSubmit(event) {
    event.target.submit();
  }
  render() {
    return html`
      <form method="get" action="data/WindTurbine.zip" @submit=${this.handleSubmit}>
        <x-button
          variant="primary"
          ?disabled=${this.disabled}
          type="submit"
          .title="${this.loading ? "Loading..." : "Download"}">
          ${this.loading ?
            html`
              <x-circular-progress class="svg" size="24px" color=${this.disabled ? "currentColor" : nothing}>
              </x-circular-progress>
            ` :
            html`
              <svg class="svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>
              </svg>
            `
          }
        </x-button>
      </form>
    `;
  }
}

customElements.define("x-download-button", DownloadButton);
