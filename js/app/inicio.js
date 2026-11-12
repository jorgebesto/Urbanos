/* Arranque de la página del portafolio */
(async function () {
  const PF = window.PF;
  await PF.iniciarNucleo();
  PF.alCambiarPort.forEach((fn) => fn());
  PF.vista("buscar");
  window.__portafolio = PF.E; // para revisar desde la consola
})();
