"""Bounded, authenticated OSM centreline lookup. No imagery or map keys."""
import asyncio, copy, json, math, time, ssl, logging
from urllib.parse import urlsplit
import httpx
from fastapi import HTTPException

# Current global instances from the OSM Overpass documentation.
ENDPOINTS = ('https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter')
LOG = logging.getLogger(__name__)

def overpass_tls_context():
    # The default TLS handshake stalls on this server network. Use TLS 1.2 with
    # forward-secret AEAD ciphers for this outbound OSM client only.
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.maximum_version = ssl.TLSVersion.TLSv1_2
    context.set_ciphers('ECDHE+AESGCM')
    return context
MAX_BYTES = 8 * 1024 * 1024

def area_input(body):
    if not isinstance(body, dict) or set(body) - {'polygon', 'kinds', 'include_drainage'}:
        raise HTTPException(422, '仅接受地图框选的 polygon 与 kinds。')
    if type(body.get('include_drainage',False)) is not bool: raise HTTPException(422,'include_drainage 必须为布尔值。')
    p = body.get('polygon')
    if not isinstance(p, list) or not 3 <= len(p) <= 100:
        raise HTTPException(422, '框选需要 3 至 100 个顶点。')
    def valid(v):
        return isinstance(v, list) and len(v) == 2 and all(type(x) in (int,float) and math.isfinite(x) for x in v) and abs(v[0]) <= 180 and abs(v[1]) <= 85
    if not all(valid(v) for v in p):
        raise HTTPException(422, '坐标必须为 WGS84 的 [经度,纬度]。')
    p = [list(v) for v in p]
    if p[0] == p[-1]: p.pop()
    if len(set(map(tuple,p))) < 3: raise HTTPException(422, '框选范围不能退化为线段。')
    lng, lat = zip(*p); box = (min(lat),min(lng),max(lat),max(lng))
    width = (box[3]-box[1])*111320*math.cos(math.radians(sum(lat)/len(lat)))
    height = (box[2]-box[0])*111320
    if width <= 0 or height <= 0 or width > 20000 or height > 20000 or width*height > 25_000_000:
        raise HTTPException(422, '请缩小框选范围至 25 平方公里以内，单边不超过 20 公里。')
    # Reject self intersections; concave polygons remain supported.
    for i,a in enumerate(p):
        b=p[(i+1)%len(p)]
        for j in range(i+2,len(p)):
            if i==0 and j==len(p)-1: continue
            if intersection(a,b,p[j],p[(j+1)%len(p)]) is not None:
                raise HTTPException(422, '框选多边形不能自相交。')
    kinds=body.get('kinds',['road','river'])
    if not isinstance(kinds,list) or not kinds or any(v not in ('road','river','water') for v in kinds):
        raise HTTPException(422, '地物类型只能选择道路、河流或水域。')
    return p, box, sorted(set(kinds))

def cross(a,b): return a[0]*b[1]-a[1]*b[0]
def intersection(a,b,c,d):
    r=[b[0]-a[0],b[1]-a[1]]; s=[d[0]-c[0],d[1]-c[1]]; den=cross(r,s)
    if abs(den)<1e-14: return None
    q=[c[0]-a[0],c[1]-a[1]]; t=cross(q,s)/den; u=cross(q,r)/den
    return max(0,min(1,t)) if -1e-9<=t<=1+1e-9 and -1e-9<=u<=1+1e-9 else None
def inside(v,p):
    hit=False
    for i,a in enumerate(p):
        b=p[(i+1)%len(p)]
        if abs(cross([b[0]-a[0],b[1]-a[1]],[v[0]-a[0],v[1]-a[1]]))<1e-10 and min(a[0],b[0])-1e-10<=v[0]<=max(a[0],b[0])+1e-10 and min(a[1],b[1])-1e-10<=v[1]<=max(a[1],b[1])+1e-10: return True
        if (a[1]>v[1])!=(b[1]>v[1]) and v[0]<(b[0]-a[0])*(v[1]-a[1])/(b[1]-a[1])+a[0]: hit=not hit
    return hit
def clip_line(line,p):
    parts=[]; current=[]
    def at(a,b,t): return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
    for a,b in zip(line,line[1:]):
        ts=sorted(set([0.,1.]+[t for i,c in enumerate(p) if (t:=intersection(a,b,c,p[(i+1)%len(p)])) is not None]))
        for x,y in zip(ts,ts[1:]):
            if y-x<1e-10: continue
            if inside(at(a,b,(x+y)/2),p):
                start,end=at(a,b,x),at(a,b,y)
                if current and math.dist(current[-1],start)>1e-8:
                    if len(current)>1: parts.append(current)
                    current=[]
                if not current: current=[start]
                if math.dist(current[-1],end)>1e-10: current.append(end)
            elif current:
                if len(current)>1: parts.append(current)
                current=[]
    if len(current)>1: parts.append(current)
    return parts

def features(data,p,kinds,include_drainage=False):
    if not isinstance(data,dict) or not isinstance(data.get('elements'),list): raise HTTPException(503,'地物服务返回格式异常，请手工补画或重试。')
    if data.get('remark'): raise HTTPException(503,'地物服务未完成查询，请缩小范围或手工补画。')
    out=[]; coords=0; seen=set();warnings=[]
    if 'water' in kinds:
        from osm_water import water_features
        out,warnings=water_features(data['elements'],p,inside,clip_line)
        coords=sum(len(r) for f in out for poly in ([f['geometry']['coordinates']] if f['geometry']['type']=='Polygon' else f['geometry']['coordinates']) for r in poly)
        if coords>30000 or len(out)>1500: raise HTTPException(422,'范围内水域轮廓过多，请缩小范围。')
    for el in data['elements']:
        if el.get('type')!='way' or el.get('id') in seen: continue
        seen.add(el.get('id')); tags=el.get('tags',{})
        kind='river' if tags.get('waterway') in (('river','stream','canal','drain','ditch') if include_drainage else ('river','stream','canal')) else 'road' if tags.get('highway') and tags.get('area')!='yes' else None
        if kind not in kinds: continue
        geometry=el.get('geometry',[])
        if len(geometry)>30000: raise HTTPException(422,'地物过于复杂，请缩小范围。')
        # Invalid or missing nodes split the line instead of joining a gap.
        chunks=[]; chunk=[]
        for v in geometry:
            x,y=v.get('lon'),v.get('lat')
            if type(x) in (int,float) and type(y) in (int,float) and math.isfinite(x) and math.isfinite(y) and abs(x)<=180 and abs(y)<=85: chunk.append([x,y])
            else:
                if len(chunk)>1: chunks.append(chunk)
                chunk=[]
        if len(chunk)>1: chunks.append(chunk)
        parts=[part for c in chunks for part in clip_line(c,p)]
        for i,line in enumerate(parts):
            coords+=len(line)
            if coords>30000 or len(out)>=1500: raise HTTPException(422,'范围内地物过多，请缩小框选范围。')
            fid=f"osm-way-{el['id']}-{i}"
            label={'river':'河流','stream':'溪流','canal':'运河','drain':'排水渠','ditch':'排水沟'}.get(tags.get('waterway'),'道路')
            out.append({'type':'Feature','id':fid,'properties':{'id':fid,'osm_id':el['id'],'kind':kind,'name':str(tags.get('name') or tags.get('name:zh') or '未命名'+label)[:160],'label':label,'subtype':tags.get('waterway') if kind=='river' else tags.get('highway'),'source':'OSM'},'geometry':{'type':'LineString','coordinates':line}})
    return {'type':'FeatureCollection','features':out,'attribution':'© OpenStreetMap contributors · ODbL','crs_name':'EPSG:4326','query':{'polygon':p,'kinds':kinds,'include_drainage':include_drainage},'warnings':warnings,'warning':'OSM 为公开地图资料，请在卫星影像上核对；缺失地物可手工补画。'}

class Corridors:
    def __init__(self, client_factory=None):
        self.cache={}; self.rate={}; self.lock=asyncio.Lock()
        self.client_factory=client_factory or httpx.AsyncClient
        self.tls_context=overpass_tls_context()
        self.preferred_endpoint=None
    async def query(self,tenant,body):
        p,box,kinds=area_input(body); now=time.monotonic(); key=(tenant,json.dumps([p,kinds,body.get('include_drainage',False)],separators=(',',':')))
        async with self.lock:
            if key in self.cache and self.cache[key][0]>now: return copy.deepcopy(self.cache[key][1])
            calls=[t for t in self.rate.get(tenant,[]) if t>now-60]
            if len(calls)>=6: raise HTTPException(429,'查询较频繁，请稍后再试；当前地物仍可继续编辑。')
            self.rate[tenant]=calls+[now]
            if len(self.rate)>1000: self.rate={k:v for k,v in self.rate.items() if v[-1]>now-60}
        bbox=','.join(f'{n:.7f}' for n in box)
        filters=[]
        if 'road' in kinds: filters.append(f'way["highway"]["area"!="yes"]({bbox});')
        if 'river' in kinds: filters.append(f'way["waterway"~"^({"river|stream|canal|drain|ditch" if body.get("include_drainage") else "river|stream|canal"})$"]({bbox});')
        if 'water' in kinds:
            for tag in ['["natural"="water"]','["waterway"="riverbank"]','["landuse"="reservoir"]']:
                filters.append(f'way{tag}({bbox});relation{tag}["type"="multipolygon"]({bbox});')
        q='[out:json][timeout:20][maxsize:33554432];('+''.join(filters)+');out tags geom;'
        result=None
        try:
            async with asyncio.timeout(55):
                async with self.client_factory(timeout=httpx.Timeout(connect=6,read=24,write=6,pool=6),verify=self.tls_context,follow_redirects=False,headers={'User-Agent':'RunHive-Corridor/44 (OSM inspection planner)'}) as client:
                    for endpoint in sorted(ENDPOINTS,key=lambda value:value!=self.preferred_endpoint):
                        try:
                            async with client.stream('POST',endpoint,data={'data':q}) as r:
                                if r.status_code!=200:
                                    LOG.warning('OSM upstream %s returned HTTP %s', urlsplit(endpoint).hostname, r.status_code)
                                    continue
                                buf=bytearray()
                                async for chunk in r.aiter_bytes():
                                    buf.extend(chunk)
                                    if len(buf)>MAX_BYTES: raise HTTPException(422,'返回数据过多，请缩小范围。')
                            result=features(json.loads(buf),p,kinds,body.get('include_drainage',False))
                            self.preferred_endpoint=endpoint
                            break
                        except HTTPException as error:
                            if error.status_code!=503: raise
                            # A 200 response with an Overpass timeout remark or
                            # invalid schema is incomplete, so try the next mirror.
                            LOG.warning('OSM upstream %s returned incomplete data', urlsplit(endpoint).hostname)
                        except (httpx.HTTPError,ValueError):
                            LOG.warning('OSM upstream %s connection or JSON failed', urlsplit(endpoint).hostname)
        except TimeoutError:
            raise HTTPException(503,'OSM 地物查询超时，请稍后重新提取；也可在地图补画地物。') from None
        if result is None: raise HTTPException(503,'OSM 地物服务暂时不可用。可在当前 Mars3D 地图手工绘制中心线，或稍后重试。')
        result['queried_at']=int(time.time())
        async with self.lock:
            self.cache={k:v for k,v in self.cache.items() if v[0]>now}
            if len(self.cache)>=64: self.cache.pop(next(iter(self.cache)))
            self.cache[key]=(now+300,copy.deepcopy(result))
        return result

service=Corridors()

