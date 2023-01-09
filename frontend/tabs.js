import { LitElement, html, css } from "lit";

class Tabs extends LitElement {
  static properties = {
    height: { type: String }
  };
  constructor() {
    super();
    this.height = 'auto';
  }
  static styles = css`
    nav {
      display: flex;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.3);
      font-size: 0.833rem;
      font-weight: bold;
      text-transform: uppercase;
    }
  `;
  handleSelect(event) {
    const children = this._children;
    const selectedIndex = children.indexOf(event.target);
    const selectedValue = children[selectedIndex].getAttribute('value');
    this.dispatchEvent(new CustomEvent('select', {
      detail: {selectedIndex, selectedValue},
      bubbles: true,
      composed: true
    }));
  }
  get _children() {
    const slot = this.shadowRoot.querySelector('slot');
    return slot.assignedElements({flatten: true});
  }
  render() {
    return html`
      <nav style="height: ${this.height};">
        <slot @click=${this.handleSelect}></slot>
      </nav>
    `;
  }
}

customElements.define("x-tabs", Tabs);
