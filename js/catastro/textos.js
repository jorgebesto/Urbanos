/* Textos de los resultados del contraste */
(function (g) {
  const IP = (g.IP = g.IP || {});
  IP.textos = {
    VEREDICTO: { ok: "Sin diferencias", revisar: "Revisar", diferente: "Con diferencias", sin_dato: "Sin contraste" },
    ESTADO: { ok: "Coincide", revisar: "Revisar", diferente: "Diferente", sin_dato: "—" },
  };
})(typeof window !== "undefined" ? window : globalThis);
