export class TouchControls {
  constructor(elL, elR, nubL, nubR) {
    this.elL = elL; this.elR = elR; this.nubL = nubL; this.nubR = nubR;
    this.state = { pitch:0, roll:0, yaw:0, throttle:0.5 };
    this._bind();
  }
  _bind() {
    const mkHandler = (side) => {
      const el = side==='L' ? this.elL : this.elR;
      const nub = side==='L' ? this.nubL : this.nubR;
      let start = null;
      let lastTap = 0;
      const onDown = (e) => {
        const t = e.touches ? e.touches[0] : e;
        start = { x:t.clientX, y:t.clientY };
        el.style.borderColor = 'rgba(255,255,255,.5)';
      };
      const onMove = (e) => {
        if (!start) return;
        const t = e.touches ? e.touches[0] : e;
        const rect = el.getBoundingClientRect();
        const x = Math.max(rect.left, Math.min(t.clientX, rect.right));
        const y = Math.max(rect.top, Math.min(t.clientY, rect.bottom));
        const nx = (x - rect.left) / rect.width * 2 - 1;  // -1..1
        const ny = (y - rect.top) / rect.height * 2 - 1;  // -1..1
        nub.style.left = (nx*0.5+0.5)*100 + '%';
        nub.style.top  = (ny*0.5+0.5)*100 + '%';
        if (side==='L') {
          // Left: pitch (vertical, invert) & roll (horizontal)
          this.state.pitch = -ny;    // up is negative ny
          this.state.roll  = nx;
        } else {
          // Right: yaw (horizontal) & throttle (vertical inversed, 0..1)
          this.state.yaw      = nx;
          this.state.throttle = Math.max(0, Math.min(1, 1 - (ny*0.5+0.5)));
        }
      };
      const onUp = () => {
        start = null;
        el.style.borderColor = 'rgba(255,255,255,.2)';
        // spring back the nubs
        nub.style.left = '50%'; nub.style.top = '50%';
        if (side==='L') { this.state.pitch = 0; this.state.roll = 0; }
        else { this.state.yaw = 0; /* keep throttle */ }
      };
      const onTap = () => {
        const now = performance.now();
        if (now - lastTap < 300) {
          // double tap: recenter
          this.state = { ...this.state, pitch:0, roll:0, yaw:0 };
          nub.style.left = '50%'; nub.style.top = '50%';
        }
        lastTap = now;
      };
      el.addEventListener('touchstart', onDown, {passive:true});
      el.addEventListener('touchmove', onMove, {passive:false});
      el.addEventListener('touchend', onUp, {passive:true});
      el.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      el.addEventListener('click', onTap);
    };
    mkHandler('L'); mkHandler('R');
  }
}
