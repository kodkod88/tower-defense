// Inline SVG icons for the HUD and overlay. Drawn from the theme palette; no external assets.
import { PALETTE } from '../render/theme';

export type IconName = 'coin' | 'shield' | 'swords' | 'trophy' | 'skull';

const P = PALETTE;

/** SVG markup (24x24 viewBox) per icon. Pure data, exported for tests. */
export const ICON_SVG: Record<IconName, string> = {
  coin:
    `<circle cx="12" cy="12" r="10" fill="${P.gold}" stroke="${P.goldDeep}" stroke-width="2"/>` +
    `<circle cx="12" cy="12" r="6.2" fill="none" stroke="${P.goldDeep}" stroke-width="1.3"/>` +
    `<path d="M12 7.8l2.4 4.2-2.4 4.2-2.4-4.2z" fill="${P.goldDeep}"/>` +
    `<path d="M6.5 8.5a6.5 6.5 0 0 1 4-3.4" stroke="#fff6d8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  shield:
    `<path d="M12 2.2l8.2 3v6.2c0 5-3.6 8.9-8.2 10.9-4.6-2-8.2-5.9-8.2-10.9V5.2z" fill="${P.danger}" stroke="${P.ink}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M12 4.6l6 2.2v4.6c0 3.7-2.5 6.7-6 8.4z" fill="#ffffff" opacity="0.18"/>` +
    `<path d="M12 7.5l1.4 2.9 3.1.4-2.3 2.1.6 3.1-2.8-1.6-2.8 1.6.6-3.1-2.3-2.1 3.1-.4z" fill="${P.gold}"/>`,
  swords:
    `<g stroke-linecap="round">` +
    `<path d="M5 4.5l10.5 10.5M19 4.5L8.5 15" stroke="${P.stoneLight}" stroke-width="2.6"/>` +
    `<path d="M12.5 18.5l6-6M5.5 12.5l6 6" stroke="${P.gold}" stroke-width="2.4"/>` +
    `<path d="M17.2 17.2l2.6 2.6M6.8 17.2l-2.6 2.6" stroke="${P.dirtDark}" stroke-width="2.8"/>` +
    `</g>`,
  trophy:
    `<path d="M6.5 4.5H3.5v2.5a4 4 0 0 0 4 4M17.5 4.5h3v2.5a4 4 0 0 1-4 4" fill="none" stroke="${P.goldDeep}" stroke-width="1.8"/>` +
    `<path d="M6.5 3h11v5.5a5.5 5.5 0 0 1-11 0z" fill="${P.gold}" stroke="${P.ink}" stroke-width="1.2"/>` +
    `<path d="M10.5 13.6h3v3.4h-3z" fill="${P.goldDeep}"/>` +
    `<path d="M7 17h10v3.5H7z" fill="${P.gold}" stroke="${P.ink}" stroke-width="1.2"/>` +
    `<path d="M9 5v3" stroke="#fff6d8" stroke-width="1.4" stroke-linecap="round"/>`,
  skull:
    `<path d="M12 2.8a8 8 0 0 0-8 8c0 3 1.4 4.8 3 5.7v3.7h10v-3.7c1.6-.9 3-2.7 3-5.7a8 8 0 0 0-8-8z" fill="${P.stoneLight}" stroke="${P.ink}" stroke-width="1.3"/>` +
    `<circle cx="8.8" cy="11" r="2.2" fill="${P.ink}"/><circle cx="15.2" cy="11" r="2.2" fill="${P.ink}"/>` +
    `<path d="M12 13.4l-1.2 2.2h2.4z" fill="${P.ink}"/>` +
    `<path d="M10 20.2v-2.4M12 20.2v-2.4M14 20.2v-2.4" stroke="${P.ink}" stroke-width="1"/>`,
};

export function icon(name: IconName, className = 'hud-icon'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.innerHTML = ICON_SVG[name];
  return svg;
}
