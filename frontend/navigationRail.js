import { LitElement, html, css } from "lit";

import "./typography.js";
import "./windTurbineIcon.js";

class NavigationRail extends LitElement {
  static styles = css`
    :host {
      height: 100%;
      width: var(--navigation-rail-width);
      height: 100%;
      box-shadow: 3px 0px 5px rgba(0, 0, 0, 0.2);
      background-color: var(--background-navigation);
      transition: var(--transition-duration-standard) ease-in-out;
    }
  `;
  handleSelect(event) {
    // guard against click events for slot or x-navigation-rail.
    // ensure event.target is an x-navigation-rail-button element.
    if (event.eventPhase === Event.BUBBLING_PHASE) {
      const children = this._children;
      const selectedIndex = children.indexOf(event.target);
      if (children[selectedIndex]) {
        const selectedValue = children[selectedIndex].getAttribute('value');
        this.dispatchEvent(new CustomEvent('select', {
          detail: {selectedIndex, selectedValue},
          bubbles: true,
          composed: true
        }));
      }
    }
  }
  get _children() {
    const slot = this.shadowRoot.querySelector('slot');
    return slot.assignedElements({flatten: true});
  }
  render() {
    return html`<slot @click=${this.handleSelect}></slot>`;
  }
}

customElements.define("x-navigation-rail", NavigationRail);
