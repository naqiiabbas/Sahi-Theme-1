import { Component } from '@theme/component';

/**
 * Header search icon that expands into an inline search field.
 * The toggle is a link to the search page, so search still works before this module loads.
 *
 * @typedef {object} Refs
 * @property {HTMLAnchorElement} toggle - The search icon link that opens the field.
 * @property {HTMLFormElement} form - The search form revealed when open.
 * @property {HTMLInputElement} input - The search query field.
 *
 * @extends {Component<Refs>}
 */
class HeaderSearchBar extends Component {
  requiredRefs = ['toggle', 'form', 'input'];

  /** @type {AbortController | null} */
  #openController = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#openController?.abort();
    this.#openController = null;
  }

  get isOpen() {
    return this.hasAttribute('open');
  }

  /**
   * Opens the field instead of following the search page link.
   * @param {MouseEvent} event - The toggle click event.
   */
  open(event) {
    event?.preventDefault();
    if (this.isOpen) return;

    this.setAttribute('open', '');
    this.refs.toggle.setAttribute('aria-expanded', 'true');
    this.refs.form.inert = false;
    this.refs.input.focus();

    this.#openController = new AbortController();
    const { signal } = this.#openController;
    document.addEventListener('pointerdown', this.#onPointerDown, { signal });
    this.addEventListener('keydown', this.#onKeyDown, { signal });
    this.addEventListener('focusout', this.#onFocusOut, { signal });
  }

  /**
   * Closes the field.
   * @param {boolean} [restoreFocus=false] - Whether to move focus back to the icon.
   */
  close(restoreFocus = false) {
    if (!this.isOpen) return;

    this.#openController?.abort();
    this.#openController = null;

    this.removeAttribute('open');
    this.refs.toggle.setAttribute('aria-expanded', 'false');
    this.refs.form.inert = true;

    if (restoreFocus) this.refs.toggle.focus();
  }

  /**
   * Handles the close button.
   */
  handleClose = () => {
    this.close(true);
  };

  /**
   * Keeps empty searches on the page instead of loading an empty results page.
   * @param {SubmitEvent} event - The form submit event.
   */
  handleSubmit = (event) => {
    if (this.refs.input.value.trim()) return;

    event.preventDefault();
    this.refs.input.focus();
  };

  /**
   * @param {PointerEvent} event
   */
  #onPointerDown = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) return;
    this.close();
  };

  /**
   * @param {KeyboardEvent} event
   */
  #onKeyDown = (event) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    this.close(true);
  };

  /**
   * Closes when keyboard focus leaves an empty field.
   * @param {FocusEvent} event
   */
  #onFocusOut = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    if (this.refs.input.value.trim()) return;

    this.close();
  };
}

if (!customElements.get('header-search-bar')) {
  customElements.define('header-search-bar', HeaderSearchBar);
}
