import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Polices de la charte APE, servies avec le site (aucun appel à Google Fonts).
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
