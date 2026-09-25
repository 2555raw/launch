(() => { seekr.nav(); document.querySelectorAll('pre.code').forEach((p) => { p.textContent = p.textContent.replace(/https:\/\/YOUR-DOMAIN/g, location.origin); }); })();
