"""
Gera a nova animação do ícone do LIFE para o hero.
Direção: idle premium — o card respira, flutua, gira de leve e uma luz
passa por ele uma vez a cada volta. Loop de 8s, matematicamente fechado.
"""
import json, math, sys

T   = 480          # duração do loop em frames (60fps => 8s)
FPS = 60

# ---------- helpers de keyframe ----------
EASE = ((0.42, 0.0), (0.58, 1.0))   # easeInOut padrão de motion design

def kf(pares, ease=EASE, suave_no_pico=True):
    """pares = [(tempo, valor_ou_lista), ...] -> lista de keyframes Lottie."""
    (ox, oy), (ix, iy) = ease
    out = []
    for n, (t, v) in enumerate(pares):
        v = v if isinstance(v, list) else [v]
        d = len(v)
        k = {"t": t, "s": v}
        if n < len(pares) - 1:
            k["o"] = {"x": [ox] * d, "y": [oy] * d}
            k["i"] = {"x": [ix] * d, "y": [iy] * d}
        out.append(k)
    return out

def anim(pares, ease=EASE):
    return {"a": 1, "k": kf(pares, ease)}

def fixo(v):
    return {"a": 0, "k": v}

# Uma senoide amostrada em extremos e cruzamentos NÃO pode usar easeInOut em
# todo keyframe: isso faz o movimento parar também nos cruzamentos, e o que era
# pra ser uma deriva contínua vira um pulsar de 4 tempos. No cruzamento a
# velocidade é máxima, no extremo é zero. Daí as duas curvas abaixo.
SAI_DO_CRUZAMENTO = ((0.39, 0.575), (0.565, 1.0))   # rápido -> devagar (easeOutSine)
SAI_DO_EXTREMO    = ((0.47, 0.0),   (0.745, 0.715)) # devagar -> rápido (easeInSine)

def seno_kf(amp, base, ciclos=1, monta=lambda v: v):
    """Keyframes de uma senoide de verdade: amostra nos extremos e cruzamentos,
    com a tangente certa em cada trecho. Fecha exatamente em t=0 e t=T."""
    passo = T // (4 * ciclos)
    out = []
    n = 4 * ciclos
    for i in range(n + 1):
        t = i * passo
        val = round(base + amp * math.sin(2 * math.pi * ciclos * t / T), 3)
        v = monta(val)
        v = v if isinstance(v, list) else [v]
        k = {"t": t, "s": v}
        if i < n:
            # índice par = cruzamento (velocidade máxima), ímpar = extremo (parado)
            (ox, oy), (ix, iy) = SAI_DO_CRUZAMENTO if i % 2 == 0 else SAI_DO_EXTREMO
            d = len(v)
            k["o"] = {"x": [ox] * d, "y": [oy] * d}
            k["i"] = {"x": [ix] * d, "y": [iy] * d}
        out.append(k)
    return {"a": 1, "k": out}

# ---------- parâmetros da composição ----------
FLUTUA   = 7.0    # px de deriva vertical do card
RESPIRA  = 1.3    # % de variação de escala
GIRO     = 0.8    # graus de micro-rotação
YAW      = 22.0   # graus de giro no eixo Y (simulado por escala X)
SOMBRA   = 6.0    # opacidade máx. do escurecimento quando o card está virado

# O card tem exatamente o tamanho da composição (512x512). Sem folga, tudo que
# ele faz (flutuar, respirar, inclinar) sai da moldura e é cortado. Esta escala
# base cria a margem: 512 * 0,935 = 479px de card, ~16px livres de cada lado.
# Pior caso somado: 7px de flutuação + 3,3px de respiração + 3,6px de rotação.
BASE     = 93.5

# janela do brilho que atravessa o card (uma vez por volta)
LUZ_INI, LUZ_PICO, LUZ_FIM = 96, 142, 208
LUZ_OPACIDADE = 55.0

# ---------- assets: reaproveita o logo já otimizado ----------
orig = json.load(open(sys.argv[1], encoding="utf-8"))
img = [a for a in orig["assets"] if "layers" not in a][0]
velho = [a for a in orig["assets"] if "layers" in a][0]
formas = {L["nm"]: L for L in velho["layers"]}

def rect():
    return {"ty": "rc", "d": 1, "s": fixo([512, 512]), "p": fixo([0, 0]), "r": fixo(112)}

def grupo(pintura, tr_extra=None):
    tr = {"ty": "tr", "p": fixo([256, 256]), "a": fixo([0, 0]),
          "s": fixo([100, 100]), "r": fixo(0), "o": fixo(100)}
    if tr_extra:
        tr.update(tr_extra)
    return {"ty": "gr", "nm": "g", "it": [rect(), pintura, tr]}

def base_layer(ind, nome, ty=4):
    return {"ddd": 0, "ind": ind, "ty": ty, "nm": nome, "sr": 1,
            "ip": 0, "op": T, "st": 0, "bm": 0}

# ---------- 1. CARD (fundo claro, estático) ----------
grad_card = formas["card"]["shapes"][0]["it"][1]
card = base_layer(4, "card")
card["ks"] = {"o": fixo(100), "r": fixo(0), "p": fixo([256, 256, 0]),
              "a": fixo([256, 256, 0]), "s": fixo([100, 100, 100])}
card["shapes"] = [grupo(json.loads(json.dumps(grad_card)))]

# ---------- 2. LOGO (contra-respiração sutil = profundidade) ----------
logo = base_layer(3, "logo", ty=2)
logo["refId"] = img["id"]
logo["ks"] = {
    "o": fixo(100), "r": fixo(0),
    "p": fixo([256, 256, 0]), "a": fixo([256, 256, 0]),
    # o card cresce, o logo encolhe um triz: o card parece expandir em volta dele
    "s": anim([(0, [92, 92, 100]), (T // 2, [91.3, 91.3, 100]), (T, [92, 92, 100])]),
}

# ---------- 3. SHADE (o card escurece quando está mais virado) ----------
shade = base_layer(2, "shade")
shade["ks"] = {"o": fixo(100), "r": fixo(0), "p": fixo([256, 256, 0]),
               "a": fixo([256, 256, 0]), "s": fixo([100, 100, 100])}
fill = {"ty": "fl", "c": fixo([0.05, 0.02, 0.05, 1]), "o": fixo(100), "r": 1}
shade["shapes"] = [grupo(fill, {"o": anim([
    (0, 0.0), (T // 4, SOMBRA), (T // 2, 0.0), (3 * T // 4, SOMBRA), (T, 0.0)])})]

# ---------- 4. GLARE (a luz que atravessa o card) ----------
u = (0.645, 0.764)          # direção da luz, a mesma do gradiente do card
MEIA = 68                   # meia-largura da faixa de luz
VIAGEM = 470                # quanto o centro da faixa percorre para cada lado

def ponto(k, sinal):
    c = (k * VIAGEM * u[0], k * VIAGEM * u[1])
    return [round(c[0] + sinal * MEIA * u[0], 1), round(c[1] + sinal * MEIA * u[1], 1)]

grad_luz = {
    "ty": "gf", "o": fixo(100), "r": 1, "t": 1,
    "s": anim([(LUZ_INI, ponto(-1.0, -1)), (LUZ_FIM, ponto(1.0, -1))]),
    "e": anim([(LUZ_INI, ponto(-1.0, +1)), (LUZ_FIM, ponto(1.0, +1))]),
    # 3 paradas de cor (branco) + 3 de alpha: faixa que acende no meio e some nas pontas
    "g": {"p": 3, "k": fixo([0, 1, 1, 1, 0.5, 1, 1, 1, 1, 1, 1, 1,
                             0, 0.0, 0.5, 0.9, 1, 0.0])},
}
glare = base_layer(1, "glare")
glare["ks"] = {"o": fixo(100), "r": fixo(0), "p": fixo([256, 256, 0]),
               "a": fixo([256, 256, 0]), "s": fixo([100, 100, 100])}
glare["shapes"] = [grupo(grad_luz, {"o": anim([
    (0, 0.0), (LUZ_INI, 0.0), (LUZ_PICO, LUZ_OPACIDADE), (LUZ_FIM, 0.0), (T, 0.0)])})]

# ---------- composição interna ----------
comp = {"id": "comp_0", "layers": [glare, shade, logo, card]}

# ---------- camadas da raiz ----------
# null que carrega flutuação + respiração + micro-rotação
drift = base_layer(2, "drift", ty=3)
drift["ks"] = {
    "o": fixo(100),
    "r": seno_kf(GIRO, 0.0, ciclos=2),                       # 2 ciclos: sai do compasso do resto
    "p": seno_kf(-FLUTUA, 256, monta=lambda v: [256, v, 0]),
    "a": fixo([256, 256, 0]),
    "s": anim([(0, [BASE, BASE, 100]),
               (T // 2, [BASE + RESPIRA, BASE + RESPIRA, 100]),
               (T, [BASE, BASE, 100])]),
}

# o card em si: giro no eixo Y, simulado por escala X (nunca mostra as costas)
sx_min = round(100 * math.cos(math.radians(YAW)), 2)
icone = base_layer(1, "icon", ty=0)
icone["refId"] = "comp_0"
icone["w"] = 512
icone["h"] = 512
icone["parent"] = 2
icone["ks"] = {
    "o": fixo(100), "r": fixo(0),
    "p": fixo([256, 256, 0]), "a": fixo([256, 256, 0]),
    "s": anim([(0, [100, 100, 100]), (T // 4, [sx_min, 100, 100]),
               (T // 2, [100, 100, 100]), (3 * T // 4, [sx_min, 100, 100]),
               (T, [100, 100, 100])]),
}

novo = {"v": "5.9.0", "fr": FPS, "ip": 0, "op": T, "w": 512, "h": 512,
        "nm": "LIFE app icon - idle premium", "ddd": 0,
        "assets": [img, comp], "layers": [icone, drift]}

json.dump(novo, open(sys.argv[2], "w", encoding="utf-8"), separators=(",", ":"))

def conta(o, acc):
    if isinstance(o, dict):
        if o.get("a") == 1 and isinstance(o.get("k"), list):
            acc.append(len(o["k"]))
        for v in o.values():
            conta(v, acc)
    elif isinstance(o, list):
        for v in o:
            conta(v, acc)

acc = []
conta(novo, acc)
import os
print(f"gerado: {sys.argv[2]}")
print(f"  loop {T/FPS:.0f}s | {len(novo['layers'])} layers raiz + {len(comp['layers'])} internas")
print(f"  keyframes: {sum(acc)} em {len(acc)} propriedades")
print(f"  tamanho: {round(os.path.getsize(sys.argv[2])/1024)} KB")
print(f"  escala X no giro: 100% -> {sx_min}% (yaw {YAW} graus)")
