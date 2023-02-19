import { LitElement, html, css } from "lit";
import "./windTurbineIcon.js";

export default class EmptyState extends LitElement {
  static styles = css`
    :host {
      display: block;
      text-align: center;
      padding-top: 25vh;
    }
  `;
  render() {
    return html`
      <div class="empty-state">
        <x-wind-turbine-icon size="65" fill="#9E9E9E" ></x-wind-turbine-icon>
        <p style="font-size: var(--h2); font-weight: bold;">No Visualization</p>
        <p style="font-size: 1rem;">Click <strong>Visualize</strong> button on <strong>Inputs</strong> tab.</p>
      </div>
    `;
  }
}

customElements.define("x-empty-state", EmptyState);
