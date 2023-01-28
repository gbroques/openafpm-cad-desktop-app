import { LitElement, html, css } from "lit";
import { ifDefined } from 'lit-html/directives/if-defined.js';

import "./circularProgress.js";

const WindTurbine = {
  T_SHAPE: 'T Shape',
  H_SHAPE: 'H Shape',
  STAR_SHAPE: 'Star Shape',
  T_SHAPE_2F: 'T Shape 2F'
};

class InputsForm extends LitElement {
  static properties = {
    _variant: { type: String, state: true },
    _parametersByVariant: { type: Object, state: true },
    _parametersSchema: { type: Object, state: true }, 
    _form: { type: Object, state: true },
    _isLoading: { type: Boolean, state: true },
    _errorMessage: { type: String, state: true }
  };
  constructor() {
    super();
    this._variant = WindTurbine.T_SHAPE;
    this._parametersByVariant = {};
    this._parametersSchema = {};
    this._form = {};
    this._isLoading = true;
    this._errorMessage = '';
    this._abortController = null;
  }
  static styles = css`
    :host {
      display: block;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: calc(var(--spacing) * 2);
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
      flex: 1;
      font-weight: bold;
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
    .variantSelect {
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
    /* duplicate x-button styles since web components don't work nicely with forms */
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
    .positionAbsolute {
      position: absolute;
    }
  `;
  handleSelect(event) {
    const selectedVariant = event.target.value; 
    this._variant = selectedVariant;
    const parameters = this._parametersByVariant[selectedVariant];
    this._form = flatten(parameters);
  }
  handleCloseError() {
    this._errorMessage = '';
  }
  firstUpdated() {
    const defaultParametersPromise = this.fetch('/defaultparameters')
    const parametersSchemaPromise = this.fetch('/parametersschema');

    const promise = Promise.all([defaultParametersPromise, parametersSchemaPromise]);
    promise.then(([parametersByVariant, parametersSchema]) => {
      this._parametersByVariant = parametersByVariant;
      this._form = flatten(parametersByVariant[this._variant]);
      this._parametersSchema = parametersSchema;
    });
    this.setPromiseToState(promise);
  }
  handleSubmit(event) {
    event.preventDefault();
    if (this._isLoading) this._abortController.abort();
    this._abortController = new AbortController();
    const formData = new FormData(event.target);
    const valueByKey = {};
    formData.forEach((value, key) => {
      valueByKey[key] = value;
    });
    const parameters = this._parametersByVariant[this._variant];
    const groupByKey = flattenToGroupByKey(parameters);
    const valueTransformer = value => isNaN(value) ? value : parseFloat(value);
    const parameterByGroup = createdNestedObject(valueByKey,
      key => groupByKey[key],
      valueTransformer);
    const body = JSON.stringify(parameterByGroup);
    this._isLoading = true;
    this.createArchive(body);
    const visualizePromise = this.fetch(event.target.action, {
      body,
      headers: {
        'Content-Type': 'application/json',
      },
      method: event.target.method,
      signal: this._abortController.signal
    })
    .then(data => {
      this.dispatchEvent(new CustomEvent('visualize', {
        detail: data,
        bubbles: true,
        composed: true
      }));
    });
    this.setPromiseToState(visualizePromise);
  }
  createArchive(body) {
    this.fetch('/archive', {
      body,
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: this._abortController.signal
    })
    .then(() => {
      this.dispatchEvent(new Event('archive-created', {
        bubbles: true,
        composed: true
      }));
    })
    .catch(error => {
      if (error.name !== 'AbortError') {
        this._errorMessage = error.message;
      }
    });
  }
  setPromiseToState(promise) {
    promise
    .then(() => {
      this._isLoading = false;
    })
    .catch(error => {
      if (error.name !== 'AbortError') {
        this._errorMessage = error.message;
        this._isLoading = false;
      }
    });
  }
  fetch(...args) {
    return fetch(...args)
      .then(r => r.json())
      .then(r => {
        if (r.error) {
          throw new Error(r.error);
        }
        return r;
      });
  }
  handleValueChange(event) {
    const {target} = event;
    if (target.nextElementSibling) {
      target.nextElementSibling.innerText = target.validationMessage;
    }
    const {name, value} = target;
    const form = this._form;
    this._form = {...form, [name]: value};
  }
  getGroupParameters(groupName) {
    const groupProperties = this._parametersSchema?.properties?.[groupName]?.properties ?? {};
    return Object.entries(groupProperties);
  }
  render() {
    const circularProgressSize = "28px";
    const isFormLoading = Object.keys(this._parametersSchema).length === 0;
    return html`
      <form action="visualize" method="post" @submit=${this.handleSubmit}>
        <label>
          Preset
          <select
            name="Variant"
            @change=${this.handleSelect}
            ?disabled=${isFormLoading}
            class="variantSelect"
          >
            <option value="T Shape" ?selected=${this._variant === "T Shape"}>T Shape</option>
            <option value="H Shape" ?selected=${this._variant === "H Shape"}>H Shape</option>
            <option value="Star Shape" ?selected=${this._variant === "Star Shape"}>Star Shape</option>
            <option value="T Shape 2F" ?selected=${this._variant === "T Shape 2F"}>T Shape 2F</option>
          </select>
        </label>
        <fieldset>
          <legend>
            MagnAFPM
            ${this._isLoading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            ${this.getGroupParameters('magnafpm').map(([name, schema]) => 
              SchemaInput({
                name,
                schema,
                value: this._form[name],
                onValueChange: this.handleValueChange
              })
            )}
          </section>
        </fieldset>
        <fieldset>
          <legend>
            Furling
            ${this._isLoading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            ${this.getGroupParameters('furling').map(([name, schema]) =>
              SchemaInput({
                name,
                schema,
                value: this._form[name],
                onValueChange: this.handleValueChange
              })
            )}
          </section>
        </fieldset>
        <fieldset>
          <legend>
            User
            ${this._isLoading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            ${this.getGroupParameters('user').map(([name, schema]) =>
              SchemaInput({
                name,
                schema,
                value: this._form[name],
                onValueChange: this.handleValueChange
              })
            )}
          </section>
        </fieldset>
        ${this._errorMessage ? html`<x-error-banner .message="${this._errorMessage}" @close=${this.handleCloseError}></x-error-banner>` : ''}
        <button type="submit" ?disabled=${isFormLoading} style="position: relative">
          ${isFormLoading ? "Loading..." : "Visualize"}
          ${!isFormLoading && this._isLoading ? html`<x-circular-progress size="var(--h6)" class="positionAbsolute circularProgress" color="white"></x-circular-progress>` : ""}
        </button>
      </form>
    `;
  }
}

function flatten(object) {
  return Object.values(object)
    .reduce((acc, obj) => ({...acc, ...obj}), {});
}

function flattenToGroupByKey(parameters) {
  const entries = Object.entries(parameters);
  return entries.reduce((acc, entry) => {
    const [group, valueByKey] = entry;
    const keys = Object.keys(valueByKey);
    const groupByKey = keys.reduce((obj, key) => {
      return {...obj, [key]: group};
    }, {});
    return {...acc, ...groupByKey};
  }, {});
}

function createdNestedObject(object, groupGetter, valueTransformer) {
  const entries = Object.entries(object);
  return entries.reduce((acc, entry) => {
    const [key, value] = entry;
    const group = groupGetter(key);
    if (group === undefined) {
      return acc;
    }
    if (acc[group] === undefined) {
      acc[group] = {};
    }
    acc[group][key] = valueTransformer(value);
    return acc;
  }, {});
}

customElements.define("x-inputs-form", InputsForm);

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
          .step=${props.schema.type === "integer" ? "1" : "any"}
          max=${ifDefined(props.schema.maximum)}
          .value="${props.value}"
          ?disabled=${props.disabled}
          @input=${props.onValueChange}
          required
        />
        <p class="validationMessage"></p>
    </label>
  `
}
