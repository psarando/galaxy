//#define STANDALONE 1
/* -*- Mode: JavaScript; tab-width: 4 -*- */
/* galaxy --- spinning galaxies */

/* Originally done by Uli Siegmund <uli@wombat.okapi.sub.org> on Amiga
 *   for EGS in Cluster
 * Port from Cluster/EGS to C/Intuition by Harald Backert
 * Port to X11 and incorporation into xlockmore by Hubert Feyrer
 *   <hubert.feyrer@rz.uni-regensburg.de>
 *
 * Permission to use, copy, modify, and distribute this software and its
 * documentation for any purpose and without fee is hereby granted,
 * provided that the above copyright notice appear in all copies and that
 * both that copyright notice and this permission notice appear in
 * supporting documentation.
 *
 * This file is provided AS IS with no warranties of any kind.  The author
 * shall have no liability with respect to the infringement of copyrights,
 * trade secrets or any patents by this file or any part thereof.  In no
 * event will the author be liable for any lost revenue or profits or
 * other special, indirect and consequential damages.
 *
 * Revision History:
 * 26-Aug-00: robert.nagtegaal@phil.uu.nl and roland@tschai.demon.nl:
 *            various improvements
 * 10-May-97: jwz@jwz.org: turned into a standalone program.
 * 18-Apr-97: Memory leak fixed by Tom Schmidt <tschmidt@micron.com>
 * 07-Apr-97: Modified by Dave Mitchell <davem@magnet.com>
 * 23-Oct-94: Modified by David Bagley <bagleyd@bigfoot.com>
 *  random star sizes
 *  colors change depending on velocity
 * 10-Oct-94: Add colors by Hubert Feyer
 * 30-Sep-94: Initial port by Hubert Feyer
 * 09-Mar-94: VMS can generate a random number 0.0 which results in a
 *            division by zero, corrected by Jouk Jansen
 *            <joukj@crys.chem.uva.nl>
 */
var DEFAULTS =  "*delay:  20000  \n" +
                "*count:  -5     \n" +
                "*cycles:  250   \n" +
                "*ncolors:  64   \n" +
                "*fpsSolid:  true   \n";

var UNIFORM_COLORS = true;
var reshape_galaxy = 0;
var galaxy_handle_event = 0;
function NRAND(n) {return ( (LRAND() % (n)))}
var MAXRAND = 2147483648.0; /* unsigned 1<<31 as a float */

var galaxy_opts = {
    tracks: {
        on: true,
        desc: "turn on/off star tracks"
    },
    spin: {
        on: true,
        desc: "do/don't spin viewpoint"
    }
};


function FLOATRAND() { return (LRAND() / (MAXRAND))}

var MINSIZE = 1;
var MINGALAXIES = 2;
var MAX_STARS = 3000;
var MAX_IDELTAT = 50;
/* These come originally from the Cluster-version */
var DEFAULT_GALAXIES = 3;
var DEFAULT_STARS = 1000;
var DEFAULT_HITITERATIONS = 7500;
var DEFAULT_IDELTAT = 200; /* 0.02 */
var EPSILON = 0.00000001;

var sqrt_EPSILON = 0.0001;

var DELTAT = (MAX_IDELTAT * 0.0001);

var GALAXYRANGESIZE = 0.1;
var GALAXYMINSIZE = 0.15;
var QCONS = 0.001;


var COLORBASE = 16;
/* colors per galaxy */
/* var COLORSTEP = (NUMCOLORS/COLORBASE) */


function XPoint() {
this.x = 0;
this.y = 0;
}

function Star() {
this.pos = {x:0, y:0, z:0}; this.vel = {x:0, y:0, z:0};
}


function Galaxy() {
 this.mass = 0;
 this.stars = new Array();
 this.oldpoints = new Array();
 this.newpoints = new Array();
 this.pos = {x:0, y:0, z:0}; this.vel = {x:0, y:0, z:0};
 this.galcol = 0;
}

function Universe() {
 this.mat = [3][3]; /* Movement of stars(?) */
 this.scale = 0.0; /* Scale */
 this.midx = 0; /* Middle of screen, x */
 this.midy = 0; /* Middle of screen, y */
 this.size = 0.0; /* */
 this.diff = new Array(); /* */
 this.galaxies = new Array(); /* the Whole Universe */
 this.f_hititerations = 0; /* # iterations before restart */
 this.step = 0; /* */
 this.rot_y = 0.0; /* rotation of eye around center of universe, around
y-axis*/
 this.rot_x = 0.0; /* rotation of eye around center of universe, around
x-axis */
}

var universe = new Universe();

function
startover(mi)
{
 var gp = universe;
 var i, j; /* more tmp */
 var w1, w2; /* more tmp */
 var d, v, w, h; /* yet more tmp */

 gp.step = 0;
 gp.rot_y = 0;
 gp.rot_x = 0;

 gp.ngalaxies = mi.batchcount;
 if (gp.ngalaxies < -MINGALAXIES)
  gp.ngalaxies = NRAND(-gp.ngalaxies - MINGALAXIES + 1) + MINGALAXIES;

 else if (gp.ngalaxies < MINGALAXIES)
  gp.ngalaxies = MINGALAXIES;
 if (gp.galaxies == null) {
  gp.galaxies = new Array();
 for (i = 0; i < gp.ngalaxies; ++i) {
     gp.galaxies[i] = new Galaxy();
 }
 }
 for (i = 0; i < gp.ngalaxies; ++i) {
  var gt = gp.galaxies[i];
  var sinw1, sinw2, cosw1, cosw2;

  gt.galcol = NRAND(COLORBASE - 2);
  if (gt.galcol > 1)
   gt.galcol += 2; /* Mult 8; 16..31 no green stars */
  /* Galaxies still may have some green stars but are not all green. */

  gt.nstars = (NRAND(MAX_STARS / 2)) + MAX_STARS / 2;
  gt.stars = new Array();
  gt.oldpoints = new Array();
  gt.newpoints = new Array();
 for (j = 0; j < gt.nstars; j++) {
  gt.stars[j] = new Star();
  gt.oldpoints[j] = new XPoint();
  gt.newpoints[j] = new XPoint();
 }
  w1 = 2.0 * M_PI * FLOATRAND;
  w2 = 2.0 * M_PI * FLOATRAND;
  sinw1 = SINF(w1);
  sinw2 = SINF(w2);
  cosw1 = COSF(w1);
  cosw2 = COSF(w2);

  gp.mat[0][0] = cosw2;
  gp.mat[0][1] = -sinw1 * sinw2;
  gp.mat[0][2] = cosw1 * sinw2;
  gp.mat[1][0] = 0.0;
  gp.mat[1][1] = cosw1;
  gp.mat[1][2] = sinw1;
  gp.mat[2][0] = -sinw2;
  gp.mat[2][1] = -sinw1 * cosw2;
  gp.mat[2][2] = cosw1 * cosw2;

  gt.vel.x = FLOATRAND * 2.0 - 1.0;
  gt.vel.y = FLOATRAND * 2.0 - 1.0;
  gt.vel.z = FLOATRAND * 2.0 - 1.0;
  gt.pos.x = -gt.vel.x * DELTAT * gp.f_hititerations + FLOATRAND -
0.5;
  gt.pos.y = -gt.vel.y * DELTAT * gp.f_hititerations + FLOATRAND -
0.5;
  gt.pos.z = -gt.vel.z * DELTAT * gp.f_hititerations + FLOATRAND -
0.5;

  gt.mass = (FLOATRAND * 1000.0) + 1;

  gp.size = GALAXYRANGESIZE * FLOATRAND + GALAXYMINSIZE;

  for (j = 0; j < gt.nstars; ++j) {
   var st = gt.stars[j];
   var oldp = gt.oldpoints[j];
   var newp = gt.newpoints[j];

   var sinw, cosw;

   w = 2.0 * M_PI * FLOATRAND;
   sinw = SINF(w);
   cosw = COSF(w);
   d = FLOATRAND * gp.size;
   h = FLOATRAND * exp(-2.0 * (d / gp.size)) / 5.0 * gp.size;
   if (FLOATRAND < 0.5)
    h = -h;
   st.pos.x = gp.mat[0][0] * d * cosw + gp.mat[1][0] * d * sinw +
gp.mat[2][0] * h + gt.pos.x;
   st.pos.y = gp.mat[0][1] * d * cosw + gp.mat[1][1] * d * sinw +
gp.mat[2][1] * h + gt.pos.y;
   st.pos.z = gp.mat[0][2] * d * cosw + gp.mat[1][2] * d * sinw +
gp.mat[2][2] * h + gt.pos.z;

   v = sqrt(gt.mass * QCONS / sqrt(d * d + h * h));
   st.vel.x = -gp.mat[0][0] * v * sinw + gp.mat[1][0] * v * cosw +
gt.vel.x;
   st.vel.y = -gp.mat[0][1] * v * sinw + gp.mat[1][1] * v * cosw +
gt.vel.y;
   st.vel.z = -gp.mat[0][2] * v * sinw + gp.mat[1][2] * v * cosw +
gt.vel.z;

   st.vel.x *= DELTAT;
   st.vel.y *= DELTAT;
   st.vel.z *= DELTAT;

   oldp.x = 0;
   oldp.y = 0;
   newp.x = 0;
   newp.y = 0;
  }

 }

// XClearWindow(mi.dpy, mi.window);

if (0) {
 console("ngalaxies=%d, f_hititerations=%d\n", gp.ngalaxies,
gp.f_hititerations);
 console("f_deltat=%g\n", DELTAT);
 console("Screen: ");
}
}

function
init_galaxy(mi)
{
 var gp = universe;

 gp.f_hititerations = MI_CYCLES(mi);

 gp.scale = (MI_WIN_WIDTH(mi) + MI_WIN_HEIGHT(mi)) / 8.0;
 gp.midx =  MI_WIN_WIDTH(mi)  / 2;
 gp.midy =  MI_WIN_HEIGHT(mi) / 2;
 startover(mi);
}

function
draw_galaxy(mi)
{
  var display = mi.dpy;
  var window = mi.window;
  var gc = mi.gc;
  var gp = universe;
  var d, eps, cox, six, cor, sir;  /* tmp */
  var i, j, k; /* more tmp */
  var dummy = null;

//  if (! dbufp)
//    XClearWindow(mi.dpy, mi.window);

  if(galaxy_opts.spin.on){
    gp.rot_y += 0.01;
    gp.rot_x += 0.004;
  }

  cox = COSF(gp.rot_y);
  six = SINF(gp.rot_y);
  cor = COSF(gp.rot_x);
  sir = SINF(gp.rot_x);

  eps = 1/(EPSILON * sqrt_EPSILON * DELTAT * DELTAT * QCONS);

  for (i = 0; i < gp.ngalaxies; ++i) {
    var gt = gp.galaxies[i];

    for (j = 0; j < gp.galaxies[i].nstars; ++j) {
      var st = gt.stars[j];
      var newp = gt.newpoints[j];
      var v0 = st.vel.x;
      var v1 = st.vel.y;
      var v2 = st.vel.z;

      for (k = 0; k < gp.ngalaxies; ++k) {
        var gtk = gp.galaxies[k];
        var d0 = gtk.pos.x - st.pos.x;
        var d1 = gtk.pos.y - st.pos.y;
        var d2 = gtk.pos.z - st.pos.z;

        d = d0 * d0 + d1 * d1 + d2 * d2;
        if (d > EPSILON)
          d = gtk.mass / (d * sqrt(d)) * DELTAT * DELTAT * QCONS;
        else
          d = gtk.mass / (eps * sqrt(eps));
        v0 += d0 * d;
        v1 += d1 * d;
        v2 += d2 * d;
      }

      st.vel.x = v0;
      st.vel.y = v1;
      st.vel.z = v2;

      st.pos.x += v0;
      st.pos.y += v1;
      st.pos.z += v2;

      newp.x = (((cox * st.pos.x) - (six * st.pos.z)) *
                         gp.scale) + gp.midx;
      newp.y = (((cor * st.pos.y) - (sir * ((six * st.pos.x) +
                                                       (cox * st.pos.z))))
                         * gp.scale) + gp.midy;

    }

    for (k = i + 1; k < gp.ngalaxies; ++k) {
      gtk = gp.galaxies[k];
      d0 = gtk.pos.x - gt.pos.x;
      d1 = gtk.pos.y - gt.pos.y;
      d2 = gtk.pos.z - gt.pos.z;

      d = d0 * d0 + d1 * d1 + d2 * d2;
      if (d > EPSILON)
        d = 1 / (d * sqrt(d)) * DELTAT * QCONS;
      else
        d = 1 / (EPSILON * sqrt_EPSILON) * DELTAT * QCONS;

      d0 *= d;
      d1 *= d;
      d2 *= d;
      gt.vel.x += d0 * gtk.mass;
      gt.vel.y += d1 * gtk.mass;
      gt.vel.z += d2 * gtk.mass;
      gtk.vel.x -= d0 * gt.mass;
      gtk.vel.y -= d1 * gt.mass;
      gtk.vel.z -= d2 * gt.mass;
    }

    gt.pos.x += gt.vel.x * DELTAT;
    gt.pos.y += gt.vel.y * DELTAT;
    gt.pos.z += gt.vel.z * DELTAT;

//    if (dbufp) {
//      XSetForeground(display, gc, MI_WIN_BLACK_PIXEL(mi));
//      XDrawPoints(display, window, gc, gt.oldpoints, gt.nstars,
//                  CoordModeOrigin);
//    }
//    XSetForeground(display, gc, MI_PIXEL(mi, COLORSTEP * gt.galcol));
//    XDrawPoints(display, window, gc, gt.newpoints, gt.nstars,
//                CoordModeOrigin);

    dummy = gt.oldpoints;
    gt.oldpoints = gt.newpoints;
    gt.newpoints = dummy;
  }

  gp.step++;
  if (gp.step > gp.f_hititerations * 4)
    startover(mi);
}

