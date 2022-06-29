# traktor.js
O script traktor.js é utilizado para agregar informações de UTM, Campanhas e Referral e os classificar de acordo com um padrão definido pela Traktor de forma a obtermos informações relevantes sobre origem de leads.

A informação obtida é armazenada em cookies, que são:

lastSourceAttribution (última origem de campanha atribuida ao usuário)
firstSourceAttribution (primeira origem de campanha atribuída ao usuário)
multiSourceAttribution (todo o caminho percorrido)
fbclid (id de clique do Facebook Ads)
gclid (id de clique do Google Ads)
utmCampaign (todo o caminho de campanhas percorrido)
utmTerm (termos utilizados por busca paga)
utmContent (conteúdo do anúncio)

Por fim, essa informação é repassada através de variáveis que possuem o mesmo nome dos cookies para campos ocultos do formulário e enviadas juntamente com o lead para o sistema de gerenciamento de leads do cliente.

## Para seu funcionamento são necessários alguns passos
### Adicionar o script abaixo em todas as páginas do site:

```
<script src="https://gotraktor.com/traktor.js"></script>
```

Esse script vai puxar as informações de origem de entrada e armazenará em um cookie.
A ideia é utilizar essas informações no envio do formulário para ajudar a identificar a origem de cada usuário.

### Fazer a chamada dos dados no envio do form:

Para fazer a chamada pode-se inserir as informações em campos ocultos do formulário via script para que seja enviada junto com as informações do cadastro da seguinte forma:

- document.getElementById("lastSourceAttribution").value = lastSourceAttribution;
- document.getElementById("firstSourceAttribution").value = firstSourceAttribution;
- document.getElementById("multiSourceAttribution").value = multiSourceAttribution;
- document.getElementById("fbclid").value = fbclid
- document.getElementById("gclid").value = gclid
- document.getElementById("utm_campaign").value = utm_campaign
- document.getElementById("utm_content").value = utm_content
- document.getElementById("utm_term").value = utm_term