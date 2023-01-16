import { LitElement, html, css } from "lit";

import "./button.js";
import "./circularProgress.js";
import initialForm from "./initialForm.js";

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
    _form: { type: Object, state: true },
    _isLoading: { type: Boolean, state: true },
    _errorMessage: { type: String, state: true }
  };
  constructor() {
    super();
    this._variant = WindTurbine.T_SHAPE;
    this._parametersByVariant = {};
    this._form = initialForm;
    this._isLoading = true;
    this._errorMessage = '';
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
      margin: 0;
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
      display: flex;
      gap: calc(var(--spacing) * 2);
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
    x-button::part(button) {
      padding: calc(var(--spacing) * 3);
      text-transform: uppercase;
      font-weight: bold;
      border-radius: 4px;
      font-size: var(--h6);
    }
    .circularProgress {
      margin-left: calc(var(--spacing) * 2);
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
    this.fetch('/defaultparameters')
    .then(parametersByVariant => {
      this._parametersByVariant = parametersByVariant;
      this._form = flatten(parametersByVariant[this._variant]);
    });
  }
  handleSubmit(event) {
    event.preventDefault();
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
    this.fetch(event.target.action, {
      body,
      headers: {
        'Content-Type': 'application/json',
      },
      method: event.target.method
    })
    .then(data => {
      this.dispatchEvent(new CustomEvent('visualize', {
        detail: data,
        bubbles: true,
        composed: true
      }));
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
      })
      .catch(error => {
        this._errorMessage = error.message;
      })
      .finally(() => {
        this._isLoading = false;
      });
  }
  handleValueChange(event) {
    const {name, value} = event.target;
    const form = this._form;
    this._form = {...form, [name]: value};
  }
  render() {
    const circularProgressSize = "28px";
    return html`
      <form action="visualize" method="post" @submit=${this.handleSubmit}>
        <label>
          Preset
          <select
            name="Variant"
            .value=${this._variant}
            @change=${this.handleSelect}
            ?disabled=${this._isLoading}
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
            <label>
              Rotor Disk Radius
              <input
                type="number"
                name="RotorDiskRadius"
                .value=${this._form["RotorDiskRadius"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Rotor Disk Inner Radius
              <input
                type="number"
                name="RotorDiskInnerRadius"
                .value=${this._form["RotorDiskInnerRadius"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Disk Thickness
              <input
                type="number"
                name="DiskThickness"
                .value=${this._form["DiskThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Magnet Length
              <input
                type="number"
                name="MagnetLength"
                .value=${this._form["MagnetLength"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Magnet Width
              <input
                type="number"
                name="MagnetWidth"
                .value=${this._form["MagnetWidth"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Magnet Thickness
              <input
                type="number"
                name="MagnetThickness"
                .value=${this._form["MagnetThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Magnet Material
              <select
                name="MagnetMaterial"
                .value=${this._form["MagnetMaterial"]}
                ?disabled=${this._isLoading}
                @change=${this.handleValueChange}>
                <option value="Neodymium" ?selected=${this._form["MagnetMaterial"] === "Neodymium"}>
                  Neodymium
                </option>
                <option value="Ferrite" ?selected=${this._form["MagnetMaterial"] === "Ferrite"}>
                  Ferrite
                </option>
              </select>
            </label>
            <label>
              Number Magnet
              <input
                type="number"
                name="NumberMagnet"
                .value=${this._form["NumberMagnet"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Inner Distance Between Magnets
              <input
                type="number"
                name="InnerDistanceBetweenMagnets"
                .value=${this._form["InnerDistanceBetweenMagnets"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Stator Thickness
              <input
                type="number"
                name="StatorThickness"
                .value=${this._form["StatorThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Mechanical Clearance
              <input
                type="number"
                name="MechanicalClearance"
                .value=${this._form["MechanicalClearance"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Coil Type
              <input
                type="number"
                name="CoilType"
                .value=${this._form["CoilType"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Number of Coils Per Phase
              <input
                type="number"
                name="NumberOfCoilsPerPhase"
                .value=${this._form["NumberOfCoilsPerPhase"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Coil Leg Width
              <input
                type="number"
                name="CoilLegWidth"
                .value=${this._form["CoilLegWidth"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Coil Inner Width 1
              <input
                type="number"
                name="CoilInnerWidth1"
                .value=${this._form["CoilInnerWidth1"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Coil Inner Width 2
              <input
                type="number"
                name="CoilInnerWidth2"
                .value=${this._form["CoilInnerWidth2"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
        </fieldset>
        <fieldset>
          <legend>
            Furling
            ${this._isLoading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            <label>
              Vertical Plane Angle
              <input
                type="number"
                name="VerticalPlaneAngle"
                .value=${this._form["VerticalPlaneAngle"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Horizontal Plane Angle
              <input
                type="number"
                name="HorizontalPlaneAngle"
                .value=${this._form["HorizontalPlaneAngle"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Offset
              <input
                type="number"
                name="Offset"
                .value=${this._form["Offset"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Bracket Length
              <input
                type="number"
                name="BracketLength"
                .value=${this._form["BracketLength"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Bracket Width
              <input
                type="number"
                name="BracketWidth"
                .value=${this._form["BracketWidth"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Bracket Thickness
              <input
                type="number"
                name="BracketThickness"
                .value=${this._form["BracketThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Boom Length
              <input
                type="number"
                name="BoomLength"
                .value=${this._form["BoomLength"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Boom Pipe Radius
              <input
                type="number"
                name="BoomPipeRadius"
                .value=${this._form["BoomPipeRadius"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Boom Pipe Thickness
              <input
                type="number"
                name="BoomPipeThickness"
                .value=${this._form["BoomPipeThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Vane Length
              <input
                type="number"
                name="VaneLength"
                .value=${this._form["VaneLength"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Vane Thickness
              <input
                type="number"
                name="VaneThickness"
                .value=${this._form["VaneThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Vane Width
              <input
                type="number"
                name="VaneWidth"
                .value=${this._form["VaneWidth"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
        </fieldset>
        <fieldset>
          <legend>
            User
            ${this._isLoading ? html`<x-circular-progress size="${circularProgressSize}" class="circularProgress"></x-circular-progress>` : ""}
          </legend>
          <section>
            <label>
              Hub Holes Placement
              <input
                type="number"
                name="HubHolesPlacement"
                .value=${this._form["HubHolesPlacement"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Hub Holes
              <input
                type="number"
                name="HubHoles"
                .value=${this._form["HubHoles"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Holes
              <input
                type="number"
                name="Holes"
                .value=${this._form["Holes"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Metal Length L
              <input
                type="number"
                name="MetalLengthL"
                .value=${this._form["MetalLengthL"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Metal Thickness L
              <input
                type="number"
                name="MetalThicknessL"
                .value=${this._form["MetalThicknessL"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Flat Metal Thickness
              <input
                type="number"
                name="FlatMetalThickness"
                .value=${this._form["FlatMetalThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Yaw Pipe Diameter
              <input
                type="number"
                name="YawPipeDiameter"
                .value=${this._form["YawPipeDiameter"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Pipe Thickness
              <input
                type="number"
                name="PipeThickness"
                .value=${this._form["PipeThickness"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
          <section>
            <label>
              Rotor Inner Circle
              <input
                type="number"
                name="RotorInnerCircle"
                .value=${this._form["RotorInnerCircle"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
            <label>
              Resine Rotor Margin
              <input
                type="number"
                name="ResineRotorMargin"
                .value=${this._form["ResineRotorMargin"]}
                ?disabled=${this._isLoading}
                @keypress=${this.handleValueChange}
              />
            </label>
          </section>
        </fieldset>
        ${this._errorMessage ? html`<x-error-banner .message="${this._errorMessage}" @close=${this.handleCloseError}></x-error-banner>` : ''}
        <x-button variant="primary" type="submit" ?disabled=${this._isLoading}>
          ${this._isLoading ? "Loading..." : "Visualize"}
        </x-button>
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
