import { LitElement, html, css } from "lit";
import { Tab, Assembly } from "./enums.js";
import "./container.js";
import "./downloadButton.js";
import "./errorBanner.js";
import "./header.js"
import "./inputsForm.js";
import "./navigationRail.js";
import "./navigationRailButton.js";
import "./tab.js";
import "./tabPanel.js";
import "./tabs.js";

export default class App extends LitElement {
  static properties = {
    preset: { type: String },
    parametersByPreset: { attribute: false },
    parametersSchema: { attribute: false }, 
    form: { attribute: false },
    loading: { type: Boolean },
    errorMessage: { type: String },
    assembly: { type: String },
    tab: { type: String },
    archiveLoading: { type: Boolean },
    archiveErrorMessage: { type: String }
  };
  static styles = css`
    :host {
      display: grid;
      grid-template-rows: min-content 1fr;
    }
    .visualizationTabContents {
      display: flex;
      width: 100%;
      height: 100%;
    }
    .slot {
      display: block;
      width: calc(100% - var(--navigation-rail-width));
    }
    .tabs {
      z-index: 10;
    }
  `;
  handleTabSelect(event) {
    const { selectedValue } = event.detail;
    this.dispatchEvent(new CustomEvent('select-tab', {
      detail: { selectedTab: selectedValue },
      bubbles: true,
      composed: true
    }));
  }
  handleAssemblySelect(event) {
    const { selectedValue } = event.detail;
    this.dispatchEvent(new CustomEvent('select-assembly', {
      detail: { selectedAssembly: selectedValue },
      bubbles: true,
      composed: true
    }));
  }
  handleDownloadArchive() {
    this.dispatchEvent(new CustomEvent('download-archive', {
      bubbles: true,
      composed: true
    }));
  }
  render() {
    return html`
      <x-tabs class="tabs" @select=${this.handleTabSelect}>
        <x-tab value=${Tab.INPUTS} ?selected=${this.tab === Tab.INPUTS}>
          Inputs
        </x-tab>
        <x-tab value=${Tab.VISUALIZE} ?selected=${this.tab === Tab.VISUALIZE}>
          Visualize
        </x-tab>
      </x-tabs>
      <x-tab-panel ?visible=${this.tab === Tab.INPUTS}>
        <x-container>
          <x-inputs-form
            .preset=${this.preset}
            .parametersByPreset=${this.parametersByPreset}
            .parametersSchema=${this.parametersSchema}
            .form=${this.form}
            ?loading=${this.loading}
            .errorMessage=${this.errorMessage}>
        </x-inputs-form>
        </x-container>
      </x-tab-panel>
      <x-tab-panel ?visible=${this.tab === Tab.VISUALIZE}>
        <div class="visualizationTabContents">
          <x-navigation-rail @select=${this.handleAssemblySelect}>
            <x-navigation-rail-button
              value=${Assembly.WIND_TURBINE}
              ?selected=${this.assembly === Assembly.WIND_TURBINE}>
                Wind Turbine
            </x-navigation-rail-button>
            <x-navigation-rail-button
              value=${Assembly.STATOR_MOLD}
              ?selected=${this.assembly === Assembly.STATOR_MOLD}>
                Stator Mold
            </x-navigation-rail-button>
            <x-navigation-rail-button
              value=${Assembly.ROTOR_MOLD}
              ?selected=${this.assembly === Assembly.ROTOR_MOLD}>
                Rotor Mold
            </x-navigation-rail-button>
            <x-navigation-rail-button
              value=${Assembly.MAGNET_JIG}
              ?selected=${this.assembly === Assembly.MAGNET_JIG}>
                Magnet Jig
            </x-navigation-rail-button>
            <x-navigation-rail-button
              value=${Assembly.COIL_WINDER}
              ?selected=${this.assembly === Assembly.COIL_WINDER}>
                Coil Winder
            </x-navigation-rail-button>
          </x-navigation-rail>
          <slot class="slot"></slot>
          <x-download-button
            ?disabled=${this.form === null || this.archiveLoading}
            ?loading=${this.archiveLoading}
            .errorMessage=${this.archiveErrorMessage}
            @click=${this.handleDownloadArchive}>
          </x-download-button>
        </div>
      </x-tab-panel>
    `;
  }
}

customElements.define("x-app", App);
