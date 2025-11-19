import { LitElement, html, css } from "lit";
import "@material/web/progress/linear-progress.js";

export default class ProgressBar extends LitElement {
  static properties = {
    percent: { type: Number },
    message: { type: String }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: calc(var(--spacing) * 2);
      width: 100%;
      max-width: 400px;
    }

    md-linear-progress {
      width: 100%;
    }

    .progress-text {
      font-size: var(--h6);
      color: var(--text-color);
      text-align: center;
    }
  `;

  render() {
    const percentValue = this.percent || 0;
    const progressMessage = this.message || 'Loading...';
    
    return html`
      <div class="progress-text">
        ${progressMessage}${percentValue > 0 ? ` - ${percentValue}%` : ''}
      </div>
      <md-linear-progress 
        .value="${percentValue}" 
        max="100">
      </md-linear-progress>
    `;
  }
}

customElements.define('x-progress-bar', ProgressBar);
