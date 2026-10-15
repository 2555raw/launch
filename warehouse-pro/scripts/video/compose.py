import subprocess, json, os
F = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
FM = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
def run(cmd): subprocess.run(cmd, check=True)
def esc(s): return s.replace("'", "\\'").replace(":", "\\:")
W, H = 1280, 720
# (nombre, archivo, inicio, duración, rótulo, subrótulo)
scenes = [
  ('dashboard', 'rec/dashboard.webm', 0.7, 4.0, 'Dashboard', 'Todo el almacén de un vistazo'),
  ('mapa', 'rec/mapa.webm', 1.3, 9.0, 'Plano 3D · 360°', 'Estanterías, cámaras de frío, muelles y camiones'),
  ('seleccion', 'rec/seleccion.webm', 1.3, 5.0, 'Cada hueco, con sus 4 niveles', 'Capas de color por ocupación, temperatura o familia'),
  ('mover', 'rec/mover.webm', 1.3, 7.5, 'Arrastrar y soltar', 'Confirma la cantidad: el inventario se actualiza al instante'),
  ('picking', 'rec/picking.webm', 1.3, 7.5, 'Recepción · Picking · Expedición', 'Un solo inventario, sin descontar dos veces'),
  ('puestos', 'rec/puestos.webm', 1.0, 4.5, '4 puestos de trabajo', 'Cada puesto ve solo lo que necesita'),
  ('informes', 'rec/informes.webm', 1.3, 4.5, 'Informes y trazabilidad', 'Cada movimiento queda registrado'),
]
def caption(title, sub, dur):
    # banda inferior con rótulo que entra deslizando
    return (f"drawbox=x=0:y={H-118}:w={W}:h=118:color=0x0B1630@0.78:t=fill,"
            f"drawbox=x=40:y={H-96}:w=8:h=72:color=0x2F7CFF@1:t=fill,"
            f"drawtext=fontfile='{F}':text='{esc(title)}':fontsize=38:fontcolor=white:x=64:y={H-92}:alpha='min(1,(t-0.15)*4)',"
            f"drawtext=fontfile='{FM}':text='{esc(sub)}':fontsize=24:fontcolor=0xBFD0F2:x=64:y={H-44}:alpha='min(1,(t-0.35)*4)',"
            f"drawtext=fontfile='{F}':text='BETO':fontsize=22:fontcolor=white:x=w-tw-40:y={H-70}:alpha=0.9")
clips = []
for name, src, ss, dur, title, sub in scenes:
    out = f'clip_{name}.mp4'
    vf = f"scale={W}:{H}:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=3,trim=duration={dur},setpts=PTS-STARTPTS,{caption(title, sub, dur)}"
    run(['ffmpeg','-y','-loglevel','error','-ss',str(ss),'-i',src,'-vf',vf,'-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',out])
    clips.append((out, dur))
# Portada y cierre
def card(out, dur, big, small, tag, zoom_from=1.08):
    vf = (f"[0:v]scale={W}:{H},zoompan=z='{zoom_from}-({zoom_from}-1)*min(1,on/{int(dur*30)})':d=1:s={W}x{H}:fps=30[bg];"
          f"[1:v]scale=200:200[lg];[bg][lg]overlay=x=(W-w)/2:y=150:format=auto[v1];"
          f"[v1]drawtext=fontfile='{F}':text='{esc(big)}':fontsize=132:fontcolor=white:x=(w-tw)/2:y=372:alpha='min(1,(t-0.2)*3)',"
          f"drawtext=fontfile='{FM}':text='{esc(small)}':fontsize=34:fontcolor=0xBFD0F2:x=(w-tw)/2:y=528:alpha='min(1,(t-0.6)*3)',"
          f"drawtext=fontfile='{F}':text='{esc(tag)}':fontsize=22:fontcolor=0x5B9BFF:x=(w-tw)/2:y=590:alpha='min(1,(t-0.9)*3)'[v]")
    run(['ffmpeg','-y','-loglevel','error','-loop','1','-i','bg.png','-loop','1','-i','logo_white.png','-filter_complex',vf,'-map','[v]','-t',str(dur),'-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',out])
# fondo degradado
import numpy as np
from PIL import Image
y, x = np.mgrid[0:H, 0:W]
g = (x/W*0.6 + y/H*0.4)
r = (11 + (39-11)*g); gg = (22 + (71-22)*g); b = (48 + (158-48)*g)
Image.fromarray(np.dstack([r, gg, b]).astype('uint8')).save('bg.png')
card('card_intro.mp4', 2.2, 'BETO', 'Sistema de gestión de almacén · BETO S.L.', 'PLANO 3D  ·  INVENTARIO  ·  TRAZABILIDAD')
card('card_outro.mp4', 3.6, 'BETO', 'Tu almacén, bajo control.', 'Jordi · Beto · Eva · Lucía · Raúl', 1.0)
seq = [('card_intro.mp4', 2.2)] + clips + [('card_outro.mp4', 3.6)]
# xfade en cadena
X = 0.35
inputs = []; 
for f, d in seq: inputs += ['-i', f]
fc = []; prev = '0:v'; offset = 0.0; starts = [0.0]
for i in range(1, len(seq)):
    offset += seq[i-1][1] - X
    starts.append(offset)
    out = f'v{i}' if i < len(seq)-1 else 'vout'
    fc.append(f"[{prev}][{i}:v]xfade=transition={'fade' if i in (1, len(seq)-1) else 'slideleft'}:duration={X}:offset={offset:.3f}[{out}]")
    prev = out
total = offset + seq[-1][1]
# audio: voz por escena + música
voices = ['intro', None, 'mapa', 'seleccion', 'mover', 'picking', 'puestos', 'informes', 'outro']
vstart = {'intro': starts[0] + 0.3, 'mapa': starts[2] + 0.25, 'seleccion': starts[3] + 0.25, 'mover': starts[4] + 0.25, 'picking': starts[5] + 0.25, 'puestos': starts[6] + 0.25, 'informes': starts[7] + 0.25, 'outro': starts[8] + 0.35}
ai = len(seq)
inputs += ['-i', 'musica.wav']
afc = [f"[{ai}:a]atrim=duration={total:.2f},volume=0.22,afade=t=in:d=0.5,afade=t=out:st={total-2.5:.2f}:d=2.5[mus]"]
mix = ['[mus]']
for k, v in vstart.items():
    ai += 1; inputs += ['-i', f'voz_{k}.wav']
    afc.append(f"[{ai}:a]adelay={int(v*1000)}|{int(v*1000)},volume=1.0[v_{k}]"); mix.append(f'[v_{k}]')
afc.append(''.join(mix) + f"amix=inputs={len(mix)}:normalize=0:dropout_transition=0,alimiter=limit=0.95[aout]")
run(['ffmpeg','-y','-loglevel','error'] + inputs + ['-filter_complex', ';'.join(fc + afc), '-map','[vout]','-map','[aout]','-t',f'{total:.2f}','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','BETO_video.mp4'])
print('total', round(total, 1), 's', json.dumps({k: round(v,2) for k,v in vstart.items()}))
