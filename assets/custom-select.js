import { Component } from '@theme/component';

/**
 * Styled replacement for a native select (select-only combobox pattern). The native select stays in
 * the form as the submitted field and the no-JavaScript fallback; this component hides it, mirrors
 * its value, and surfaces its required-field validation on the custom button.
 *
 * @typedef {object} Refs
 * @property {HTMLSelectElement} select - The native select that is submitted with the form.
 * @property {HTMLButtonElement} button - Opens the list and shows the chosen option.
 * @property {HTMLElement} value - Text of the chosen option, or the placeholder.
 * @property {HTMLElement} listbox - The list of options.
 * @property {HTMLElement[]} options - The option elements, each with a data-value.
 * @property {HTMLElement} [error] - Shows the validation message.
 *
 * @extends {Component<Refs>}
 */
class CustomSelect extends Component {
  requiredRefs = ['select', 'button', 'value', 'listbox', 'options'];

  /** @type {AbortController | undefined} */
  #abortController;

  /** Index of the highlighted option while the list is open. */
  #activeIndex = -1;

  /** Characters typed in quick succession, for type-ahead. */
  #typeahead = '';

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #typeaheadTimer;

  connectedCallback() {
    super.connectedCallback();
    this.#setUp();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#setUp();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController?.abort();
    clearTimeout(this.#typeaheadTimer);
  }

  #setUp() {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    const { select } = this.refs;

    // Only the custom button takes focus once it is shown.
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    // Clicking the field label focuses the hidden select; hand that focus to the visible button.
    select.addEventListener('focus', () => this.refs.button.focus(), { signal });

    // Replace the browser's validation bubble (anchored to a hidden select) with an inline message.
    select.addEventListener(
      'invalid',
      (event) => {
        event.preventDefault();
        this.#showError(select.validationMessage);
        this.refs.button.focus();
      },
      { signal }
    );

    document.addEventListener(
      'pointerdown',
      (event) => {
        if (this.#isOpen && event.target instanceof Node && !this.contains(event.target)) this.close();
      },
      { signal }
    );

    this.#render();
  }

  get #isOpen() {
    return this.refs.button.getAttribute('aria-expanded') === 'true';
  }

  /** Index of the option matching the select's current value. */
  get #selectedIndex() {
    return this.refs.options.findIndex((option) => option.dataset.value === this.refs.select.value);
  }

  /**
   * Opens or closes the list.
   */
  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Opens the list and highlights the chosen option, or the first one.
   * @param {number} [index] - Option to highlight instead.
   */
  open(index) {
    const { button, listbox } = this.refs;
    button.setAttribute('aria-expanded', 'true');
    listbox.hidden = false;
    this.#setActive(index ?? Math.max(this.#selectedIndex, 0));
    listbox.focus();
  }

  /**
   * Closes the list.
   * @param {boolean} [restoreFocus] - Moves focus back to the button.
   */
  close(restoreFocus = false) {
    const { button, listbox } = this.refs;
    button.setAttribute('aria-expanded', 'false');
    listbox.hidden = true;
    listbox.removeAttribute('aria-activedescendant');
    if (restoreFocus) button.focus();
  }

  /**
   * Keyboard support on the closed button.
   * @param {KeyboardEvent} event
   */
  handleButtonKeydown(event) {
    const last = this.refs.options.length - 1;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.open();
        break;
      case 'Home':
        event.preventDefault();
        this.open(0);
        break;
      case 'End':
        event.preventDefault();
        this.open(last);
        break;
      default:
        if (this.#isPrintable(event)) {
          this.open();
          this.#typeAhead(event.key);
        }
    }
  }

  /**
   * Keyboard support inside the open list.
   * @param {KeyboardEvent} event
   */
  handleListKeydown(event) {
    const last = this.refs.options.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.#setActive(Math.min(this.#activeIndex + 1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.#setActive(Math.max(this.#activeIndex - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        this.#setActive(0);
        break;
      case 'End':
        event.preventDefault();
        this.#setActive(last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.#choose(this.#activeIndex);
        this.close(true);
        break;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;
      case 'Tab':
        // Tab keeps the highlighted option, like a native select.
        this.#choose(this.#activeIndex);
        this.close();
        break;
      default:
        if (this.#isPrintable(event)) this.#typeAhead(event.key);
    }
  }

  /**
   * Chooses the clicked option.
   * @param {MouseEvent} event
   */
  handleOptionClick(event) {
    if (!(event.target instanceof Element)) return;
    const option = event.target.closest('[role="option"]');
    if (!(option instanceof HTMLElement)) return;

    this.#choose(this.refs.options.indexOf(option));
    this.close(true);
  }

  /**
   * Writes an option to the native select and notifies the form.
   * @param {number} index
   */
  #choose(index) {
    const option = this.refs.options[index];
    if (!option) return;

    const { select } = this.refs;
    if (select.value !== option.dataset.value) {
      select.value = option.dataset.value ?? '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    this.#hideError();
    this.#render();
  }

  /**
   * Highlights an option and keeps it in view.
   * @param {number} index
   */
  #setActive(index) {
    const { listbox, options } = this.refs;
    this.#activeIndex = index;

    options.forEach((option, optionIndex) => option.classList.toggle('is-active', optionIndex === index));

    const active = options[index];
    if (!active) return;
    listbox.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Moves to the next option starting with the typed characters.
   * @param {string} key
   */
  #typeAhead(key) {
    clearTimeout(this.#typeaheadTimer);
    this.#typeahead += key.toLowerCase();
    this.#typeaheadTimer = setTimeout(() => (this.#typeahead = ''), 500);

    const { options } = this.refs;
    const start = this.#typeahead.length === 1 ? this.#activeIndex + 1 : this.#activeIndex;
    for (let step = 0; step < options.length; step++) {
      const index = (start + step) % options.length;
      if (options[index]?.textContent?.trim().toLowerCase().startsWith(this.#typeahead)) {
        this.#setActive(index);
        return;
      }
    }
  }

  /**
   * @param {KeyboardEvent} event
   */
  #isPrintable(event) {
    return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ';
  }

  /**
   * Shows the select's value on the button and marks the chosen option.
   */
  #render() {
    const { select, value, options } = this.refs;
    const selectedIndex = this.#selectedIndex;
    const selected = options[selectedIndex];

    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === selectedIndex)));

    if (selected) {
      value.textContent = selected.textContent?.trim() ?? '';
      value.classList.remove('custom-select__value--placeholder');
    } else {
      value.textContent = select.options[0]?.textContent?.trim() ?? '';
      value.classList.add('custom-select__value--placeholder');
    }
  }

  /**
   * @param {string} message
   */
  #showError(message) {
    const { button, error } = this.refs;
    this.classList.add('is-invalid');
    button.setAttribute('aria-invalid', 'true');
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  #hideError() {
    const { button, error } = this.refs;
    this.classList.remove('is-invalid');
    button.removeAttribute('aria-invalid');
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }
}

if (!customElements.get('custom-select')) {
  customElements.define('custom-select', CustomSelect);
}
