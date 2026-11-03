"""Estilo común de las gráficas (matplotlib). Solo se usa en local, nunca en Vercel.

Paleta categórica validada (orden fijo, nunca se recicla): azul, naranja, aqua.
Líneas de 2 px, cuadrícula tenue, leyenda siempre que hay 2 o más series.
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

SUPERFICIE = "#fcfcfb"
TINTA = "#0b0b0b"
TINTA_2 = "#52514e"
TENUE = "#898781"
CUADRICULA = "#e1e0d9"
EJE = "#c3c2b7"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
CRITICO = "#d03b3b"
DIVERGENTE = ["#184f95", "#3987e5", "#86b6ef", "#f0efec", "#f2a3a2", "#e34948", "#a52a2a"]
SECUENCIAL = ["#cde2fb", "#86b6ef", "#3987e5", "#256abf", "#104281"]

plt.rcParams.update({
    "figure.facecolor": SUPERFICIE,
    "axes.facecolor": SUPERFICIE,
    "savefig.facecolor": SUPERFICIE,
    "axes.edgecolor": EJE,
    "axes.labelcolor": TINTA_2,
    "axes.titlecolor": TINTA,
    "axes.titlesize": 11,
    "axes.titleweight": "bold",
    "axes.labelsize": 9,
    "axes.grid": True,
    "axes.axisbelow": True,
    "grid.color": CUADRICULA,
    "grid.linewidth": 0.6,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "xtick.color": TENUE,
    "ytick.color": TENUE,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "lines.linewidth": 2,
    "legend.frameon": False,
    "legend.fontsize": 8,
    "font.family": ["Segoe UI", "DejaVu Sans", "sans-serif"],
    "axes.prop_cycle": matplotlib.cycler(color=SERIES),
})


def guardar(fig, ruta):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(ruta, dpi=120)
    plt.close(fig)
