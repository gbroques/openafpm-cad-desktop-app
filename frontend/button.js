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
      border: none;
      box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.30);
      cursor: pointer;
      width: 100%;
      transition: var(--transition-duration-standard) ease-in-out;
    }
    .primary {
      background-color: var(--primary-color-main);
      color: var(--background-default);
    }
    .primary:hover {
      background-color: var(--primary-color-dark);
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
