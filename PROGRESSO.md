# Lavra — Progresso

Legenda: `[x]` pronto e testado · `[~]` parcial · `[ ]` pendente.
Cada marco só fecha com: testes passando, zero erros no console, screenshots do Playwright conferidas e commit.

## M0 — Base do projeto
- [ ] Vite + TypeScript + Three.js, Vitest, Playwright
- [ ] DESIGN.md e PROGRESSO.md
- [ ] Harness de teste `window.__lavra`

## M1 — Motor de voxels e renderização base
- [ ] Constantes, matemática, PRNG com seed, ruído Perlin/Simplex com oitavas
- [ ] Registro de blocos com estados e tabelas tipadas
- [ ] Seções/chunks/mundo (get/set, heightmap)
- [ ] Pool de workers (geração + malha) com prioridade
- [ ] Mesher: greedy meshing, descarte de faces ocultas, AO e luz suave por vértice, modelos e fluidos
- [ ] Texturas pixel art procedurais em texture array (com mipmaps preservando cobertura)
- [ ] Renderizador de chunks WebGL2 (VAO por seção, UBO, culling por frustum)
- [ ] Culling de cavernas (grafo de visibilidade por seção)
- [ ] Distância de renderização configurável, carregamento em espiral sem travadas
- [ ] Tela de debug (FPS, coordenadas, bioma, chunk)

## M2 — Mundo e biomas
- [ ] Clima multi-ruído e seleção de biomas com transição suave
- [ ] Biomas: planície, floresta, deserto, neve, montanhas, oceano, pântano, selva, savana, taiga, praia, rio, Bosque Lume (raro)
- [ ] Terreno 3D (saliências, penhascos, picos), rios, lagos
- [ ] Cavernas queijo/espaguete/talharim, túneis, ravinas, aquíferos, lava profunda
- [ ] Minérios por profundidade (carvão, ferro, cobre, ouro, fulgor, lápis, diamante, esmeralda), deepslate, camada indestrutível
- [ ] Árvores (carvalho, bétula, pinheiro, selva, acácia, carvalho escuro, pântano, lume) e vegetação (grama, flores, cactos, cogumelos, cana, abóboras, melancias, frutinhas, algas)

## M3 — Jogador e física
- [ ] Colisão AABB, gravidade, pulo, corrida, agachar sem cair de beiradas, degrau, nado, escadas de mão
- [ ] Números do original (0,42 de pulo, 0,08 de gravidade, atrito 0,546, 4,317 m/s andando…)
- [ ] Raycast, quebrar (tempo por bloco/ferramenta) e colocar blocos, contorno e rachaduras
- [ ] Blocos com gravidade (areia, cascalho)
- [ ] Primeira e terceira pessoa, mão/item na tela
- [ ] Voo no Criativo

## M4 — Iluminação
- [ ] Luz do céu e de blocos com propagação entre chunks
- [ ] Atualização incremental ao quebrar/colocar
- [ ] Luz suave + AO, ciclo dia/noite (20 min)

## M5 — Inventário e crafting
- [ ] Registro de itens, ícones (atlas), hotbar, inventário com arrastar/soltar, empilhar, dividir, shift-clique, distribuir arrastando
- [ ] Crafting 2×2 e 3×3 (com e sem formato), livro de receitas navegável
- [ ] Fornalha com combustível, baús
- [ ] Ferramentas (madeira, pedra, ferro, ouro, diamante) com durabilidade, espadas, machados
- [ ] Arco e flecha, escudo, armaduras

## M6 — Sobrevivência
- [ ] Vida, fome, saciedade, exaustão, regeneração, comida
- [ ] Dano de queda, afogamento, fogo, lava, sufocamento, vazio
- [ ] Morte, tela de morte, respawn
- [ ] Modos Sobrevivência e Criativo
- [ ] XP e níveis, orbes
- [ ] Cama (pular a noite, ponto de respawn)

## M7 — Animais e inimigos
- [ ] Sistema de entidades, modelos por caixas com skins procedurais, animação
- [ ] A* na grade de voxels, IA por objetivos (vagar, fugir, perseguir, atacar)
- [ ] Spawn por luz/bioma, limites de população, despawn
- [ ] Animais: vaca, porco, ovelha, galinha, cavalo, lobo, gato, coelho, peixes, Musgarto (+ filhotes, reprodução, drops)
- [ ] Mecânicas: tosquiar, ordenhar, ovos, domesticar lobo e gato, selar e montar cavalo
- [ ] Inimigos: Carniçal, Ossudo, Tecelã, Pavio, Feiticeira, Gosma, Assombro, Náufrago, Vulto, Espreitador
- [ ] Combate: cooldown, crítico, knockback, armadura

## M8 — Vilas e aldeões
- [ ] Vilas por bioma (casas de vários tamanhos, caminhos, fazendas, poço, oficinas, praça, postes de luz)
- [ ] Aldeões com profissões, rotina dia/noite, reprodução, fuga de inimigos
- [ ] Comércio com níveis
- [ ] Sentinela (protetor da vila)

## M9 — Líquidos e agricultura
- [ ] Água e lava escorrendo, fontes infinitas, interação (obsidiana, pedregulho, pedra), baldes
- [ ] Enxada, terra arada, irrigação, plantio, crescimento, colheita, farinha de osso

## M10 — Circuitos (fulgor)
- [ ] Pó de fulgor (força 0–15), tocha, repetidor, comparador, alavanca, botão, placa de pressão
- [ ] Lâmpada, porta, alçapão, portão, pistão e pistão pegajoso, observador, TNT

## M11 — Estruturas
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
- [ ] Sombras em cascata com bordas suaves
- [ ] Céu com dispersão atmosférica, estrelas, lua com fases, nuvens volumétricas
- [ ] Raios de luz e neblina volumétrica
- [ ] Água: reflexo, refração, ondas, cáusticas, espuma
- [ ] Vento em folhas, grama e plantas
- [ ] PBR procedural (normal, rugosidade, metais, pedras molhadas)
- [ ] Bloom em emissivos, SSAO, tonemapping fílmico, correção de cor, exposição automática, TAA/FXAA
- [ ] Clima: chuva, neve, tempestade com raios, superfícies molhadas e poças
- [ ] DOF e motion blur opcionais
- [ ] Partículas: quebra, fumaça, respingos, chuva, faíscas
- [ ] Presets Baixo/Médio/Alto/Ultra

## M15 — Áudio e menus
- [ ] Sons procedurais (passos por material, quebrar, colocar, dano, criaturas, chuva, vento, cavernas)
- [ ] Música ambiente procedural
- [ ] Menu principal, criar mundo (nome, seed, modo), lista de mundos, pausa, configurações (gráficos, distância, FOV, sensibilidade, volume, teclas)
- [ ] HUD completo; textos em pt-BR
- [ ] Salvamento automático e manual de vários mundos

## M16 — Publicação
- [ ] Build de produção, publicação online e link

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
