# Prompts de geração (Tripo) - fiéis às bíblias do projeto

Prompts de texto→3D derivados de `docs/biblia-ambientes.md` (formas/dimensões),
`docs/direcao-de-arte.md` + `biblia-ambientes` Parte 6 (paleta/estilo) e
`docs/biblia-vestuario.md` (cores). Objetivo: máxima especificação VISUAL (forma, material,
cor, período) - IA-3D não entende lore, só aparência. Estilo comum em todas pra o set ficar
coeso.

## Sufixo de estilo (anexar a TODA peça)
`, low-poly stylized, warm desert color palette, flat hand-painted textures, soft lighting, clean single centered game asset`

## Negative prompt padrão
`medieval European, gothic castle, battlements, crenellations, gray granite stone bricks, modern, sci-fi, fantasy, text, watermark, people, character, blurry, low quality`

## Paleta-mestra (biblia-ambientes Parte 6 / vestuário)
- tijolo de barro: marrom-avermelhado/ocre (#9C5A2E), rough alto
- pedra calcária: creme/cinza-amarelado (#CBB78F)
- areia: ocre-dourado/rosado (#C8A96E)
- acácia (madeira): mel quente (#6B4A2C)
- bronze: dourado-amarronzado metálico (#B5793A)
- ouro (Arca/Tabernáculo): metallic alto, leve emissivo (#D8A93B)
- linho: branco-cru/bege fosco (#E8DCC0); pano de tenda: pelo de cabra preto-acinzentado (#2B2520)

## Prompts por peça (fonte: biblia-ambientes seção indicada)

- TENDA (2.6) `tenda.glb`:
  "Bedouin black goat-hair tent, bayt al-sha'r, low rectangular saddle shape, dark charcoal woven cloth in horizontal sewn strips, wooden poles and tension ropes, one side flap raised"

- CASA quatro cômodos (2.3) `casa_adobe.glb`:
  "ancient Israelite four-room house, reddish-brown mud-brick walls on a pale stone foundation, irregular clay plaster, flat roof terrace with wooden beams and low parapet, small low doorway and tiny windows, Bronze Age Canaan"

- MURALHA de tell (2.1) `muralha.glb` [usar negative]:
  "Bronze Age Canaanite tell city wall segment, lower half a smooth sloped plastered glacis ramp in pale cream limestone, upper half a thick rampart of reddish-brown sun-dried mud-brick, one square mud-brick watchtower, weathered clay"

- PORTÃO de câmaras (2.2) `portao.glb` [usar negative]:
  "ancient Canaanite chambered city gate, two flanking square mud-brick towers, recessed entrance passage with niches, large double wooden doors, reddish-brown clay, Bronze Age"

- TABERNÁCULO (2.7) `tabernaculo.glb`:
  "ancient Israelite Tabernacle, rectangular tent sanctuary, black goat-hair and ram-skin roof over gold-covered acacia plank walls, surrounded by a white linen courtyard fence on posts, bronze altar at the east entrance, desert"

- ARCA da Aliança (2.8) `arca.glb` (hero, ouro):
  "Ark of the Covenant, gold-covered acacia wood chest, ornate gold molding, lid mercy seat with two facing golden winged cherubim, two long carrying poles through gold rings, shining polished gold, ornate sacred relic"
  (obs.: hero prop - pode gerar SEM o sufixo low-poly, buscando mais riqueza/metal)

- TAMAREIRA (Parte 4) `palmeira.glb`:
  "date palm tree, tall slender trunk with diamond-pattern bark, crown of long arching green fronds, a few date clusters, desert oasis"

- JARRO cananeu (Parte 3) `jarro.glb`:
  "ancient Canaanite storage jar, piriform body, wide shoulders, pointed base, two side handles, terracotta clay, Bronze Age pottery"

- FORNO tabun (Parte 3) `tabun.glb`:
  "clay tabun oven, beehive dome shape open at the top, sun-dried mud, ash and embers, ancient Near East"

## Uso
```bash
python3 tools/tripo_gen.py "<PROMPT> + <sufixo de estilo>" --negative "<negative padrão>" -o public/models/<arquivo>.glb --face-limit 20000
```
