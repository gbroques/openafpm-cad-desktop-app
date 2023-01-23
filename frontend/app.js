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
    _hasArchive: { type: Boolean, state: true },
    _isArchiveLoading: { type: Boolean, state: true }
  };
  static styles = css`
    :host {
      display: block;
    }
  `;
  constructor() {
    super();
    this._tab = Tab.Inputs;
    this._hasArchive = false;
    this._isArchiveLoading = false;
  }
  handleSelect(event) {
    this._tab = event.detail.selectedValue;
  }
  handleVisualize() {
    this._tab = Tab.Visualize;
    this._isArchiveLoading = true;
  }
  handleArchiveCreated() {
    this._hasArchive = true;
    this._isArchiveLoading = false;
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
          <x-inputs-form @visualize=${this.handleVisualize} @archive-created=${this.handleArchiveCreated}>
        </x-inputs-form>
        </x-container>
      </x-tab-panel>
      <x-tab-panel ?visible=${this._tab === Tab.Visualize}>
        <slot></slot>
        <x-download-button
          ?disabled=${!this._hasArchive || this._isArchiveLoading}
          ?loading=${this._isArchiveLoading}>
        </x-download-button>
      </x-tab-panel>
    `;
  }
}

customElements.define("x-app", App);
