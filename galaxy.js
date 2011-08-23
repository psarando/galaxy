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
var DEFAULTS =
    "*delay:  20000  \n" +
    "*count:  -5     \n" +
    "*cycles:  250   \n" +
    "*ncolors:  64   \n" +
    "*fpsSolid:  true   \n";

var NUMCOLORS = 64;
var UNIFORM_COLORS = true;
var reshape_galaxy = 0;
var galaxy_handle_event = 0;
function NRAND( n ) {
    return Math.round(Math.random() * (n - 1));
}

var galaxy_opts = {
    delay: {
        value: 20000,
        desc: "Frame rate (0 - 100000)"
    },
    batchcount: {
        value: -5,
        desc: "Count (-20 - 20)"
    },
    cycles: {
        value: 250,
        desc: "Duration (10 - 1000)"
    },
    ncolors: {
        value: 64,
        desc: "Number of colors (10 - 255)"
    },
    tracks: {
        on: true,
        desc: "turn on/off star tracks"
    },
    spin: {
        on: true,
        desc: "do/don't spin viewpoint"
    }
};

function FLOATRAND() {
    return Math.random();
}

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
var COLORSTEP = (NUMCOLORS/COLORBASE)


function XPoint() {
    this.x = 0;
    this.y = 0;
}

function Star() {
    this.pos = {
        x:0.0,
        y:0.0,
        z:0.0
    };
    this.vel = {
        x:0.0,
        y:0.0,
        z:0.0
    };
}

function Galaxy() {
    this.mass = 0;
    this.stars = [];
    this.oldpoints = [];
    this.newpoints = [];
    this.pos = {
        x:0.0,
        y:0.0,
        z:0.0
    };
    this.vel = {
        x:0.0,
        y:0.0,
        z:0.0
    };
    this.galcol = 0;
}

var canvas_el, canvas_ctx, attachedDiv;
function Universe() {
    this.mat = new Array(new Array(3), new Array(3), new Array(3)); /* Movement of stars(?) */
    this.scale = 0.0; /* Scale */
    this.midx = 0; /* Middle of screen, x */
    this.midy = 0; /* Middle of screen, y */
    this.size = 0.0; /* */
    this.diff = []; /* array of doubles */
    this.galaxies = null; /* the Whole Universe */
    this.f_hititerations = 0; /* # iterations before restart */
    this.step = 0; /* */
    this.rot_y = 0.0; /* rotation of eye around center of universe, around y-axis*/
    this.rot_x = 0.0; /* rotation of eye around center of universe, around x-axis */

    this.onReady = function( parentNode ) {
        canvas_el = document.createElement('canvas');
        canvas_el.width = 1024;
        canvas_el.height = 768;
        canvas_el.style.cssText = 'position: absolute; z-index: 500;';
        parentNode.appendChild(canvas_el);
        canvas_ctx = canvas_el.getContext('2d');

        attachedDiv = document.createElement('div');
        parentNode.appendChild(attachedDiv);

        init_galaxy();
    }
}

var universe = new Universe();

function startover() {
    var gp = universe;
    var i, j; /* more tmp */
    var w1, w2; /* more tmp */
    var d, v, w, h; /* yet more tmp */

    gp.step = 0;
    gp.rot_y = 0;
    gp.rot_x = 0;

    var ngalaxies = galaxy_opts.batchcount.value;
    if( ngalaxies < -MINGALAXIES ) {
        ngalaxies = NRAND( -ngalaxies - MINGALAXIES + 1 ) + MINGALAXIES;
    } else if( ngalaxies < MINGALAXIES ) {
        ngalaxies = MINGALAXIES;
    }

    if( gp.galaxies == null ) {
        gp.galaxies = [];
        for( i = 0; i < ngalaxies; ++i ) {
            gp.galaxies[i] = new Galaxy();
        }
    }

    for( i = 0; i < ngalaxies; ++i ) {
        var gt = gp.galaxies[i];
        var sinw1, sinw2, cosw1, cosw2;

        gt.galcol = NRAND(COLORBASE - 2);
        if( gt.galcol > 1 ) {
            gt.galcol += 2; // Mult 8; 16..31 no green stars
            // Galaxies still may have some green stars but are not all green.
        }

        var nstars = (NRAND( MAX_STARS / 2 )) + MAX_STARS / 2;
        gt.stars = [];
        gt.oldpoints = [];
        gt.newpoints = [];

        for( j = 0; j < nstars; j++ ) {
            gt.stars[j] = new Star();
            gt.oldpoints[j] = new XPoint();
            gt.newpoints[j] = new XPoint();
        }

        w1 = 2.0 * Math.PI * FLOATRAND();
        w2 = 2.0 * Math.PI * FLOATRAND();
        sinw1 = Math.sin( w1 );
        sinw2 = Math.sin( w2 );
        cosw1 = Math.cos( w1 );
        cosw2 = Math.cos( w2 );

        gp.mat[0][0] = cosw2;
        gp.mat[0][1] = -sinw1 * sinw2;
        gp.mat[0][2] = cosw1 * sinw2;
        gp.mat[1][0] = 0.0;
        gp.mat[1][1] = cosw1;
        gp.mat[1][2] = sinw1;
        gp.mat[2][0] = -sinw2;
        gp.mat[2][1] = -sinw1 * cosw2;
        gp.mat[2][2] = cosw1 * cosw2;

        gt.vel.x = FLOATRAND() * 2.0 - 1.0;
        gt.vel.y = FLOATRAND() * 2.0 - 1.0;
        gt.vel.z = FLOATRAND() * 2.0 - 1.0;
        gt.pos.x = -gt.vel.x * DELTAT * gp.f_hititerations + FLOATRAND() - 0.5;
        gt.pos.y = -gt.vel.y * DELTAT * gp.f_hititerations + FLOATRAND() - 0.5;
        gt.pos.z = -gt.vel.z * DELTAT * gp.f_hititerations + FLOATRAND() - 0.5;

        gt.mass = (FLOATRAND() * 1000.0) + 1;

        gp.size = GALAXYRANGESIZE * FLOATRAND() + GALAXYMINSIZE;

        for( j = 0; j < nstars; ++j ) {
            var st = gt.stars[j];
            var oldp = gt.oldpoints[j];
            var newp = gt.newpoints[j];

            var sinw, cosw;

            w = 2.0 * Math.PI * FLOATRAND();
            sinw = Math.sin( w );
            cosw = Math.cos( w );
            d = FLOATRAND() * gp.size;
            h = FLOATRAND() * Math.exp( -2.0 * (d / gp.size) ) / 5.0 * gp.size;
            if( FLOATRAND() < 0.5 ) {
                h = -h;
            }

            st.pos.x = gp.mat[0][0] * d * cosw + gp.mat[1][0] * d * sinw +
                gp.mat[2][0] * h + gt.pos.x;
            st.pos.y = gp.mat[0][1] * d * cosw + gp.mat[1][1] * d * sinw +
                gp.mat[2][1] * h + gt.pos.y;
            st.pos.z = gp.mat[0][2] * d * cosw + gp.mat[1][2] * d * sinw +
                gp.mat[2][2] * h + gt.pos.z;

            v = Math.sqrt( gt.mass * QCONS / Math.sqrt( d * d + h * h ) );
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

    canvas_ctx.clearRect( 0, 0, canvas_el.width, canvas_el.height );

    if( 0 ) {
        console( "ngalaxies=%d, f_hititerations=%d\n", ngalaxies, gp.f_hititerations );
        console( "f_deltat=%g\n", DELTAT );
        console( "Screen: " );
    }

    var checkInterval = setInterval(function () {
        clearInterval(checkInterval);
        draw_galaxy();
    }, 100);
}

function init_galaxy() {
    var gp = universe;

    gp.f_hititerations = galaxy_opts.cycles.value;

    gp.scale = (canvas_el.width + canvas_el.height) / 8.0;
    gp.midx =  canvas_el.width  / 2;
    gp.midy =  canvas_el.height / 2;
    startover();
}

function draw_galaxy() {
    var gp = universe;
    var d, eps, cox, six, cor, sir;  /* tmp */
    var i, j, k; /* more tmp */
    var dummy = null;

    canvas_ctx.clearRect( 0, 0, canvas_el.width, canvas_el.height );

    if( galaxy_opts.spin.on ) {
        gp.rot_y += 0.01;
        gp.rot_x += 0.004;
    }

    cox = Math.cos( gp.rot_y );
    six = Math.sin( gp.rot_y );
    cor = Math.cos( gp.rot_x );
    sir = Math.sin( gp.rot_x );

    eps = 1/(EPSILON * sqrt_EPSILON * DELTAT * DELTAT * QCONS);

    for( i = 0; i < gp.galaxies.length; ++i ) {
        var gt = gp.galaxies[i];

        for( j = 0; j < gp.galaxies[i].stars.length; ++j ) {
            var st = gt.stars[j];
            var newp = gt.newpoints[j];
            var v0 = st.vel.x;
            var v1 = st.vel.y;
            var v2 = st.vel.z;

            for( k = 0; k < gp.galaxies.length; ++k ) {
                var gtk = gp.galaxies[k];
                var d0 = gtk.pos.x - st.pos.x;
                var d1 = gtk.pos.y - st.pos.y;
                var d2 = gtk.pos.z - st.pos.z;

                d = d0 * d0 + d1 * d1 + d2 * d2;
                if( d > EPSILON ) {
                    d = gtk.mass / (d * Math.sqrt( d )) * DELTAT * DELTAT * QCONS;
                } else {
                    d = gtk.mass / (eps * Math.sqrt( eps ));
                }

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

        for( k = i + 1; k < gp.galaxies.length; ++k ) {
            gtk = gp.galaxies[k];
            d0 = gtk.pos.x - gt.pos.x;
            d1 = gtk.pos.y - gt.pos.y;
            d2 = gtk.pos.z - gt.pos.z;

            d = d0 * d0 + d1 * d1 + d2 * d2;
            if( d > EPSILON ) {
                d = 1 / (d * Math.sqrt( d )) * DELTAT * QCONS;
            } else {
                d = 1 / (EPSILON * sqrt_EPSILON) * DELTAT * QCONS;
            }

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

        drawPoints( gt );

        dummy = gt.oldpoints;
        gt.oldpoints = gt.newpoints;
        gt.newpoints = dummy;
    }

    gp.step++;
    if( gp.step > gp.f_hititerations * 4 ) {
        startover();
    } else {
        var checkInterval = setInterval(function () {
            clearInterval(checkInterval);
            draw_galaxy();
        }, 100);
    }
}

    function drawPoints( gt ) {
        for( var i = 0; i < gt.newpoints.length; i++ ) {
            var newp = gt.newpoints[i];
            canvas_ctx.fillStyle = "#" + ((COLORSTEP * gt.galcol * 0x1000/NUMCOLORS) % 0xFFF).toString(16);
            canvas_ctx.fillRect( newp.x, newp.y, 1, 1 );
        }
    }

function startGalaxy() {
    var universeDiv = document.createElement('div');
    universeDiv.khIgnore = true;
    document.body.appendChild(universeDiv);

    var checkInterval = setInterval(function () {
        if (window.jQuery) {
            clearInterval(checkInterval);
            universe.onReady(universeDiv);
        }
    }, 100);
}
