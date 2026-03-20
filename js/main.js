/**
 * Main - game entry
 */
import { Game } from './game.js?v=33';
import { UI } from './ui.js?v=25';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    new UI(game);
    game.start();
});
