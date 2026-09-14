export type Point=[number,number];
export function intersects(a:number[][],b:number[][]){
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],nx=q[1]-p[1],ny=p[0]-q[0];let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
  for(const v of a){const d=v[0]*nx+v[1]*ny;amin=Math.min(amin,d);amax=Math.max(amax,d);}for(const v of b){const d=v[0]*nx+v[1]*ny;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}if(amax<=bmin||bmax<=amin)return false;
 }return true;
}
export function contains(poly:number[][],x:number,y:number){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function rayDistance(poly:number[][],sx:number,sy:number,dx:number,dy:number){
 if(contains(poly,sx,sy))return 0;let best=Infinity;
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],ex=q[0]-p[0],ey=q[1]-p[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-8)continue;const px=p[0]-sx,py=p[1]-sy,t=(px*ey-py*ex)/det,u=(px*dy-py*dx)/det;if(t>=0&&u>=0&&u<=1)best=Math.min(best,t);}return best;
}
