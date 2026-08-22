# Carrossel da Área Coding Loop

O carrossel aparece no topo da Área Coding Loop, aberta pelo logo/nome **Coding-Loop** no cabeçalho da dashboard. Ele serve para destacar cursos, avisos, novidades ou qualquer outro conteúdo que você queira apresentar aos alunos.

## Como ele funciona

- Os slides ficam em `public/dashboard.html`.
- Cada slide é um bloco `<article>` com o atributo `data-carousel-slide`.
- Os botões de seta e os indicadores são criados/atualizados automaticamente pelo arquivo `public/assets/js/carrossel.js`.
- O slide muda automaticamente a cada 7 segundos.
- Ao passar o mouse, usar os botões ou navegar pelo teclado dentro do carrossel, a troca automática é pausada temporariamente.
- Pessoas que ativaram a preferência de redução de movimento no sistema não recebem animação automática.

## Onde editar

Abra `public/dashboard.html` e procure pelo comentário:

```html
CARROSSEL (TEMPLATE)
```

Os slides ficam dentro deste contêiner:

```html
<div class='cl-carousel-track'>
    <!-- slides entram aqui -->
</div>
```

## Como adicionar um slide

1. Localize um bloco que começa com `<article` e termina com `</article>` dentro de `.cl-carousel-track`.
2. Copie o bloco inteiro.
3. Cole-o antes do fechamento `</div>` da `.cl-carousel-track`.
4. Altere o conteúdo interno: categoria, título, texto e link.

Modelo para copiar:

```html
<article class='cl-carousel-slide cl-carousel-slide--primary' data-carousel-slide>
    <div class='cl-carousel-content'>
        <p class='cl-carousel-eyebrow'>NOVA CATEGORIA</p>
        <h2>Título do destaque</h2>
        <p>Texto explicando o conteúdo do destaque.</p>
        <a class='cl-carousel-link' href='ide.html'>Texto do botão <span aria-hidden='true'>→</span></a>
    </div>
</article>
```

O atributo `data-carousel-slide` deve continuar no `<article>`; sem ele, o item não será reconhecido como slide.

## Como remover um slide

1. Encontre o `<article ... data-carousel-slide>` do conteúdo que não deseja mais mostrar.
2. Apague desde a abertura `<article>` até o respectivo `</article>`.
3. Salve o arquivo.

Não é necessário alterar JavaScript, setas ou indicadores. Eles são recalculados ao carregar a página.

## Como editar um slide existente

Dentro do bloco do slide, você pode editar livremente:

- `<p class='cl-carousel-eyebrow'>`: categoria curta exibida acima do título;
- `<h2>`: título principal;
- `<p>`: descrição;
- `<a class='cl-carousel-link' href='...'>`: botão e destino. Remova a linha inteira caso não queira botão.

## Cores disponíveis

No atributo `class` do `<article>`, mantenha `cl-carousel-slide` e escolha uma destas variações:

| Classe adicional | Uso sugerido |
| --- | --- |
| `cl-carousel-slide--primary` | Cursos e chamadas principais |
| `cl-carousel-slide--accent` | Avisos e novidades |
| `cl-carousel-slide--neutral` | Conteúdo informativo ou genérico |

Exemplo:

```html
<article class='cl-carousel-slide cl-carousel-slide--accent' data-carousel-slide>
```

## Ajustar o tempo da troca automática

No início do carrossel, há este atributo:

```html
data-carousel-interval='7000'
```

O valor está em milissegundos. Exemplos:

- `5000` = 5 segundos;
- `10000` = 10 segundos;
- `15000` = 15 segundos.

## Arquivos relacionados

- `public/dashboard.html`: conteúdo e estrutura dos slides;
- `public/assets/js/carrossel.js`: navegação, indicadores e troca automática;
- `public/assets/css/dashboard.css`: aparência, cores e responsividade.
