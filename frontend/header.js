import { LitElement, html, css } from "lit";

import "./typography.js";
import "./windTurbineIcon.js";

class Header extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      margin-bottom: calc(var(--spacing) * 3);
    }
  `;
  render() {
    return html`
      <x-wind-turbine-icon size="2.488rem" fill="var(--primary-color-main)">
      </x-wind-turbine-icon>
      <x-typography variant="h1">
        OpenAFPM CAD
      </x-typography>
    `;
  }
}

customElements.define("x-header", Header);
