import { startApp } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');
startApp(root);
