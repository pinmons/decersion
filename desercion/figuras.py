"""Gráficas PNG del reporte. Todas dicen en el título que los datos son sintéticos."""
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

from .graficas import plt, guardar, SERIES, TINTA, TINTA_2, TENUE, CRITICO, DIVERGENTE, EJE
from .variables import NOMBRES_LEGIBLES

AVISO = " (datos sintéticos)"
MAPA_DIVERGENTE = LinearSegmentedColormap.from_list("divergente", DIVERGENTE)


def _leg(n):
    return NOMBRES_LEGIBLES.get(n, n)


def distribuciones(registros, y, ruta):
    y = np.asarray(y)
    fig, ejes = plt.subplots(2, 4, figsize=(14, 6.4))
    num = [("promedio_acumulado", "Promedio acumulado", np.linspace(0.5, 5, 30)),
           ("porcentaje_asistencia", "Asistencia (%)", np.linspace(30, 100, 30)),
           ("tasa_reprobacion", "Tasa de reprobación", np.linspace(0, 1, 21)),
           ("creditos_inscritos", "Créditos inscritos", np.arange(3.5, 26.5, 1))]
    for ax, (campo, titulo, bins) in zip(ejes[0], num):
        if campo == "tasa_reprobacion":
            v = np.array([r["materias_reprobadas"] / r["materias_cursadas_periodo_anterior"] for r in registros])
        else:
            v = np.array([r[campo] for r in registros], float)
        ax.hist(v[y == 0], bins=bins, density=True, histtype="step", lw=2, color=SERIES[0], label="no desertó")
        ax.hist(v[y == 1], bins=bins, density=True, histtype="step", lw=2, color=SERIES[1], label="desertó")
        ax.set_title(titulo); ax.set_yticks([])
    ejes[0][0].legend(loc="upper left")
    cat = [("estrato", "Deserción por estrato", lambda r: str(r["estrato"])),
           ("semestre", "Deserción por semestre", lambda r: str(r["semestre"])),
           ("trabaja", "Deserción según si trabaja", lambda r: "sí" if r["trabaja"] else "no"),
           ("deuda", "Deserción según deuda", lambda r: {True: "sí", False: "no", None: "no inf."}[r.get("deuda_matricula")])]
    for ax, (_, titulo, f) in zip(ejes[1], cat):
        etiquetas = np.array([f(r) for r in registros])
        orden = sorted(set(etiquetas), key=lambda s: (s == "no inf.", s))
        tasas = [y[etiquetas == e].mean() * 100 for e in orden]
        barras = ax.bar(orden, tasas, color=SERIES[0], width=0.6)
        for b_, t in zip(barras, tasas):
            ax.text(b_.get_x() + b_.get_width() / 2, t + 0.5, f"{t:.0f} %", ha="center", fontsize=7, color=TINTA_2)
        ax.set_title(titulo); ax.set_ylabel("% que desertó")
    fig.suptitle("Distribuciones del dataset" + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta)


def mapa_calor(matrices, titulos, nombres, ruta, titulo_general):
    fig, ejes = plt.subplots(1, len(matrices), figsize=(6.2 * len(matrices), 5.6))
    ejes = np.atleast_1d(ejes)
    etiquetas = [_leg(n) for n in nombres]
    for ax, m, t in zip(ejes, matrices, titulos):
        m = np.asarray(m)
        ax.imshow(m, cmap=MAPA_DIVERGENTE, vmin=-1, vmax=1)
        ax.grid(False)
        ax.set_xticks(range(len(nombres))); ax.set_xticklabels(etiquetas, rotation=45, ha="right")
        ax.set_yticks(range(len(nombres))); ax.set_yticklabels(etiquetas)
        for i in range(len(nombres)):
            for j in range(len(nombres)):
                ax.text(j, i, f"{m[i, j]:.2f}", ha="center", va="center", fontsize=7,
                        color="#ffffff" if abs(m[i, j]) > 0.6 else TINTA)
        ax.set_title(t)
    fig.suptitle(titulo_general + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta)


def vif_antes_despues(vif_antes, vif_despues, ruta):
    fig, ejes = plt.subplots(1, 2, figsize=(12, 4.2), sharex=True)
    tope = max(max(vif_antes.values()), 12)
    for ax, v, t in zip(ejes, (vif_antes, vif_despues), ("Antes", "Después")):
        nombres = list(v)[::-1]
        valores = [v[n] for n in nombres]
        ax.barh([_leg(n) for n in nombres], valores, color=[CRITICO if x > 10 else SERIES[0] for x in valores], height=0.6)
        for i, x in enumerate(valores):
            ax.text(x + tope * 0.01, i, f"{x:.1f}", va="center", fontsize=7, color=TINTA_2)
        ax.axvline(5, color=TENUE, ls="--", lw=1); ax.axvline(10, color=CRITICO, ls="--", lw=1)
        ax.set_title(f"VIF – {t.lower()} de tratar la colinealidad")
        ax.set_xlim(0, tope * 1.12)
    ejes[0].text(5, -0.9, " 5 moderada", fontsize=7, color=TENUE)
    ejes[0].text(10, -0.9, " 10 grave", fontsize=7, color=CRITICO)
    fig.suptitle("Factor de inflación de varianza" + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta)


def curvas(historiales, ruta_perdida, ruta_auc):
    fig, ejes = plt.subplots(1, len(historiales), figsize=(6.2 * len(historiales), 4))
    for ax, (nombre, hist, mejor) in zip(np.atleast_1d(ejes), historiales):
        ep = [h["epoca"] for h in hist]
        ax.plot(ep, [h["perdida_train"] for h in hist], color=SERIES[0], label="entrenamiento")
        ax.plot(ep, [h["perdida_val"] for h in hist], color=SERIES[1], label="validación")
        ax.axvline(mejor, color=TENUE, ls="--", lw=1)
        ax.text(mejor, ax.get_ylim()[1], f" mejor época {mejor}", fontsize=7, color=TINTA_2, va="top")
        ax.set_title(f"Pérdida por época – {nombre}"); ax.set_xlabel("época"); ax.set_ylabel("log-loss ponderada")
        ax.legend()
    fig.suptitle("Curvas de aprendizaje" + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta_perdida)

    fig, ejes = plt.subplots(1, 2, figsize=(12.4, 4))
    for i, (nombre, hist, mejor) in enumerate(historiales):
        ep = [h["epoca"] for h in hist]
        ejes[0].plot(ep, [h["auc_val"] for h in hist], color=SERIES[i], label=nombre)
        ejes[1].plot(ep, [h["recall_val"] for h in hist], color=SERIES[i], label=nombre)
    ejes[0].set_title("AUC en validación por época"); ejes[0].set_xlabel("época"); ejes[0].legend()
    ejes[1].set_title("Recall de desertores en validación (umbral 0.5)"); ejes[1].set_xlabel("época"); ejes[1].legend()
    fig.suptitle("Métricas de validación durante el entrenamiento" + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta_auc)


def evolucion_pesos(hist, nombres, ruta):
    fig, ax = plt.subplots(figsize=(10, 5))
    ep = [h["epoca"] for h in hist]
    W = np.array([h["pesos"] for h in hist])
    for j, n in enumerate(nombres):
        ax.plot(ep, W[:, j], color=SERIES[j % len(SERIES)], label=_leg(n))
    # etiquetas directas separadas al menos `gap` para que no se encimen
    gap = (W.max() - W.min()) * 0.045
    orden = np.argsort(W[-1])
    posiciones = []
    for j in orden:
        y_ = W[-1, j] if not posiciones else max(W[-1, j], posiciones[-1] + gap)
        posiciones.append(y_)
        ax.text(ep[-1] + 0.5, y_, _leg(nombres[j]), fontsize=7, color=TINTA_2, va="center")
    ax.axhline(0, color=EJE, lw=1)
    ax.set_xlabel("época"); ax.set_ylabel("peso (variable estandarizada)")
    ax.set_title("Evolución de los pesos de la regresión logística" + AVISO)
    ax.set_xlim(ep[0], ep[-1] * 1.15)
    ax.legend(ncol=4, loc="upper left", bbox_to_anchor=(0, -0.12))
    guardar(fig, ruta)


def importancias(paneles, nombres_por_panel, ruta, tope=0.35):
    fig, ejes = plt.subplots(1, len(paneles), figsize=(6.2 * len(paneles), 4.2))
    for ax, (titulo, pct), nombres in zip(np.atleast_1d(ejes), paneles, nombres_por_panel):
        orden = np.argsort(pct)
        etiquetas = [_leg(nombres[i]) for i in orden]
        valores = np.asarray(pct)[orden] * 100
        ax.barh(etiquetas, valores, color=[CRITICO if v > tope * 100 else SERIES[0] for v in valores], height=0.6)
        for i, v in enumerate(valores):
            ax.text(v + 0.5, i, f"{v:.1f} %", va="center", fontsize=7, color=TINTA_2)
        ax.axvline(tope * 100, color=CRITICO, ls="--", lw=1)
        ax.text(tope * 100, -0.9, f" tope {tope * 100:.0f} %", fontsize=7, color=CRITICO)
        ax.set_xlim(0, max(tope * 100, valores.max()) * 1.15)
        ax.set_title(titulo); ax.set_xlabel("% de la importancia total (caída de AUC)")
    fig.suptitle("Importancia por permutación en test" + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta)


def barras_simples(nombres, valores, titulo, etiqueta_x, ruta, formato="{:+.3f}", linea=None):
    fig, ax = plt.subplots(figsize=(8, 0.45 * len(nombres) + 1.6))
    orden = np.argsort(valores)
    v = np.asarray(valores)[orden]
    ax.barh([_leg(nombres[i]) for i in orden], v, color=SERIES[0], height=0.6)
    for i, x in enumerate(v):
        ax.text(x, i, " " + formato.format(x), va="center", fontsize=7, color=TINTA_2)
    if linea is not None:
        ax.axvline(linea, color=CRITICO, ls="--", lw=1)
    ax.axvline(0, color=EJE, lw=1)
    ax.set_title(titulo + AVISO); ax.set_xlabel(etiqueta_x)
    guardar(fig, ruta)


def estabilidad(nombres, media, desv, ruta):
    fig, ax = plt.subplots(figsize=(8, 0.45 * len(nombres) + 1.6))
    orden = np.argsort(media)
    ax.barh([_leg(nombres[i]) for i in orden], np.asarray(media)[orden], xerr=np.asarray(desv)[orden],
            color=SERIES[0], height=0.6, error_kw={"ecolor": TINTA, "capsize": 3, "lw": 1})
    ax.axvline(0, color=EJE, lw=1)
    ax.set_title("Pesos de la logística en 5 muestras bootstrap (media ± desv.)" + AVISO)
    ax.set_xlabel("peso (variable estandarizada)")
    guardar(fig, ruta)


def por_estrato(tabla_con, tabla_sin, ruta):
    fig, ejes = plt.subplots(1, 2, figsize=(12, 4))
    estratos = [str(f["estrato"]) for f in tabla_con]
    x = np.arange(len(estratos)); ancho = 0.38
    ejes[0].bar(x - ancho / 2, [f["fraccion_alto"] * 100 for f in tabla_con], ancho, color=SERIES[0], label="con estrato")
    ejes[0].bar(x + ancho / 2, [f["fraccion_alto"] * 100 for f in tabla_sin], ancho, color=SERIES[1], label="sin estrato")
    ejes[0].plot(x, [f["tasa_real"] * 100 for f in tabla_con], "o", color=TINTA, ms=8, label="deserción real")
    ejes[0].set_xticks(x); ejes[0].set_xticklabels(estratos); ejes[0].set_xlabel("estrato")
    ejes[0].set_title("% de estudiantes en nivel alto"); ejes[0].legend()
    ejes[1].bar(x - ancho / 2, [f["recall_alto"] * 100 for f in tabla_con], ancho, color=SERIES[0], label="con estrato")
    ejes[1].bar(x + ancho / 2, [f["recall_alto"] * 100 for f in tabla_sin], ancho, color=SERIES[1], label="sin estrato")
    ejes[1].set_xticks(x); ejes[1].set_xticklabels(estratos); ejes[1].set_xlabel("estrato")
    ejes[1].set_title("Recall de desertores en nivel alto (%)"); ejes[1].legend()
    fig.suptitle("Variable sensible: análisis por estrato en test" + AVISO, color=TINTA, fontweight="bold")
    guardar(fig, ruta)


def calibracion(curvas_, ruta):
    fig, ax = plt.subplots(figsize=(6, 5.4))
    ax.plot([0, 1], [0, 1], color=EJE, lw=1, ls="--", label="calibración perfecta")
    for i, (nombre, puntos_) in enumerate(curvas_):
        ax.plot([p[0] for p in puntos_], [p[1] for p in puntos_], marker="o", ms=5, color=SERIES[i], label=nombre)
    ax.set_xlabel("probabilidad predicha (media del decil)"); ax.set_ylabel("tasa real de deserción")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.set_title("Curva de calibración en test" + AVISO); ax.legend(loc="upper left")
    guardar(fig, ruta)
