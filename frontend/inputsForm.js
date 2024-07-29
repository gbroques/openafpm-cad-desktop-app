import { LitElement, html, css } from "lit";
import { ifDefined } from 'lit-html/directives/if-defined.js';
import { Preset } from "./enums.js";
import groupParameters from "./groupParameters.js";

import "@material/web/button/text-button.js";
import "./circularProgress.js";

class InputsForm extends LitElement {
  static properties = {
    preset: { type: String },
    parametersByPreset: { attribute: false },
    parametersSchemaByPreset: { attribute: false }, 
    form: { attribute: false },
    loading: { type: Boolean },
    errorMessage: { type: String }
  };
  static styles = css`
    :host {
      display: block;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: calc(var(--spacing) * 2);
    }
    .form-controls-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    fieldset {
      display: flex;
      flex-direction: column;
      gap: calc(var(--spacing) * 2);
      margin: 0px 0px calc(var(--spacing) * 2) 0px;
      padding: 0px 0px calc(var(--spacing) * 2) 0px;
      border-top: none;
      border-right: none;
      border-left: none;
      border-bottom: 1px solid var(--divider);
    }
    legend {
      display: flex;
      align-items: center;
      font-size: var(--h2);
      padding: 0;
      line-height: 1.25;
      margin-bottom: calc(var(--spacing) * 2);
    }
    section {
      display: grid;
      gap: calc(var(--spacing) * 2);
      /* https://css-tricks.com/look-ma-no-media-queries-responsive-layouts-using-css-grid/ */
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    label {
      font-weight: 500;
    }
    section input, section select {
      width: 100%;
      margin-top: calc(var(--spacing) * 1);
      box-sizing: border-box;
      font-size: var(--h6);
    }
    input, select {
      color: var(--text-color);
      background-color: var(--background-paper);
      padding: calc(var(--spacing) * 1);
      border: none;
      transition: var(--transition-duration-standard) ease-in-out;
      border-radius: 4px;
    }
    .presetSelect {
      margin-left: calc(var(--spacing) * 1);
    }
    input:focus-visible, select:focus-visible {
      outline: 1px solid var(--primary-color-main);
    }
    input:disabled, select:disabled {
      background-color: var(--background-disabled);
      color: var(--text-disabled);
      opacity: 1;
    }
    input:invalid {
      outline: 1px solid var(--validation-color-main);
    }
    button[type="submit"] {
      /* base button styles */
      border: none;
      box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.30);
      cursor: pointer;
      width: 100%;
      transition: var(--transition-duration-standard) ease-in-out;

      /* primary styles */
      background-color: var(--primary-color-main);
      color: var(--background-default);

      padding: calc(var(--spacing) * 3);
      text-transform: uppercase;
      font-weight: bold;
      border-radius: 4px;
      font-size: var(--h6);
      position: relative;
    }
    button[type="submit"]:hover {
      background-color: var(--primary-color-dark);
    }
    button[type="submit"]:disabled {
      box-shadow: none;
      cursor: default;
      background-color: var(--background-disabled);
      color: var(--text-disabled);
    }
    button[type="submit"]:active {
      box-shadow: none;
      top: 1px;
    }
    .circularProgress {
      margin-left: calc(var(--spacing) * 2);
    }
    .validationMessage {
      color: var(--validation-color-main);
      font-weight: normal;
      font-size: var(--h6);
      min-height: 16px;
      margin-bottom: 0;
      margin-top: calc(var(--spacing) * 1);
    }
    .submitButtonCircularProgress {
      margin-left: calc(var(--spacing) * 1.5);
      position: absolute;
    }
    .importButton {
      margin-right: calc(var(--spacing) * 1);
    }
  `;
  handlePresetSelect(event) {
    const selectedPreset = event.target.value;
    this.dispatchEvent(new CustomEvent('select-preset', {
      detail: { selectedPreset },
      bubbles: true,
      composed: true
    }));
  }
  handleCloseError() {
    this.dispatchEvent(new Event('close-error', {
      bubbles: true,
      composed: true
    }));
  }
  handleSubmit(event) {
    event.preventDefault();
    this.dispatchEvent(new Event('visualize', {
      bubbles: true,
      composed: true
    }));
  }
  handleValueChange(event) {
    const { target } = event;
    const { name, value, validationMessage } = target;
    this.dispatchEvent(new CustomEvent('input-change', {
      detail: { name, value, validationMessage },
      bubbles: true,
      composed: true
    }));
  }
  getGroupParameters(groupName) {
    const groupProperties = this.parametersSchemaByPreset?.[this.preset].properties[groupName].properties ?? {};
    return Object.entries(groupProperties);
  }
  handleImport(event) {
    this.renderRoot.querySelector('#file-upload').click();
    event.preventDefault();
  }
  handleFileUploadChange(event) {
    const firstFile = event.target.files[0];
    this.dispatchEvent(new CustomEvent('file-upload', {
      detail: {file: firstFile},
      bubbles: true,
      composed: true
    }));
  }
  handleExport() {
    if (this.parametersByPreset?.[this.preset]) {
      const parametersByGroup = groupParameters(this.form, this.parametersByPreset[this.preset]);
      const parametersByGroupWithPreset = {preset: this.preset, ...parametersByGroup};
      download(JSON.stringify(parametersByGroupWithPreset, null, 2), 'application/json', this.preset + '.json');
    }
  }
  render() {
    const circularProgressSize = "28px";
    const isFormLoading = Object.keys(this.parametersSchemaByPreset ?? {}).length === 0 && !this.errorMessage;
    return html`
      <form @submit=${this.handleSubmit}>
        <div class="form-controls-container">
          <label>
            Preset
            <select
              name="Preset"
              @change=${this.handlePresetSelect}
              class="presetSelect"
            >
              <option value=${Preset.T_SHAPE} ?selected=${this.preset === Preset.T_SHAPE}>T Shape</option>
              <option value=${Preset.H_SHAPE} ?selected=${this.preset === Preset.H_SHAPE}>H Shape</option>
              <option value=${Preset.STAR_SHAPE} ?selected=${this.preset === Preset.STAR_SHAPE}>Star Shape</option>
              <option value=${Preset.T_SHAPE_2F} ?selected=${this.preset === Preset.T_SHAPE_2F}>T Shape 2F</option>
              <option value=${Preset.H_SHAPE_4F} ?selected=${this.preset === Preset.H_SHAPE_4F}>H Shape 4F</option>
            </select>
          </label>
          <div>
            <input id="file-upload" type="file" accept="application/json,.mat" hidden @change=${this.handleFileUploadChange} />
            <md-text-button class="importButton" @click=${this.handleImport} title="Import JSON or .mat files">
              Import
              <!-- file_download material icon -->
              <svg slot="icon" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </md-text-button>
            <md-text-button type="button" @click=${this.handleExport}>
              Export
              <!-- file_upload material icon -->
              <svg slot="icon" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
            </md-text-button>
          </div>
        </div>
        <fieldset>
          <legend>
            MagnAFPM
            ${this.loading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            ${this.getGroupParameters('magnafpm').map(([name, schema]) =>
              SchemaInput({
                name,
                schema,
                value: this.form[name].value,
                validationMessage: this.form[name].validationMessage,
                onValueChange: this.handleValueChange
              })
            )}
          </section>
        </fieldset>
        <fieldset>
          <legend>
            Furling
            ${this.loading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            ${this.getGroupParameters('furling').map(([name, schema]) =>
              SchemaInput({
                name,
                schema,
                value: this.form[name].value,
                validationMessage: this.form[name].validationMessage,
                onValueChange: this.handleValueChange
              })
            )}
          </section>
        </fieldset>
        <fieldset>
          <legend>
            User
            ${this.loading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            ${this.getGroupParameters('user').map(([name, schema]) =>
              SchemaInput({
                name,
                schema,
                value: this.form[name].value,
                validationMessage: this.form[name].validationMessage,
                onValueChange: this.handleValueChange
              })
            )}
          </section>
        </fieldset>
        ${this.errorMessage ?
          html`<x-error-banner .message="${this.errorMessage}" closeable @close=${this.handleCloseError}></x-error-banner>` :
          ""
        }
        <button type="submit" ?disabled=${isFormLoading || this.errorMessage} style="position: relative">
          ${isFormLoading ? "Loading..." : "Visualize"}
          ${!isFormLoading && this.loading ? html`<x-circular-progress size="var(--h6)" class="submitButtonCircularProgress" color="var(--background-default)"></x-circular-progress>` : ""}
        </button>
      </form>
    `;
  }
}

function SchemaInput(props) {
  return props.schema.enum ?
    html`
      <label .title="${props.schema.description}">
        ${props.schema.title}
        <select
          name="${props.name}"
          ?disabled=${props.disabled}
          @change=${props.onValueChange}>
          ${props.schema.enum.map(value =>
            html`
              <option value="${value}" ?selected=${props.value === value}>
                ${value}
              </option>
            `
          )}
        </select>
      </label>
    ` :
    html`
      <label .title="${props.schema.description}">
        ${props.schema.title}
        <input
          type="number"
          name="${props.name}"
          min=${ifDefined(props.schema.minimum)}
          max=${ifDefined(props.schema.maximum)}
          step=${ifDefined(props.schema.multipleOf)}
          .value="${props.value}"
          ?disabled=${props.disabled}
          @input=${props.onValueChange}
          required
        />
        <p class="validationMessage">${props.validationMessage}</p>
    </label>
  `;
}

function download(content, mimeType, filename) {
  const a = document.createElement('a');
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.click();
}

customElements.define("x-inputs-form", InputsForm);
