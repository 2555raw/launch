from gtts import gTTS
import subprocess, json
lines = [
 ("intro", "BETO. El almacén de BETO S.L., en una sola pantalla."),
 ("mapa", "Un plano en 3D que gira 360 grados: estanterías, cámaras de frío, muelles y camiones."),
 ("seleccion", "Selecciona cualquier hueco y mira sus cuatro niveles."),
 ("mover", "Arrastra la mercancía, confirma la cantidad, y el inventario se actualiza al instante."),
 ("picking", "Recepción con control de calidad, picking con ruta optimizada y expediciones sin errores."),
 ("puestos", "Cada puesto de trabajo ve solo lo que necesita."),
 ("informes", "Informes, alertas y trazabilidad completa."),
 ("outro", "BETO. Tu almacén, bajo control."),
]
durs = {}
for key, text in lines:
    gTTS(text, lang='es', tld='es').save(f'voz_{key}_raw.mp3')
    # acelerar ligeramente (formato rápido) y normalizar
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'voz_{key}_raw.mp3','-filter:a','atempo=1.12,loudnorm=I=-16:TP=-1.5','-ar','48000',f'voz_{key}.wav'],check=True)
    out = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f'voz_{key}.wav'],capture_output=True,text=True).stdout.strip()
    durs[key] = float(out)
json.dump(durs, open('voz_durs.json','w'), indent=1)
print(durs)
