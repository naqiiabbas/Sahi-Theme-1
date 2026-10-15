import { Component } from '@theme/component';
import { convertMoneyToMinorUnits, formatMoney } from '@theme/money-formatting';

/**
 * Two-handle price slider rendered by snippets/price-filter.liquid inside a price-facet-component.
 * The range inputs have no name; they write to the facet's min and max text fields, and the range
 * input's bubbling `change` event runs the facet's own updatePriceFilterAndResults.
 *
 * @typedef {object} PriceRangeSliderRefs
 * @property {HTMLInputElement} minRange - The lower handle.
 * @property {HTMLInputElement} maxRange - The upper handle.
 * @property {HTMLElement} [minLabel] - Shows the lower value.
 * @property {HTMLElement} [maxLabel] - Shows the upper value.
 *
 * @extends {Component<PriceRangeSliderRefs>}
 */
class PriceRangeSlider extends Component {
  requiredRefs = ['minRange', 'maxRange'];

  /** @type {AbortController | undefined} */
  #abortController;

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
  }

  /**
   * Snaps handles to whole currency units and keeps them in step with typed values.
   */
  #setUp() {
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const { minRange, maxRange } = this.refs;
    const step = String(this.#unitSize);
    minRange.step = step;
    maxRange.step = step;

    // Typing in the (visually hidden) text fields still moves the handles.
    this.#facet?.addEventListener(
      'input',
      (event) => {
        if (event.target === this.#minInput || event.target === this.#maxInput) this.#syncFromFields();
      },
      { signal: this.#abortController.signal }
    );
  }

  /**
   * Handles a handle being dragged or moved with the keyboard.
   * @param {Event} event - The input event from either range input.
   */
  handleInput(event) {
    const { minRange, maxRange } = this.refs;
    let min = Number(minRange.value);
    let max = Number(maxRange.value);

    // Handles can't cross: the one being moved stops at the other.
    if (min > max) {
      if (event.target === minRange) {
        min = max;
        minRange.value = String(min);
      } else {
        max = min;
        maxRange.value = String(max);
      }
    }

    this.#render(min, max);
    this.#writeFields(min, max);
  }

  /**
   * Writes the slider values to the facet's text fields. The ends of the range clear the field,
   * so an untouched handle adds no filter.
   * @param {number} min - Lower value in minor units.
   * @param {number} max - Upper value in minor units.
   */
  #writeFields(min, max) {
    const minInput = this.#minInput;
    const maxInput = this.#maxInput;
    if (!minInput || !maxInput) return;

    // Handles snap to whole units, so the top step counts as the end even when the range max has cents.
    const atEnd = max + this.#unitSize > this.#rangeMax;

    minInput.value = min <= 0 ? '' : formatMoney(min, this.#fieldFormat, this.#currency);
    maxInput.value = atEnd ? '' : formatMoney(max, this.#fieldFormat, this.#currency);
  }

  /**
   * Moves the handles to the values typed into the text fields.
   */
  #syncFromFields() {
    const { minRange, maxRange } = this.refs;
    const minValue = this.#minInput?.value.trim() ?? '';
    const maxValue = this.#maxInput?.value.trim() ?? '';

    const min = minValue === '' ? 0 : convertMoneyToMinorUnits(minValue, this.#currency) ?? 0;
    const max = maxValue === '' ? this.#rangeMax : convertMoneyToMinorUnits(maxValue, this.#currency) ?? this.#rangeMax;

    minRange.value = String(min);
    maxRange.value = String(max);
    this.#render(Number(minRange.value), Number(maxRange.value));
  }

  /**
   * Updates the filled track, the value labels, and the announced values.
   * @param {number} min - Lower value in minor units.
   * @param {number} max - Upper value in minor units.
   */
  #render(min, max) {
    const { minRange, maxRange, minLabel, maxLabel } = this.refs;
    const rangeMax = this.#rangeMax || 1;

    this.style.setProperty('--price-range-start', `${(min / rangeMax) * 100}%`);
    this.style.setProperty('--price-range-end', `${(max / rangeMax) * 100}%`);

    const minText = formatMoney(min, this.#labelFormat, this.#currency);
    const maxText = formatMoney(max, this.#labelFormat, this.#currency);

    minRange.setAttribute('aria-valuetext', minText);
    maxRange.setAttribute('aria-valuetext', maxText);
    if (minLabel) minLabel.textContent = minText;
    if (maxLabel) maxLabel.textContent = maxText;
  }

  /** @returns {HTMLElement | null} */
  get #facet() {
    return this.closest('price-facet-component');
  }

  /** @returns {HTMLInputElement | null} */
  get #minInput() {
    return this.#facet?.querySelector('input[ref="minInput"]') ?? null;
  }

  /** @returns {HTMLInputElement | null} */
  get #maxInput() {
    return this.#facet?.querySelector('input[ref="maxInput"]') ?? null;
  }

  get #currency() {
    return this.#facet?.dataset.currency ?? 'USD';
  }

  get #rangeMax() {
    return Number(this.dataset.rangeMax) || 0;
  }

  /** Minor units in one whole currency unit, e.g. 100 for PKR or USD, 1 for JPY. */
  get #unitSize() {
    return convertMoneyToMinorUnits('1', this.#currency) || 1;
  }

  /** The shop's money format, e.g. "Rs. {{amount}}". */
  get #moneyFormat() {
    return this.#facet?.dataset.moneyFormat ?? '{{amount}}';
  }

  /** Amount-only format for the text fields, matching what the price facet writes itself. */
  get #fieldFormat() {
    return this.#moneyFormat.match(/{{\s*\w+\s*}}/)?.[0] ?? '{{amount}}';
  }

  /** Display format without decimals; handles move in whole units. */
  get #labelFormat() {
    return this.#moneyFormat
      .replace(/{{\s*amount\s*}}/, '{{amount_no_decimals}}')
      .replace(/{{\s*amount_with_comma_separator\s*}}/, '{{amount_no_decimals_with_comma_separator}}');
  }
}

if (!customElements.get('price-range-slider')) {
  customElements.define('price-range-slider', PriceRangeSlider);
}
