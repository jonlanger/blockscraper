// Procedural surface relief: per-vertex `pattern` ids become brick, stone, concrete, wood,
// tile, roof tiles… with color variation and bump-mapped normals, anti-aliased by distance.

const VERT_HEAD = /* glsl */`
attribute float pattern;
varying float vPat;
varying vec3 vPW;
varying vec3 vPN;
`;

const VERT_BODY = /* glsl */`
vPat = pattern;
{
  vec4 pw_ = vec4( transformed, 1.0 );
  vec3 pn_ = objectNormal;
  #ifdef USE_BATCHING
    pw_ = batchingMatrix * pw_; pn_ = mat3( batchingMatrix ) * pn_;
  #endif
  #ifdef USE_INSTANCING
    pw_ = instanceMatrix * pw_; pn_ = mat3( instanceMatrix ) * pn_;
  #endif
  pw_ = modelMatrix * pw_;
  vPW = pw_.xyz;
  vPN = normalize( mat3( modelMatrix ) * pn_ );
}
`;

const FRAG_HEAD = /* glsl */`
varying float vPat;
varying vec3 vPW;
varying vec3 vPN;
float gPatH = 0.0;

float pHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float pNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( pHash( i ), pHash( i + vec2( 1, 0 ) ), f.x ), mix( pHash( i + vec2( 0, 1 ) ), pHash( i + vec2( 1, 1 ) ), f.x ), f.y );
}
float pFbm( vec2 p ) { float v = 0.0, a = 0.5; for ( int i = 0; i < 4; i++ ) { v += a * pNoise( p ); p *= 2.03; a *= 0.5; } return v; }
// 1 inside a block, 0 in the joint; size = block size in metres, jw = joint half-width in metres
float pJoint( vec2 cell, vec2 size, float jw ) { vec2 d = min( cell, 1.0 - cell ) * size; return smoothstep( 0.0, jw, min( d.x, d.y ) ); }
float pAA( float fw, float feat ) { return clamp( 2.0 - fw * 3.0 / feat, 0.0, 1.0 ); }

vec3 patColor( vec3 base, vec3 wp, vec3 wn, float id ) {
  if ( id < 0.5 ) return base;
  vec3 an = abs( wn );
  bool horiz = an.y > max( an.x, an.z );
  vec2 uv = an.x > max( an.y, an.z ) ? wp.zy : ( an.z >= an.y ? wp.xy : wp.xz );
  float fw = max( length( fwidth( uv ) ), 1e-5 );
  vec3 col = base;
  float h = 0.0;
  int k = int( id + 0.5 );

  if ( k == 1 ) { // brick, running bond
    vec2 sz = vec2( 0.30, 0.10 ); vec2 q = uv / sz; float row = floor( q.y ); q.x += mod( row, 2.0 ) * 0.5;
    vec2 cell = fract( q ); vec2 idc = vec2( floor( q.x ), row );
    float aa = pAA( fw, 0.1 );
    float b = pJoint( cell, sz, 0.014 );
    vec3 brick = base * ( 0.78 + 0.34 * pHash( idc ) ) * ( 0.92 + 0.16 * pNoise( uv * 7.0 ) );
    vec3 mortar = vec3( 0.52, 0.49, 0.45 );
    col = mix( base * ( 0.9 + 0.2 * pFbm( uv * 0.8 ) ), mix( mortar, brick, b ), aa );
    h = b * aa;
  } else if ( k == 2 || k == 15 ) { // ashlar / rusticated stone
    vec2 sz = k == 2 ? vec2( 1.2, 0.5 ) : vec2( 1.0, 0.5 );
    vec2 q = uv / sz; float row = floor( q.y ); q.x += mod( row, 2.0 ) * 0.5;
    vec2 cell = fract( q ); vec2 idc = vec2( floor( q.x ), row );
    float aa = pAA( fw, 0.25 );
    float jw = k == 2 ? 0.012 : 0.045;
    float b = pJoint( cell, sz, jw );
    float stain = 0.88 + 0.16 * pFbm( uv * 1.3 + idc );
    col = base * mix( 1.0, ( 0.9 + 0.14 * pHash( idc ) ) * stain, aa );
    col *= mix( 1.0, mix( 0.62, 1.0, b ), aa );
    h = ( k == 15 ? smoothstep( 0.0, 1.0, b ) : b ) * aa + pNoise( uv * 20.0 ) * 0.08 * aa;
  } else if ( k == 3 ) { // board-formed concrete with tie holes and streaks
    vec2 sz = vec2( 1.2, 0.6 ); vec2 cell = fract( uv / sz );
    float aa = pAA( fw, 0.2 );
    float seam = pJoint( cell, sz, 0.006 );
    vec2 tie = ( cell - vec2( 0.25, 0.5 ) ) * sz; vec2 tie2 = ( cell - vec2( 0.75, 0.5 ) ) * sz;
    float holes = smoothstep( 0.02, 0.035, min( length( tie ), length( tie2 ) ) );
    float streak = pNoise( vec2( uv.x * 6.0, uv.y * 0.25 ) );
    float boards = 0.96 + 0.04 * sin( uv.y * 52.0 + pNoise( uv * 3.0 ) * 3.0 );
    col = base * ( 0.84 + 0.2 * pFbm( uv * 1.2 ) ) * mix( 1.0, ( 0.9 + 0.1 * streak ) * boards * mix( 0.55, 1.0, holes ) * mix( 0.8, 1.0, seam ), aa );
    h = ( seam * holes ) * aa;
  } else if ( k == 4 ) { // stucco
    float aa = pAA( fw, 0.05 );
    col = base * ( 0.9 + 0.14 * pFbm( uv * 2.5 ) );
    h = pNoise( uv * 28.0 ) * aa * 0.6;
  } else if ( k == 5 ) { // wood planks
    vec2 p = horiz ? uv : uv.yx;
    float w = 0.18; float plank = floor( p.y / w );
    float off = pHash( vec2( plank, 3.0 ) ) * 2.4;
    vec2 cell = vec2( fract( ( p.x + off ) / 2.4 ), fract( p.y / w ) );
    float aa = pAA( fw, 0.06 );
    float b = pJoint( cell, vec2( 2.4, w ), 0.006 );
    float grain = sin( ( p.x * 1.5 + pFbm( p * vec2( 1.0, 14.0 ) + plank ) * 5.0 ) * 9.0 ) * 0.5 + 0.5;
    col = base * mix( 1.0, ( 0.8 + 0.25 * pHash( vec2( plank, floor( ( p.x + off ) / 2.4 ) ) ) ) * ( 0.9 + 0.12 * grain ) * mix( 0.6, 1.0, b ), aa );
    h = b * aa;
  } else if ( k == 6 ) { // tile
    vec2 sz = vec2( 0.4 ); vec2 cell = fract( uv / sz ); vec2 idc = floor( uv / sz );
    float aa = pAA( fw, 0.12 );
    float b = pJoint( cell, sz, 0.01 );
    col = base * mix( 1.0, mix( 1.12, 0.94 + 0.1 * pHash( idc ), b ), aa );
    h = b * aa;
  } else if ( k == 7 ) { // carpet
    float aa = pAA( fw, 0.02 );
    col = base * ( 0.88 + 0.14 * pFbm( uv * 3.0 ) ) * ( 1.0 + ( pNoise( uv * 60.0 ) - 0.5 ) * 0.2 * aa );
    h = pNoise( uv * 60.0 ) * aa * 0.3;
  } else if ( k == 8 ) { // clay roof tiles (scalloped rows)
    vec2 sz = vec2( 0.22, 0.2 ); vec2 q = uv / sz; float row = floor( q.y ); q.x += mod( row, 2.0 ) * 0.5;
    vec2 cell = fract( q );
    float aa = pAA( fw, 0.08 );
    float scallop = cell.y - 0.3 * ( 1.0 - pow( cell.x * 2.0 - 1.0, 2.0 ) );
    float t = smoothstep( -0.05, 0.1, scallop );
    col = base * mix( 1.0, ( 0.7 + 0.35 * cell.y ) * ( 0.85 + 0.25 * pHash( floor( q ) ) ) * mix( 0.7, 1.0, t ), aa );
    h = ( cell.y * t ) * aa;
  } else if ( k == 9 ) { // metal panels, brushed
    vec2 sz = vec2( 1.0, 1.33 ); vec2 cell = fract( uv / sz );
    float aa = pAA( fw, 0.1 );
    float b = pJoint( cell, sz, 0.008 );
    col = base * mix( 1.0, ( 0.94 + 0.08 * pNoise( vec2( uv.x * 90.0, uv.y * 1.5 ) ) ) * mix( 0.7, 1.0, b ) * ( 0.95 + 0.08 * pHash( floor( uv / sz ) ) ), aa );
    h = b * aa;
  } else if ( k == 10 ) { // marble
    float v = abs( sin( uv.x * 1.7 + uv.y * 0.9 + pFbm( uv * 1.4 ) * 7.0 ) );
    float vein = smoothstep( 0.9, 1.0, 1.0 - v );
    vec2 cell = fract( uv / 0.8 );
    float aa = pAA( fw, 0.2 );
    col = mix( base * ( 0.95 + 0.08 * pFbm( uv * 4.0 ) ), base * 0.5, vein * 0.7 ) * mix( 1.0, mix( 0.8, 1.0, pJoint( cell, vec2( 0.8 ), 0.004 ) ), aa );
    h = pJoint( cell, vec2( 0.8 ), 0.004 ) * aa * 0.4;
  } else if ( k == 11 ) { // gravel / asphalt
    float aa = pAA( fw, 0.02 );
    col = base * ( 0.85 + 0.2 * pFbm( uv * 1.5 ) ) * mix( 1.0, 0.75 + 0.5 * pHash( floor( uv * 30.0 ) ), aa * 0.6 );
    h = pHash( floor( uv * 30.0 ) ) * aa * 0.5;
  } else if ( k == 12 ) { // glazed terracotta blocks with bevelled edges
    vec2 sz = vec2( 0.6, 0.4 ); vec2 q = uv / sz; float row = floor( q.y ); q.x += mod( row, 2.0 ) * 0.5;
    vec2 cell = fract( q );
    float aa = pAA( fw, 0.12 );
    float b = pJoint( cell, sz, 0.05 );
    col = base * mix( 1.0, ( 0.86 + 0.18 * pHash( floor( q ) ) ) * mix( 0.72, 1.0, b ), aa );
    h = b * aa;
  } else if ( k == 13 ) { // slate shingles
    vec2 sz = vec2( 0.25, 0.14 ); vec2 q = uv / sz; float row = floor( q.y ); q.x += mod( row, 2.0 ) * 0.5 + pHash( vec2( row, 1.0 ) ) * 0.3;
    vec2 cell = fract( q );
    float aa = pAA( fw, 0.06 );
    col = base * mix( 1.0, ( 0.75 + 0.35 * pHash( floor( q ) ) ) * ( 0.75 + 0.3 * cell.y ), aa );
    h = cell.y * aa;
  } else if ( k == 14 ) { // grass / planting
    float aa = pAA( fw, 0.03 );
    col = base * ( 0.72 + 0.4 * pFbm( uv * 2.5 ) ) * mix( 1.0, 0.8 + 0.4 * pNoise( uv * 40.0 ), aa );
    h = pNoise( uv * 40.0 ) * aa;
  } else if ( k == 16 ) { // mass timber vertical boards
    vec2 p = horiz ? uv : vec2( uv.x, uv.y );
    float w = 0.16; float board = floor( p.x / w );
    vec2 cell = vec2( fract( p.x / w ), fract( ( p.y + pHash( vec2( board, 7.0 ) ) * 3.0 ) / 3.0 ) );
    float aa = pAA( fw, 0.06 );
    float b = pJoint( cell, vec2( w, 3.0 ), 0.005 );
    float grain = sin( ( p.y * 1.2 + pFbm( vec2( p.x * 14.0, p.y ) + board ) * 5.0 ) * 8.0 ) * 0.5 + 0.5;
    col = base * mix( 1.0, ( 0.82 + 0.22 * pHash( vec2( board, 2.0 ) ) ) * ( 0.9 + 0.12 * grain ) * mix( 0.65, 1.0, b ), aa );
    h = b * aa;
  }
  gPatH = h;
  return col;
}

vec3 patPerturb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir ) {
  vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
  vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
  vec3 R1 = cross( vSigmaY, surf_norm );
  vec3 R2 = cross( surf_norm, vSigmaX );
  float fDet = dot( vSigmaX, R1 ) * faceDir;
  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
  return normalize( abs( fDet ) * surf_norm - vGrad );
}
`;

export function applyPatterns(material, bump = 0.35) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = patColor( diffuseColor.rgb, vPW, normalize( vPN ), vPat );')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n  normal = patPerturb( - vViewPosition, normal, vec2( dFdx( gPatH ), dFdy( gPatH ) ) * ${bump.toFixed(3)}, faceDirection );`);
  };
  material.customProgramCacheKey = () => `patterns-${bump}`;
  return material;
}
