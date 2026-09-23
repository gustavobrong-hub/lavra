/** Tela de comércio com aldeão: lista de ofertas, pagamento → resultado e barra de nível. */
import { h } from '../ui';
import { ContainerScreen, slotHTML, tooltipLines } from './container';
import type { MerchantMenu } from '../../game/inventory/merchantmenu';
import { LEVEL_NAMES, LEVEL_XP, PROFESSION_LABEL, priceOf } from '../../game/village/trades';
import type { Villager } from '../../game/village/villager';

export class MerchantScreen extends ContainerScreen {
  private readonly list: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private sig = '';

  constructor(readonly mm: MerchantMenu, readonly villager: Villager) {
    super(mm, '', 'merchant');
    this.title = h('div', 'panel-title');
    this.bar = h('div', 'xp-fill');
    this.list = h('div', 'offers');
    const right = h('div', 'trade-right',
      this.title,
      h('div', 'villager-xp', this.bar),
      h('div', 'trade-row', this.slot(0), this.slot(1), h('div', 'arrow'), this.slot(2, 'result')),
      this.playerGrids(mm.playerStart));
    this.panel.append(h('div', 'trade-wrap', this.list, right));
    this.list.addEventListener('mousedown', (e) => {
      const row = (e.target as HTMLElement).closest('.offer') as HTMLElement | null;
      if (!row) return;
      e.stopPropagation();
      this.mm.selectOffer(parseInt(row.dataset.i!, 10));
      this.render(true);
    });
  }

  protected override renderExtra(): void {
    const v = this.villager;
    const lvl = v.tradeLevel;
    this.title.textContent = `${PROFESSION_LABEL[v.profession] ?? 'Aldeão'} — ${LEVEL_NAMES[lvl]}`;
    const cur = LEVEL_XP[lvl], next = LEVEL_XP[Math.min(5, lvl + 1)];
    this.bar.style.width = lvl >= 5 ? '100%' : `${Math.max(0, Math.min(1, (v.tradeXp - cur) / Math.max(1, next - cur))) * 100}%`;
    const sig = v.offers.map((o) => `${o.a.id}${priceOf(o)}${o.b?.id}${o.out.id}${o.uses}/${o.maxUses}`).join('|') + this.mm.selected;
    if (sig === this.sig) return;
    this.sig = sig;
    this.list.innerHTML = '';
    v.offers.forEach((o, i) => {
      const price = priceOf(o);
      const a = o.a.copy(price);
      const out = o.out;
      const row = h('div', `offer${i === this.mm.selected ? ' sel' : ''}${o.uses >= o.maxUses ? ' out' : ''}`);
      row.dataset.i = String(i);
      const cell = (html: string, tip: string) => { const c = h('span', 'offer-slot'); c.innerHTML = html; c.title = tip; return c; };
      const strip = (s: string) => s.replace(/<[^>]+>/g, '');
      row.append(
        cell(slotHTML(a), strip(tooltipLines(a).join('\n'))),
        o.b ? cell(slotHTML(o.b), strip(tooltipLines(o.b).join('\n'))) : h('span', 'offer-slot empty'),
        h('span', 'offer-arrow', o.uses >= o.maxUses ? '✕' : '→'),
        cell(slotHTML(out), strip(tooltipLines(out).join('\n'))),
      );
      this.list.append(row);
    });
  }

  override update(): void { this.render(); }
}
