# Lavra — Documento de Design

> *Lavra*: em português, tanto o trabalho de minerar (lavra de minério) quanto o de cultivar a terra (lavrar).
> Um jogo sandbox de voxels de sobrevivência e construção que roda direto no navegador.

Este documento registra a arquitetura, os formatos de dados e **todas as decisões tomadas de forma autônoma**,
com o motivo de cada uma. A seção [Decisões](#decisões-registradas) é atualizada a cada marco.

---

## 1. Objetivos

1. **Jogabilidade fiel ao Java Edition** do jogo de referência: mesmos números (20 ticks/s, dia de 24 000 ticks,
   física do jogador, tempos de quebra, durabilidade, fome/saciedade, dano, spawn por luz, pilhas de 64,
   chunks de 16×16, altura −64…319 etc.).
2. **Gráficos muito além do original**, no nível de pacotes de shaders: sombras em cascata, atmosfera física,
   nuvens volumétricas, água com reflexo/refração, PBR procedural, bloom, SSAO, TAA, clima.
3. **Identidade 100% própria**: nome, texturas (pixel art gerada em código), sons e música procedurais,
   criaturas, interface. Nenhum asset baixado, nenhum nome/marca/criatura do jogo de referência.
4. Roda em Chrome, Edge, Firefox e Safari atuais, sem instalar nada.

## 2. Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | TypeScript (strict) | exigência + segurança em base grande |
| Build | Vite | exigência; workers ES module nativos |
| 3D | Three.js (WebGLRenderer, WebGL2) + **renderizador de chunks em WebGL2 puro** | ver D-001/D-002 |
| Testes | Vitest (lógica) e Playwright (jogo rodando + screenshots) | exigência |
| Persistência | IndexedDB (+ `CompressionStream` deflate) | exigência; compressão nativa em todos os navegadores atuais |
| Áudio | Web Audio API, 100% sintetizado | exigência |

## 3. Estrutura de pastas

```
src/
  main.ts                 bootstrap: detecção de recursos, UI raiz, menu principal
  core/                   código puro (sem DOM/Three) — usado por workers e testes
    constants.ts          CHUNK=16, MIN_Y=-64, HEIGHT=384, TPS=20, DAY=24000…
    math.ts rng.ts noise.ts aabb.ts
  world/
    blocks/               registro de blocos e estados (tabelas tipadas por stateId)
    chunk.ts world.ts     armazenamento em seções 16³ e acesso ao mundo
    light/                propagação de luz do céu e de blocos (BFS incremental)
    gen/                  geração: clima, biomas, terreno, cavernas, minérios, features, estruturas, Ínfero
    fluids.ts fire.ts …   simulação de blocos (líquidos, gravidade, fogo, ticks aleatórios)
    redstone/             circuitos de "fulgor"
  mesh/                   mesher puro (greedy + AO + luz suave + modelos) — roda no worker
  workers/                worker de geração/malha + pool com prioridade
  render/
    gl/                   utilitários WebGL2 crus (programas, UBO)
    chunks/               renderizador de chunks (VAO por seção, culling por frustum e por visibilidade de cavernas)
    textures/             pixel art procedural (blocos, itens, entidades) + mapas PBR derivados
    shaders/              GLSL (terreno, água, céu, nuvens, sombras, pós-processamento)
    pipeline.ts           grafo do frame: sombras → cena HDR → céu → água → pós
    entities/ particles/ weather/ hand/ …
  game/                   sessão de jogo, jogador, física, entidades, IA, itens, inventário, crafting…
  save/                   IndexedDB + serialização
  audio/                  síntese de efeitos e música
  ui/                     menus, HUD, telas de inventário, debug (DOM + CSS)
tests/unit                Vitest
tests/e2e                 Playwright (roteiros jogando + screenshots)
bench/                    benchmark automatizado (FPS e geração de chunk)
```

## 4. Mundo e dados

### 4.1 Coordenadas
- Eixo Y para cima. Mundo de **y = −64 até 319** (384 blocos, 24 seções), nível do mar **63** — como a versão moderna.
- Chunk = coluna 16×16×384 composta de 24 **seções** 16×16×16.
- Índice dentro da seção: `(y << 8) | (z << 4) | x`.
- Renderização relativa à câmera (origem da seção − posição da câmera, calculado em double na CPU) para evitar
  perda de precisão de float em coordenadas grandes.

### 4.2 Estados de bloco
- Cada bloco tem propriedades (ex.: `facing`, `half`, `age`, `level`). Cada combinação vira um **stateId de 16 bits**
  (`stateId = baseState + índice misto das propriedades`). `0` = ar.
- O registro gera **tabelas tipadas indexadas por stateId** (`OPAQUE`, `LIGHT_EMIT`, `LIGHT_OPACITY`, `SHAPE`,
  `RENDER_LAYER`, `FACE_TEX[state*6+face]`, …) — acesso O(1) no mesher, na luz e na física.
- O registro é construído de forma determinística a partir das definições (mesmo código no worker e na thread principal).

### 4.3 Seção e chunk em memória
```ts
Section { blocks: Uint16Array(4096); light: Uint8Array(4096) /* (céu<<4)|bloco */; count }
Chunk   { cx, cz, sections: (Section|null)[24], heightmap: Int16Array(256),
          biomes: Uint8Array(256), tints: Uint16Array(768) /* grama, folhagem, água em RGB565 */,
          blockEntities: Map<index, BlockEntity> }
```
Seção `null` ⇔ só ar, luz do céu 15, luz de bloco 0 (economia de memória no céu).

### 4.4 Luz
- 0–15 para céu e para blocos, como no original. Opacidade por bloco (folhas e água: 1; opacos: 15).
- **Worker de geração** calcula a luz *interna* da coluna (céu descendo pelas colunas + BFS dentro do chunk).
- **Thread principal** faz a propagação **entre chunks** quando um vizinho chega (BFS bidirecional nas bordas,
  com orçamento de tempo por frame) e as **atualizações incrementais** ao colocar/quebrar blocos
  (BFS de remoção + BFS de adição, algoritmo clássico).
- Qualquer célula de luz alterada marca a seção (e vizinhas, se estiver na borda) para refazer a malha.
- Brilho visual do céu depende da hora; o valor interno não muda (igual ao original).

### 4.5 Geração (determinística por seed)
Pipeline por coluna, no worker:
1. **Clima multi-ruído** (temperatura, umidade, continentalidade, erosão, estranheza → picos/vales) amostrado em
   resolução de 4 blocos.
2. **Densidade 3D** do terreno avaliada numa grade grossa 4×8×4 e interpolada trilinearmente (mesma técnica do
   original) — permite saliências, penhascos e picos.
3. **Cavernas**: "queijo" (cavernões), "espaguete" e "talharim" (túneis por interseção de ruídos), mais
   escavadores clássicos (túneis e **ravinas**) determinísticos por chunk de origem.
4. **Aquíferos**: nível de água local por região; lava abaixo de y = −54.
5. **Superfície por bioma**, **deepslate** abaixo de y≈0, **camada indestrutível** em y = −64…−60.
6. **Minérios** com distribuição por altura igual à moderna.
7. **Features** (árvores, plantas, lagos) — cada feature é determinística a partir do chunk de origem; um chunk
   aplica as features de todos os chunks de origem num raio que podem tocá-lo (sem dependência de ordem de geração).
8. **Estruturas** (vilas, ruínas, masmorras, templos, minas, naufrágios): posições por grade regional com
   espaçamento/separação; peças com caixas envolventes; cada chunk coloca apenas o que intercepta. Layouts em cache no worker.
9. Luz interna, heightmap e **cores de bioma misturadas** (transição suave de grama/folhagem/água).

### 4.6 Malhas
- Por **seção**, com borda de 1 bloco (18³) enviada ao worker: blocos + luz + cores.
- **Greedy meshing** para cubos (junta faces com mesmo layer/AO/luz/cor) + faces de **modelos** (caixas estilo
  JSON: escadas, cercas, portas, tochas, trilhos…) + malha própria para **fluidos** (altura por canto).
- **Luz suave e AO por vértice** (média de 4 células; triângulo girado conforme AO para evitar anisotropia).
- Vértice compactado em **3×uint32 (12 bytes)**:
  - `w0`: x,y,z em 1/16 de bloco (9 bits cada) | normal (3) | tipo de balanço ao vento (2)
  - `w1`: u,v em 1/16 (9+9) | camada da textura (11) | AO (2)
  - `w2`: luz do céu (6, soma de 4 amostras) | luz de bloco (6) | flags (4) | cor RGB565 (16)
- Índices: um único buffer de índices de quads compartilhado por todas as seções.
- Saída também traz o **grafo de visibilidade** da seção (quais pares de faces se enxergam) para culling de cavernas.

### 4.7 Renderização
Ver D-001/D-002. Frame:
1. **Sombras em cascata** (3–4 cascatas, PCF com penumbra variável; cascatas distantes atualizadas em frames alternados).
2. **Cena HDR** (RGBA16F + normais/material em MRT + depth): terreno opaco/recortado (WebGL2 puro), entidades (Three).
3. **Céu** físico (LUTs de transmitância e céu no estilo Hillaire), sol, lua com fases, estrelas.
4. **Nuvens volumétricas** em baixa resolução com reprojeção temporal.
5. **Água** (reflexo SSR + fallback do céu, refração, absorção por profundidade, ondas, cáusticas, espuma) e
   translúcidos ordenados por seção.
6. **Pós**: SSAO, neblina volumétrica/raios de luz, bloom (pirâmide de mips), exposição automática,
   DOF e motion blur opcionais, tonemapping fílmico + correção de cor, TAA/FXAA.
Presets **Baixo/Médio/Alto/Ultra** controlam resolução de sombra, nº de cascatas, passos de nuvem, SSR, SSAO, escala de render.

### 4.8 Simulação
- Loop fixo de **20 ticks/s**, render com interpolação.
- Ticks agendados (fluidos, fulgor, blocos com gravidade) e **ticks aleatórios** (3 por seção por tick: plantações,
  grama, folhas, fogo, gelo/neve).
- Entidades: `Entity → Living → Mob → espécie`. IA por **objetivos com prioridade** (estados vagar, fugir,
  perseguir, atacar…), **A\*** na grade de voxels, navegação por terra, água, voo e escalada.

### 4.9 Persistência (IndexedDB `lavra`)
- `worlds`: metadados (nome, seed, modo, hora, clima, spawn, jogador, regras, miniatura).
- `chunks`: chave `mundo|dim|cx|cz` → seções comprimidas (deflate) + block entities + entidades.
- Só chunks modificados ou com entidades persistentes são salvos; o resto é regenerado pela seed.
- Salvamento automático a cada 6000 ticks (5 min) e ao pausar/sair.

## 5. Nomes próprios (originalidade)

| Conceito | Nome em Lavra |
|---|---|
| Jogo | **Lavra** |
| Sistema de circuitos | **Fulgor** (pó, tocha, repetidor, comparador, lâmpada de fulgor) |
| Segunda dimensão | **Ínfero** |
| Chefe | **Ignarca, o Colosso de Brasa** |
| Bioma raro | **Bosque Lume** (árvores de folhas luminosas) |
| Inimigos | Carniçal (morto-vivo), Ossudo (arqueiro), Tecelã (aranha), Pavio (explode), Feiticeira (poções), Gosma (se divide), Assombro (voador noturno), Náufrago (aquático), Vulto (se teleporta), Espreitador (inventado: finge ser rocha nas cavernas), Fagulha e Brasal (Ínfero) |
| Animais | vaca-zebu, porco, ovelha, galinha, cavalo, lobo, gato, coelho, peixes (lambari, tambaqui, baiacu), **Musgarto** (inventado: lagarto-tartaruga musguento) |
| Protetor da vila | **Sentinela** |

## 6. Testes
- **Vitest**: ruído determinístico, registro de blocos, chunk, luz, mesher, física (números do original), tempos de
  quebra, crafting, cliques do inventário, fome, XP, fluidos, fulgor, A*, serialização, comércio.
- **Playwright**: abre o jogo, cria mundo com seed fixa, executa roteiros (andar, pular, quebrar, colocar, craftar,
  lutar, negociar) via `window.__lavra` (harness de teste) e tira screenshots conferidas a cada marco.
- **Benchmark**: rota de câmera fixa, mede FPS médio/1% e tempo de geração/malha por chunk → `bench/results/*.json`.

---

## Decisões registradas

- **D-001 — WebGL2 como caminho de render; WebGPU é detectado mas não usado para desenhar.**
  O `WebGPURenderer` do Three não aceita `ShaderMaterial` GLSL: todo o pipeline (terreno, água, céu, nuvens, pós)
  teria de ser escrito duas vezes (GLSL e TSL) e o backend WebGL2 dele é mais lento que o `WebGLRenderer`.
  WebGL2 está em 100% dos navegadores-alvo. O jogo detecta WebGPU/WebGL2/extensões (float render targets,
  anisotropia, `WEBGL_debug_renderer_info`), escolhe o preset inicial pela GPU e mostra tudo na tela de debug.
  Fallbacks: sem `EXT_color_buffer_float` → HDR em RGBA8 com codificação; GPU fraca → preset Baixo.
- **D-002 — Chunks desenhados com WebGL2 puro dentro do pipeline do Three.** Um `Mesh` do Three por seção
  geraria milhares de draw calls com custo de CPU alto (~5 µs cada). O renderizador próprio usa VAO por seção,
  UBO por frame, atributos inteiros compactados e texture arrays: ~1 µs por draw. Entidades, partículas,
  pós-processamento e render targets continuam no Three (`renderer.resetState()` entre os dois mundos).
- **D-003 — Altura do mundo −64…319**, igual à versão moderna, com seções vazias não alocadas.
- **D-004 — Luz: interna no worker + bordas e edições na thread principal** (em vez de recalcular tudo no worker
  a cada malha): mantém a luz disponível para spawn/plantações e deixa as edições instantâneas.
- **D-005 — Features por chunk de origem** (e não o pipeline de proto-chunks do original): cada chunk pode ser
  gerado isoladamente em qualquer worker e o resultado é idêntico independentemente da ordem de carregamento.
- **D-006 — Interface em DOM/CSS**, com ícones de itens gerados num atlas (canvas 2D) e usados como sprites CSS.
- **D-007 — Alcance: 4,5 blocos (blocos) e 3 (entidades) no Sobrevivência; 5 no Criativo** (regras 1.20.5+).
- **D-008 — Física do jogador copiada do algoritmo do original** (LivingEntity.travel/Entity.move): atrito do bloco × 0,91,
  aceleração `velocidade × 0,216/atrito³` no chão e 0,02 no ar, gravidade 0,08 com arrasto 0,98, pulo 0,42, degrau 0,6,
  recuo na beirada ao agachar em passos de 0,05. Testes (`tests/unit/physics.test.ts`) conferem 4,317 m/s andando,
  5,612 correndo, ~1,3 agachado, 10,89 voando e ~1,25 de altura de pulo.
- **D-009 — Queda: o dano usa a distância acumulada antes do tick do pouso** (exatamente como o original), por isso uma
  queda "de 23 blocos" pode dar 19 ou 20 de dano conforme a fase do movimento; 25 blocos sempre matam.
- **D-010 — Plantas aquáticas "encharcadas"** (alga, capim-marinho) têm a flag `F_WATERLOGGED`: a célula renderiza água
  junto do modelo e a física trata como água parada, sem precisar de estados extras.
- **D-011 — Texturas e sprites pintados por código com um kit próprio** (`Tex`: paletas, ruídos periódicos, mapas ASCII)
  que também gera altura (normal map) e material por pixel (suavidade, metal, porosidade, emissão) para o PBR.
  A pintura foi paralelizada em grupos; `scripts/texsheet.mjs` gera folhas de contato para revisão visual.
- **D-012 — Ícones**: blocos em isométrico desenhados em canvas 2D a partir das próprias texturas; itens com sprite 16×16.
  Os mesmos sprites viram itens 3D "extrudados" (frente, verso e bordas por pixel) na mão e no chão.
- **D-013 — Receitas próprias onde faltam itens equivalentes** (marcadas no código): biscoito sem cacau, andaime sem
  bambu, tinta preta de carvão, tinta marrom de cogumelo, lanterna do mar com pó de lumita, farol com o coração do chefe,
  ferramentas ígneas na bancada (diamante + lingote ígneo) em vez da mesa de ferraria.
- **D-014 — Fome aparece como "coxinhas"** no HUD (ícone próprio), mantendo os números do original.
