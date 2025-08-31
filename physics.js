// Very simplified fixed-wing physics.
// This is not Level-D sim—just enough to feel like a plane.
export class Aircraft {
  constructor() {
    // State vectors (world space)
    this.pos = { x:0, y:500, z:0 }; // meters; y = altitude
    this.vel = { x:60, y:0, z:0 };  // m/s; initial forward speed ~ 117 kt
    this.ang = { pitch:0, roll:0, yaw:0 }; // radians
    this.omega = { x:0, y:0, z:0 }; // angular rates
    // Parameters
    this.mass = 1200; // kg (small GA aircraft)
    this.S = 16.2; // wing area m^2
    this.b = 11;   // wingspan m
    this.c = this.S / this.b; // mean chord
    this.Cd0 = 0.032; // zero-lift drag
    this.ClAlpha = 5.5; // per rad
    this.CmAlpha = -0.8;
    this.CmQ = -8.0;
    this.CnBeta = 0.12;
    this.rho = 1.225;
    this.maxThrust = 18000; // N
    this.thrust = 0.5 * this.maxThrust;
    this.flaps = 0; // radians
    this.gearDown = true;
  }

  step(dt, controls) {
    // Controls: pitch [-1,1], roll [-1,1], yaw [-1,1], throttle [0,1]
    this.thrust = controls.throttle * this.maxThrust;

    // Orientation to body axes
    const cp = Math.cos(this.ang.pitch), sp = Math.sin(this.ang.pitch);
    const cr = Math.cos(this.ang.roll),  sr = Math.sin(this.ang.roll);
    const cy = Math.cos(this.ang.yaw),   sy = Math.sin(this.ang.yaw);

    // Rotation matrix world->body
    const Rwb = [
      cy*cp, cy*sp*sr - sy*cr, cy*sp*cr + sy*sr,
      sy*cp, sy*sp*sr + cy*cr, sy*sp*cr - cy*sr,
      -sp,   cp*sr,            cp*cr
    ];

    // Velocity in body axes
    const Vx = Rwb[0]*this.vel.x + Rwb[3]*this.vel.y + Rwb[6]*this.vel.z;
    const Vy = Rwb[1]*this.vel.x + Rwb[4]*this.vel.y + Rwb[7]*this.vel.z;
    const Vz = Rwb[2]*this.vel.x + Rwb[5]*this.vel.y + Rwb[8]*this.vel.z;

    const V = Math.max(0.1, Math.hypot(Vx, Vy, Vz));
    const alpha = Math.atan2(-Vz, Vx); // angle of attack
    const beta  = Math.asin(Vy / V);   // sideslip

    // Aerodynamics
    const q = 0.5 * this.rho * V * V;
    let Cl = this.ClAlpha * alpha + 0.3*this.flaps;
    // Simple stall: limit Cl
    Cl = Math.max(-1.2, Math.min(1.5, Cl));
    const Cd = this.Cd0 + 0.04*Cl*Cl + (this.gearDown?0.02:0);
    const Cy = -0.98 * beta;

    const L = q * this.S * Cl;
    const D = q * this.S * Cd;
    const Y = q * this.S * Cy;

    // Forces in body axes
    const Fx_body = this.thrust - D * (Vx/V);
    const Fy_body = Y;
    const Fz_body = -L;

    // Gravity in body axes (world gravity [0,-g,0] with g->-Y)
    const g = 9.81;
    const Fg_world = { x:0, y:-this.mass*g, z:0 };
    // Transform body forces to world
    const Rbw = [
      cy*cp, sy*cp, -sp,
      cy*sp*sr - sy*cr, sy*sp*sr + cy*cr, cp*sr,
      cy*sp*cr + sy*sr, sy*sp*cr - cy*sr, cp*cr
    ];
    const Fb_world = {
      x: Rbw[0]*Fx_body + Rbw[3]*Fy_body + Rbw[6]*Fz_body,
      y: Rbw[1]*Fx_body + Rbw[4]*Fy_body + Rbw[7]*Fz_body,
      z: Rbw[2]*Fx_body + Rbw[5]*Fy_body + Rbw[8]*Fz_body,
    };

    // Sum forces
    const Fx = Fb_world.x + Fg_world.x;
    const Fy = Fb_world.y + Fg_world.y;
    const Fz = Fb_world.z + Fg_world.z;

    // Integrate linear motion
    this.vel.x += (Fx/this.mass) * dt;
    this.vel.y += (Fy/this.mass) * dt;
    this.vel.z += (Fz/this.mass) * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y = Math.max(0, this.pos.y + this.vel.y * dt); // ground at y=0
    this.pos.z += this.vel.z * dt;

    // Moments (super simplified): roll via aileron, pitch via elevator, yaw via rudder
    const Ix = 900, Iy = 2000, Iz = 2500; // inertias
    const Lm = 15000 * controls.roll - 2000 * this.omega.x; // roll damping
    const Mm = 25000 * controls.pitch + q*this.S*this.c*(this.CmAlpha*alpha + this.CmQ*(this.omega.y*this.c/(2*Math.max(1,V)))) - 3000*this.omega.y;
    const Nm = 12000 * controls.yaw + q*this.S*this.b*(this.CnBeta*beta) - 3500*this.omega.z;

    this.omega.x += (Lm/Ix) * dt;
    this.omega.y += (Mm/Iy) * dt;
    this.omega.z += (Nm/Iz) * dt;

    // Integrate Euler angles (small-angle approx)
    this.ang.roll  += this.omega.x * dt;
    this.ang.pitch += this.omega.y * dt;
    this.ang.yaw   += this.omega.z * dt;

    // Ground interaction
    if (this.pos.y <= 0 && this.vel.y < 0) {
      // simple bounce/landing
      this.pos.y = 0;
      this.vel.y *= -0.2;
      this.vel.x *= 0.98;
      this.vel.z *= 0.98;
    }
  }
}
