// House dimensions shared by cabin, interior, upstairs, collision and effects.
export const HX=4.5,HZ=3.25,T_=.25;            // outer half-extents, wall thickness → inner faces at ±4.25 / ±3.0
export const GF=.31,WH=3,UF=3.3,UH=6,RIDGE=8.3; // ground floor, ground wall top / slab underside, upper floor, upper wall top, roof ridge
export const STAIR={x0:-2.2,x1:1.8,z0:-3,z1:-2,hx:-1.3}; // along back wall, rises +x; hx = start of slab opening
export const BALC={x0:-6,x1:-HX,hz:1.6};        // west gable, z in [-hz,hz], floor at UF
export const stairH=x=>GF+Math.min(1,Math.max(0,(x-STAIR.x0)/(STAIR.x1-STAIR.x0)))*(UF-GF);
