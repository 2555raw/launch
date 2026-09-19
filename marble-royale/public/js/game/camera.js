/* The camera director.

   The race is watched, not played, so the camera is most of the show. It has
   a handful of shots and picks between them on its own:

     idle       a slow dolly down the empty course, for the home page
     overview   high over the hopper, watching the field gather
     gate       tight on the start gate for the countdown
     follow     behind and above the leader, looking down the track
     battle     pulled in on the leader and the marble on its heels
     finish     parked at the line as the leader arrives
     victory    a slow orbit of the winner

   Every cut is a lerp, so nothing snaps, and a shake can be laid on top.
   The director never touches the race; it only reads it. */

(function () {
  'use strict';

  const SLOPE = 34 * Math.PI / 180;               // how steeply the course descends
  const K = 0.01;                                  // course units to world units
  const FWD = { x: 0, y: -Math.sin(SLOPE), z: -Math.cos(SLOPE) };   // down the track
  const UP = { x: 0, y: Math.cos(SLOPE), z: -Math.sin(SLOPE) };     // off the track plane
  const RIGHT = { x: 1, y: 0, z: 0 };

  /** Course (x, y) → world, at height h above the track plane. */
  function world(x, y, h) {
    const d = y * K, u = h || 0;
    return {
      x: (x - 500) * K + RIGHT.x * 0 + UP.x * u,
      y: FWD.y * d + UP.y * u,
      z: FWD.z * d + UP.z * u
    };
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const v = (x, y, z) => ({ x, y, z });
  const add = (a, b, s) => v(a.x + b.x * (s ?? 1), a.y + b.y * (s ?? 1), a.z + b.z * (s ?? 1));

  const cam = {
    mode: 'idle', auto: true,
    pos: v(0, 6, 8), look: v(0, 0, 0),
    wantPos: v(0, 6, 8), wantLook: v(0, 0, 0),
    shake: 0, shakeSeed: 0,
    t: 0, lastCut: 0, orbit: 0,
    fov: 55, wantFov: 55
  };

  function setMode(mode) {
    if (mode === 'auto') { cam.auto = true; return; }
    cam.auto = false;
    cam.mode = mode;
  }

  function shake(amount) { cam.shake = Math.max(cam.shake, amount); }

  /* Where the shot wants to be, given the race. */
  function decide(state, dt) {
    const c = state && state.course;
    const height = c ? c.height : 9000;
    cam.t += dt;

    let mode = cam.mode;
    if (cam.auto && state) {
      const racing = state.t > 0 && !state.hold && !state.over;
      /* once the winner is home for a moment, the show is the winner */
      const won = state.finished.length > 0 && (state.t - state.finished[0].time) > 1.4;
      if (state.over || won) mode = 'victory';
      else if (!racing) mode = state.hold ? 'overview' : 'gate';
      else {
        const lead = state.leader;
        /* battle when a close second is within a few marbles; finish as the
           leader closes on the line; follow otherwise. Cuts are held for at
           least two seconds so the picture never flickers between shots. */
        let second = null;
        for (const b of state.balls) if (!b.done && b !== lead && (!second || b.y > second.y)) second = b;
        const past = lead ? lead.y / c.finishY : 0;
        const closeFight = lead && second && past > 0.2 && (lead.y - second.y) < 80 && Math.abs(lead.x - second.x) < 220;
        const nearFinish = lead && lead.y > c.finishY - 800;
        const want = nearFinish ? 'finish' : (closeFight ? 'battle' : 'follow');
        /* a battle shot is held for three seconds and then handed back, so the
           camera reads as cutting between shots rather than dithering */
        const held = cam.t - cam.lastCut;
        if (want !== cam.mode && (want === 'finish' ? held > 0.3 : (cam.mode === 'battle' ? held > 3 : held > 2))) { mode = want; cam.lastCut = cam.t; }
        else mode = cam.mode === 'idle' || cam.mode === 'overview' || cam.mode === 'gate' ? want : cam.mode;
      }
      cam.mode = mode;
    }

    const lead = state && (state.leader || state.balls[0]);
    let target, pos, fov = 55, rate = 2.4, lookRate = 3.2;

    switch (mode) {
      case 'idle': {
        /* a slow dolly down the course and back */
        const d = (Math.sin(cam.t * 0.09) * 0.5 + 0.5) * Math.max(0, height - 1800) + 600;
        target = world(500, d + 600, 0);
        pos = add(world(500, d - 700, 0), UP, 3.6);
        pos.x += Math.sin(cam.t * 0.15) * 2.6;
        fov = 50; rate = 1.2; lookRate = 1.2;
        break;
      }
      case 'overview': {
        target = world(500, 520, 0);
        pos = add(world(500, -900, 0), UP, 6.2);
        pos.x += Math.sin(cam.t * 0.25) * 1.4;
        fov = 52; rate = 1.4; lookRate = 1.6;
        break;
      }
      case 'gate': {
        target = world(500, 470, 0.2);
        pos = add(world(500 + Math.sin(cam.t * 0.6) * 120, -260, 0), UP, 3.0);
        fov = 44; rate = 1.8; lookRate = 2.2;
        break;
      }
      case 'follow': {
        /* close behind the leader, high enough to read the track ahead */
        const x = lead ? lead.x : 500, y = lead ? lead.y : 500;
        target = world(x * 0.5 + 250, y + 260, 0);
        pos = add(world(x * 0.6 + 200, y - 340, 0), UP, 2.5);
        fov = 60; rate = 2.8; lookRate = 3.6;
        break;
      }
      case 'battle': {
        /* low and off to one side of the pair, so the fight fills the frame */
        const x = lead ? lead.x : 500, y = lead ? lead.y : 500;
        const side = x > 500 ? -1 : 1;
        target = world(x, y + 110, 0.05);
        pos = add(world(x + side * 300, y - 260, 0), UP, 1.7);
        fov = 46; rate = 3; lookRate = 4.2;
        break;
      }
      case 'finish': {
        /* parked past the line, looking back up the track at what is coming */
        const fy = c ? c.finishY : 9000;
        const x = lead ? lead.x : 500, y = lead ? lead.y : fy;
        target = world(lead ? x * 0.6 + 200 : 500, Math.min(y + 120, fy + 40), 0.1);
        pos = add(world(500 + (x - 500) * 0.3, fy + 380, 0), UP, 2.6);
        fov = 50; rate = 2.2; lookRate = 3.2;
        break;
      }
      case 'victory': {
        /* a slow orbit of the winner in the first slot of the pen */
        const fy = c ? c.finishY : 9000;
        cam.orbit += dt * 0.4;
        const cx = 140, cy = fy + 90;
        target = world(cx + 120, cy, 0.15);
        const ring = world(cx + 120 + Math.cos(cam.orbit) * 260, cy + Math.sin(cam.orbit) * 260, 0);
        pos = add(ring, UP, 1.6);
        fov = 44; rate = 1.6; lookRate = 2.4;
        break;
      }
      default:
        target = world(500, 500, 0); pos = add(world(500, -600, 0), UP, 5);
    }

    cam.wantPos = pos; cam.wantLook = target; cam.wantFov = fov;
    const a = Math.min(1, dt * rate), b = Math.min(1, dt * lookRate);
    cam.pos = v(lerp(cam.pos.x, pos.x, a), lerp(cam.pos.y, pos.y, a), lerp(cam.pos.z, pos.z, a));
    cam.look = v(lerp(cam.look.x, target.x, b), lerp(cam.look.y, target.y, b), lerp(cam.look.z, target.z, b));
    cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 2));

    /* shake: a decaying wobble laid on the position */
    if (cam.shake > 0.001) {
      cam.shakeSeed += dt * 40;
      const s = cam.shake;
      cam.pos = add(cam.pos, v(Math.sin(cam.shakeSeed * 1.3) * s, Math.cos(cam.shakeSeed * 1.7) * s * 0.6, Math.sin(cam.shakeSeed * 0.9) * s * 0.4));
      cam.shake *= Math.max(0, 1 - dt * 6);
    }
    return cam;
  }

  function snap() { cam.pos = cam.wantPos; cam.look = cam.wantLook; cam.fov = cam.wantFov; }

  window.CAMERA = { world, decide, setMode, shake, snap, K, SLOPE, FWD, UP, RIGHT, get state() { return cam; } };
})();
