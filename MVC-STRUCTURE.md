# MVC-style structure for the project

This project started as a collection of plain HTML, CSS, and JavaScript files. To make it easier to maintain, I created a minimal MVC-style layout in the `src/` folder.

## Structure

- `src/models/recordsModel.js` — holds the data and dashboard state.
- `src/views/homeView.js` — renders the HTML for the landing page.
- `src/controllers/homeController.js` — connects the model and view.
- `src/app.js` — starts the app after the page loads.
- `mvc-demo.html` — demo page showing the MVC pattern in action.

## Why this helps

- Models manage data.
- Views render the UI.
- Controllers orchestrate the logic.
- The app remains plain JavaScript, so it still fits the existing codebase style.

## How to use it

Open `mvc-demo.html` in a browser to see the example. Then you can gradually move each module (requests, dockets, users, documents) into the same pattern.
