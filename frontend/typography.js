import { LitElement, html, css } from "lit";

import classNames from "./classNames.js";

class Typography extends LitElement {
  static properties = {
    variant: { type: String }
  };
  constructor() {
    super();
    this.variant = 'p';
  }
  static styles = css`
    :host {
      display: block;
    }
    .typography {
      margin: 0;
      line-height: 1.25;
    }
    .h6 {
      font-size: var(--h6);
    }
    .h5 {
      font-size: var(--h5);
    }
    .h4 {
      font-size: var(--h4);
    }
    .h3 {
      font-size: var(--h3);
    }
    .h2 {
      font-size: var(--h2);
    }
    .h1 {
      font-size: var(--h1);
    }
    .p {
      font-size: 1rem;
    }
  `;
  render() {
    switch (this.variant) {
      case 'h6':
        return html`
          <h6 class=${classNames("typography", this.variant)}>
            <slot></slot>
          </h6>`;
      case 'h5':
        return html`
          <h5 class=${classNames("typography", this.variant)}>
            <slot></slot>
          </h5>`;
      case 'h4':
        return html`
          <h4 class=${classNames("typography", this.variant)}>
            <slot></slot>
          </h4>`; 
      case 'h3':
        return html`
          <h3 class=${classNames("typography", this.variant)}>
            <slot></slot>
          </h3>`;
      case 'h2':
        return html`
          <h2 class=${classNames("typography", this.variant)}>
            <slot></slot>
          </h2>`;
      case 'h1':
        return html`
          <h1 class=${classNames("typography", this.variant)}>
            <slot></slot>
          </h1>`;
      default:
        return html`
          <p class=${classNames("typography", this.variant)}>
            <slot></slot>
          </p>`;
    }
  }
}

customElements.define("x-typography", Typography);
