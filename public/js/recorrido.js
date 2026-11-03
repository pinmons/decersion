/* Script clásico (sin módulos) para que la página funcione también abierta como archivo. */
(function () {
  "use strict";
  const { s, lienzo } = window.SAT;
  /* Diagrama del contrato: el orden en que se revisa un registro y dónde puede terminar.
     Con una salida del sistema, ilumina el camino que siguió ese registro. */

  const ANCHO = 380, ALTO = 560;
  const COL = { x: 20, w: 200 };           // columna principal
  const DER = { x: 262, w: 108 };          // salidas a la derecha
  const H = 42;
  const NODOS = [
    { id: "entrada", y: 8, t: "Registro del estudiante", sub: "12 campos" },
    { id: "formato", y: 76, t: "1. Formato", sub: "tipo, rango y valores" },
    { id: "poblacion", y: 144, t: "2. Población", sub: "pregrado, activo, sem. 2–4" },
    { id: "faltantes", y: 212, t: "3. Datos completos", sub: "ningún obligatorio vacío" },
    { id: "coherencia", y: 280, t: "4. Coherencia", sub: "contradicciones C1 a C4" },
    { id: "puntaje", y: 348, t: "Puntaje de 0 a 100", sub: "reglas o modelo aprendido" },
    { id: "r34", y: 416, t: "Regla R3.4", sub: "promedio < 3,0 y asist. < 70" },
  ];
  const NIVELES = [
    { id: "bajo", x: 20, t: "Bajo", sub: "seguimiento" },
    { id: "medio", x: 90, t: "Medio", sub: "tutoría" },
    { id: "alto", x: 160, t: "Alto", sub: "remisión" },
  ];
  const Y_NIVEL = 500, W_NIVEL = 64;
  const PARADAS = { fuera_de_poblacion: "poblacion", campo_faltante: "faltantes", datos_contradictorios: "coherencia" };

  function caja(id, x, y, w, h, t, sub, extra = "") {
    return s("g", { class: `nodo ${extra}`, "data-id": id }, [
      s("rect", { x, y, width: w, height: h, rx: 7 }),
      s("text", { x: x + w / 2, y: y + (sub ? 17 : h / 2 + 4), "text-anchor": "middle", texto: t }),
      sub ? s("text", { x: x + w / 2, y: y + 32, "text-anchor": "middle", class: "sub", texto: sub }) : null,
    ]);
  }
  function flecha(id, d, clase = "") {
    return s("path", { d, class: `arista ${clase}`, "data-id": id, "marker-end": "url(#punta-recorrido)" });
  }

  function crearRecorrido(contenedor) {
    const svg = lienzo(ANCHO, ALTO, "Diagrama del contrato: el registro pasa por cuatro revisiones en orden; si falla el formato termina en error, si falla población, datos completos o coherencia se remite a una persona; si pasa todo recibe un puntaje, se revisa la regla R3.4 y se asigna un nivel.");
    svg.appendChild(s("defs", {}, [s("marker", { id: "punta-recorrido", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" },
      [s("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--tenue)" })])]));
    const cx = COL.x + COL.w / 2;
    // flechas verticales entre revisiones
    for (let i = 0; i < NODOS.length - 1; i++) {
      const a = NODOS[i], b = NODOS[i + 1];
      svg.appendChild(flecha(`${a.id}-${b.id}`, `M${cx},${a.y + H} L${cx},${b.y - 2}`));
    }
    svg.appendChild(s("text", { x: cx + 6, y: 70, class: "etiqueta-arista", texto: "pasa" }));
    // salida de error
    const yErr = NODOS[1].y;
    svg.appendChild(flecha("formato-error", `M${COL.x + COL.w},${yErr + H / 2} L${DER.x - 2},${yErr + H / 2}`, "salida salida-error"));
    svg.appendChild(s("text", { x: COL.x + COL.w + 8, y: yErr + H / 2 - 6, class: "etiqueta-arista", texto: "no" }));
    svg.appendChild(caja("error", DER.x, yErr, DER.w, H, "Error", "se corrige el dato"));
    // salida humana (población, faltantes, coherencia)
    const yH0 = NODOS[2].y, yH1 = NODOS[4].y + H;
    svg.appendChild(caja("humano", DER.x, yH0, DER.w, yH1 - yH0, "Revisión", "humana"));
    for (const id of ["poblacion", "faltantes", "coherencia"]) {
      const n = NODOS.find((x) => x.id === id);
      svg.appendChild(flecha(`${id}-humano`, `M${COL.x + COL.w},${n.y + H / 2} L${DER.x - 2},${n.y + H / 2}`, "salida salida-humano"));
      svg.appendChild(s("text", { x: COL.x + COL.w + 8, y: n.y + H / 2 - 6, class: "etiqueta-arista", texto: "no" }));
    }
    for (const n of NODOS) svg.appendChild(caja(n.id, COL.x, n.y, COL.w, H, n.t, n.sub));
    // del R3.4 a cada nivel
    const r34 = NODOS[NODOS.length - 1];
    for (const n of NIVELES) {
      const xm = n.x + W_NIVEL / 2;
      svg.appendChild(flecha(`r34-${n.id}`, `M${cx},${r34.y + H} C${cx},${r34.y + H + 22} ${xm},${Y_NIVEL - 24} ${xm},${Y_NIVEL - 2}`));
      svg.appendChild(caja(n.id, n.x, Y_NIVEL, W_NIVEL, H, n.t, n.sub));
    }
    svg.appendChild(s("text", { x: 240, y: Y_NIVEL + 16, class: "etiqueta-arista", texto: "si R3.4 se cumple," }));
    svg.appendChild(s("text", { x: 240, y: Y_NIVEL + 30, class: "etiqueta-arista", texto: "el nivel es alto" }));
    contenedor.replaceChildren(svg);
    return svg;
  }

  /* Marca el camino de una salida del sistema (o lo limpia si `salida` es null). */
  function marcarRecorrido(svg, salida, extra = {}) {
    svg.querySelectorAll(".nodo").forEach((n) => n.setAttribute("class", "nodo"));
    svg.querySelectorAll(".arista").forEach((a) => a.classList.remove("activa"));
    const sub = svg.querySelector('.nodo[data-id="puntaje"] .sub');
    sub.textContent = "reglas o modelo aprendido";
    svg.querySelector('.nodo[data-id="r34"] .sub').textContent = "promedio < 3,0 y asist. < 70";
    if (!salida) return;
    const nodo = (id, ...clases) => svg.querySelector(`.nodo[data-id="${id}"]`)?.classList.add(...clases);
    const arista = (id) => svg.querySelector(`.arista[data-id="${id}"]`)?.classList.add("activa");
    const orden = ["entrada", "formato", "poblacion", "faltantes", "coherencia", "puntaje", "r34"];
    let hasta = orden.length;
    if (salida.decision === "error") hasta = 1;
    else if (salida.decision === "abstener") hasta = orden.indexOf(PARADAS[salida.motivo] || "coherencia");
    for (let i = 0; i < Math.min(hasta, orden.length); i++) {
      nodo(orden[i], "pasa");
      if (i > 0) arista(`${orden[i - 1]}-${orden[i]}`);
    }
    if (salida.decision === "error") {
      nodo("formato", "para", "para-error"); arista("entrada-formato"); arista("formato-error"); nodo("error", "para", "para-error");
    } else if (salida.decision === "abstener") {
      const id = PARADAS[salida.motivo] || "coherencia";
      arista(`${orden[hasta - 1]}-${id}`); nodo(id, "para", "para-humano"); arista(`${id}-humano`); nodo("humano", "para", "para-humano");
    } else if (salida.decision === "resultado") {
      sub.textContent = `${salida.puntaje} puntos`;
      const r34 = svg.querySelector('.nodo[data-id="r34"] .sub');
      if (extra.r34) { r34.textContent = "se cumple: fuerza alto"; nodo("r34", "nivel-alto"); }
      else r34.textContent = "no se cumple";
      arista(`r34-${salida.nivel}`); nodo(salida.nivel, `nivel-${salida.nivel}`);
    }
  }

  window.SAT = Object.assign(window.SAT || {}, { crearRecorrido, marcarRecorrido });
})();
