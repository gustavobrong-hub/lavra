# Lavra — Progresso

Legenda: `[x]` pronto e testado · `[~]` parcial · `[ ]` pendente.
Cada marco só fecha com: testes passando, zero erros no console, screenshots do Playwright conferidas e commit.

## M0 — Base do projeto
- [x] Vite + TypeScript + Three.js, Vitest, Playwright
- [x] DESIGN.md e PROGRESSO.md
- [x] Harness de teste `window.__lavra`

## M1 — Motor de voxels e renderização base
- [x] Constantes, matemática, PRNG com seed, ruído Perlin/Simplex com oitavas
- [x] Registro de blocos com estados e tabelas tipadas
- [x] Seções/chunks/mundo (get/set, heightmap)
- [x] Pool de workers (geração + malha) com prioridade
- [x] Mesher: greedy meshing, descarte de faces ocultas, AO e luz suave por vértice, modelos e fluidos
- [x] Texturas pixel art procedurais em texture array (com mipmaps preservando cobertura)
- [x] Renderizador de chunks WebGL2 (VAO por seção, UBO, culling por frustum)
- [x] Culling de cavernas (grafo de visibilidade por seção)
- [x] Distância de renderização configurável, carregamento em espiral sem travadas
- [x] Tela de debug (FPS, coordenadas, bioma, chunk)

## M2 — Mundo e biomas
- [x] Clima multi-ruído e seleção de biomas com transição suave
- [x] Biomas: planície, floresta, deserto, neve, montanhas, oceano, pântano, selva, savana, taiga, praia, rio, Bosque Lume (raro)
- [x] Terreno 3D (saliências, penhascos, picos), rios, lagos
- [x] Cavernas queijo/espaguete/talharim, túneis, ravinas, aquíferos, lava profunda
- [x] Minérios por profundidade (carvão, ferro, cobre, ouro, fulgor, lápis, diamante, esmeralda), deepslate, camada indestrutível
- [x] Árvores (carvalho, bétula, pinheiro, selva, acácia, carvalho escuro, pântano, lume) e vegetação (grama, flores, cactos, cogumelos, cana, abóboras, melancias, frutinhas, algas)

## M3 — Jogador e física
- [x] Colisão AABB, gravidade, pulo, corrida, agachar sem cair de beiradas, degrau, nado, escadas de mão
- [x] Números do original (0,42 de pulo, 0,08 de gravidade, atrito 0,546, 4,317 m/s andando…)
- [x] Raycast, quebrar (tempo por bloco/ferramenta) e colocar blocos, contorno e rachaduras
- [x] Blocos com gravidade (areia, cascalho)
- [~] Primeira e terceira pessoa, mão/item na tela (falta o modelo do jogador para a 3ª pessoa)
- [x] Voo no Criativo

## M4 — Iluminação
- [x] Luz do céu e de blocos com propagação entre chunks
- [x] Atualização incremental ao quebrar/colocar
- [x] Luz suave + AO, ciclo dia/noite (20 min)

## M5 — Inventário e crafting
- [x] Registro de itens, ícones (atlas), hotbar, inventário com arrastar/soltar, empilhar, dividir, shift-clique, distribuir arrastando
- [x] Crafting 2×2 e 3×3 (com e sem formato), livro de receitas navegável
- [x] Fornalha com combustível, baús
- [x] Ferramentas (madeira, pedra, ferro, ouro, diamante) com durabilidade, espadas, machados
- [x] Arco e flecha, escudo, armaduras

## M6 — Sobrevivência
- [x] Vida, fome, saciedade, exaustão, regeneração, comida
- [x] Dano de queda, afogamento, fogo, lava, sufocamento, vazio
- [x] Morte, tela de morte, respawn
- [x] Modos Sobrevivência e Criativo
- [x] XP e níveis, orbes
- [x] Cama (pular a noite, ponto de respawn)

## M7 — Animais e inimigos
- [x] Sistema de entidades, modelos por caixas com skins procedurais, animação
- [x] A* na grade de voxels, IA por objetivos (vagar, fugir, perseguir, atacar)
- [x] Spawn por luz/bioma, limites de população, despawn
- [x] Animais: vaca, porco, ovelha, galinha d'angola, cavalo crioulo, lobo-guará, gato, tapiti, peixes (lambari, tambaqui, baiacu, acará), Musgarto (+ filhotes, reprodução, drops), com modelos e variantes
- [x] Mecânicas: tosquiar, ordenhar, ovos, domesticar lobo e gato, selar e montar cavalo
- [x] Inimigos: Carniçal, Ossudo, Tecelã, Pavio, Feiticeira, Gosma, Assombro, Náufrago, Vulto, Espreitador (+ Fagulha e Brasal do Ínfero), com modelos e animações
- [x] Combate: cooldown, crítico, knockback, armadura

## M8 — Vilas e aldeões
- [x] Vilas por bioma (casas de vários tamanhos, caminhos, fazendas, poço, oficinas, praça, postes de luz, chaminés com fumaça)
- [x] Aldeões com profissões, rotina dia/noite, reprodução, fuga de inimigos
- [x] Comércio com níveis
- [x] Sentinela (protetor da vila)

## M9 — Líquidos e agricultura
- [x] Água e lava escorrendo, fontes infinitas, interação (obsidiana, pedregulho, pedra), baldes
- [x] Enxada, terra arada, irrigação, plantio, crescimento, colheita, farinha de osso

## M10 — Circuitos (fulgor)
- [x] Pó de fulgor (força 0–15), tocha, repetidor, comparador, alavanca, botão, placa de pressão
- [x] Lâmpada, porta, alçapão, portão, pistão e pistão pegajoso, observador, TNT

## M11 — Estruturas (adiado a pedido: foco na estética)
- [ ] Ruínas, masmorras (baú + gerador), templo do deserto, templo da selva, minas abandonadas com trilhos, naufrágios

## M12 — Sistemas extras
- [ ] Encantamentos (mesa + estantes) e poções (suporte de poções), nomes próprios
- [ ] Pesca, barcos, carrinhos e trilhos (incl. energizados)
- [ ] Escadas, lajes, cercas, portões, portas, alçapões, escadas de mão, vidro, lã e tintas, placas com texto
- [ ] Mapa e bússola
- [ ] Explosões que destroem blocos, fogo que se espalha

## M13 — Ínfero e chefe
- [ ] Portal (moldura de obsidiana, isqueiro), escala 8:1, ligação de portais
- [ ] Geração do Ínfero (mar de lava, biomas, recursos, perigos, mobs)
- [ ] Arena e chefe Ignarca com fases e recompensa

## M14 — Shaders avançados e presets
- [x] Sombras em cascata (até 4) estabilizadas por texel, PCF suave, folhas translúcidas contra a luz
- [x] Céu com dispersão atmosférica (LUT Rayleigh + Mie + ozônio, espalhamento múltiplo aproximado), sol quadrado em pixel art, lua com fases e halo, estrelas que giram com o céu
- [x] Nuvens em blocos 3D iluminadas pelo sol/lua (rosadas depois do pôr do sol), com sombra no chão
- [x] Raios de sol (espaço de tela) e névoa baixa dourada ao entardecer
- [x] Água: reflexo em espaço de tela com refino + céu/nuvens refletidos, refração, absorção, ondas, trilha do sol com cintilação, espuma, cáusticas, mar distante contínuo
- [x] Vento em folhas, grama e plantas
- [x] PBR procedural (normal, rugosidade, metais, pedras molhadas e poças)
- [x] Bloom com limiar pela exposição, lens flare, tonemapping ACES, gradação por hora do dia, exposição automática, FXAA
- [~] Clima: chuva e neve em partículas, céu encoberto, superfícies molhadas (sem raios de tempestade)
- [ ] SSAO, TAA, DOF e motion blur (o AO por vértice cobre boa parte)
- [x] Partículas: detritos, fumaça de fogueiras/chaminés/tochas, vaga-lumes, folhas, chuva, neve, respingos, corações, críticos
- [x] Presets Baixo/Médio/Alto/Ultra e ajustes finos

## M15 — Áudio e menus
- [ ] Sons procedurais (passos por material, quebrar, colocar, dano, criaturas, chuva, vento, cavernas)
- [ ] Música ambiente procedural
- [~] Tela inicial com o mundo ao fundo, novo mundo com semente, pausa, gráficos, controles (falta lista de mundos e volume)
- [ ] HUD completo; textos em pt-BR
- [ ] Salvamento automático e manual de vários mundos

## M16 — Publicação
- [x] Build de produção conferido (`npm run build` + carga sem erros)
- [x] Publicação online: https://gustavobrong-hub.github.io/lavra/ (GitHub Pages via Actions a cada push na main)

## M17 — Polimento
- [ ] Ciclo 1: jogar como jogador exigente, listar ≥ 20 problemas, corrigir os principais
- [ ] Ciclo 2: idem
- [ ] Benchmark: 60 FPS no Médio (notebook comum), Ultra em GPU dedicada

## Bônus
- [ ] Multiplayer em rede local
- [ ] Controles de toque

---

## Diário
- 2026-09-23 — Projeto criado; DESIGN.md e PROGRESSO.md escritos.
- 2026-09-23 — M1–M4 (commit 51f3130): motor de voxels, geração com 37 biomas, luz, mesher em workers, renderizador WebGL2. 60 FPS no Apple M4 (Playwright).
- 2026-09-23 — M3/M5 (commit 3a4aa2a): física fiel do jogador, quebrar/colocar, itens, crafting e menus.
- 2026-09-23 — M5/M6/M7 parcial (commit a5ae9a8): 408 texturas de bloco e 273 sprites de itens pintados em código; HUD, telas de inventário, fornalha e baús; sobrevivência completa; IA de criaturas (objetivos + A*), 27 espécies com lógica, spawn natural, combate, arco, escudo, arremessáveis, explosões. 60 testes unitários + e2e de luta/ordenha/tosquia/arco/montaria passando. Modelos 3D das criaturas sendo feitos em paralelo (3 grupos) com a galeria `scripts/mobgallery.mjs`.
- 2026-09-23 — M8–M10 (commits 4da9918, 2e36ab4, b90881e): vilas e aldeões com comércio e sentinela; líquidos e agricultura; circuitos de fulgor com a semântica do original.
- 2026-09-23 — Modelos das criaturas concluídos (commit b8733e3).
- 2026-09-23 — Mudança de prioridade pedida: menos mecânicas específicas, foco na estética (referências: pôr do sol dourado no pântano, crepúsculo roxo com nuvens em blocos e água espelhada, noite nevada com lua, estrelas e chaminés).
- 2026-09-23 — Estética (commit 1b17f16): LUT de céu físico, nuvens em blocos, sombras em cascata, água espelhada (corrigida a face de baixo que cobria a superfície), bloom, raios, lens flare, exposição automática, gradação. 60 FPS no Apple M4 com distância 12.
- 2026-09-23 — Partículas e chaminés (commit 1cfd1c0); tela inicial, pausa e menus (commit a1da8af).
- 2026-09-24 — Publicado em https://gustavobrong-hub.github.io/lavra/ (conferido com Playwright no site ao vivo).
