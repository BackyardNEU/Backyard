
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wiggly SVG Comment Cards</title>

<style>
:root{
    --card-width:300px;
    --border:#9C8E8C;
    --text:#3A201F;
    --heart:#ef5a4d;
    --bg-color:#FFFDFB;

    --bg:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.19'/%3E%3C/svg%3E"),
        var(--bg-color);
    
}

*{
    box-sizing:border-box;
    margin:0;
    padding:0;
}

body{
    font-family:system-ui,sans-serif;
    background:white;
    padding:40px;
}

.comments-grid{
    display:flex;
    flex-wrap:wrap;
    gap:5px;
    align-items:flex-start;
}

.comment-card{
    
    position:relative;
    
    
}

.comment-inner{
    width:var(--card-width);
    overflow:hidden;
    background:var(--bg);
    border-radius:10px;
   
}


.comment-title{
    padding:10px;
    font-size:1.5rem;
    font-weight:700;
    color:var(--text);
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
}

.comment-text{
    padding:12px;
    color:#5a4b40;
    line-height:1.35;
    font-size:.95rem;
}

.comment-image{
    width:100%;
    overflow:hidden;
}

.comment-image img{
    display:block;
    width:100%;
    height:100%;
   
    border-radius:20px;
    padding: 11px;
    object-fit:cover;
}

.comment-image.portrait{
    aspect-ratio:3/4;
}

.comment-image.landscape{
    aspect-ratio:4/3;
}

.comment-image.square{
    aspect-ratio:1/1;
}

.comment-footer{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:6px 10px;
  
}

.comment-date{
    font-size:.95rem;
    color:var(--text);
    transform:translateY(-10px);
 
}
}

.likes{
    display:flex;
    flex-direction:column;
    align-items:center;
    line-height:1;
    
 
 
}

.like-btn{
    border:none;
    background:none;
    cursor:pointer;
    color:var(--heart);
    font-size:1.7rem;
    transition:.15s;
    transform:translateY(-2px);
   
}

.like-btn:hover{
    transform:scale(1.08);
}

.like-count{
    font-size:.95rem;
    color:var(--text);
 
    text-align: center;
    
}
.border-svg path.divider-path{
    stroke: #3A201F;
}

/* SVG BORDER LAYER */

.border-svg{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    overflow:visible;
    pointer-events:none;
}

.border-svg path{
    fill:none;
    stroke:var(--border);
    stroke-width:1;
    vector-effect:non-scaling-stroke;
    stroke-linecap:round;
    stroke-linejoin:round;
}
</style>
</head>
<body>

<div class="comments-grid">

    <!-- IMAGE ONLY -->
    <article class="comment-card">
        <svg class="border-svg"></svg>

        <div class="comment-inner">

            <div class="comment-image portrait">
                <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200">
            </div>

            <div class="divider"></div>

            <div class="comment-footer">
                <div class="comment-date">'25 9 20</div>

                <div class="likes">
                    <button class="like-btn">♥</button>
                    <div class="like-count">1k</div>
                </div>
            </div>

        </div>
    </article>

    <!-- TITLE + TEXT -->
    <article class="comment-card">
        <svg class="border-svg"></svg>

        <div class="comment-inner">

            <div class="comment-title">
                This comment is too long...
            </div>

            <div class="divider"></div>

            <div class="comment-text">
                This user didn't include photos, so just a comment appears.
                A longer description will wrap naturally and can be
                truncated with CSS if desired.
            </div>

            <div class="divider"></div>

            <div class="comment-footer">
                <div class="comment-date">'25 9 20</div>

                <div class="likes">
                    <button class="like-btn">♥</button>
                    <div class="like-count">1k</div>
                </div>
            </div>

        </div>
    </article>

    <!-- TITLE + IMAGE + TEXT -->
    <article class="comment-card">
        <svg class="border-svg"></svg>

        <div class="comment-inner">

          

           

            <div class="comment-image landscape">
                <img src="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1?w=1200">
            </div>

            <div class="divider"></div>

           

            <div class="comment-footer">
                <div class="comment-date">'25 9 20</div>

                <div class="likes">
                    <button class="like-btn">♥</button>
                    <div class="like-count">15</div>
                </div>
            </div>

        </div>
    </article>

</div>

<script>
const AMPLITUDE = 0.2;
const FREQUENCY = 4;
const SMOOTHNESS = 35;
const RADIUS = 10;
const STROKE = 2;
const SEED = 1000;

function noise(x, seed){
    return (
        Math.sin(x*1.13+seed*0.7)*0.55 +
        Math.sin(x*2.77+seed*1.1)*0.30 +
        Math.sin(x*6.21+seed*0.3)*0.15
    );
}

function roundedRectPoints(x,y,w,h,r,samples){

    const pts=[];

    function arc(cx,cy,start,end){
        for(let i=0;i<=samples;i++){
            const t=i/samples;
            const a=start+(end-start)*t;

            pts.push({
                x:cx+Math.cos(a)*r,
                y:cy+Math.sin(a)*r
            });
        }
    }

    for(let i=0;i<=samples;i++){
        pts.push({
            x:x+r+(w-r-r)*(i/samples),
            y:y
        });
    }

    arc(x+w-r,y+r,-Math.PI/2,0);

    for(let i=0;i<=samples;i++){
        pts.push({
            x:x+w,
            y:y+r+(h-r-r)*(i/samples)
        });
    }

    arc(x+w-r,y+h-r,0,Math.PI/2);

    for(let i=0;i<=samples;i++){
        pts.push({
            x:x+w-r-(w-r-r)*(i/samples),
            y:y+h
        });
    }

    arc(x+r,y+h-r,Math.PI/2,Math.PI);

    for(let i=0;i<=samples;i++){
        pts.push({
            x:x,
            y:y+h-r-(h-r-r)*(i/samples)
        });
    }

    arc(x+r,y+r,Math.PI,Math.PI*1.5);

    return pts;
}

function wiggle(points){

    const result=[];

    for(let i=0;i<points.length;i++){

        const p=points[i];
        const prev=points[(i-1+points.length)%points.length];
        const next=points[(i+1)%points.length];

        const dx=next.x-prev.x;
        const dy=next.y-prev.y;

        const len=Math.hypot(dx,dy)||1;

        const nx=-dy/len;
        const ny=dx/len;

        const n=noise(i*FREQUENCY*0.1,SEED)*AMPLITUDE;

        result.push({
            x:p.x+nx*n,
            y:p.y+ny*n
        });
    }

    return result;
}

function pathFromPoints(points){

    let d=`M ${points[0].x} ${points[0].y}`;

    for(let i=0;i<points.length-1;i++){

        const p0=points[i-1]||points[i];
        const p1=points[i];
        const p2=points[i+1];
        const p3=points[i+2]||p2;

        const cp1x=p1.x+(p2.x-p0.x)/6;
        const cp1y=p1.y+(p2.y-p0.y)/6;

        const cp2x=p2.x-(p3.x-p1.x)/6;
        const cp2y=p2.y-(p3.y-p1.y)/6;

        d+=` C ${cp1x} ${cp1y}
              ${cp2x} ${cp2y}
              ${p2.x} ${p2.y}`;
    }

    return d+" Z";
}

function dividerPath(y,w){

    const pts=[];

    for(let i=0;i<=SMOOTHNESS*4;i++){

        const t=i/(SMOOTHNESS*4);

        pts.push({
             x: 6 + t*(w - 6*2),
    y: y + noise(i*FREQUENCY*0.1,SEED)*AMPLITUDE
        });
    }

    let d=`M ${pts[0].x} ${pts[0].y}`;

    for(let i=1;i<pts.length;i++){
        d+=` L ${pts[i].x} ${pts[i].y}`;
    }

    return d;
}

function buildCard(card){

    const svg=card.querySelector('.border-svg');

    const width=card.offsetWidth;
    const height=card.offsetHeight;

    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);

    let markup='';

    

    

    const outer=wiggle(
        roundedRectPoints(
            STROKE,
            STROKE,
            width-STROKE*2,
        height-STROKE*2,
            RADIUS,
            SMOOTHNESS
        )
    );

    markup+=`
    <path class="divider-path" d="${pathFromPoints(outer)}"></path>
    `;

    card.querySelectorAll('.divider').forEach(div=>{

        const top=div.offsetTop+div.offsetHeight/2;

        markup+=`
        <path d="${dividerPath(top,width)}"></path>
        `;
    });

    svg.innerHTML=markup;
}

function buildAll(){
    document
    .querySelectorAll('.comment-card')
    .forEach(buildCard);
}

window.addEventListener('load',buildAll);

new ResizeObserver(buildAll)
.observe(document.body);
</script>

</body>
</html>
