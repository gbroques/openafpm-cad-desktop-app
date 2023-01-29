import { LitElement, html, css } from "lit";

/**
 * Adapted from:
 * @see https://codepen.io/VictorPiella/pen/poedmze
 */
class ThemeToggle extends LitElement {
  static properties = {
    theme: { type: String }
  };
  constructor() {
    super();
    this.theme = "light";
  }
  static styles = css`
    .container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .switch {
      width: 42px;
      padding: 3px;
      border: 2px solid var(--background-default);
      margin: 0 5px;
      border-radius: 1rem;
      text-align: left;
      transition: all var(--transition-duration-standard);
    }
    .switch::after {
      display: block;
      width: var(--h6);
      height: var(--h6);
      background-color: var(--background-default);
      border-radius: 0.5rem;
      content: "";
      transition: all var(--transition-duration-standard);
    }
    .is-sr-only {
      position: absolute;
      overflow: hidden;
      width: 1px;
      height: 1px;
      padding: 0;
      border: 0;
      margin: -1px;
      clip: rect(1px, 1px, 1px, 1px);
      clip-path: inset(50%);
      word-wrap: normal;
    }
    .checkbox:checked + .switch::after {
      /* Width minus size of circular switch */
      transform: translateX(calc(42px - var(--h6)));
    }
    .icon {
      transition: fill var(--transition-duration-standard) ease-in-out;
      fill: var(--background-default);
      width: 21px;
    }
  `;
  render() {
    return html`
      <div class="container">
        <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M0 0h24v24H0z" fill="none" />
          <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>
        </svg>
        <input type="checkbox" ?checked=${this.theme === 'dark'} class="checkbox is-sr-only" />
        <span class="switch"></span>
        <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M0 0h24v24H0V0z" fill="none" />
          <path d="M12.01 12c0-3.57 2.2-6.62 5.31-7.87.89-.36.75-1.69-.19-1.9-1.1-.24-2.27-.3-3.48-.14-4.51.6-8.12 4.31-8.59 8.83C4.44 16.93 9.13 22 15.01 22c.73 0 1.43-.08 2.12-.23.95-.21 1.1-1.53.2-1.9-3.22-1.29-5.33-4.41-5.32-7.87z"/>
        </svg>
      </div>
    `;
  }
}

customElements.define("x-theme-toggle", ThemeToggle);
