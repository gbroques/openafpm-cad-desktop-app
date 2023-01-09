import { LitElement, html, css } from "lit";

import "./windTurbineIcon.js";

class Container extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 75%;
      margin: calc(var(--spacing) * 4) auto;
    }
  `;
  render() {
    return html`<slot></slot>`;
  }
}

customElements.define("x-container", Container);
