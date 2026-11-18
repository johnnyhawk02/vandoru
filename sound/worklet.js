// The audio worklet: a thin host for the instrument (sound/instrument.js). Messages from the page play and edit the
// engines; every few blocks it sends back the engines' peaks and the sidechain's envelope for the meters.
import { Instrument } from './instrument.js?v=mwme9jly';

class Host extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inst = new Instrument(sampleRate);
    this.blocks = 0;
    this.port.onmessage = (e) => this.on(e.data);
  }
  on(m) {
    const I = this.inst;
    switch (m.type) {
      case 'play': I.play(m.engine, m.sound, m.vel, m.out, !!m.back); break;
      case 'update': I.update(m.engine, m.sound, m.out); break;
      case 'release': I.release(m.engine); break;
      case 'alloff': I.allOff(); break;
      case 'engines': I.setEngines(m.n); break;
      case 'tempo': I.setTempo(m.bpm, m.ret); break;
      case 'fx': I.setFx(m.fx); break;
      case 'settings': I.setSettings(m.settings); break;
    }
  }
  process(inputs, outputs) {
    const out = outputs[0], L = out[0], R = out[1] || out[0];
    this.inst.render(L, R);
    if (++this.blocks % 8 === 0) this.port.postMessage({ type: 'peaks', peaks: this.inst.readPeaks(), sc: this.inst.readSc() });
    return true;
  }
}
registerProcessor('vandoru', Host);
