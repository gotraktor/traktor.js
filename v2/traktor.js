/*!
 * traktor.js v2
 *
 * Captura origem de leads (UTMs, referrer, click IDs de mídia) e os dados
 * usados nas APIs de conversão (Meta CAPI, Google Ads, LinkedIn, TikTok,
 * Microsoft), grava em cookies e preenche os campos do formulário.
 *
 * Mantém os mesmos cookies e IDs de campo do traktor.js v1.
 *
 * Eventos no dataLayer (GTM):
 *   traktor_ready        ao carregar a página
 *   form_submit_tkt      no envio de formulário, com os dados do traktor (traktor.*),
 *                        os dados digitados pelo lead (traktorUser.email, .phone,
 *                        .firstName, .lastName, .fullName), os campos de extraFields
 *                        (traktorExtra.*) e o formulário (traktorForm.*)
 *
 * Configuração opcional, definida antes de carregar o script:
 *
 *   window.traktorConfig = {
 *       autoFields: true,            // cria os campos ocultos que faltarem (ou um seletor CSS de formulários)
 *       autoFieldName: "cf",         // "cf" (cf_atribuicao_source), "slug" (atribuicao_source) ou "label"
 *       cookieDomain: "cliente.com", // compartilha os cookies entre subdomínios
 *       cookieDays: 60,
 *       ip: true,                    // busca o IP público (IPv6 quando houver) em api64.ipify.org
 *       userData: true,              // envia e-mail, telefone e nome digitados no evento form_submit_tkt
 *       phoneCountryCode: "55",      // DDI colocado em telefones sem código do país
 *       requireContact: true,        // form_submit_tkt só sai com e-mail ou telefone válido
 *       submitDelay: 500,            // espera (ms) a validação de formulários enviados por script
 *       extraFields: { colaboradores: ["colaboradores", "funcionarios"] },  // outros campos no evento
 *       fields: { source: "cf_origem" },   // nome/id alternativo de um campo, por chave
 *       clickIds: [{ key: "twclid", param: "twclid", label: "CAPI - X Click ID", source: "Twitter Ad" }],
 *       debug: false
 *   };
 */
(function (window, document) {
    "use strict";

    if (window.traktor && window.traktor.version) {
        return;
    }

    var VERSION = "2.0.0";
    var config = window.traktorConfig || {};
    var hostname = window.location.hostname;
    var cookieDomain = config.cookieDomain || hostname;
    var EXPIRATE_DATE_COOKIE = (config.cookieDays || 60) * 86400;
    var FBC_EXPIRATE_DATE_COOKIE = 90 * 86400;
    var EXTERNAL_ID_EXPIRATE_DATE_COOKIE = 365 * 86400;
    var MAX_COOKIE_LENGTH = 1000;
    var MAX_URL_LENGTH = 500;

    function log() {
        if (config.debug) {
            console.log.apply(console, ["traktor.js -"].concat([].slice.call(arguments)));
        }
    }

    // #### Cookies e URL ####

    function getQueryParam(name) {
        var results = new RegExp("[\\?&]" + name + "=([^&#]*)").exec(
            window.location.href
        );
        if (results == null) {
            return null;
        }
        try {
            return decodeURIComponent(results[1]);
        } catch (e) {
            return results[1];
        }
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(";");
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == " ") c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function setCookie(cookieName, cookieValue, expirationTime) {
        var date = new Date();
        date.setTime(date.getTime() + expirationTime * 1000);
        document.cookie =
            cookieName +
            "=" +
            String(cookieValue).replace(/[;\r\n]/g, "") +
            "; expires=" +
            date.toUTCString() +
            "; path=/" +
            (cookieDomain.indexOf(".") !== -1 ? "; domain=" + cookieDomain : "");
    }

    function clearCookie(cookieName) {
        var cookieValue = readCookie(cookieName);
        if (cookieValue && cookieValue.length > MAX_COOKIE_LENGTH) {
            var paramList = cookieValue.split("|");
            var firstParam = paramList[0];
            var lastParam = paramList[paramList.length - 1];
            setCookie(
                cookieName,
                firstParam + " | User path too long to be recorded | " + lastParam,
                EXPIRATE_DATE_COOKIE
            );
        }
    }

    function appendCookie(cookieName, value) {
        var current = readCookie(cookieName);
        setCookie(cookieName, current ? current + " | " + value : value, EXPIRATE_DATE_COOKIE);
    }

    // #### Click IDs de mídia ####
    // Para suportar uma nova plataforma, basta uma linha aqui (ou em traktorConfig.clickIds).

    var CLICK_IDS = [
        { key: "gclid", param: "gclid", cookie: "gclidStored", source: "Google Paid Search" },
        { key: "gbraid", param: "gbraid", cookie: "gbraidStored", source: "Google Paid Search" },
        { key: "wbraid", param: "wbraid", cookie: "wbraidStored", source: "Google Paid Search" },
        { key: "fbclid", param: "fbclid", cookie: "fbclidStored", source: "Facebook Paid Social" },
        { key: "liFatId", param: "li_fat_id", cookie: "liFatIdStored", fallbackCookie: "li_fat_id", source: "Linkedin Ad" },
        { key: "ttclid", param: "ttclid", cookie: "ttclidStored", source: "TikTok Ad" },
        { key: "msclkid", param: "msclkid", cookie: "msclkidStored", source: "Microsoft Paid Search" }
    ];

    (config.clickIds || []).forEach(function (clickId) {
        if (clickId && clickId.key && clickId.param) {
            clickId.cookie = clickId.cookie || clickId.key + "Stored";
            CLICK_IDS.push(clickId);
        }
    });

    // #### Classificação da origem ####

    var REFERRER_RULES = [
        { labels: ["google"], source: "Google Organic Search" },
        { labels: ["bing"], source: "Microsoft Organic Search" },
        { labels: ["twitter"], hosts: ["t.co", "x.com"], source: "Twitter Organic" },
        { labels: ["facebook", "fb", "messenger"], source: "Facebook Organic" },
        { labels: ["linkedin", "lnkd"], source: "Linkedin Organic" },
        { labels: ["instagram"], hosts: ["ig.me"], source: "Instagram Organic" },
        { labels: ["whatsapp"], hosts: ["wa.me"], source: "WhatsApp" }
    ];

    function getHost(url) {
        var match = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:]+)/i.exec(url);
        return match ? match[1].toLowerCase() : "";
    }

    function isSameSite(host) {
        return (
            host === hostname ||
            host === cookieDomain ||
            host.slice(-(cookieDomain.length + 1)) === "." + cookieDomain
        );
    }

    function hostMatches(host, rule) {
        var labels = host.split(".");
        for (var i = 0; i < rule.labels.length; i++) {
            if (labels.indexOf(rule.labels[i]) !== -1) return true;
        }
        var hosts = rule.hosts || [];
        for (var j = 0; j < hosts.length; j++) {
            if (host === hosts[j] || host.slice(-(hosts[j].length + 1)) === "." + hosts[j]) return true;
        }
        return false;
    }

    function getReferrerSource(referrer) {
        var host = referrer ? getHost(referrer) : "";
        if (!host || isSameSite(host)) {
            return; // Self Referral ou acesso direto
        }
        setCookie("referrerSource", referrer.substring(0, MAX_URL_LENGTH), EXPIRATE_DATE_COOKIE);
        for (var i = 0; i < REFERRER_RULES.length; i++) {
            if (hostMatches(host, REFERRER_RULES[i])) return REFERRER_RULES[i].source;
        }
        return "Referral";
    }

    function getEmailSource(utm_medium, utm_source) {
        if (utm_medium.includes("mail") || utm_source.includes("mail")) {
            return "Email Marketing";
        }
    }

    function getPaidSource(utm_medium, utm_source) {
        var source;
        for (var i = 0; i < CLICK_IDS.length; i++) {
            var value = getQueryParam(CLICK_IDS[i].param);
            if (value) {
                setCookie(CLICK_IDS[i].cookie, value, EXPIRATE_DATE_COOKIE);
                source = source || CLICK_IDS[i].source;
            }
        }
        if (utm_medium === "display") {
            return "Google Display";
        }
        if (source) {
            return source;
        }
        if (
            utm_medium.includes("ppc") ||
            utm_medium.includes("ad") ||
            utm_medium.includes("cpc") ||
            utm_medium.includes("paid") ||
            utm_medium.includes("adwords")
        ) {
            switch (utm_source) {
                case "adwords":
                case "google":
                    return "Google Paid Search";
                case "microsoft":
                case "bing":
                    return "Microsoft Paid Search";
                case "facebook":
                case "instagram":
                    return "Facebook Ad";
                case "linkedin":
                    return "Linkedin Ad";
                case "twitter":
                    return "Twitter Ad";
                case "tiktok":
                    return "TikTok Ad";
            }
        }
    }

    var firstSourceCookie = readCookie("firstSourceAttribution");
    var multiSourceCookie = readCookie("multiSourceAttribution");
    var lastDirectCookie = readCookie("lastDirectSource");
    var utm_source = getQueryParam("utm_source") || "";
    var utm_medium = getQueryParam("utm_medium") || "";
    var utm_campaign = getQueryParam("utm_campaign") || "";
    var utm_term = getQueryParam("utm_term") || "";
    var utm_content = getQueryParam("utm_content") || "";

    var paidSource = getPaidSource(utm_medium, utm_source);
    var referrerSource = getReferrerSource(document.referrer);
    var emailSource = getEmailSource(utm_medium, utm_source);
    var finalSource = paidSource || emailSource || referrerSource || "Direct";

    if (finalSource !== "Direct" || lastDirectCookie === null) {
        if (finalSource !== "Direct") {
            setCookie("lastSourceAttribution", finalSource, EXPIRATE_DATE_COOKIE);
        }
        if (firstSourceCookie === null) {
            setCookie("firstSourceAttribution", finalSource, EXPIRATE_DATE_COOKIE);
        }
        setCookie(
            "multiSourceAttribution",
            multiSourceCookie ? multiSourceCookie + " | " + finalSource : finalSource,
            EXPIRATE_DATE_COOKIE
        );
    }

    if (finalSource === "Direct") {
        setCookie("lastDirectSource", "true", EXPIRATE_DATE_COOKIE);
    }

    if (utm_source !== "") {
        setCookie("utmSource", utm_source, EXPIRATE_DATE_COOKIE);
    }
    if (utm_medium !== "") {
        setCookie("utmMedium", utm_medium, EXPIRATE_DATE_COOKIE);
    }
    // Só grava UTM com valor: uma página sem UTM não pode apagar a origem já registrada
    if (utm_campaign !== "") {
        setCookie("utmCampaign", utm_campaign, EXPIRATE_DATE_COOKIE);
    }
    if (utm_term !== "") {
        appendCookie("utmTerm", utm_term);
    }
    if (utm_content !== "") {
        appendCookie("utmContent", utm_content);
    }

    // Página de entrada e início da sessão da última visita com origem (session attributes do Google)
    if (finalSource !== "Direct" || readCookie("tkLandingPage") === null) {
        setCookie("tkLandingPage", window.location.href.split("#")[0].substring(0, MAX_URL_LENGTH), EXPIRATE_DATE_COOKIE);
        setCookie("tkSessionStart", new Date().getTime(), EXPIRATE_DATE_COOKIE);
    }
    ["gad_source", "gad_campaignid"].forEach(function (param) {
        var value = getQueryParam(param);
        if (value) {
            setCookie(param === "gad_source" ? "gadSource" : "gadCampaignId", value, EXPIRATE_DATE_COOKIE);
        }
    });

    // #### Meta: fbc no formato fb.<subdomainIndex>.<creationTime>.<fbclid> ####

    function resolveFbc() {
        var fbc = readCookie("_fbc");
        var fbclid = getQueryParam("fbclid");
        if (fbclid && (!fbc || fbc.indexOf(fbclid) === -1)) {
            fbc = "fb." + Math.max(cookieDomain.split(".").length - 1, 1) + "." + new Date().getTime() + "." + fbclid;
            setCookie("_fbc", fbc, FBC_EXPIRATE_DATE_COOKIE);
        }
        return fbc;
    }

    resolveFbc();

    [
        "lastSourceAttribution",
        "firstSourceAttribution",
        "multiSourceAttribution",
        "utmSource",
        "utmMedium",
        "utmCampaign",
        "utmTerm",
        "utmContent"
    ].forEach(clearCookie);

    // #### Dados expostos ####

    function newId() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        return new Date().getTime() + "." + Math.random().toString(36).substring(2, 12);
    }

    // ID do visitante (external_id no Pixel e no CAPI), o mesmo em todas as visitas
    var externalId = readCookie("tkExternalId") || newId();
    setCookie("tkExternalId", externalId, EXTERNAL_ID_EXPIRATE_DATE_COOKIE);

    // ID da conversão (event_id para deduplicar Pixel e CAPI), renovado a cada envio de formulário
    var client_ip_address = null;
    var eventId = newId();

    function getGaClientId() {
        var ga = readCookie("_ga");
        return ga ? ga.split(".").slice(-2).join(".") : null;
    }

    function getRudderAnonymousId() {
        try {
            return window.rudderanalytics.getAnonymousId();
        } catch (e) {
            return null;
        }
    }

    function collect() {
        var data = {
            source: readCookie("utmSource"),
            medium: readCookie("utmMedium"),
            campaign: readCookie("utmCampaign"),
            term: readCookie("utmTerm"),
            content: readCookie("utmContent"),
            firstSource: readCookie("firstSourceAttribution"),
            lastSource: readCookie("lastSourceAttribution"),
            multiSource: readCookie("multiSourceAttribution"),
            referrer: readCookie("referrerSource"),
            landingPage: readCookie("tkLandingPage"),
            conversionPage: window.location.href.split("#")[0],
            sessionStart: readCookie("tkSessionStart"),
            gadSource: readCookie("gadSource"),
            gadCampaignId: readCookie("gadCampaignId"),
            gaClientId: getGaClientId(),
            gaCookie: readCookie("_ga"),
            fbc: readCookie("_fbc"),
            fbp: readCookie("_fbp"),
            ttp: readCookie("_ttp"),
            rudderAnonymousId: getRudderAnonymousId(),
            userAgent: window.navigator.userAgent,
            ip: client_ip_address,
            externalId: externalId,
            eventId: eventId
        };
        CLICK_IDS.forEach(function (clickId) {
            data[clickId.key] =
                readCookie(clickId.cookie) ||
                (clickId.fallbackCookie ? readCookie(clickId.fallbackCookie) : null);
        });
        return data;
    }

    // #### Campos do formulário ####
    // label: nome do campo no CRM. legacy: id usado pelo traktor.js v1.

    var FIELDS = [
        { key: "source", label: "Atribuição - Source", legacy: "utm_source" },
        { key: "medium", label: "Atribuição - Medium", legacy: "utm_medium" },
        { key: "campaign", label: "Atribuição - Campaign", legacy: "utm_campaign" },
        { key: "term", label: "Atribuição - Term", legacy: "utm_term" },
        { key: "content", label: "Atribuição - Content", legacy: "utm_content" },
        { key: "firstSource", label: "Atribuição - First Source", legacy: "firstSourceAttribution" },
        { key: "lastSource", label: "Atribuição - Last Source", legacy: "lastSourceAttribution" },
        { key: "multiSource", label: "Atribuição - Multi Source", legacy: "multiSourceAttribution" },
        { key: "referrer", label: "Atribuição - Referrer" },
        { key: "landingPage", label: "Atribuição - Landing Page" },
        { key: "conversionPage", label: "Atribuição - Conversion Page" },
        { key: "gclid", label: "CAPI - GCLID", legacy: "gclid" },
        { key: "gbraid", label: "CAPI - GBRAID" },
        { key: "wbraid", label: "CAPI - WBRAID" },
        { key: "gadSource", label: "CAPI - GAD Source" },
        { key: "gadCampaignId", label: "CAPI - GAD Campaign ID" },
        { key: "gaClientId", label: "CAPI - GA Client ID" },
        { key: "fbc", label: "CAPI - FBC", legacy: "fbclid" },
        { key: "fbp", label: "CAPI - FBP", legacy: "_fbp" },
        { key: "liFatId", label: "CAPI - LinkedIn Click ID" },
        { key: "ttclid", label: "CAPI - TikTok Click ID" },
        { key: "msclkid", label: "CAPI - Microsoft Click ID" },
        { key: "userAgent", label: "CAPI - User Agent", legacy: "client_user_agent" },
        { key: "ip", label: "CAPI - IP", legacy: "client_ip_address" },
        { key: "externalId", label: "CAPI - External ID" },
        { key: "eventId", label: "CAPI - Event ID" },
        { key: "gaCookie", legacy: "analyticsClientId" },
        { key: "rudderAnonymousId", legacy: "userId" }
    ];

    (config.clickIds || []).forEach(function (clickId) {
        if (clickId && clickId.key && clickId.param && clickId.label) {
            FIELDS.push({ key: clickId.key, label: clickId.label });
        }
    });

    function slug(text) {
        var value = String(text);
        if (value.normalize) {
            value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
        }
        return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    }

    FIELDS.forEach(function (field) {
        field.slug = field.label ? slug(field.label) : null;
        field.aliases = [].concat(field.legacy || [], (config.fields || {})[field.key] || []);
    });

    // Casa por id/name exato (v1 e traktorConfig.fields) ou pelo nome do campo no CRM,
    // em qualquer formato: "Atribuição - Source", atribuicao_source, cf_atribuicao_source,
    // form_fields[atribuicao_source]...
    function nameMatches(name, field) {
        if (!name) return false;
        if (field.aliases.indexOf(name) !== -1) return true;
        if (!field.slug) return false;
        var nameSlug = slug(name);
        return (
            nameSlug === field.slug ||
            nameSlug.slice(-(field.slug.length + 1)) === "_" + field.slug
        );
    }

    function findElements(field, root) {
        var found = [];
        var controls = root.querySelectorAll("input, textarea, select");
        for (var i = 0; i < controls.length; i++) {
            var el = controls[i];
            if (
                el.getAttribute("data-traktor") === field.key ||
                nameMatches(el.id, field) ||
                nameMatches(el.getAttribute("name"), field)
            ) {
                found.push(el);
            }
        }
        if (field.slug) {
            var labels = root.querySelectorAll("label");
            for (var j = 0; j < labels.length; j++) {
                var control = labels[j].control;
                if (control && found.indexOf(control) === -1 && slug(labels[j].textContent) === field.slug) {
                    found.push(control);
                }
            }
        }
        return found;
    }

    function setValue(el, value) {
        if (el.value === value) return;
        var proto =
            el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype :
            el.tagName === "INPUT" ? window.HTMLInputElement.prototype : null;
        var descriptor = proto && Object.getOwnPropertyDescriptor(proto, "value");
        if (descriptor && descriptor.set) {
            descriptor.set.call(el, value); // necessário em formulários React
        } else {
            el.value = value;
        }
        if (el.type !== "hidden") {
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function autoFieldName(field) {
        if (config.autoFieldName === "label") return field.label;
        if (config.autoFieldName === "slug") return field.slug;
        return "cf_" + field.slug;
    }

    function createMissingFields() {
        if (!config.autoFields) return;
        var forms = document.querySelectorAll(
            typeof config.autoFields === "string" ? config.autoFields : "form"
        );
        for (var i = 0; i < forms.length; i++) {
            var form = forms[i];
            // Busca e login não são formulários de lead
            if (
                form.getAttribute("role") === "search" ||
                form.querySelector("input[type=search], input[type=password]")
            ) {
                continue;
            }
            for (var j = 0; j < FIELDS.length; j++) {
                var field = FIELDS[j];
                if (!field.label || findElements(field, form).length) continue;
                var input = document.createElement("input");
                input.type = "hidden";
                input.name = autoFieldName(field);
                input.setAttribute("data-traktor", field.key);
                form.appendChild(input);
            }
        }
    }

    function fillForms() {
        createMissingFields();
        var data = collect();
        FIELDS.forEach(function (field) {
            var value = data[field.key];
            if (value === null || value === undefined || value === "") return;
            findElements(field, document).forEach(function (el) {
                setValue(el, String(value));
            });
        });
    }

    var fillTimer = null;

    function scheduleFill() {
        clearTimeout(fillTimer);
        fillTimer = setTimeout(fillForms, 300);
    }

    function loadIp() {
        if (config.ip === false) return;
        try {
            client_ip_address = window.sessionStorage.getItem("tkIp");
        } catch (e) {}
        if (client_ip_address) return;
        fetch("https://api64.ipify.org/?format=json", { method: "GET", mode: "cors" })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                client_ip_address = data.ip;
                try {
                    window.sessionStorage.setItem("tkIp", client_ip_address);
                } catch (e) {}
                scheduleFill();
            })
            .catch(function () {
                log("IP indisponível");
            });
    }

    window.traktor = {
        version: VERSION,
        get: collect,
        fill: fillForms,
        fields: FIELDS.filter(function (field) { return field.label; }).map(function (field) {
            return { key: field.key, label: field.label, name: "cf_" + field.slug };
        }),
        newEventId: function () {
            eventId = newId();
            fillForms();
            return eventId;
        }
    };

    // #### Dados digitados pelo lead ####
    // Reconhece e-mail, telefone e nome pelos nomes de campo mais comuns (inclusive em português).

    var USER_FIELD_RULES = [
        { key: "email", types: ["email"], pattern: /e_?mail/ },
        { key: "phone", types: ["tel"], pattern: /phone|telefone|^tel$|_tel$|^tel_|celular|whats|fone|mobile/ },
        { key: "firstName", pattern: /first_?name|primeiro_?nome|^fname$|given_?name/ },
        { key: "lastName", pattern: /last_?name|sobrenome|ultimo_?nome|^lname$|surname|family_?name/ },
        { key: "fullName", pattern: /nome|name/ }
    ];
    var USER_FIELD_IGNORE = /empresa|company|companhia|razao|cnpj|user_?name|login|cargo|job|cidade|city|estado|state|utm|atribuicao|capi/;

    function fieldTokens(el) {
        var label = el.labels && el.labels.length ? el.labels[0].textContent : "";
        return [el.getAttribute("name"), el.id, el.getAttribute("autocomplete"), el.getAttribute("placeholder"), label]
            .filter(Boolean)
            .map(slug)
            .join(" ");
    }

    function normalizePhone(value) {
        var digits = value.replace(/\D/g, "").replace(/^0+/, "");
        if (digits.length === 10 || digits.length === 11) {
            digits = (config.phoneCountryCode || "55") + digits;
        }
        return digits || null;
    }

    function getUserData(form) {
        var user = { email: null, phone: null, firstName: null, lastName: null, fullName: null };
        var controls = form.querySelectorAll ? form.querySelectorAll("input, textarea, select") : [];
        for (var i = 0; i < controls.length; i++) {
            var el = controls[i];
            var type = (el.type || "").toLowerCase();
            if (["hidden", "password", "checkbox", "radio", "submit", "button", "file"].indexOf(type) !== -1) continue;
            if (el.getAttribute("data-traktor") || !el.value || !String(el.value).trim()) continue;
            var tokens = fieldTokens(el);
            if (USER_FIELD_IGNORE.test(tokens)) continue;
            for (var j = 0; j < USER_FIELD_RULES.length; j++) {
                var rule = USER_FIELD_RULES[j];
                if (user[rule.key]) continue;
                if ((rule.types && rule.types.indexOf(type) !== -1) || rule.pattern.test(tokens)) {
                    user[rule.key] = String(el.value).trim();
                    break;
                }
            }
        }
        if (user.email) user.email = user.email.toLowerCase();
        if (user.phone) user.phone = normalizePhone(user.phone);
        if (user.fullName && !user.firstName) {
            var parts = user.fullName.split(/\s+/);
            user.firstName = parts[0];
            user.lastName = user.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : null);
        }
        if (!user.fullName && user.firstName) {
            user.fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
        }
        return user;
    }

    // #### Campos extras do evento (traktorConfig.extraFields) ####
    // Cada chave recebe o valor do primeiro campo do formulário cujo nome, id, rótulo ou
    // placeholder contenha um dos termos. Campo que não existe na página fica null.

    function getExtraData(form) {
        var extra = {};
        var rules = config.extraFields || {};
        var controls = form.querySelectorAll("input, textarea, select");
        Object.keys(rules).forEach(function (key) {
            var terms = [].concat(rules[key]).map(slug).filter(Boolean);
            extra[key] = null;
            for (var i = 0; i < controls.length; i++) {
                var el = controls[i];
                var type = (el.type || "").toLowerCase();
                if (el.getAttribute("data-traktor") || type === "password") continue;
                if ((type === "radio" || type === "checkbox") && !el.checked) continue;
                var tokens = fieldTokens(el);
                var matches = terms.some(function (term) { return tokens.indexOf(term) !== -1; });
                if (matches && String(el.value).trim()) {
                    extra[key] = extra[key] && type === "checkbox" ? extra[key] + ", " + el.value : String(el.value).trim();
                    if (type !== "checkbox") break;
                }
            }
        });
        return extra;
    }

    // #### Validação do envio ####
    // O evento form_submit_tkt só é enviado quando o formulário passa na validação:
    // campos obrigatórios preenchidos, e-mail ou telefone válido e nenhuma mensagem de erro visível.

    var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var ERROR_SELECTOR = [
        "[aria-invalid='true']", "input.error", "select.error", "textarea.error", "label.error",
        ".is-invalid", ".has-error", ".field-error", ".error-message", ".wpcf7-not-valid",
        ".elementor-message-danger", ".hs-error-msgs"
    ].join(",");

    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function validateSubmission(form, user, nativeValid) {
        if (!nativeValid) {
            return "campos obrigatórios ou inválidos";
        }
        if (config.requireContact !== false) {
            var validEmail = user.email && EMAIL_PATTERN.test(user.email);
            var validPhone = user.phone && user.phone.length >= 10;
            if (!validEmail && !validPhone) return "sem e-mail ou telefone válido";
        }
        var errors = form.querySelectorAll(ERROR_SELECTOR);
        for (var i = 0; i < errors.length; i++) {
            if (isVisible(errors[i])) return "mensagem de erro no formulário";
        }
        return null;
    }

    function pushSubmit(form) {
        var now = new Date().getTime();
        if (form._tktLastSubmit && now - form._tktLastSubmit < 3000) return; // clique duplo
        // Dados lidos no momento do envio: o formulário pode ser limpo logo depois do sucesso
        var snapshot = form._tktSnapshot || takeSnapshot(form);
        var user = snapshot.user;
        var problem = validateSubmission(form, user, snapshot.valid);
        if (problem) {
            log("form_submit_tkt não enviado:", problem);
            return;
        }
        form._tktLastSubmit = now;
        var payload = {
            event: "form_submit_tkt",
            traktor: collect(),
            traktorForm: { id: form.id || null, name: form.getAttribute("name") || null }
        };
        if (config.userData !== false) {
            payload.traktorUser = user;
        }
        if (config.extraFields) {
            payload.traktorExtra = snapshot.extra;
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(payload);
        // Próximo envio é outra conversão: novo event_id depois que as tags já leram este
        setTimeout(window.traktor.newEventId, 2000);
    }

    function takeSnapshot(form) {
        return { user: getUserData(form), extra: getExtraData(form), valid: !form.checkValidity || form.checkValidity() };
    }

    // Antes de qualquer outro script do formulário: garante os campos preenchidos no envio.
    function onSubmitCapture(event) {
        fillForms();
        var form = event.target;
        if (form && form.tagName === "FORM") {
            form._tktSnapshot = takeSnapshot(form);
        }
    }

    // Depois dos scripts do formulário: decide se o envio foi aceito.
    function onSubmit(event) {
        var form = event.target;
        if (!form || form.tagName !== "FORM") return;
        if (!event.defaultPrevented) {
            // Envio normal: a página vai mudar, então o evento sai agora
            pushSubmit(form);
        } else {
            // Envio por script (RD Station, Elementor, AJAX): espera a validação do próprio formulário
            setTimeout(function () {
                pushSubmit(form);
            }, config.submitDelay || 500);
        }
    }

    function start() {
        fillForms();
        // Formulários que entram depois na página (RD Station, pop-ups, SPAs)
        if (window.MutationObserver) {
            new MutationObserver(scheduleFill).observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
        // _fbp e _ga podem ser criados depois do traktor.js
        setTimeout(fillForms, 2000);
        document.addEventListener("submit", onSubmitCapture, true);
        window.addEventListener("submit", onSubmit);

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "traktor_ready", traktor: collect() });
        log("v" + VERSION, collect());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})(window, document);
