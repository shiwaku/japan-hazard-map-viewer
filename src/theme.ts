// ライト / ダークテーマの保持。<html data-theme="…"> を CSS 側が参照する。

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hazardmap-theme';

function systemPref(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 保存済みテーマ、無ければ OS の設定に従う */
export function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : systemPref();
}

/** <html data-theme="…"> を更新して現在テーマを保存する。 */
export function applyThemeAttr(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}
