import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/quicksand/latin-400.css';
import '@fontsource/quicksand/latin-500.css';
import '@fontsource/quicksand/latin-700.css';
import HouseRoot from './HouseRoot';
import './house.css';

const container = document.getElementById('root');
if (!container) throw new Error('No container found');
createRoot(container).render(<StrictMode><HouseRoot /></StrictMode>);
