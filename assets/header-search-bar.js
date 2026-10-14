import { Component } from '@theme/component';
import { sectionRenderer } from '@theme/section-renderer';
import { debounce } from '@theme/utilities';

const RESULTS_SECTION_ID = 'header-search-results';

/**
 * Header search icon that expands into an inline field with live product suggestions.
 * The toggle is a link to the search page, so search still works before this module loads.
 * Once enhanced, Enter does nothing: shoppers pick a suggestion from the dropdown.
 *
 * @typedef {object} Refs
 * @property {HTMLAnchorElement} toggle - The search icon link that opens the field.
 * @property {HTMLFormElement} form - The search form revealed when open.
 * @property {HTMLInputElement} input - The search query field.
 * @property {HTMLElement} results - The dropdown that holds product suggestions.
 * @property {HTMLElement} status - The live region that announces result counts.
 *
 * @extends {Component<Refs>}
 */
class HeaderSearchBar extends Component {
  requiredRefs = ['toggle', 'form', 'input', 'results', 'status'];

  /** @type {AbortController | null} */
  #openController = null;

  /** @type {AbortController | null} */
  #searchController = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#search.cancel();
    this.#openController?.abort();
    this.#openController = null;
    this.#searchController?.abort();
    this.#searchController = null;
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

    if (this.refs.results.childElementCount) this.#showResults();

    this.#openController = new AbortController();
    const { signal } = this.#openController;
    document.addEventListener('pointerdown', this.#onPointerDown, { signal });
    this.addEventListener('keydown', this.#onKeyDown, { signal });
    this.addEventListener('focusout', this.#onFocusOut, { signal });
  }

  /**
   * Closes the field and its suggestions.
   * @param {boolean} [restoreFocus=false] - Whether to move focus back to the icon.
   */
  close(restoreFocus = false) {
    if (!this.isOpen) return;

    this.#openController?.abort();
    this.#openController = null;

    this.removeAttribute('open');
    this.#hideResults();
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
   * Suggestions replace submitting; the form only submits before this module loads.
   * @param {SubmitEvent} event - The form submit event.
   */
  handleSubmit = (event) => {
    event.preventDefault();
  };

  /**
   * Fetches suggestions as the shopper types.
   */
  handleInput = () => {
    this.#search();
  };

  #search = debounce(() => {
    const term = this.refs.input.value.trim();

    if (!term) {
      this.#searchController?.abort();
      this.#searchController = null;
      this.#clearResults();
      return;
    }

    this.#fetchResults(term);
  }, 250);

  /**
   * @param {string} term - The search term.
   */
  async #fetchResults(term) {
    this.#searchController?.abort();
    const controller = new AbortController();
    this.#searchController = controller;

    const url = new URL(Theme.routes.predictive_search_url, location.origin);
    url.searchParams.set('q', term);
    url.searchParams.set('resources[type]', 'product');
    url.searchParams.set('resources[limit]', this.dataset.resultsLimit || '6');
    url.searchParams.set('resources[options][prefix]', 'last');

    this.setAttribute('aria-busy', 'true');

    try {
      const html = await sectionRenderer.getSectionHTML(RESULTS_SECTION_ID, false, url, controller.signal);
      if (controller.signal.aborted || this.#searchController !== controller) return;

      const content = new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector('[data-header-search-results]');

      // Ignore stale input: only render results for what is still in the field.
      if (!content || this.refs.input.value.trim() !== term) return;

      const status = content.querySelector('[data-header-search-status]');
      this.refs.status.textContent = status?.textContent?.trim() ?? '';
      status?.remove();

      this.refs.results.replaceChildren(...content.childNodes);
      if (this.isOpen) this.#showResults();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('[header-search-bar] Search request failed:', error);
    } finally {
      if (this.#searchController === controller) {
        this.#searchController = null;
        this.removeAttribute('aria-busy');
      }
    }
  }

  #showResults() {
    this.refs.results.hidden = false;
    this.toggleAttribute('data-results-open', true);
  }

  #hideResults() {
    this.refs.results.hidden = true;
    this.removeAttribute('data-results-open');
  }

  #clearResults() {
    this.refs.results.replaceChildren();
    this.refs.status.textContent = '';
    this.#hideResults();
  }

  /** @returns {HTMLAnchorElement[]} */
  get #resultLinks() {
    return [...this.refs.results.querySelectorAll('a[href]')].filter((link) => link instanceof HTMLAnchorElement);
  }

  /**
   * Moves focus through the suggestions with the arrow keys.
   * @param {number} step - 1 for the next link, -1 for the previous one.
   */
  #moveFocus(step) {
    const links = this.#resultLinks;
    if (!links.length || this.refs.results.hidden) return;

    const active = document.activeElement;
    const index = active instanceof HTMLAnchorElement ? links.indexOf(active) : -1;
    const next = index + step;

    if (next < 0) {
      this.refs.input.focus();
    } else {
      links[Math.min(next, links.length - 1)]?.focus();
    }
  }

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
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;
      case 'Enter':
        // Enter on a focused suggestion follows the link; in the field it does nothing.
        if (event.target === this.refs.input) event.preventDefault();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.#moveFocus(1);
        break;
      case 'ArrowUp':
        if (event.target === this.refs.input) return;
        event.preventDefault();
        this.#moveFocus(-1);
        break;
    }
  };

  /**
   * Closes when keyboard focus leaves the search entirely.
   * @param {FocusEvent} event
   */
  #onFocusOut = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    if (!next) return;

    this.close();
  };
}

if (!customElements.get('header-search-bar')) {
  customElements.define('header-search-bar', HeaderSearchBar);
}
