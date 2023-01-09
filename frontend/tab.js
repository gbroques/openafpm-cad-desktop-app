import { LitElement, html, css } from "lit";

class Tab extends LitElement {
  static properties = {
    selected: { type: Boolean }
  };
  static styles = css`
    :host {
      flex: 1;
      padding: calc(var(--spacing) * 3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-color);
      border-bottom: 2px solid transparent;
      transition: var(--transition-duration-standard) ease-in-out;
    }
    :host([selected]) {
      border-bottom-color: var(--primary-color-main);
      color: var(--primary-color-main);
    }
  `;
  render() {
    return html`<slot></slot>`;
  }
}

customElements.define("x-tab", Tab);
