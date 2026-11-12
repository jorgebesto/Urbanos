/* Imagen satelital del predio con su polígono dibujado (para la diapositiva de georreferenciación).
   Usa los mosaicos de Esri World Imagery, que permiten dibujarlos en un canvas desde otra página. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const M = (IP.mapaImagen = {});
  const TILE = 256;
  M.servidor = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  M.atribucion = "Imagen: Esri, Maxar, Earthstar Geographics";

  const px = (lon, lat, z) => {
    const s = TILE * 2 ** z;
    const x = ((lon + 180) / 360) * s;
    const sin = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s;
    return [x, y];
  };

  function cargar(url, ms = 15000) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const t = setTimeout(() => resolve(null), ms);
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = url;
    });
  }

  M.base_general = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";

  /* Mapa general con varios predios numerados. puntos: [{lat, lon, etiqueta}] */
  M.generarGeneral = async function (puntos, opciones = {}) {
    const W = opciones.ancho || 1400, H = opciones.alto || 900;
    const pts = puntos.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (!pts.length) throw new Error("Ningún folio tiene coordenadas todavía.");
    let z = pts.length === 1 ? 10 : 14;
    for (; z > 4; z--) {
      const xy = pts.map((p) => px(p.lon, p.lat, z));
      const w = Math.max(...xy.map((p) => p[0])) - Math.min(...xy.map((p) => p[0]));
      const h = Math.max(...xy.map((p) => p[1])) - Math.min(...xy.map((p) => p[1]));
      if (w <= W * 0.7 && h <= H * 0.7) break;
    }
    const xy = pts.map((p) => px(p.lon, p.lat, z));
    const cx = (Math.max(...xy.map((p) => p[0])) + Math.min(...xy.map((p) => p[0]))) / 2;
    const cy = (Math.max(...xy.map((p) => p[1])) + Math.min(...xy.map((p) => p[1]))) / 2;
    const x0 = cx - W / 2, y0 = cy - H / 2;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e9eef3"; ctx.fillRect(0, 0, W, H);
    const n = 2 ** z, tareas = [];
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + W) / TILE); tx++)
      for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + H) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        tareas.push(cargar(M.base_general.replace("{z}", z).replace("{x}", ((tx % n) + n) % n).replace("{y}", ty)).then((img) => ({ img, tx, ty })));
      }
    const tiles = (await Promise.all(tareas)).filter((t) => t.img);
    if (!tiles.length) throw new Error("No se pudo descargar el mapa base.");
    for (const t of tiles) ctx.drawImage(t.img, t.tx * TILE - x0, t.ty * TILE - y0, TILE, TILE);
    const R = Math.round(W / 70);
    pts.forEach((p, i) => {
      const [a, b] = xy[i];
      const x = a - x0, y = b - y0;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = "#002060"; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff"; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.round(R * 1.1)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(p.etiqueta ?? i + 1), x, y + 1);
    });
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const at = "Mapa base: Esri, HERE, Garmin, USGS";
    ctx.font = `${Math.round(W / 85)}px sans-serif`;
    const tw = ctx.measureText(at).width;
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(W - tw - 16, H - W / 85 - 12, tw + 16, W / 85 + 12);
    ctx.fillStyle = "#222"; ctx.fillText(at, W - tw - 8, H - 9);
    return canvas.toDataURL("image/jpeg", 0.88);
  };

  M.enlaceMaps =(lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;

  /* anillos: [[ [lon,lat], ... ], ...] en grados. Devuelve dataURL JPEG o lanza error. */
  M.generar = async function ({ anillos, lat, lon }, opciones = {}) {
    const W = opciones.ancho || 1200, H = opciones.alto || 1200;
    const rings = (anillos || []).filter((r) => r && r.length > 2);
    const puntos = rings.flat();
    if (!puntos.length && (lat == null || lon == null)) throw new Error("No hay polígono ni coordenadas del predio.");
    if (!puntos.length) puntos.push([lon, lat]);
    // Zoom: el polígono ocupa como máximo ~45 % del ancho, con tope de zoom 19
    let z = 19;
    for (; z > 3; z--) {
      const xy = puntos.map(([x, y]) => px(x, y, z));
      const w = Math.max(...xy.map((p) => p[0])) - Math.min(...xy.map((p) => p[0]));
      const h = Math.max(...xy.map((p) => p[1])) - Math.min(...xy.map((p) => p[1]));
      if (w <= W * 0.45 && h <= H * 0.45) break;
    }
    if (!rings.length) z = Math.min(z, 17);
    const xy = puntos.map(([x, y]) => px(x, y, z));
    const cx = (Math.max(...xy.map((p) => p[0])) + Math.min(...xy.map((p) => p[0]))) / 2;
    const cy = (Math.max(...xy.map((p) => p[1])) + Math.min(...xy.map((p) => p[1]))) / 2;
    const x0 = cx - W / 2, y0 = cy - H / 2;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#33404d"; ctx.fillRect(0, 0, W, H);

    const t0x = Math.floor(x0 / TILE), t1x = Math.floor((x0 + W) / TILE);
    const t0y = Math.floor(y0 / TILE), t1y = Math.floor((y0 + H) / TILE);
    const n = 2 ** z;
    const tareas = [];
    for (let tx = t0x; tx <= t1x; tx++) for (let ty = t0y; ty <= t1y; ty++) {
      if (ty < 0 || ty >= n) continue;
      const url = M.servidor.replace("{z}", z).replace("{x}", ((tx % n) + n) % n).replace("{y}", ty);
      tareas.push(cargar(url).then((img) => ({ img, tx, ty })));
    }
    const tiles = await Promise.all(tareas);
    const buenos = tiles.filter((t) => t.img);
    if (!buenos.length) throw new Error("No se pudo descargar la imagen satelital (revise la conexión).");
    for (const t of buenos) ctx.drawImage(t.img, t.tx * TILE - x0, t.ty * TILE - y0, TILE, TILE);

    // Polígono
    ctx.lineJoin = "round";
    if (rings.length) {
      ctx.beginPath();
      for (const r of rings) r.forEach(([x, y], i) => {
        const [a, b] = px(x, y, z);
        i ? ctx.lineTo(a - x0, b - y0) : ctx.moveTo(a - x0, b - y0);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 200, 255, 0.30)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = Math.max(3, W / 300);
      ctx.stroke();
    } else {
      const [a, b] = px(lon, lat, z);
      ctx.fillStyle = "#e53935"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(a - x0, b - y0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Atribución
    ctx.font = `${Math.round(W / 70)}px sans-serif`;
    const tw = ctx.measureText(M.atribucion).width;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(W - tw - 16, H - W / 70 - 12, tw + 16, W / 70 + 12);
    ctx.fillStyle = "#222"; ctx.fillText(M.atribucion, W - tw - 8, H - 9);
    try { return canvas.toDataURL("image/jpeg", 0.88); }
    catch (e) { throw new Error("El navegador no dejó exportar la imagen satelital. Súbala a mano."); }
  };
})(typeof window !== "undefined" ? window : globalThis);
