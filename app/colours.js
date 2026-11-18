// SCREEN COLOURS: the screen is drawn in two colours, a panel and an ink (css/lcd.css derives every other shade from
// them). Six looks to pick, or your own two; kept in this browser, not in presets. A dark panel loses the LCD's
// backlight glow and shades towards black. index.html applies the kept colours before the first paint.
import { $ } from './widgets.js?v=mwmeexdh';

const STORE = 'vandoru-colours';
export const THEMES = [['LCD', '#a7b58c', '#17200e'], ['BLUE LCD', '#9cb6c6', '#0c1a28'], ['PAPER', '#e2ded0', '#1e1c18'],
  ['AMBER', '#1c1408', '#ffaa32'], ['GREEN CRT', '#08140a', '#6eff8c'], ['NIGHT', '#14285a', '#e6eeff']];
let colours = { panel: THEMES[0][1], ink: THEMES[0][2] };
try { const c = JSON.parse(localStorage.getItem(STORE)); if (c && /^#[0-9a-f]{6}$/i.test(c.panel) && /^#[0-9a-f]{6}$/i.test(c.ink)) colours = c; } catch (e) { /* the LCD */ }

function apply(keep) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)), p = rgb(colours.panel), st = document.documentElement.style;
  const dark = (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255 < 0.4;
  st.setProperty('--panel-rgb', p.join(' ')); st.setProperty('--ink-rgb', rgb(colours.ink).join(' '));
  st.setProperty('--shade-rgb', dark ? '0 0 0' : 'var(--ink-rgb)'); st.setProperty('--glow', dark ? 0 : 1);
  $('col-panel').value = colours.panel; $('col-ink').value = colours.ink;
  for (const b of $('themes').children) b.setAttribute('aria-pressed', b.dataset.panel === colours.panel && b.dataset.ink === colours.ink);
  if (keep) { try { localStorage.setItem(STORE, JSON.stringify(colours)); } catch (e) { /* not kept */ } }
}

/** the SETTINGS menu's colour controls; say: the message line */
export function setupColours(say) {
  for (const [name, panel, ink] of THEMES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn theme'; b.textContent = name; b.dataset.panel = panel; b.dataset.ink = ink;
    b.style.setProperty('--tp', panel); b.style.setProperty('--ti', ink); b.title = `The screen in ${name.toLowerCase()} colours`;
    b.addEventListener('click', () => { colours = { panel, ink }; apply(true); say(`screen colours: <em>${name}</em>`); });
    $('themes').append(b);
  }
  for (const [id, k] of [['col-panel', 'panel'], ['col-ink', 'ink']]) $(id).addEventListener('input', (e) => { colours = { ...colours, [k]: e.target.value.toLowerCase() }; apply(true); });
  $('col-reset').addEventListener('click', () => { colours = { panel: THEMES[0][1], ink: THEMES[0][2] }; apply(true); say('screen colours: back to the <em>LCD</em>'); });
  apply(false);
}
