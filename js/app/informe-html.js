/* Informe en HTML (vista previa y PDF) a partir del modelo de js/portafolio/modelo.js. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;

  const CSS = `
  @page { size: letter; margin: 18mm 17mm 18mm 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.5pt/1.5 Arial, "Helvetica Neue", sans-serif; color: #1f2933; background: #fff; }
  .hoja { max-width: 820px; margin: 0 auto; padding: 28px 40px; }
  .portada { min-height: 900px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; break-after: page; }
  .portada .logo { width: 360px; margin-bottom: 48px; }
  .portada h1 { color: #002060; font-size: 24pt; letter-spacing: .5px; margin: 0 0 12px; text-transform: uppercase; line-height: 1.2; }
  .portada .sol { font-size: 15pt; margin: 0 0 6px; }
  .portada .gris, .gris { color: #5f6b78; }
  .portada .logo-sol { max-width: 170px; max-height: 120px; margin: 28px 0; }
  .portada .barra { width: 100%; max-width: 640px; margin-top: 60px; }
  h2 { color: #002060; font-size: 15pt; border-bottom: 2px solid #002060; padding-bottom: 4px; margin: 28px 0 12px; page-break-after: avoid; break-after: avoid; }
  h3 { color: #5f6b78; font-size: 8.5pt; letter-spacing: 1.2px; text-transform: uppercase; margin: 18px 0 4px; page-break-after: avoid; break-after: avoid; }
  p { margin: 0 0 9px; text-align: justify; }
  .cifras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 4px; }
  .cifra { background: #eef3fa; border-radius: 6px; padding: 10px 6px; text-align: center; }
  .cifra b { display: block; color: #002060; font-size: 18pt; line-height: 1.2; }
  .cifra span { color: #5f6b78; font-size: 8.5pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 4px 0 10px; page-break-inside: auto; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th { background: #002060; color: #fff; text-align: left; padding: 5px 7px; font-weight: 700; }
  td { border: 1px solid #c9d0d9; padding: 4px 7px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f7f9fc; }
  table.datos td:first-child { background: #f3f5f9; font-weight: 700; width: 34%; color: #26323f; }
  table.datos tr td { background: #fff; }
  .mapa-gen { width: 100%; max-height: 430px; object-fit: contain; background: #e9eef3; border-radius: 6px; border: 1px solid #d0d6de; margin-top: 10px; }
  .leyenda { text-align: center; font-style: italic; color: #5f6b78; font-size: 8.5pt; margin: 4px 0 14px; }
  .predio { page-break-before: always; break-before: page; }
  .predio.primero { page-break-before: auto; break-before: auto; }
  .predio-tit { color: #002060; font-size: 17pt; font-weight: 700; margin: 6px 0 0; }
  .predio-sub { margin: 2px 0 12px; font-size: 10.5pt; }
  .predio-sub b { color: #26323f; }
  .sello { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 8.5pt; font-weight: 700; background: #eef3fa; color: #002060; margin-left: 6px; }
  .hero { width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: 6px; display: block; }
  .concepto { background: #eef3fa; border-left: 4px solid #002060; padding: 9px 12px; border-radius: 0 6px 6px 0; margin: 4px 0 12px; text-align: justify; }
  .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
  .fotos figure { margin: 0; page-break-inside: avoid; break-inside: avoid; }
  .fotos img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; border: 1px solid #d0d6de; }
  .fotos figcaption { font-size: 8pt; color: #5f6b78; text-align: center; margin-top: 2px; }
  .fuentes { font-size: 8.5pt; padding-left: 18px; margin: 4px 0; }
  .fuentes a { color: #0563c1; word-break: break-all; }
  .conclusiones { page-break-before: always; break-before: page; }
  .pie-doc { margin-top: 30px; border-top: 1px solid #d0d6de; padding-top: 6px; font-size: 8pt; color: #5f6b78; display: flex; justify-content: space-between; }
  @media print { .hoja { padding: 0; max-width: none; } .pie-doc { display: none; } }
  `;

  IP.informeHtml = function (M, imgs) {
    const e = U.esc;
    const filas = (rows) => rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("");
    const datos = (rows) => `<table class="datos"><tbody>${filas(rows)}</tbody></table>`;
    const cab = (c, rows) => `<table><thead><tr>${c.map((x) => `<th>${e(x)}</th>`).join("")}</tr></thead><tbody>${filas(rows)}</tbody></table>`;
    const nRes = M.criterios.length ? 3 : 2, nPre = nRes + 1, nCon = nRes + 2;
    let h = `<div class="hoja">`;
    h += `<section class="portada">
      <img class="logo" src="${imgs.portada}" alt="Gobierno de Colombia · SAE">
      <h1>${e(M.titulo)}</h1>
      ${M.solicitante ? `<p class="sol">${e(M.solicitante)}</p>` : ""}
      ${M.tipo || M.radicado ? `<p class="gris">${e([M.tipo, M.radicado ? "Radicado " + M.radicado : ""].filter(Boolean).join(" · "))}</p>` : ""}
      ${M.logo ? `<img class="logo-sol" src="${M.logo}" alt="Logo del solicitante">` : ""}
      <p class="gris" style="margin-top:40px">${e(M.fecha)}</p><p class="gris"><i>Documento de uso interno</i></p>
      <img class="barra" src="${imgs.barra}" alt="">
    </section>`;
    h += `<h2>1. Objeto y alcance</h2>${M.objeto.map((p) => `<p>${e(p)}</p>`).join("")}<p>${e(M.metodo)}</p>
      <div class="cifras">${M.cifras.map(([n, t]) => `<div class="cifra"><b>${e(n)}</b><span>${e(t)}</span></div>`).join("")}</div>`;
    if (M.criterios.length) h += `<h2>2. Criterios de búsqueda</h2><p>Se aplicaron los siguientes filtros sobre la base de inmuebles:</p><ul>${M.criterios.map((c) => `<li>${e(c)}</li>`).join("")}</ul>`;
    h += `<h2>${nRes}. Resumen de los folios</h2>${cab(M.resumenCab, M.resumen)}`;
    if (M.mapaGeneral) h += `<img class="mapa-gen" src="${M.mapaGeneral}" alt="Mapa general"><p class="leyenda">Ubicación general de los folios (el número corresponde al de la tabla).${M.mapaNota ? " " + e(M.mapaNota) : ""}</p>`;
    else if (M.mapaNota) h += `<p class="leyenda">${e(M.mapaNota)}</p>`;
    h += `<h2>${nPre}. Descripción de los predios</h2>`;
    for (const p of M.predios) {
      const pref = `${nPre}.${p.n}`;
      const pieHero = (p.fotos.find((f) => f.url === p.hero) || {}).pie || "";
      h += `<section class="predio${p.n === 1 ? " primero" : ""}">
        <p class="predio-tit">${pref}. Folio ${e(p.fmi)}</p>
        <p class="predio-sub"><b>${e(p.lugar)}</b> <span class="gris">${p.subtitulo ? "· " + e(p.subtitulo) : ""}</span>${p.sello ? `<span class="sello">FMI vs. cédula: ${e(p.sello)}</span>` : ""}</p>
        ${p.hero ? `<img class="hero" src="${p.hero}" alt=""><p class="leyenda">${e(pieHero)}</p>` : ""}
        ${p.secciones.filter(([, t]) => t).map(([t, x]) => `<h3>${e(t)}</h3><p>${e(x)}</p>`).join("")}
        ${p.concepto ? `<h3>Concepto</h3><div class="concepto">${e(p.concepto)}</div>` : ""}
        <h3>Ficha del predio</h3>${datos(p.datos)}
        ${p.vur ? `<h3>Consulta del VUR</h3>${datos(p.vur)}` : ""}
        ${p.contraste.length ? `<h3>Contraste base / VUR / catastro</h3>${cab(["Campo", "Base", "VUR", "Catastro", "Resultado"], p.contraste)}` : ""}
        ${p.fotos.length ? `<h3>Registro fotográfico</h3><div class="fotos">${p.fotos.map((f, i) => `<figure><img src="${f.url}" alt=""><figcaption><b>Foto ${pref}.${i + 1}.</b> ${e(f.pie)}</figcaption></figure>`).join("")}</div>` : ""}
        ${p.fuentes.length ? `<h3>Fuentes</h3><ul class="fuentes">${p.fuentes.map((f) => `<li>${f.url ? `<a href="${e(f.url)}" target="_blank" rel="noopener">${e(f.texto)}</a>` : e(f.texto)}</li>`).join("")}</ul>` : ""}
      </section>`;
    }
    h += `<section class="conclusiones"><h2>${nCon}. Conclusiones y recomendaciones</h2>${M.conclusiones.map((c) => `<p>${e(c)}</p>`).join("")}</section>`;
    h += `<div class="pie-doc"><span>Sociedad de Activos Especiales · Uso interno</span><span>${e(M.fecha)}</span></div></div>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(M.titulo)}${M.solicitante ? " – " + e(M.solicitante) : ""}</title><style>${CSS}</style></head><body>${h}</body></html>`;
  };

  IP.imagenesInforme = async () => ({ portada: await IP.imagenes.plantilla("logo-portada.png"), barra: await IP.imagenes.plantilla("barra.png") });

  // PDF: se imprime el HTML desde un marco oculto (el usuario elige "Guardar como PDF")
  IP.imprimirInforme = function (html) {
    return new Promise((resolve) => {
      const f = document.createElement("iframe");
      f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(f);
      f.onload = () => {
        const imgs = [...f.contentDocument.images];
        Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => {
          setTimeout(() => {
            f.contentWindow.focus();
            f.contentWindow.print();
            setTimeout(() => { f.remove(); resolve(); }, 1500);
          }, 200);
        });
      };
      f.srcdoc = html;
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
