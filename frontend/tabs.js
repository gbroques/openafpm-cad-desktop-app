import { LitElement, html, css } from "lit";

class Tabs extends LitElement {
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
    // guard against click events for slot or x-tabs.
    // ensure event.target is an x-tab element.
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
    return html`
      <nav>
        <slot @click=${this.handleSelect}></slot>
      </nav>
    `;
  }
}

customElements.define("x-tabs", Tabs);
