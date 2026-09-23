import type { App } from './App';

/**
 * `?debug` で開く開発用パネル（開発ビルドだけで読み込む）。
 * stats.js で FPS を表示し、lil-gui で露出・視野角・各作品の調整値をその場で変えられる。
 */
export async function installDebugPanel(app: App): Promise<void> {
  const [{ default: Stats }, { default: GUI }] = await Promise.all([
    import('stats.js'),
    import('lil-gui'),
  ]);
  const stats = new Stats();
  stats.showPanel(0);
  stats.dom.style.cssText = 'position:fixed;left:0;bottom:0;z-index:100';
  document.body.appendChild(stats.dom);
  const tick = () => {
    stats.update();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const gui = new GUI({ title: 'debug' });
  gui.domElement.style.zIndex = '100';
  const view = {
    get exposure() {
      return app.renderer.toneMappingExposure;
    },
    set exposure(v: number) {
      app.renderer.toneMappingExposure = v;
    },
    get fov() {
      return app.store.get().settings.fov;
    },
    set fov(v: number) {
      app.updateSettings({ fov: v });
    },
    get calls() {
      return app.renderer.info.render.calls;
    },
  };
  const r = gui.addFolder('表示');
  r.add(view, 'exposure', 0.5, 1.6, 0.01).name('露出');
  r.add(view, 'fov', 50, 100, 1).name('視野角');
  r.add(view, 'calls').name('描画コール').listen().disable();

  // 作品ごとの調整値（例: A-4 の線の太さ・円の大きさ）
  for (const entry of app.exhibits.entries) {
    const tunables = entry.exhibit.tunables;
    if (!tunables?.length) continue;
    const folder = gui.addFolder(`${entry.content.number} ${entry.content.title}`);
    folder.close();
    for (const t of tunables) {
      const proxy = {
        get value() {
          return t.get();
        },
        set value(v: number) {
          void app.exhibits.ensureReady(entry.id).then(() => t.set(v));
        },
      };
      folder.add(proxy, 'value', t.min, t.max, t.step).name(t.label);
    }
  }
}
