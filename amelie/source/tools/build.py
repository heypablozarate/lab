#!/usr/bin/env python3
"""Build Amélie 2004 → site/ (idempotente, procesa desde la fuente)."""
import re, sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else PROJECT / "original" / "amelie"
DST = Path(sys.argv[2]) if len(sys.argv) > 2 else PROJECT / "site"

MUSIC = {"sound.html": "musicafinal.mp3", "sound_rojo.html": "musica_rojo.mp3",
         "sound_azul.html": "musica_azul.mp3", "sound_verde.html": ""}

SOUND_TMPL = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Sound</title>
<style>body{{background:#000;margin:0}}</style>
<link href="{css}" rel="stylesheet" type="text/css">
</head>
<body data-music="{music}">
<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr><td><img src="../../img/dot.gif" alt="" width="1" height="370"></td></tr>
  <tr><td><div id="ame-sound-slot"></div></td></tr>
</table>
<script src="../../js/amelie-sound.js"></script>
</body>
</html>
"""

def process(rel: Path):
    raw = (SRC / rel).read_text(encoding="latin-1")
    name = rel.name
    if name in MUSIC:
        m = re.search(r'link href="([^"]+)"', raw)
        css = m.group(1) if m else ""
        music = f"../../sound/{MUSIC[name]}" if MUSIC[name] else ""
        out = SOUND_TMPL.format(css=css, music=music)
    else:
        out = raw
        # comentarios JS rotos en la fuente 2004 (`/v3.0`): IE los toleraba, hoy son regex inválidas
        out = re.sub(r"\{(\s*)/(?=(v\d|reloads))", r"{\1//", out)
        out = out.replace("\n/-->", "\n//-->")
        out = out.replace("charset=iso-8859-1", "charset=utf-8")
        # único <img> sin width/height del sitio: con assets @2x se vería al doble
        out = out.replace('<img alt="" src="../../img/nav_rojo/esencia_on.jpg">',
                          '<img alt="" src="../../img/nav_rojo/esencia_on.jpg" width="104" height="72">')
        out = out.replace("../../index.php", "../../index.html")
        out = out.replace("index.php", "index.html")
        # el logo usaba target="_top" (2004: reemplazar toda la ventana); dentro
        # del iframe de la escena eso escapa al top real. _parent = el iframe.
        out = out.replace('target="_top"', 'target="_parent"')
        if name == "index.html" and "<frameset" in out:
            # deep-link 2026: ?p=seccion.html&s=sound_x.html para abrir una
            # sección directa (lo usa el easter egg del post-it en la escena)
            dl = ('<script>document.addEventListener("DOMContentLoaded",function(){'
                  'var q=new URLSearchParams(location.search);'
                  'var ok=function(v){return v&&/^[a-z_]+\\.html$/.test(v);};'
                  'var p=q.get("p"),s=q.get("s");'
                  'if(ok(p))document.querySelector(\'frame[name="mainFrame"]\').src=p;'
                  'if(ok(s))document.querySelector(\'frame[name="rightFrame"]\').src=s;});</script>\n</head>')
            out = out.replace("</head>", dl, 1)
        if name == "trailers.html":
            # 2004: click descargaba el .avi — 2026: la tele lo reproduce inline
            old_tv = '<a href="../../download/amelie_trailer_256x128.avi"><img alt="" src="../../img/trailers/pantalla_anim.gif" width="150" height="136" border="0"></a>'
            new_tv = ('<div id="ame-tv" style="position:relative;width:150px;height:136px;cursor:pointer" title="Play">'
                      '<img id="ame-tv-off" src="../../img/trailers/pantalla_anim.gif" width="150" height="136" alt="" style="display:block">'
                      '<video id="ame-tv-video" width="150" height="136" '
                      'style="display:none;object-fit:cover;background:#000" playsinline>'
                      '<source src="../../video/amelie_trailer.mp4" type="video/mp4">'
                      '<source src="../../video/amelie_trailer.webm" type="video/webm">'
                      '</video></div>')
            tv_js = ('<script>(function(){'
                     'function inlinePlay(){var v=document.getElementById("ame-tv-video"),i=document.getElementById("ame-tv-off");'
                     'if(v.style.display==="none"){i.style.display="none";v.style.display="block";v.play();}'
                     'else if(v.paused){v.play();}else{v.pause();}'
                     'v.onended=function(){v.style.display="none";i.style.display="block";};}'
                     # dentro de la escena: pedir la ventana QuickTime al top; si nadie
                     # contesta (sitio navegado suelto), reproducir en la tele como siempre
                     'document.getElementById("ame-tv").addEventListener("click",function(){'
                     'if(window.top===window.self){inlinePlay();return;}'
                     'var acked=false;var h=function(ev){if(ev.data&&ev.data.type==="amelie-trailer-ack"){acked=true;window.removeEventListener("message",h);}};'
                     'window.addEventListener("message",h);'
                     # avisar a TODOS los ancestros: la escena puede estar anidada
                     # (page de Next → escena → frameset → esta página)
                     'try{for(var w=window.parent;;w=w.parent){w.postMessage({type:"amelie-trailer"},"*");if(w===w.top)break;}}catch(e){}'
                     'setTimeout(function(){window.removeEventListener("message",h);if(!acked)inlinePlay();},250);'
                     '});})();</script>')
            out = out.replace(old_tv, new_tv)
            out = out.replace("</body>", tv_js + "\n</body>")
        if "</body>" in out and ("MM_dragLayer" in out or "MM_controlSound" in out):
            out = out.replace("</body>", '<script src="../../js/amelie-modern.js"></script>\n</body>')
    (DST / rel).parent.mkdir(parents=True, exist_ok=True)
    (DST / rel).write_text(out, encoding="utf-8")

count = 0
for world in ["mundo_amelie", "mundo_jeunet"]:
    for f in sorted((SRC / "html" / world).glob("*.html")):
        process(Path("html") / world / f.name)
        count += 1
print(f"OK: {count} páginas procesadas → {DST}")
