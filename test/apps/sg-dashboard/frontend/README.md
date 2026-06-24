# SG Dashboard Frontend

This directory houses the user interface markup, stylesheets, and modular ES6 JavaScript clients.

## Contents

- `index.html`: Main Single Page Application structure. Loads the external stylesheets and modules.
- `styles.css`: Styling configurations, theme rules, transitions, custom components, and layouts.
- `js/`: Modular frontend script controllers:
  - `api.js`: Low-level asynchronous fetch calls mapping endpoints.
  - `ui.js`: Visual components renderer, DOM manipulators, dynamic item renderers, modals, and tab logic.
  - `app.js`: Master state manager, session initiator, postMessage handler, and window interface exposer.
