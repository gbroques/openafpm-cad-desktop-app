import { LitElement, html, css } from "lit";
import "./container.js";
import "./downloadButton.js";
import "./errorBanner.js";
import "./header.js"
import "./inputsForm.js";
import "./tab.js";
import "./tabPanel.js";
import "./tabs.js";

const Tab = {
  Inputs: 'Inputs',
  Visualize: 'Visualize'
};

export default class App extends LitElement {
  static properties = {
    _tab: { type: String, state: true },
    _hasVisualization: { type: Boolean, state: true }
  };
  static styles = css`
    :host {
      display: block;
    }
  `;
  constructor() {
    super();
    this._tab = Tab.Inputs;
    this._hasVisualization = false;
  }
  handleSelect(event) {
    this._tab = event.detail.selectedValue;
  }
  handleVisualize() {
    this._hasVisualization = true;
    this._tab = Tab.Visualize;
  }
  render() {
    return html`
      <x-tabs @select=${this.handleSelect}>
        <x-tab value=${Tab.Inputs} ?selected=${this._tab === Tab.Inputs}>
          Inputs
        </x-tab>
        <x-tab value=${Tab.Visualize} ?selected=${this._tab === Tab.Visualize}>
          Visualize
        </x-tab>
      </x-tabs>
      <x-tab-panel ?visible=${this._tab === Tab.Inputs}>
        <x-container>
          <x-header></x-header>
          <x-inputs-form @visualize=${this.handleVisualize}></x-inputs-form>
        </x-container>
      </x-tab-panel>
      <x-tab-panel ?visible=${this._tab === Tab.Visualize}>
        <slot></slot>
        <x-download-button ?disabled=${!this._hasVisualization}></x-download-button>
      </x-tab-panel>
    `;
  }
}

customElements.define("x-app", App);
