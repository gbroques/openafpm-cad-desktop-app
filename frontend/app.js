import { LitElement, html } from "lit";
import { Tab, Assembly } from "./enums.js";
import OpenAfpmCadVisualization from "openafpm-cad-visualization";

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
  // Disable shadow DOM - render directly into light DOM
  // This allows openafpm-cad-visualization's styles (injected into <head>) to work
  // without shadow DOM boundaries blocking them
  createRenderRoot() {
    return this;
  }
  
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
    visualize: { attribute: false },
    visualizeProgress: { attribute: false },
    visualizeErrorMessage: { type: String },
    shapeBounds: { attribute: false },
    theme: { type: String }
  };
  
  firstUpdated() {
    const visualizationRoot = this.renderRoot.querySelector('#visualization-root');
    this._openAfpmCadVisualization = new OpenAfpmCadVisualization({
      rootDomElement: visualizationRoot,
      width: this._calculateWidth(),
      height: this._calculateHeight()
    });
  }
  
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._mouseMoveHandler) {
      window.removeEventListener('mousemove', this._mouseMoveHandler);
    }
  }
  
  updated(changedProperties) {
    if (changedProperties.has('dimensionTables') && !changedProperties.get('dimensionTables') && this.dimensionTables) {
      const container = this.querySelector('.dimensionTablesContainer');
      for (const element of this.dimensionTables) {
        // schedule macrotask to avoid blocking main thread
        setTimeout(() => container.append(render(element)));
      }
    }
    
    if (changedProperties.has('visualizeProgress') && this.visualizeProgress && this._openAfpmCadVisualization) {
      const {message, percent} = this.visualizeProgress;
      this._openAfpmCadVisualization.setProgress(message, percent);
    }
    
    if (!this._openAfpmCadVisualization) return;
    
    if (changedProperties.has('visualize') && this.visualize) {
      const {objText, furlTransform} = this.visualize;
      this._openAfpmCadVisualization.render(objText, this.assembly, furlTransform);
      
      // Remove old listener and add new one with updated handleMouseMove reference
      if (this._mouseMoveHandler) {
        window.removeEventListener('mousemove', this._mouseMoveHandler);
      }
      this._mouseMoveHandler = (event) => {
        this._openAfpmCadVisualization.handleMouseMove(event);
      };
      window.addEventListener('mousemove', this._mouseMoveHandler);
    }
    
    if (changedProperties.has('visualizeErrorMessage') && this.visualizeErrorMessage) {
      this._openAfpmCadVisualization.showError(this.visualizeErrorMessage);
    }
    
    if ((changedProperties.has('tab') || changedProperties.has('assembly')) && this.tab === Tab.VISUALIZE) {
      this._handleResize();
    }
  }
  _handleResize() {
    if (this.tab === Tab.VISUALIZE && this._openAfpmCadVisualization) {
      const visualizationRoot = this.renderRoot.querySelector('#visualization-root');
      if (visualizationRoot) {
        const width = this._calculateWidth();
        const height = this._calculateHeight();
        this._openAfpmCadVisualization.resize(width, height);
      }
    }
  }
  _calculateWidth() {
    const navigationRailWidth = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--navigation-rail-width'));
    return document.documentElement.clientWidth - navigationRailWidth;
  }
  _calculateHeight() {
    const headerHeight = this.renderRoot.querySelector('header').offsetHeight;
    const tabsHeight = this.renderRoot.querySelector('md-tabs').offsetHeight;
    const offsetHeight = headerHeight + tabsHeight;
    return window.innerHeight - offsetHeight;
  }
  handleTabChange(event) {
    const selectedTab = TABS[event.target.activeTabIndex];
    this.dispatchEvent(new CustomEvent('select-tab', {
      detail: { selectedTab },
      bubbles: true,
      composed: true
    }));
  }
  handleThemeToggle() {
    const targetTheme = this.theme === "light" ? "dark" : "light";
    this.dispatchEvent(new CustomEvent('toggle-theme', {
      detail: { theme: targetTheme },
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
      <header>
        OpenAFPM CAD
        <x-theme-toggle theme=${this.theme} @click=${this.handleThemeToggle}></x-theme-toggle>
      </header>
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
          <div id="visualization-root" data-theme=${this.theme || 'light'}>
            ${!this.visualize && !this.visualizeProgress && !this.visualizeErrorMessage ? html`<x-empty-state></x-empty-state>` : ''}
          </div>
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
