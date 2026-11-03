# traktor.js v2

Versão única do traktor.js: substitui `traktor.js`, `traktor-lite.js` e `databerg-traktor.js`.

O script captura a origem do lead (UTMs, referrer e IDs de clique de mídia) e os dados usados nas APIs de conversão (Meta CAPI, Google Ads, LinkedIn, TikTok e Microsoft). Ele grava tudo em cookies e preenche os campos do formulário. Também pode criar os campos ocultos sozinho, sem precisar de uma tag separada para isso.

## Implementação no GTM

Uma única tag de **HTML personalizado**, disparada em **All Pages**. Escolha o modelo pelo CRM do cliente.

### Cliente com RD Station

```html
<script>
  window.traktorConfig = { autoFields: true, autoFieldName: "cf" };
</script>
<script src="https://js.gotraktor.com/v2/traktor.js"></script>
```

Cria os campos no formato do RD: `cf_atribuicao_source`, `cf_capi_gclid`…

### Demais clientes

```html
<script>
  window.traktorConfig = { autoFields: true, autoFieldName: "slug" };
</script>
<script src="https://js.gotraktor.com/v2/traktor.js"></script>
```

Cria os campos no formato `atribuicao_source`, `capi_gclid`…

Nos dois casos, os campos precisam existir no CRM com o mesmo identificador para que o valor seja gravado no lead.

### Quais formulários recebem os campos

Todos os `<form>` da página, inclusive os que carregam depois (RD Station, pop-ups). Ficam de fora:

- formulários de busca (`role="search"` ou com campo de pesquisa);
- formulários de login (com campo de senha).

Para limitar a formulários específicos, troque `true` por um seletor CSS:

```js
window.traktorConfig = { autoFields: "#form-contato", autoFieldName: "slug" };
```

O script não alcança formulários dentro de iframe. Também não cria campos em formulários montados sem a tag `<form>`, mas preenche os campos que já existirem neles.

### Sem criação automática

Sem `autoFields`, o script só preenche os campos que já existem no formulário. Esse modo serve para quando os campos são criados no próprio formulário ou por outra tag:

```html
<script src="https://js.gotraktor.com/v2/traktor.js"></script>
```

O campo é reconhecido pelo nome em qualquer formato: `Atribuição - Source`, `atribuicao_source`, `cf_atribuicao_source`, `form_fields[atribuicao_source]` ou pelo texto do `<label>`.

## Evento de envio de formulário

Quando um formulário é enviado com sucesso, o script envia ao `dataLayer` o evento `form_submit_tkt`, que serve de acionador para as tags de conversão do navegador (Pixel da Meta, Google Ads, LinkedIn).

O evento só sai se o envio passar no validador: campos obrigatórios preenchidos, e-mail válido ou telefone com 10+ dígitos (`requireContact`), nenhuma mensagem de erro visível no formulário e nenhum disparo do mesmo formulário nos últimos 3 segundos. Formulários enviados por script (RD Station, Elementor) são conferidos `submitDelay` ms depois do envio (padrão 500). O validador não vê a resposta do servidor do CRM. Com `debug: true`, o console mostra por que um envio não disparou o evento.

| Variável | Conteúdo |
|---|---|
| `traktor.*` | Todos os dados de origem e identificadores, os mesmos de `traktor.get()` |
| `traktorUser.email` | E-mail digitado, em minúsculas |
| `traktorUser.phone` | Telefone só com números e com DDI (ex.: `5511987654321`) |
| `traktorUser.firstName` / `lastName` / `fullName` | Nome do lead |
| `traktorExtra.*` | Campos configurados em `extraFields` (null quando o campo não existe na página) |
| `traktorForm.id` / `traktorForm.name` | Formulário enviado |

E-mail, telefone e nome são reconhecidos pelo nome, id, rótulo, placeholder e tipo do campo (`email`, `telefone`, `celular`, `whatsapp`, `nome`, `sobrenome`, `first_name`…). Campos de empresa, cargo, cidade e estado são ignorados. Para não enviar esses dados, use `userData: false`.

Exemplo de tag do Pixel da Meta, com acionador de evento personalizado `form_submit_tkt`:

```html
<script>
  fbq('init', 'PIXEL_ID', {
    em: {{DLV - traktorUser.email}},
    ph: {{DLV - traktorUser.phone}},
    fn: {{DLV - traktorUser.firstName}},
    ln: {{DLV - traktorUser.lastName}},
    external_id: {{DLV - traktor.externalId}}
  });
  fbq('track', 'Lead');
</script>
```

O CAPI envia conversões do CRM (mudanças de etapa), que são eventos diferentes do Lead do navegador; não há deduplicação entre os dois.

Ao carregar a página, o script também envia o evento `traktor_ready`, com todos os dados em `traktor.*`.

## Campos

| Campo no CRM | RD Station | Demais | Conteúdo |
|---|---|---|---|
| Atribuição - Source | `cf_atribuicao_source` | `atribuicao_source` | utm_source |
| Atribuição - Medium | `cf_atribuicao_medium` | `atribuicao_medium` | utm_medium |
| Atribuição - Campaign | `cf_atribuicao_campaign` | `atribuicao_campaign` | utm_campaign |
| Atribuição - Term | `cf_atribuicao_term` | `atribuicao_term` | utm_term (acumulado com " \| ") |
| Atribuição - Content | `cf_atribuicao_content` | `atribuicao_content` | utm_content (acumulado com " \| ") |
| Atribuição - First Source | `cf_atribuicao_first_source` | `atribuicao_first_source` | Primeira origem classificada |
| Atribuição - Last Source | `cf_atribuicao_last_source` | `atribuicao_last_source` | Última origem que não foi "Direct" |
| Atribuição - Multi Source | `cf_atribuicao_multi_source` | `atribuicao_multi_source` | Caminho completo de origens |
| Atribuição - Referrer | `cf_atribuicao_referrer` | `atribuicao_referrer` | Último site externo que trouxe o visitante |
| Atribuição - Landing Page | `cf_atribuicao_landing_page` | `atribuicao_landing_page` | Primeira página da última visita com origem |
| Atribuição - Conversion Page | `cf_atribuicao_conversion_page` | `atribuicao_conversion_page` | Página onde o formulário foi enviado |
| CAPI - GCLID | `cf_capi_gclid` | `capi_gclid` | Clique do Google Ads |
| CAPI - GBRAID | `cf_capi_gbraid` | `capi_gbraid` | Clique do Google Ads em iOS (web → app) |
| CAPI - WBRAID | `cf_capi_wbraid` | `capi_wbraid` | Clique do Google Ads em iOS (app → web) |
| CAPI - GAD Source | `cf_capi_gad_source` | `capi_gad_source` | Parâmetro `gad_source` do Google Ads |
| CAPI - GAD Campaign ID | `cf_capi_gad_campaign_id` | `capi_gad_campaign_id` | ID da campanha do Google Ads (`gad_campaignid`) |
| CAPI - GA Client ID | `cf_capi_ga_client_id` | `capi_ga_client_id` | ID do Google Analytics (ex.: `123.456`) |
| CAPI - FBC | `cf_capi_fbc` | `capi_fbc` | Clique da Meta no formato `fb.1.<timestamp>.<fbclid>` |
| CAPI - FBP | `cf_capi_fbp` | `capi_fbp` | ID de navegador da Meta (cookie `_fbp`) |
| CAPI - LinkedIn Click ID | `cf_capi_linkedin_click_id` | `capi_linkedin_click_id` | `li_fat_id` |
| CAPI - TikTok Click ID | `cf_capi_tiktok_click_id` | `capi_tiktok_click_id` | `ttclid` |
| CAPI - Microsoft Click ID | `cf_capi_microsoft_click_id` | `capi_microsoft_click_id` | `msclkid` |
| CAPI - User Agent | `cf_capi_user_agent` | `capi_user_agent` | Navegador do visitante |
| CAPI - IP | `cf_capi_ip` | `capi_ip` | IP público, IPv6 quando houver |
| CAPI - External ID | `cf_capi_external_id` | `capi_external_id` | ID do visitante, o mesmo por 1 ano |
| CAPI - Event ID | `cf_capi_event_id` | `capi_event_id` | ID da conversão, novo a cada envio |

Valores possíveis de First, Last e Multi Source: Google Paid Search, Google Display, Facebook Paid Social, Facebook Ad, Microsoft Paid Search, Linkedin Ad, Twitter Ad, TikTok Ad, Email Marketing, Google Organic Search, Microsoft Organic Search, Twitter Organic, Facebook Organic, Linkedin Organic, Instagram Organic, WhatsApp, Referral e Direct.

## Outras opções de `traktorConfig`

| Opção | Padrão | Uso |
|---|---|---|
| `autoFields` | desligado | `true` ou seletor CSS: cria os campos que faltarem |
| `autoFieldName` | `"cf"` | `"cf"` (RD Station), `"slug"` ou `"label"` (`Atribuição - Source`) |
| `cookieDomain` | domínio da página | Ex.: `"cliente.com"`, para compartilhar a origem entre `www` e a LP |
| `cookieDays` | `60` | Validade dos cookies de origem |
| `ip` | `true` | `false` desliga a busca do IP (feita em api64.ipify.org) |
| `userData` | `true` | `false` não envia e-mail, telefone e nome no evento `form_submit_tkt` |
| `phoneCountryCode` | `"55"` | DDI colocado em telefones sem código do país |
| `requireContact` | `true` | `false` dispara o evento mesmo sem e-mail ou telefone válido |
| `submitDelay` | `500` | Espera (ms) antes de conferir formulários enviados por script |
| `extraFields` | — | Outros campos no evento: `{ colaboradores: ["colaboradores", "funcionarios"] }` → `traktorExtra.colaboradores` |
| `fields` | — | Nome alternativo de um campo: `{ source: "origem_lead" }` |
| `clickIds` | — | Nova plataforma: `[{ key: "twclid", param: "twclid", label: "CAPI - X Click ID", source: "Twitter Ad" }]` |
| `debug` | `false` | Mostra os dados capturados no console |

Para consultar os dados no console do navegador: `traktor.get()`.
