import { LitElement, html, css } from "lit";

import "./typography.js";
import "./windTurbineIcon.js";

class NavigationRailButton extends LitElement {
  static properties = {
    selected: { type: Boolean }
  };
  static styles = css`
    .button {
      display: block;
      background: transparent;
      border: none;
      cursor: pointer;
      margin: 0;
      padding: 0;
      font-size: var(--h6);
      min-height: var(--navigation-rail-width);
      padding: calc(var(--spacing) * 1);
      color: var(--text-color);
      transition: all var(--transition-duration-standard) ease-in-out;
    }
    :host([selected]) > .button {
      font-size: 1rem;
      color: var(--primary-color-dark);
    }
  `;
  render() {
    return html`
      <button class="button"><slot></slot></button>
    `;
  }
}

customElements.define("x-navigation-rail-button", NavigationRailButton);
