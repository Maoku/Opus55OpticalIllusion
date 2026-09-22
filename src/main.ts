import './styles/base.css';
import './styles/ui.css';
import { App } from './app/App';

const container = document.getElementById('app');
if (!container) throw new Error('#app が見つかりません');

const app = new App(container);
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  void import('./app/debugApi').then(({ installDebugApi }) => installDebugApi(app));
}
app.init().catch((err: unknown) => {
  console.error(err);
  const msg = document.createElement('p');
  msg.className = 'fatal';
  msg.textContent =
    'このブラウザでは 3D 表示を開始できませんでした。WebGL2 に対応した最新のブラウザでお試しください。';
  document.body.appendChild(msg);
});
