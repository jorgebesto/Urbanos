/* Presentación de portafolio con la plantilla SAE.
   Primero se arma un modelo de diapositivas (posiciones en pulgadas, 13,333 × 7,5) y luego se dibuja:
   - en PowerPoint con PptxGenJS, para descargar;
   - en HTML, para la vista previa en la página. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const I = () => IP.imagenes;

  IP.CAMPOS_FICHA = [
    ["direccion", "DIRECCIÓN"], ["clase", "CLASE"], ["tipo_activo", "TIPO ACTIVO"], ["clasificacion", "CLASIFICACIÓN ACTIVO"],
    ["estado_legal", "ESTADO LEGAL"], ["ocupacion", "ESTADO DE OCUPACIÓN"], ["area_terreno", "ÁREA TERRENO"],
    ["area_construida", "ÁREA CONSTRUÍDA"], ["activo_social", "ACTIVO SOCIAL"], ["avaluo_catastral", "AVALÚO CATASTRAL"],
    ["avaluo_comercial", "AVALÚO COMERCIAL"],
  ];
  IP.CAMPOS_GEO = [["departamento", "DEPARTAMENTO"], ["municipio", "CIUDAD/MUNICIPIO"], ["direccion", "DIRECCIÓN"], ["barrio", "BARRIO"], ["enlace", "ENLACE"]];

  /* ---------------- Modelo ---------------- */
  IP.modeloDiapositivas = async function (port) {
    const P = IP.PORTAFOLIO.presentacion;
    const img = {
      portada: await I().plantilla("logo-portada.png"), foto: await I().plantilla("foto-portada.jpg"), barra: await I().plantilla("barra.png"),
      sae: await I().plantilla("logo-sae.png"), cierre: await I().plantilla("logo-cierre.png"),
    };
    const F = P.fuente;
    const slides = [];
    const barra = () => ({ t: "img", data: img.barra, x: 0, y: 7.3, w: 13.333, h: 0.2 });
    const logoSae = (x, y) => ({ t: "img", data: img.sae, x, y, w: 1.02, h: 0.51 });
    const titulo = (texto, x, y) => ({ t: "txt", text: texto, x, y, w: 5.1, h: 0.7, o: { fontFace: P.fuente_titulo, fontSize: 36, bold: true, color: P.azul, align: "center", valign: "middle" } });
    async function foto(url, b) {
      const els = [{ t: "rect", x: b.x - 0.05, y: b.y - 0.05, w: b.w + 0.1, h: b.h + 0.1, o: { fill: "FFFFFF", line: "D9D9D9", sombra: true } }];
      if (!url) els.push({ t: "txt", text: "Sin imagen", x: b.x, y: b.y, w: b.w, h: b.h, o: { fontFace: F, fontSize: 14, color: "7F7F7F", align: "center", valign: "middle", fill: "F2F2F2" } });
      else els.push({ t: "img", data: await I().recortar(url, b.w / b.h), ...b });
      return els;
    }
    const pie = (color) => ({ t: "txt", text: P.codigo_formato, x: 10.49, y: 6.98, w: 2.55, h: 0.29, o: { fontFace: "Calibri", fontSize: 8, color, align: "right" } });
    const et = (t, extra = {}) => ({ text: t, o: { bold: true, color: "FFFFFF", fill: P.azul, align: "center", ...extra } });

    // Portada
    slides.push({ fondo: "FFFFFF", els: [{ t: "img", data: img.portada, x: 3.09, y: 2.49, w: 7.15, h: 2.52 }, pie("595959")] });

    // Solicitante
    const s2 = [{ t: "img", data: await I().recortar(img.foto, 6.667 / 7.5, 1400), x: 6.667, y: 0, w: 6.667, h: 7.5 }, barra(), logoSae(0.85, 0.62),
      { t: "txt", runs: [
        { text: "PORTAFOLIO", o: { fontFace: "Montserrat ExtraBold", fontSize: 28, bold: true, color: P.azul_boton, breakLine: true } },
        { text: port.solicitante || "", o: { fontFace: F, fontSize: 20, bold: true, color: P.azul_boton } },
      ], x: 0.79, y: 1.25, w: 4.89, h: 1.92, o: { align: "center", valign: "middle" } }];
    if (port.logo) {
      const m = await I().medidas(port.logo);
      s2.push({ t: "img", data: port.logo, ...I().ajustar(m.w, m.h, { x: 1.88, y: 3.26, w: 2.75, h: 2.03 }) });
    }
    s2.push({ t: "txt", text: port.tipo || P.tipo_por_defecto, x: 0.79, y: 5.73, w: 4.89, h: 0.67,
      o: { forma: "roundRect", rectRadius: 0.12, fill: P.azul_boton, color: "FFFFFF", bold: true, fontFace: F, fontSize: 20, align: "center", valign: "middle", sombra: true } });
    slides.push({ fondo: "FFFFFF", els: s2 });

    // Folios
    for (const it of port.items) {
      const c = it.campos || {}, fmi = it.fmi_texto || it.fmi, im = it.imagenes || {};
      // Georreferenciación
      const geo = [[{ text: "GEOREFERENCIACIÓN", o: { colspan: 2, bold: true, color: "FFFFFF", fill: P.azul, align: "center" } }]];
      for (const [k, e] of IP.CAMPOS_GEO) {
        const v = U.limpiar(c[k]) || "-";
        geo.push([et(e), k === "enlace" && /^https?:/.test(v)
          ? { text: /google\.[a-z.]+\/maps/.test(v) && v.length > 45 ? "Ver en Google Maps" : v, o: { hyperlink: v, color: "0563C1", underline: true, align: "center" } }
          : { text: v, o: { align: "center" } }]);
      }
      slides.push({ fondo: "FFFFFF", els: [...await foto(it.mapa, { x: 0.31, y: 0.26, w: 6.84, h: 6.82 }), logoSae(11.7, 0.54), titulo(fmi, 7.62, 1.95),
        { t: "tabla", filas: geo, x: 7.47, y: 2.92, w: 5.47, colW: [1.75, 3.72], o: { fontFace: F, fontSize: 10, color: "000000" } }, barra()] });
      // Ficha
      const ficha = IP.CAMPOS_FICHA.map(([k, e]) => [et(e, { fontSize: 9 }), { text: U.limpiar(c[k]) || "-", o: { align: "left" } }]);
      slides.push({ fondo: "FFFFFF", els: [logoSae(0.85, 0.62), titulo(fmi, 0.92, 1.73),
        { t: "tabla", filas: ficha, x: 0.41, y: 2.66, w: 5.9, colW: [2.05, 3.85], o: { fontFace: F, fontSize: 9.5, color: "000000" } },
        ...await foto(im.fachada ? im.fachada.url : "", { x: 6.67, y: 1.13, w: 6.43, h: 5.5 }), barra()] });
      // Interiores y adicionales, de a dos
      const fotos = [im.interior1, im.interior2, ...(im.extra || [])].filter(Boolean);
      for (let i = 0; i < fotos.length; i += 2) {
        const par = fotos.slice(i, i + 2);
        const els = [titulo(fmi, 4.12, 0.35), logoSae(11.7, 0.54)];
        if (par.length === 2) els.push(...await foto(par[0].url, { x: 0.95, y: 1.45, w: 5.43, h: 5.42 }), ...await foto(par[1].url, { x: 6.97, y: 1.45, w: 5.43, h: 5.42 }));
        else els.push(...await foto(par[0].url, { x: 3.95, y: 1.45, w: 5.43, h: 5.42 }));
        els.push(barra());
        slides.push({ fondo: "FFFFFF", els });
      }
    }
    // Cierre
    slides.push({ fondo: P.azul_cierre, els: [{ t: "img", data: img.cierre, x: 3.05, y: 2.57, w: 7.24, h: 2.2 }, pie("FFFFFF")] });
    return slides;
  };

  /* ---------------- PowerPoint ---------------- */
  IP.generarPresentacion = async function (port, slides) {
    if (!g.PptxGenJS) throw new Error("No se cargó la librería de presentaciones (js/lib/pptxgen.bundle.js).");
    slides = slides || await IP.modeloDiapositivas(port);
    const pptx = new g.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "SAE – Portafolio";
    pptx.title = "Portafolio " + (port.solicitante || "");
    const sombra = { type: "outer", blur: 5, offset: 2, angle: 45, opacity: 0.35, color: "000000" };
    const opts = (o = {}) => {
      const r = { ...o };
      if (o.fill) r.fill = { color: o.fill };
      if (o.sombra) r.shadow = sombra;
      if (o.hyperlink) r.hyperlink = { url: o.hyperlink };
      if (o.underline) r.underline = { style: "sng" };
      delete r.sombra; delete r.forma;
      return r;
    };
    for (const sd of slides) {
      const s = pptx.addSlide();
      s.background = { color: sd.fondo || "FFFFFF" };
      for (const e of sd.els) {
        if (e.t === "img") s.addImage({ data: e.data, x: e.x, y: e.y, w: e.w, h: e.h });
        else if (e.t === "rect") s.addShape(pptx.ShapeType.rect, { x: e.x, y: e.y, w: e.w, h: e.h, fill: { color: e.o.fill }, line: { color: e.o.line, width: 0.75 }, shadow: e.o.sombra ? sombra : undefined });
        else if (e.t === "txt") {
          const o = { ...opts(e.o), x: e.x, y: e.y, w: e.w, h: e.h, margin: e.o.forma ? undefined : 0 };
          if (e.o.forma) { o.shape = pptx.ShapeType[e.o.forma]; o.line = { color: e.o.fill }; }
          s.addText(e.runs ? e.runs.map((r) => ({ text: r.text, options: opts(r.o) })) : e.text, o);
        } else if (e.t === "tabla") {
          s.addTable(e.filas.map((f) => f.map((c) => ({ text: c.text, options: opts(c.o) }))),
            { x: e.x, y: e.y, w: e.w, colW: e.colW, ...opts(e.o), valign: "middle", border: { type: "solid", pt: 0.75, color: "000000" }, margin: 0.04, autoPage: false });
        }
      }
    }
    return await pptx.write({ outputType: "blob" });
  };

  /* ---------------- HTML (vista previa) ---------------- */
  IP.diapositivasHtml = function (slides) {
    const esc = U.esc;
    const PX = 72; // 1 pulgada = 72 px; 1 pt = 1 px
    const caja = (e) => `left:${e.x * PX}px;top:${e.y * PX}px;width:${e.w * PX}px;${e.h ? `height:${e.h * PX}px;` : ""}`;
    const estiloTexto = (o = {}) => [
      o.fontFace ? `font-family:'${o.fontFace.replace(/ (ExtraBold|SemiBold)$/, "")}',Montserrat,sans-serif` : "",
      o.fontFace && /ExtraBold/.test(o.fontFace) ? "font-weight:800" : o.bold ? "font-weight:700" : "",
      o.fontSize ? `font-size:${o.fontSize}px` : "", o.color ? `color:#${o.color}` : "",
      o.align ? `text-align:${o.align}` : "", o.fill ? `background:#${o.fill}` : "",
    ].filter(Boolean).join(";");
    const just = { top: "flex-start", middle: "center", bottom: "flex-end" };
    return slides.map((sd, n) => {
      const els = sd.els.map((e) => {
        if (e.t === "img") return `<img src="${e.data}" style="position:absolute;${caja(e)}object-fit:fill" alt="">`;
        if (e.t === "rect") return `<div style="position:absolute;${caja(e)}background:#${e.o.fill};border:1px solid #${e.o.line};${e.o.sombra ? "box-shadow:2px 2px 6px rgba(0,0,0,.35);" : ""}"></div>`;
        if (e.t === "txt") {
          const o = e.o || {};
          const cuerpo = e.runs ? e.runs.map((r) => `<span style="${estiloTexto(r.o)}">${esc(r.text)}</span>${r.o.breakLine ? "<br>" : ""}`).join("") : esc(e.text);
          return `<div style="position:absolute;${caja(e)}display:flex;flex-direction:column;justify-content:${just[o.valign] || "flex-start"};${estiloTexto(o)};${o.forma ? "border-radius:9px;" : ""}${o.sombra ? "box-shadow:0 2px 5px rgba(0,0,0,.3);" : ""}line-height:1.15"><div>${cuerpo}</div></div>`;
        }
        if (e.t === "tabla") {
          const tot = e.colW.reduce((a, b) => a + b, 0);
          const filas = e.filas.map((f) => `<tr>${f.map((c, i) => {
            const o = c.o || {};
            const t = o.hyperlink ? `<a href="${esc(o.hyperlink)}" target="_blank" rel="noopener" style="color:#0563C1">${esc(c.text)}</a>` : esc(c.text);
            return `<td${o.colspan ? ` colspan="${o.colspan}"` : ""} style="width:${((e.colW[i] || 0) / tot) * 100}%;${estiloTexto({ ...e.o, ...o })}">${t}</td>`;
          }).join("")}</tr>`).join("");
          return `<table class="pv-tabla" style="position:absolute;${caja(e)}${estiloTexto(e.o)}">${filas}</table>`;
        }
        return "";
      }).join("");
      return `<div class="pv-marco"><div class="pv-slide" style="background:#${sd.fondo || "FFFFFF"}">${els}</div><span class="pv-num">${n + 1}</span></div>`;
    }).join("");
  };
})(typeof window !== "undefined" ? window : globalThis);
