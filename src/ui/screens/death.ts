/** Tela de morte: causa, pontuação e opção de renascer. */
import { h, type Screen } from '../ui';

const CAUSES: Record<string, string> = {
  fall: 'caiu de muito alto', drown: 'se afogou', lava: 'tentou nadar na lava', fire: 'virou cinzas', onFire: 'queimou até o fim',
  suffocate: 'sufocou dentro de uma parede', void: 'caiu no vazio', starve: 'morreu de fome', mob: 'foi derrotado',
  player: 'foi derrotado', arrow: 'foi atingido por uma flecha', explosion: 'explodiu', magic: 'foi morto por magia',
  cactus: 'foi espetado até a morte', lightning: 'foi atingido por um raio', generic: 'morreu', kill: 'morreu',
};

export class DeathScreen implements Screen {
  readonly el: HTMLDivElement;
  readonly pauses = false;
  readonly freesMouse = true;

  constructor(cause: string, attacker: string | null, score: number, onRespawn: () => void, onMenu: () => void) {
    const respawn = h('button', 'btn big', 'Renascer');
    const menu = h('button', 'btn', 'Menu principal');
    respawn.disabled = true;
    setTimeout(() => { respawn.disabled = false; }, 1000);
    respawn.addEventListener('click', onRespawn);
    menu.addEventListener('click', onMenu);
    const text = attacker ? `Você foi derrotado por ${attacker}` : `Você ${CAUSES[cause] ?? 'morreu'}`;
    this.el = h('div', 'screen death',
      h('div', 'death-box',
        h('h1', '', 'Você morreu!'),
        h('p', 'death-cause', text),
        h('p', 'death-score', `Pontuação: ${score}`),
        h('div', 'death-buttons', respawn, menu)));
  }

  onKey(e: KeyboardEvent): boolean { return e.code === 'Escape'; }
}
