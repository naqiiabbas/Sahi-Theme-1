/**
 * "Write a Review" buttons in the product info tabs open the review app's own form.
 * Judge.me renders a `.jdgm-write-rev-link` toggle inside its widget; clicking it opens the form.
 * Falls back to scrolling to the review widget when the app's toggle is not found.
 */
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-write-review]') : null;
  if (!button) return;

  const panel = button.closest('.product-info-tabs__reviews');
  const app = panel?.querySelector('.product-info-tabs__app');
  if (!app) return;

  const appToggle = app.querySelector('.jdgm-write-rev-link');
  if (appToggle instanceof HTMLElement) {
    appToggle.click();
    // The app reveals its form after the click; move focus into it for keyboard users.
    requestAnimationFrame(() => {
      const field = app.querySelector('.jdgm-form input, .jdgm-form textarea, form input, form textarea');
      if (field instanceof HTMLElement) field.focus({ preventScroll: false });
    });
    return;
  }

  app.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
