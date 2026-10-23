"""OSM water polygons, including multipolygon islands. No inferred boundaries."""
import math

LABELS={'lake':'湖泊','pond':'池塘','reservoir':'水库','river':'河流水面','canal':'运河水面','basin':'蓄水池','lagoon':'潟湖','oxbow':'牛轭湖'}
def water_tags(tags):return tags.get('natural')=='water' or tags.get('waterway')=='riverbank' or tags.get('landuse')=='reservoir'
def coordinates(geometry):
    if not isinstance(geometry,list) or len(geometry)>30000:return None
    out=[]
    for v in geometry:
        x,y=v.get('lon'),v.get('lat')
        if type(x) not in (float,int) or type(y) not in (float,int) or not math.isfinite(x) or not math.isfinite(y) or abs(x)>180 or abs(y)>85:return None
        p=[x,y]
        if not out or p!=out[-1]:out.append(p)
    return out if len(out)>=2 else None
def equal(a,b):return abs(a[0]-b[0])+abs(a[1]-b[1])<1e-7
def rings(segments):
    pending=[list(s) for s in segments if s];out=[];invalid=0
    while pending:
        chain=pending.pop(0)
        while not equal(chain[0],chain[-1]):
            found=False
            for i,s in enumerate(pending):
                if equal(chain[-1],s[0]):chain+=s[1:]
                elif equal(chain[-1],s[-1]):chain+=list(reversed(s))[1:]
                elif equal(chain[0],s[-1]):chain=s[:-1]+chain
                elif equal(chain[0],s[0]):chain=list(reversed(s))[:-1]+chain
                else:continue
                pending.pop(i);found=True;break
            if not found:break
        if len(chain)>=4 and equal(chain[0],chain[-1]):chain[-1]=chain[0][:];out.append(chain)
        else:invalid+=1
    return out,invalid
def ring_area(r):
    return abs(sum(math.radians(b[0]-a[0])*(2+math.sin(math.radians(a[1]))+math.sin(math.radians(b[1]))) for a,b in zip(r,r[1:]))*6371008.8**2/2)
def area(polygons):return sum(max(0,ring_area(p[0])-sum(ring_area(r) for r in p[1:])) for p in polygons)
def water_features(elements,selection,inside,clip_line):
    out=[];used=set();warnings=[];ways={el.get('id'):el for el in elements if el.get('type')=='way'}
    def overlaps(polygons):
        for poly in polygons:
            outer=poly[0];xs=[v[0] for v in outer];ys=[v[1] for v in outer]
            if max(xs)<min(v[0] for v in selection) or min(xs)>max(v[0] for v in selection) or max(ys)<min(v[1] for v in selection) or min(ys)>max(v[1] for v in selection):continue
            if any(inside(p,selection) for p in outer) or clip_line(outer,selection):return True
            if any(inside(p,outer) and not any(inside(p,h) for h in poly[1:]) for p in selection):return True
        return False
    def feature(el,polygons):
        if not polygons or not overlaps(polygons):return None
        tag=el.get('tags',{});sub=tag.get('water') or ('reservoir' if tag.get('landuse')=='reservoir' else 'river' if tag.get('waterway')=='riverbank' else 'water')
        label=LABELS.get(sub,'水域');fid=f"osm-{el['type']}-{el['id']}-water"
        return {'type':'Feature','id':fid,'properties':{'id':fid,'osm_id':el['id'],'osm_type':el['type'],'kind':'water','name':str(tag.get('name') or tag.get('name:zh') or '未命名'+label)[:160],'subtype':sub,'label':label,'source':'OSM','area_m2':round(area(polygons),2),'intermittent':tag.get('intermittent')=='yes'},'geometry':{'type':'Polygon','coordinates':polygons[0]} if len(polygons)==1 else {'type':'MultiPolygon','coordinates':polygons}}
    for el in elements:
        if el.get('type')!='relation' or not water_tags(el.get('tags',{})):continue
        members=el.get('members',[])
        if not isinstance(members,list) or len(members)>5000:warnings.append('部分水域关系过于复杂，未载入');continue
        used.update(m.get('ref') for m in members if m.get('type')=='way')
        outer=[];inner=[];refs=[];bad=0
        for m in members:
            if m.get('type')!='way':continue
            role=m.get('role','');data=coordinates(m.get('geometry') or ways.get(m.get('ref'),{}).get('geometry'))
            if role not in ('','outer','inner') or not data:bad+=1;continue
            (inner if role=='inner' else outer).append(data);refs.append(m.get('ref'))
        os,missing=rings(outer);hs,holes_missing=rings(inner)
        # An incomplete island must not silently become water.
        if bad or missing or holes_missing:warnings.append('部分水域边界未闭合，已跳过；可在地图补画');continue
        polygons=[[o] for o in os]
        orphan=False
        for h in hs:
            owners=[poly for poly in polygons if inside(h[0],poly[0])]
            if not owners:orphan=True;break
            min(owners,key=lambda poly:ring_area(poly[0])).append(h)
        if orphan:warnings.append('部分水域岛屿边界无对应外环，已跳过');continue
        f=feature(el,polygons)
        if f:out.append(f);used.update(refs)
    for el in elements:
        if el.get('type')!='way' or el.get('id') in used or not water_tags(el.get('tags',{})):continue
        data=coordinates(el.get('geometry'));rs,bad=rings([data] if data else [])
        if bad or not rs:warnings.append('部分水域边界未闭合，已跳过；可在地图补画');continue
        f=feature(el,[[r] for r in rs])
        if f:out.append(f)
    return out,list(dict.fromkeys(warnings))
