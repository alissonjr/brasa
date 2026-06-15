# Tools - geração do personagem (Blender headless)

Constrói o `public/models/josue.glb` a partir do humanoide rigado CC0 (Quaternius
"Mannequin" + 46 animações), VESTINDO-O por código: a túnica é uma cópia do tronco do
corpo (herda os pesos de skinning -> deforma junto e não atravessa), recortada,
alargada na barra e colorida; cinto pintado como faixa de material. Tudo sem modelar à mão.

Pré-requisito: Blender (portátil, sem sudo). Neste ambiente:
  /home/alisson/.local/blender/blender-4.5.9-linux-x64/blender

Uso:
  BL=/home/alisson/.local/blender/blender-4.5.9-linux-x64/blender
  "$BL" --background --python tools/make_josue.py     # gera public/models/josue.glb
  "$BL" --background --python tools/render_josue.py    # render de conferência em /tmp/josue_render.png

O jogo (src/game/actors/heroModel.ts) carrega /models/josue.glb automaticamente se existir;
senão, usa o placeholder. As animações são casadas por nome (idle/walk/run).

Próximos incrementos possíveis (todos via script): barba/bandolete/escamas/espada presos
aos ossos, capa nas costas, mãos melhores, ajuste de proporção e cores.
