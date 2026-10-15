import { Component } from '@theme/component';

/**
 * Shows how many characters a field holds, e.g. "120/500". The limit itself is the field's
 * maxlength attribute, so the counter is only a visual aid and the form works without it.
 *
 * @typedef {object} Refs
 * @property {HTMLInputElement | HTMLTextAreaElement} input - The counted field.
 * @property {HTMLElement} count - Shows the current character count.
 *
 * @extends {Component<Refs>}
 */
class CharacterCounter extends Component {
  requiredRefs = ['input', 'count'];

  connectedCallback() {
    super.connectedCallback();
    // Browsers can restore a typed value on back navigation.
    this.update();
  }

  updatedCallback() {
    super.updatedCallback();
    this.update();
  }

  /**
   * Updates the count from the field's current value.
   */
  update() {
    const { input, count } = this.refs;
    count.textContent = String(input.value.length);
  }
}

if (!customElements.get('character-counter')) {
  customElements.define('character-counter', CharacterCounter);
}
