import { LitElement, html, css } from "lit";

/**
 * @see https://www.webtips.dev/how-to-recreate-the-material-circular-loader-in-css
 */
class CircularProgress extends LitElement {
  static properties = {
    style: { type: String },
    class: { type: String },
    size: { type: String }
  };
  constructor() {
    super();
    this.style = "";
  }
  static styles = css`
    :host {
      display: inline-flex;
    }
    .loader-path {
      fill: none;
      stroke: var(--primary-color-main);
      transition: stroke var(--transition-duration-standard) ease-in-out;
      stroke-width: 3px;
      stroke-linecap: round;
      stroke-dasharray: 10, 10;
      animation: animate-stroke 1.5s ease-in-out infinite;
    }
    @keyframes rotate {
      100% {
        transform: rotate(360deg);
      }
    }
    .circular-loader {
      animation: rotate 2s linear infinite;
    }
    @keyframes animate-stroke {
      0% {
        stroke-dasharray: 1, 200;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: -35;
      }
      100% {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: -124;
      }
    }
  `;
  render() {
    return html`
      <div class="${this.class}" style="width: ${this.size}; height: ${this.size}; display: inline-block; ${this.style}">
        <svg class="circular-loader" viewBox="25 25 50 50">
          <circle class="loader-path" cx="50" cy="50" r="20" fill="none"></circle>
        </svg>
      </div>
    `;
  }
}

customElements.define("x-circular-progress", CircularProgress);
