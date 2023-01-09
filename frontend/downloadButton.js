import { LitElement, html, css } from "lit";

import "./button.js"
import "./windTurbineIcon.js";

class DownloadButton extends LitElement {
  static properties = {
    disabled: { type: Boolean }
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
      <form method="get" action="WindTurbine.zip" @submit=${this.handleSubmit}>
        <x-button variant="primary" ?disabled=${this.disabled} type="submit" title="Download">
          <svg class="svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>
          </svg>
        </x-button>
      </form>
    `;
  }
}

customElements.define("x-download-button", DownloadButton);
