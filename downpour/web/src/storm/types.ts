/** 'drizzle' is the calm sky, 'storm' the meteor shower. */
export type Intensity = 'drizzle' | 'storm';

/** 'hero': currency stars shine anywhere, mostly around the headline. 'content': they
 *  keep to the margins beside the page column so they never sit on a form or a table. */
export type Scene = 'hero' | 'content';

/** What both sky renderers (WebGL and the 2D fallback) offer the page. */
export interface StormRenderer {
  onPop?: (code: string) => void;
  readonly isRunning: boolean;
  resize(): void;
  setCurrencies(codes: string[]): void;
  setIntensity(i: Intensity): void;
  setScene(scene: Scene): void;
  strike(x?: number, y?: number): void;
  /** Day or night on the planet: the night sweeps in (or out) over a few seconds, or
   *  at once when `instant`. */
  setNight(night: boolean, instant?: boolean): void;
  /** Bursts the currency star under the point, if any; returns whether one was hit. */
  pop(x: number, y: number): boolean;
  start(): void;
  stop(): void;
  destroy?(): void;
}

/** Width of the page column (.wrap max-width), used to find the margins. */
export const COLUMN = 1160;
