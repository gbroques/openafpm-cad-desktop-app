import { LitElement, html, css } from "lit";
import { Tab, Assembly } from "./enums.js";

import "@material/web/tabs/primary-tab.js";
import "@material/web/tabs/tabs.js";
import "./circularProgress.js";
import "./container.js";
import "./downloadButton.js";
import "./emptyState.js";
import "./errorBanner.js";
import "./header.js"
import "./inputsForm.js";
import "./navigationRail.js";
import "./navigationRailButton.js";
import "./progressBar.js";
import "./tabPanel.js";
import "./typography.js";

const TABS = [Tab.INPUTS, Tab.VISUALIZE, Tab.CNC, Tab.DIMENSIONS];

export default class App extends LitElement {
  static properties = {
    preset: { type: String },
    parametersByPreset: { attribute: false },
    parametersSchemaByPreset: { attribute: false }, 
    form: { attribute: false },
    loading: { type: Boolean },
    errorMessage: { type: String },
    assembly: { type: String },
    tab: { type: String },
    archiveLoading: { type: Boolean },
    archiveErrorMessage: { type: String },
    cncOverviewSvgErrorMessage: { type: String },
    cncOverviewSvg: { attribute: false },
    cncOverviewSvgProgress: { attribute: false },
    dxfArchiveLoading: { type: Boolean },
    dxfArchiveErrorMessage: { type: String },
    dimensionTablesErrorMessage: { type: String },
    dimensionTables: { attribute: false },
    dimensionTablesProgress: { attribute: false },
    visualizeProgress: { attribute: false },
    shapeBounds: { attribute: false }
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
    .cncOverviewContainer {
      background-color: black;
      padding: calc(var(--spacing) * 2);
      & > svg {
        width: 100%;
        height: 100%;
      }
    }
    .centeredContainer {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
    }
    .slot {
      display: block;
      width: calc(100% - var(--navigation-rail-width));
    }
    .tabs {
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .tab-label {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .tab-spinner {
      position: absolute;
      right: calc(var(--spacing) * -3);
      width: 16px;
      height: 16px;
    }
    @media print {
      .tabs {
        display: none;
      }
    }
    /**********************************************************
     * Table styles                                           *
     **********************************************************/
    .dimensionTablesContainer table {
      border-collapse: collapse;
      break-inside: avoid-page;
    }
    .dimensionTablesContainer > * {
      margin-bottom: calc(var(--spacing) * 2);
    }
    .dimensionTablesContainer td, .dimensionTablesContainer th {
      border: 1px solid var(--text-color);
      padding: calc(var(--spacing) / 2) var(--spacing);
      transition: border-color var(--transition-duration-standard) ease-in-out;
    }
    .dimensionTablesContainer th {
      text-align: left;
      text-transform: uppercase;
    }
    .dimensionTablesContainer tfoot td {
      border: none;
    }
    .dimensionTablesContainer img {
        max-width: 480px;
    }
    /**********************************************************/
  `;
  updated(changedProperties) {
    if (changedProperties.has('dimensionTables') && !changedProperties.get('dimensionTables') && this.dimensionTables) {
      const container = this.shadowRoot.querySelector('.dimensionTablesContainer');
      for (const element of this.dimensionTables) {
        // schedule macrotask to avoid blocking main thread
        setTimeout(() => container.append(render(element)));
      }
    }
  }
  handleTabChange(event) {
    const selectedTab = TABS[event.target.activeTabIndex];
    this.dispatchEvent(new CustomEvent('select-tab', {
      detail: { selectedTab },
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
  handleDownloadDxfArchive() {
    this.dispatchEvent(new CustomEvent('download-dxf-archive', {
      bubbles: true,
      composed: true
    }));
  }

  shouldShowSpinner(tab) {
    switch(tab) {
      case Tab.VISUALIZE:
        return Boolean(this.visualizeProgress);
      case Tab.CNC:
        return Boolean(this.cncOverviewSvgProgress);
      case Tab.DIMENSIONS:
        return Boolean(this.dimensionTablesProgress);
      default:
        return false;
    }
  }

  render() {
    return html`
      <md-tabs class="tabs" @change=${this.handleTabChange}>
        ${TABS.map(tab => html`
          <md-primary-tab ?selected=${this.tab === tab}>
            <span class="tab-label">
              ${tab}
              ${this.shouldShowSpinner(tab) ? html`
                <x-circular-progress class="tab-spinner" size="16px"></x-circular-progress>
              ` : ''}
            </span>
          </md-primary-tab>
        `)}
      </md-tabs>
      <x-tab-panel ?visible=${this.tab === Tab.INPUTS}>
        <x-container>
          <x-inputs-form
            .preset=${this.preset}
            .parametersByPreset=${this.parametersByPreset}
            .parametersSchemaByPreset=${this.parametersSchemaByPreset}
            .shapeBounds=${this.shapeBounds}
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
            <x-navigation-rail-button
              value=${Assembly.BLADE_TEMPLATE}
              ?selected=${this.assembly === Assembly.BLADE_TEMPLATE}>
                Blade Template
            </x-navigation-rail-button>
          </x-navigation-rail>
          <slot class="slot"></slot>
          <x-download-button
            title="Download FreeCAD files"
            ?loading=${this.archiveLoading}
            .errorMessage=${this.archiveErrorMessage}
            @click=${this.handleDownloadArchive}>
          </x-download-button>
        </div>
      </x-tab-panel>
      <x-tab-panel ?visible=${this.tab === Tab.CNC}>
        <!-- Empty State -->
        ${!this.cncOverviewSvg && !this.cncOverviewSvgProgress && !this.cncOverviewSvgErrorMessage ?
          html`<x-empty-state></x-empty-state>` :
          ""
        }
        <!-- Loading -->
        ${!this.cncOverviewSvg && this.cncOverviewSvgProgress && !this.cncOverviewSvgErrorMessage ?
          html`
            <div class="centeredContainer">
              <p>Loading CNC Overview</p>
              <x-progress-bar 
                .percent=${this.cncOverviewSvgProgress.percent}
                .message=${this.cncOverviewSvgProgress.message}>
              </x-progress-bar>
            </div>
          ` : ""
        }
        <!-- Data -->
        ${this.cncOverviewSvg && !this.cncOverviewSvgProgress && !this.cncOverviewSvgErrorMessage ?
          html`<div class="cncOverviewContainer" .innerHTML=${this.cncOverviewSvg}></div>` :
          ""
        }
        <!-- Error -->
        ${!this.cncOverviewSvg && !this.cncOverviewSvgProgress && this.cncOverviewSvgErrorMessage ?
          html`
            <div class="centeredContainer">
              <x-error-banner .message="${this.cncOverviewSvgErrorMessage}" .closeable="${false}"></x-error-banner>
            </div>
          ` : ""
        }
        <x-download-button
          title="Download DXF files"
          ?loading=${this.dxfArchiveLoading}
          .errorMessage=${this.dxfArchiveErrorMessage}
          @click=${this.handleDownloadDxfArchive}>
        </x-download-button>
      </x-tab-panel>
      <x-tab-panel ?visible=${this.tab === Tab.DIMENSIONS}>
        <!-- Empty State -->
        ${!this.dimensionTables && !this.dimensionTablesProgress && !this.dimensionTablesErrorMessage ?
          html`<x-empty-state></x-empty-state>` :
          ""
        }
        <!-- Loading -->
        ${!this.dimensionTables && this.dimensionTablesProgress && !this.dimensionTablesErrorMessage ?
          html`
            <div class="centeredContainer">
              <p>Loading Dimension Tables</p>
              <x-progress-bar 
                .percent=${this.dimensionTablesProgress.percent}
                .message=${this.dimensionTablesProgress.message}>
              </x-progress-bar>
            </div>
          ` : ""
        }
        <!-- Data -->
        ${this.dimensionTables && !this.dimensionTablesProgress && !this.dimensionTablesErrorMessage ?
          html`
            <x-container>
              <div class="dimensionTablesContainer">
              </div>
            </x-container>
          ` : ""
        }
        <!-- Error -->
        ${!this.dimensionTables && !this.dimensionTablesProgress && this.dimensionTablesErrorMessage ?
          html`
            <div class="centeredContainer">
              <x-error-banner .message="${this.dimensionTablesErrorMessage}" .closeable="${false}"></x-error-banner>
            </div>
          ` : ""
        }
      </x-tab-panel>
    `;
  }
}

function render({tagName, children, properties}) {
  const element = document.createElement(tagName);
  if (properties) {
    Object.entries(properties).forEach(([propertyName, value]) => {
      element[propertyName] = value;
    });
  }
  if (children) {
    for (const child of children) {
      // schedule macrotask to avoid blocking main thread
      setTimeout(() => element.append(render(child)));
    }
  }
  return element;
}

customElements.define("x-app", App);
