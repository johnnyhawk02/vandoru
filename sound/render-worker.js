// A Worker for offline renders, off the page's thread: { id, sound, level, vel, seconds, fs } in, { id, samples } out.
import { renderSound } from '../engine/render.js?v=mwmdy8tl';

self.onmessage = (e) => {
  const { id, sound, level, vel, seconds, fs } = e.data;
  const samples = renderSound(sound, { level, vel, seconds, fs });
  self.postMessage({ id, samples }, [samples.buffer]);
};
