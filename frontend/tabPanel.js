import { LitElement, html, css } from "lit";

class TabPanel extends LitElement {
  static properties = {
    visible: { type: Boolean }
  };
  static styles = css`
    :host {
      display: none;
    }
    :host([visible]) {
      display: block;
    }
  `;
  render() {
    return html`<slot></slot>`;
  }
}

customElements.define("x-tab-panel", TabPanel);
