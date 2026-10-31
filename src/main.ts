import './ui/styles.css';
import { App } from './core/App';
import { EngineHost } from './engine/EngineHost';
import { t } from './localization/i18n';

const root = document.getElementById('app')!;

if (!EngineHost.isSupported()) {
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `<div><h2>${t('error.webgl')}</h2></div>`;
  root.append(el);
} else {
  try {
    new App(root);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="overlay"><div><h2>${t('error.webgl')}</h2></div></div>`;
  }
}
