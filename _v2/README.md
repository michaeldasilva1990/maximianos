# Landing Page — Maximianos

Projeto estático pronto para hospedagem em qualquer servidor, cPanel, Netlify, Vercel ou Cloudflare Pages.

## Estrutura

- `index.html`: conteúdo e SEO.
- `css/style.css`: estilos responsivos, componentes e animações.
- `js/app.js`: formulário, validações, passageiros, tracking e redirecionamento.
- `assets/img/logo-maximianos.png`: logo enviada.

## Publicação rápida

1. Extraia o `.zip`.
2. Envie todo o conteúdo da pasta para a raiz do domínio ou subdomínio.
3. Abra o endereço publicado e faça um teste completo em celular e desktop.

## Integração da busca

O formulário monta a URL de busca no padrão:

`https://www.comprarviagem.com.br/maximianos/flight-list?...`

A constante pode ser alterada no início de `js/app.js`:

```js
const SEARCH_BASE = "https://www.comprarviagem.com.br/maximianos/flight-list";
```

### Aeroportos

O autocomplete usa o `<datalist id="airports">` no final de `index.html`.
Já há uma seleção dos principais aeroportos nacionais e internacionais.

Para produção em escala, recomenda-se conectar um serviço/API de aeroportos ou adicionar a lista completa no mesmo formato:

```html
<option
  value="Cidade - IATA"
  data-iata="IATA"
  data-city="Cidade"
  data-country="País"
  data-name="Nome completo usado pelo motor">
```

## Google Ads, GA4, GTM e Meta Pixel

Os cliques e envios já disparam eventos no `dataLayer`:

- `flight_search_submit`
- `flight_search_validation_error`
- `flight_route_swap`
- `whatsapp_click`

Para ativar o Google Tag Manager:

1. Adicione o snippet oficial do GTM no `<head>` e o `noscript` logo após `<body>`.
2. Crie tags de GA4, Google Ads Conversion e Meta Pixel.
3. Use os eventos acima como gatilhos.
4. Valide tudo no Tag Assistant e no Meta Pixel Helper.

Não foram inseridos IDs fictícios para evitar dados contaminados.

## Conversões recomendadas

- Conversão principal: `flight_search_submit`.
- Conversão secundária: `whatsapp_click`.
- Crie UTMs por campanha.
- Considere preservar parâmetros `utm_*` no redirecionamento, conforme a estratégia de atribuição.
- Configure Consent Mode v2 e banner de cookies antes de ativar tags de publicidade, de acordo com sua política de privacidade e orientação jurídica.

## WhatsApp

Número atual: `+55 (11) 2445-3712`.

Links usam:

`https://wa.me/551124453712`

Pesquise por `551124453712` no projeto para trocar o número ou mensagens.

## SEO e conteúdo

Antes da publicação definitiva:

- Atualize o `canonical` caso a landing use outra URL.
- Troque `og:image` por uma imagem social 1200×630.
- Publique páginas reais de Política de Privacidade e Termos de Uso.
- Confirme autorização para uso dos depoimentos.
- Revise afirmações comerciais e horários.

## Performance

O projeto não usa frameworks nem bibliotecas externas. A logo é pré-carregada e as animações respeitam `prefers-reduced-motion`.

Para otimizar ainda mais:

- Converta a logo para WebP/AVIF mantendo o PNG como fallback.
- Ative Brotli/Gzip, cache longo e HTTP/2 ou HTTP/3 no servidor.
- Minifique CSS e JS na etapa de deploy.
- Use CDN.

## Observação importante

O mecanismo de busca externo pode alterar nomes ou parâmetros. Teste o redirecionamento em homologação antes de anunciar. Caso algum parâmetro mude, ajuste a montagem de `URLSearchParams` em `js/app.js`.


## Versão visual atual

Esta versão usa fundo branco, tons suaves de areia, azul e rosé, cantos arredondados e uma linguagem visual mais delicada e associada a agências de viagens.


## Revisão final
Hero 100vh com vídeo em loop e sem som, busca horizontal dominante, tipografia H1/H2/H3 ajustada e elementos gráficos em PNG.
