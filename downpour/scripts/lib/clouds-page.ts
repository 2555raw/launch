/* Runs in the browser for scripts/build-earth-clouds.mjs: renders the planet's cloud cover
 * (CLOUD_FS, over the same land mask and storms the sky uses) and returns it as JPEGs. */
import { landFields, STORMS } from '../../web/src/storm/earth';
import { CLOUD_FS } from '../../web/src/storm/earthgen';
import { FULLSCREEN_VS, program } from '../../web/src/storm/gl';

export function render(sizes: number[], quality: number): string[] {
  const W = Math.max(...sizes);
  const H = W / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is not available');

  const f = landFields();
  const mask = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, mask);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, f.w, f.h, 0, gl.RG, gl.UNSIGNED_BYTE, f.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const storms = new Float32Array(32);
  STORMS.forEach(([lat, lon, twist], i) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    storms.set([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo), twist], i * 4);
  });

  const P = program(gl, FULLSCREEN_VS, CLOUD_FS, ['uMask', 'uStorm']);
  gl.useProgram(P.prog);
  gl.uniform1i(P.u.uMask, 0);
  gl.uniform4fv(P.u.uStorm, storms);
  gl.bindVertexArray(gl.createVertexArray());
  gl.viewport(0, 0, W, H);
  // in strips, so no single draw keeps the GPU busy for long
  gl.enable(gl.SCISSOR_TEST);
  const strips = 16;
  for (let s = 0; s < strips; s++) {
    const y0 = Math.floor((H * s) / strips);
    const y1 = Math.floor((H * (s + 1)) / strips);
    gl.scissor(0, y0, W, y1 - y0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }

  // readPixels starts at the framebuffer's row 0, which the shader made the north pole:
  // the image's top row, as the day map has it
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), W, H), 0, 0);

  return sizes.map((w) => {
    if (w === W) return full.toDataURL('image/jpeg', quality);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = w / 2;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(full, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  });
}
