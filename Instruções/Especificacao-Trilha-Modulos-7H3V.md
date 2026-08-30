# Trilha de módulos - padrão 7H:3V

Esta especificação descreve como gerar um SVG de trilha contínua para módulos. Ela serve como instrução para pessoas e para qualquer IA. Cada curso pode ter uma geometria diferente, mas todos obedecem às regras abaixo.

## 1. Resultado obrigatório

- O resultado é um SVG vertical, com uma única trilha ortogonal contínua.
- Cada segmento começa exatamente no ponto onde o anterior termina.
- Não existem saltos, bifurcações, linhas desconectadas, cruzamentos ou movimento vertical para cima.
- Cada unidade termina em um ponto/círculo. Uma trilha com `N` segmentos possui `N + 1` pontos.
- O desenho se mantém visualmente equilibrado ao redor da linha central `x = 0`, sem precisar ser simétrico.

## 2. Escala fixa

Use estas medidas no sistema de coordenadas do SVG:

```text
1 unidade horizontal = 255 px
1 unidade vertical   = 170 px
```

Logo:

```text
H1 = 255 px   H2 = 510 px   H3 = 765 px
D1 = 170 px
```

A proporção visual de uma unidade é `255:170 = 3:2 = 1,5:1`.

## 3. Direções

```text
R = direita:  x += 255
L = esquerda: x -= 255
D = baixo:    y += 170
```

Nunca use subida.

## 4. Bloco obrigatório: 7H:3V

Todo bloco completo tem dez segmentos:

```text
7 segmentos horizontais + 3 segmentos verticais = 10 segmentos
```

Sua estrutura é sempre:

```text
grupo horizontal 1 -> D1 -> grupo horizontal 2 -> D1 -> grupo horizontal 3 -> D1
```

Os três grupos horizontais somam exatamente sete unidades; cada grupo pode ter somente uma, duas ou três unidades.

## 5. Partições permitidas

As únicas partições válidas são:

```text
A = (1, 3, 3)
B = (3, 1, 3)
C = (3, 3, 1)
D = (2, 2, 3)
E = (2, 3, 2)
F = (3, 2, 2)
```

Exemplo com `E = (2,3,2)`:

```text
R2, D1, L3, D1, R2, D1
```

Esse bloco possui `2 + 3 + 2 = 7H` e exatamente três descidas.

## 6. Alternância lateral

Dentro de cada bloco, os grupos horizontais alternam obrigatoriamente:

```text
R -> L -> R
```

ou:

```text
L -> R -> L
```

Como há três grupos por bloco, o bloco seguinte deve iniciar no lado oposto:

```text
Bloco 1: R -> L -> R
Bloco 2: L -> R -> L
Bloco 3: R -> L -> R
```

## 7. Equilíbrio em torno do centro

Para uma partição `(a,b,c)`, o deslocamento líquido de um bloco iniciado à direita é:

```text
net = a - b + c
```

Para um bloco iniciado à esquerda, inverta o sinal.

A forma recomendada de garantir equilíbrio é gerar blocos aos pares:

1. Escolha um bloco iniciado à direita.
2. Escolha o próximo bloco, iniciado à esquerda, com o mesmo valor absoluto de `net`.
3. Os dois blocos retornam ao centro, mesmo que usem partições diferentes.

Exemplo equilibrado e não espelhado:

```text
R2, D1, L3, D1, R2, D1   # net +1
L3, D1, R3, D1, L1, D1   # net -1
```

Evite repetir a mesma partição nos últimos quatro blocos quando existir alternativa.

## 8. Variações por curso

O algoritmo, a escala e a proporção são comuns. O que muda entre cursos é a sequência de partições escolhidas.

```text
LogProg: sequência própria
HTML:    sequência própria
CSS:     sequência própria
JS:      sequência própria
```

Cada sequência deve alternar o lado inicial, equilibrar pares de blocos e evitar cópias ou espelhos perfeitos. Uma seed pode gerar a sequência; para reproduzir exatamente uma trilha, registre seed, posição atual, lado do próximo bloco e histórico recente.

## 9. Pseudocódigo

```text
H = 255
V = 170
particoes = [(1,3,3), (3,1,3), (3,3,1), (2,2,3), (2,3,2), (3,2,2)]

ponto = (0,0)
adicionar ponto inicial
lado = R

para cada bloco:
    escolher uma partição válida, diferente das recentes
    direcoes = [lado, oposto(lado), lado]

    para cada grupo em partição:
        repetir o tamanho do grupo:
            mover H na direção do grupo
            adicionar ponto
        mover D1 para baixo
        adicionar ponto

    lado = oposto(lado)
```

Para preservar a proporção exata, use totais múltiplos de 10:

```text
40 segmentos = 4 blocos = 41 pontos
350 segmentos = 35 blocos = 351 pontos
```

Para outro total, pare no trecho necessário do próximo bloco. O bloco final parcial ainda não terá 7H:3V completo.

## 10. Validação

- [ ] Um único caminho contínuo.
- [ ] Sem subida.
- [ ] Horizontal unitário de 255 px.
- [ ] Vertical unitário de 170 px.
- [ ] Cada bloco completo possui 7H e 3V.
- [ ] Cada grupo horizontal mede 1, 2 ou 3 unidades.
- [ ] As direções alternam dentro e entre blocos.
- [ ] Há um círculo no início e no final de cada segmento.
- [ ] Pares de blocos compensam o deslocamento lateral.
- [ ] Não há cruzamentos, sobreposições ou segmentos soltos.

## 11. Estilo SVG sugerido

```text
Fundo: branco
Linha: preta, stroke-width entre 1.4 e 4, linecap e linejoin round
Linha central: tracejada cinza em x = 0, opcional
Pontos internos: branco com contorno preto
Início: verde #00c853
Fim: vermelho #ff1744
```

Desenhe a linha antes dos círculos para que os pontos permaneçam visíveis.

