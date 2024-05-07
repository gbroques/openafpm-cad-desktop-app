import { LitElement, html, css } from "lit";

import classNames from "./classNames.js";

class Button extends LitElement {
  static properties = {
    disabled: { type: Boolean },
    type: { type: String },
    variant: { type: String }
  };
  constructor() {
    super();
    this.disabled = false;
    this.type = 'button';
    this.variant = 'primary';
  }
  static styles = css`
    :host {
      display: inline;
    }
    .button {
      font-family: var(--font-family);
      font-size: var(--root-font-size);
      border: none;
      cursor: pointer;
      width: 100%;
    }
    .primary {
      background-color: var(--primary-color-main);
      color: var(--background-default);
      box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.30);
      transition: var(--transition-duration-standard) ease-in-out;
    }
    .primary:hover {
      background-color: var(--primary-color-dark);
    }
    .secondary {
      background-color: var(--background-default);
      color: var(--primary-color-main);
      font-weight: 500;
      transition-duration: var(--transition-duration-standard);
      transition-timing-function: ease-in-out;
      transition-property: color, background-color, background-size;
      padding: calc(var(--spacing) * 1) calc(var(--spacing) * 2);
      border-radius: 4px;
    }
    .secondary:hover {
      /* Source: https://codepen.io/jamesharmer/pen/NWKwXKJ */
      background-color: rgb(from var(--primary-color-main) r g b / 0.08);
      background-image: radial-gradient(circle, transparent 1%, rgb(from var(--primary-color-main) r g b / 0.08) 1%);
      background-position: center;
      background-size: 15000%;
    }
    .secondary:active {
      background-color: rgb(from var(--primary-color-main) r g b / 0.10);
      background-size: 100%;
      transition-duration: 0s;
    }
    .error {
      background-color: var(--error-color-main);
      color: white;
    }
    .error:hover {
      background-color: var(--error-color-dark);
    }
    .button:disabled {
      box-shadow: none;
      cursor: default;
      background-color: var(--background-disabled);
      color: var(--text-disabled);
    }
  `;
  render() {
    return html`
      <button
        part="button"
        class=${classNames("button", this.variant)}
        ?disabled=${this.disabled}
        .type="${this.type}">
        <slot></slot>
      </button>
    `;
  }
}

customElements.define("x-button", Button);
