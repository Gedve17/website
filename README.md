# Y9

A browser-based app called y9.

## Features

- Welcome/name screen
- Light/dark mode toggle
- Main menu
- Rock–Paper–Scissors against the computer
- Running score during the current game session
- Calculator with `+`, `-`, `×`, `÷`, decimals, clear, equals, and square root
- Responsive layout for desktop and mobile

## Run locally

1. Open a terminal in this folder.
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open the local URL Vite prints in the terminal, normally `http://localhost:5173`.

## Production build

```bash
npm run build
```

The production files will be created in `dist/`.

## Notes

The original Python calculator used Python `eval()` to evaluate entered arithmetic. This remake uses a small arithmetic parser instead so arbitrary JavaScript cannot be executed from the calculator input.
