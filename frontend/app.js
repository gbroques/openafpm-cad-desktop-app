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
    _isArchiveLoading: { type: Boolean, state: true },
    _errorMessage: { type: String, state: true }
  };
  static styles = css`
    :host {
      display: block;
    }
  `;
  constructor() {
    super();
    this._tab = Tab.Inputs;
    this._isArchiveLoading = false;
    this._errorMessage = '';
    this._createArchive = null;
  }
  handleSelect(event) {
    this._tab = event.detail.selectedValue;
  }
  handleVisualize(event) {
    const { visualizePromise, createArchive } = event.detail;
    visualizePromise
      .then(() => {
        this._tab = Tab.Visualize;
      })
      .catch(error => error.name !== 'AbortError' && console.error(error));
    this._createArchive = createArchive;
  }
  handleDownloadButtonClick() {
    if (this._isArchiveLoading) return;
    this._isArchiveLoading = true;
    this._createArchive()
      .then(response => {
        if (!response.ok) {
          return response.json();
        }
        return response;
      })
      .then(response => {
        if (response.error) {
          throw new Error(response.error);
        }
        return response;
      })
      .then(response => response.blob())
      .then(blob => {
        this._errorMessage = '';
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'WindTurbine.zip';
        link.click();
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          this._errorMessage = error.message;
        }
      })
      .finally(() => {
        this._isArchiveLoading = false;
      });
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
          <x-inputs-form @visualize=${this.handleVisualize}>
        </x-inputs-form>
        </x-container>
      </x-tab-panel>
      <x-tab-panel ?visible=${this._tab === Tab.Visualize}>
        <slot></slot>
        <x-download-button
          ?disabled=${this._createArchive === null || this._isArchiveLoading}
          ?loading=${this._isArchiveLoading}
          .errorMessage=${this._errorMessage}
          @click=${this.handleDownloadButtonClick}>
        </x-download-button>
      </x-tab-panel>
    `;
  }
}

customElements.define("x-app", App);
