let finalSource;
let referrer = document.referrer;
let domain = window.location.hostname;
let EXPIRATE_DATE_COOKIE = 5184000;

function getQueryParam(name) {
    let results = new RegExp("[\\?&]" + name + "=([^&#]*)").exec(
        window.location.href
    );
    if (results == null) {
        return results;
    } else {
        return decodeURIComponent(results[1]);
    }
}

function readCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function setCookie(cookieName, cookieValue, expirationTime) {
    expirationTime = expirationTime * 1000;
    let date = new Date();
    let dateTimeNow = date.getTime();

    date.setTime(dateTimeNow + expirationTime);
    date = date.toUTCString();
    document.cookie =
        cookieName +
        "=" +
        cookieValue +
        "; expires=" +
        date +
        "; path=/; domain=" +
        domain;
}


function clearCookie(cookieName) {

    var cookieValue = readCookie(cookieName);

    if (cookieValue) {

        if (cookieValue.length > 1000) {

            var paramList = cookieValue.split("|")
            var firstParam = paramList[0]
            var lastParam = paramList[paramList.length - 1]
            var smallCookie = firstParam + " | User path too long to be recorded | " + lastParam
            setCookie(cookieName, smallCookie, 5184000)
        };
    };

}

let lastSourceCookie = readCookie("lastSourceAttribution");
let firstSourceCookie = readCookie("firstSourceAttribution");
let multiSourceCookie = readCookie("multiSourceAttribution");
let lastDirectCookie = readCookie("lastDirectSource");
let utm_source = getQueryParam("utm_source");
let utm_medium = getQueryParam("utm_medium");
let utm_campaign = getQueryParam("utm_campaign");
let utm_term = getQueryParam("utm_term");
let utm_content = getQueryParam("utm_content");
let gclid = getQueryParam("gclid");
let fbclid = getQueryParam("fbclid");

if (!utm_medium) {
    utm_medium = "";
}
if (!utm_source) {
    utm_source = "";
}

function getEmailSource(utm_medium, utm_source) {
    if (utm_medium.includes("mail") || utm_source.includes("mail")) {
        return "Email Marketing";
    }
}

function getReferrerSource(referrer) {
    let source;

    if (referrer) {
        if (referrer.includes(window.location.hostname)) {
            console.log("Self Referral"); //leaving the variable undefined;
        } else if (referrer.includes("google")) {
            source = "Google Organic Search";
        } else if (referrer.includes("bing")) {
            source = "Microsoft Organic Search";
        } else if (referrer.includes("twitter")) {
            source = "Twitter Organic";
        } else if (referrer.includes("facebook") || referrer.includes("fb")) {
            source = "Facebook Organic";
        } else if (referrer.includes("linkedin")) {
            source = "Linkedin Organic";
        } else if (referrer.includes("insta") || referrer.includes("ig")) {
            source = "Instagram Organic";
        } else if (referrer.includes("whats") || referrer.includes("wa")) {
            source = "WhatsApp";
        } else {
            source = "Referral";
        }
        setCookie("referrerSource", referrer, 5184000);
    }
    return source;
}

function getPaidSource(utm_medium, utm_source, gclid, fbclid) {
    let source;
    if (utm_medium === "display") {
        return "Google Display";
    }
    if (gclid !== null) {
        setCookie("gclidStored", gclid, 5184000);
        return "Google Paid Search";
    }
    if (fbclid !== null) {
        setCookie("fbclidStored", fbclid, 5184000);
        return "Facebook Paid Social";
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
                source = "Google Paid Search";
                break;
            case "microsoft":
            case "bing":
                source = "Microsoft Paid Search";
                break;
            case "facebook":
            case "instagram":
                source = "Facebook Ad";
                break;
            case "linkedin":
                source = "Linkedin Ad";
                break;
            case "twitter":
                source = "Twitter Ad";
                break;
        }
        return source;
    }
}

let paidSource = getPaidSource(utm_medium, utm_source, gclid, fbclid);
let referrerSource = getReferrerSource(referrer);
let emailSource = getEmailSource(utm_medium, utm_source);

finalSource = paidSource || emailSource || referrerSource || "Direct";

if (
    (finalSource === "Direct" && lastDirectCookie === null) ||
    finalSource !== "Direct"
) {
    if (finalSource !== "Direct") {
        setCookie("lastSourceAttribution", finalSource, EXPIRATE_DATE_COOKIE);
    }

    if (firstSourceCookie === null) {
        setCookie("firstSourceAttribution", finalSource, EXPIRATE_DATE_COOKIE);
    }

    if (multiSourceCookie) {
        setCookie(
            "multiSourceAttribution",
            multiSourceCookie + " | " + finalSource,
            EXPIRATE_DATE_COOKIE
        );
    } else {
        setCookie("multiSourceAttribution", finalSource, EXPIRATE_DATE_COOKIE);
    }
}

if (finalSource === "Direct") {
    setCookie("lastDirectSource", "true", 5184000);
}

if (utm_source !== null && utm_source !== "") {
    setCookie("utmSource", utm_source, 5184000);
}

if (utm_campaign !== null) {
    campaign = readCookie("utmCampaign");

    if (campaign) {
        setCookie("utmCampaign", campaign + " | " + utm_campaign, 5184000);
    } else {
        setCookie("utmCampaign", utm_campaign, 5184000);
    }
}

if (utm_term !== null) {
    term = readCookie("utmTerm");

    if (term) {
        setCookie("utmTerm", term + " | " + utm_term, 5184000);
    } else {
        setCookie("utmTerm", utm_term, 5184000);
    }
}

if (utm_content !== null) {
    content = readCookie("utmContent");

    if (content) {
        setCookie("utmContent", content + " | " + utm_content, 5184000);
    } else {
        setCookie("utmContent", utm_content, 5184000);
    }
}

if (utm_medium !== null && utm_medium !== "") {
    setCookie("utmMedium", utm_medium, 5184000);
}

clearCookie("lastSourceAttribution");
clearCookie("firstSourceAttribution");
clearCookie("multiSourceAttribution");


clearCookie("utmSource");
clearCookie("utmMedium");
clearCookie("utmCampaign");
clearCookie("utmTerm");
clearCookie("utmContent");

lastSourceAttribution = readCookie("lastSourceAttribution");
firstSourceAttribution = readCookie("firstSourceAttribution");
multiSourceAttribution = readCookie("multiSourceAttribution");

clearCookie("_fbc");
fbclid = readCookie("_fbc");

clearCookie("gclidStored");
gclid = readCookie("gclidStored");

utm_source = readCookie("utmSource");
utm_medium = readCookie("utmMedium");
utm_campaign = readCookie("utmCampaign");
utm_term = readCookie("utmTerm");
utm_content = readCookie("utmContent");
client_user_agent = window.navigator.userAgent


window.onload = function() {
    ga("require", "getClientId");
    var formClientID = ga.getAll()[0].get("clientId");
    try {
        document.getElementById("analyticsClientId").value = formClientID;
    } catch {
        console.log('traktor.js - Missing form field: analyticsClientId');
    };

};

function setFields() {
    fetch('https://ipinfo.io/json', { method: 'GET', mode: 'cors' })
        .then((response) => response.json())
        .then((data) => {
            client_ip_address = data.ip;
            console.log("IP: " + client_ip_address);
            try {
                // console.log(client_ip_address);
                document.getElementById("client_ip_address").value = String(client_ip_address);

            } catch {
                console.log('traktor.js - Missing form field: client_ip_address');

            };
        })


    try {
        document.getElementById("lastSourceAttribution").value = lastSourceAttribution;
    } catch {
        console.log('traktor.js - traktor.js - Missing form field: lastSourceAttribution');

    };
    try {
        document.getElementById("firstSourceAttribution").value = firstSourceAttribution;
    } catch {
        console.log('traktor.js - Missing form field: firstSourceAttribution');

    };
    try {
        document.getElementById("multiSourceAttribution").value = multiSourceAttribution;
    } catch {
        console.log('traktor.js - Missing form field: multiSourceAttribution');

    };


    try {
        document.getElementById("client_user_agent").value = client_user_agent;
    } catch {
        console.log('traktor.js - Missing form field: client_user_agent');

    };
    try {
        // console.log(client_ip_address);
        document.getElementById("client_ip_address").value = String(client_ip_address);

    } catch {
        console.log('traktor.js - Missing form field: client_ip_address');

    };
    try {
        document.getElementById("gclid").value = gclid;
    } catch {
        console.log('traktor.js - Missing form field: gclid');

    };
    try {
        document.getElementById("fbclid").value = fbclid;

    } catch {
        console.log('traktor.js - Missing form field: fbclid');

    };


    try {
        document.getElementById("utm_content").value = utm_content;
    } catch {
        console.log('traktor.js - Missing form field: utm_content');

    };
    try {
        document.getElementById("utm_term").value = utm_term;
    } catch {
        console.log('traktor.js - Missing form field: utm_term');

    };
    try {
        document.getElementById("utm_campaign").value = utm_campaign;
    } catch {
        console.log('traktor.js - Missing form field: utm_campaign');

    };
    try {
        document.getElementById("utm_source").value = utm_source;
    } catch {
        console.log('traktor.js - Missing form field: utm_source');

    };
    try {
        document.getElementById("utm_medium").value = utm_medium;
    } catch {
        console.log('traktor.js - Missing form field: utm_medium');

    };
}

setTimeout(setFields, 3000);