/* Manejo de imágenes en el navegador: reducir fotos, recortar al tamaño del marco y convertir para los documentos. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const I = (IP.imagenes = {});

  I.cargar = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = src;
  });

  I.leerArchivo = (archivo) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(archivo);
  });

  // Reduce una foto a 'max' píxeles en el lado mayor. Los PNG (logos) conservan la transparencia.
  I.reducir = async function (archivoODataUrl, max = 1600, calidad = 0.85) {
    const src = typeof archivoODataUrl === "string" ? archivoODataUrl : await I.leerArchivo(archivoODataUrl);
    const img = await I.cargar(src);
    const png = /^data:image\/png/.test(src);
    const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
    const ctx = c.getContext("2d");
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { url: png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", calidad), w: c.width, h: c.height };
  };

  I.medidas = async (src) => { const img = await I.cargar(src); return { w: img.naturalWidth, h: img.naturalHeight }; };

  // Recorta al centro para llenar un marco de proporción ancho/alto (como "rellenar" en PowerPoint)
  I.recortar = async function (src, proporcion, max = 1600) {
    const img = await I.cargar(src);
    const W = img.naturalWidth, H = img.naturalHeight;
    let sw = W, sh = H;
    if (W / H > proporcion) sw = H * proporcion; else sh = W / proporcion;
    const f = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * f); c.height = Math.round(sh * f);
    c.getContext("2d").drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  };

  // Ubica una imagen dentro de un marco sin recortarla (como "ajustar")
  I.ajustar = function (w, h, marco) {
    const f = Math.min(marco.w / w, marco.h / h);
    const ww = w * f, hh = h * f;
    return { x: marco.x + (marco.w - ww) / 2, y: marco.y + (marco.h - hh) / 2, w: ww, h: hh };
  };

  I.bytes = function (dataUrl) {
    const b64 = dataUrl.split(",")[1] || "";
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  I.tipo = (dataUrl) => (/^data:image\/png/.test(dataUrl) ? "png" : /^data:image\/gif/.test(dataUrl) ? "gif" : "jpg");

  // Imagen de la carpeta plantilla/ como dataURL
  const cache = {};
  I.plantilla = async function (nombre) {
    if (cache[nombre]) return cache[nombre];
    const r = await fetch("plantilla/" + nombre);
    if (!r.ok) throw new Error("No se encontró plantilla/" + nombre);
    const blob = await r.blob();
    cache[nombre] = await I.leerArchivo(blob);
    return cache[nombre];
  };
})(typeof window !== "undefined" ? window : globalThis);
