"""Blender-authored small-body meshes and distinct solid-world bases.
Run: blender --background --factory-startup --python assets/blender/build_world_models.py
Bodies are stylized illustrations, not measured spacecraft shape reconstructions.
"""
import bpy,bmesh,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/models';OUT.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
def material(name,color):
 if name in materials:return materials[name]
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m['webColor']='#'+''.join('%02x'%round(c*255) for c in color);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;materials[name]=m;return m
rock=material('Small body stone',(.58,.55,.5));ice=material('Small body ice',(.76,.81,.83))
profiles={'phobos':(1,.78,.67),'deimos':(1,.81,.71),'haumea':(1,.51,.41),'hiiaka':(1,.81,.73),'namaka':(1,.73,.62),'proteus':(1,.9,.81),'nereid':(1,.83,.75),'nix':(1,.61,.53),'hydra':(1,.7,.56),'dysnomia':(1,.87,.78),'actaea':(1,.86,.78),'ilmare':(1,.85,.76),'vanth':(1,.89,.8),'xiangliu':(1,.82,.71),'zoozve':(1,.63,.57),'vesta':(1,.94,.78),'pallas':(1,.92,.84),'hygiea':(1,.96,.92),'eros':(1,.38,.39),'ida':(1,.48,.46),'gaspra':(1,.65,.61),'itokawa':(1,.47,.43),'bennu':(.96,1,.96),'ryugu':(1,.94,1),'arrokoth':(1,.55,.52),'varuna':(1,.61,.56),'ixion':(1,.89,.82)}
for i in range(8):profiles['belt-'+str(i)]=(1,.55+(i%4)*.11,.48+(i%3)*.13)
def export(objects,name,colliders=False):
 merged={};bounds=[]
 for o in objects:
  if o.type!='MESH':continue
  o.data.calc_loop_triangles();m=o.data.materials[0];part=merged.setdefault(m.name,{'name':m.name,'positions':[],'normals':[],'uvs':[],'color':m['webColor'],'metalness':.06,'roughness':.87})
  normal=o.matrix_world.to_3x3().inverted().transposed()
  for tri in o.data.loop_triangles:
   for vi in tri.vertices:
    vert=o.data.vertices[vi];v=o.matrix_world@vert.co;n=(normal@vert.normal).normalized();part['positions'] += [round(v.x,5),round(v.z,5),round(-v.y,5)];part['normals'] += [round(n.x,5),round(n.z,5),round(-n.y,5)];q=vert.co.normalized();part['uvs'] += [round(math.atan2(q.y,q.x)/(2*math.pi)+.5,5),round(math.asin(max(-1,min(1,q.z)))/math.pi+.5,5)]
  if colliders:
   corners=[o.matrix_world@Vector(c) for c in o.bound_box];pts=[(v.x,v.z,-v.y) for v in corners];bounds.append({'min':[round(min(v[k] for v in pts),4) for k in range(3)],'max':[round(max(v[k] for v in pts),4) for k in range(3)]})
 data={'name':name,'generator':'Blender '+bpy.app.version_string,'meshes':list(merged.values())}
 if colliders:data['colliders']=bounds
 (OUT/(name+'.json')).write_text(json.dumps(data,separators=(',',':'))+'\n')
for index,(name,axes) in enumerate(profiles.items()):
 if name=='arrokoth':
  bpy.ops.object.select_all(action='DESELECT');parts=[]
  for radius,x in [(.64,-.42),(.5,.5)]:
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=radius,location=(x,0,0));parts.append(bpy.context.object)
  for part in parts:part.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 else:
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2 if name.startswith('belt-') else 3,radius=1);o=bpy.context.object
 o.name='small-'+name;rand=random.Random(107+index);phase=rand.random()*6.28
 for vert in o.data.vertices:
  v=vert.co;direction=v.normalized();r=1 if name=='haumea' else 1+.055*math.sin(v.x*5+phase)*math.cos(v.z*7-phase)+.035*math.sin(v.y*9+phase)
  if name=='phobos':r-=.22*math.exp(-((direction-Vector((.9,.2,.4)).normalized()).length/.42)**2)
  if name=='bennu' or name=='ryugu':r*=1+.14*(1-abs(v.z))
  v.x*=axes[0]*r;v.y*=axes[2]*r;v.z*=axes[1]*r
 if name=='arrokoth':
  for v in o.data.vertices:v.co.x*=1.1;v.co.y*=.72 if abs(v.co.x)<.23 else 1
 maxr=max(v.co.length for v in o.data.vertices)
 for v in o.data.vertices:v.co/=maxr
 o.data.materials.append(ice if name in ['haumea','hiiaka','namaka','arrokoth','varuna','ixion'] else rock)
 o.data.update();bpy.context.view_layer.update();export([o],'small-'+name)
 # Retain all independently editable models in a compact native collection.
 o.location=(index%7*3,index//7*3,0);o.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/small-bodies.blend'),compress=True)
# Each base uses its own Blender components; no UI or collision-only placeholder meshes.
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
base_materials={'white':material('White hull',(.83,.89,.91)),'steel':material('Steel',(.2,.27,.32)),'glass':material('Dark windows',(.07,.2,.28)),'blue':material('Blue trim',(.18,.51,.69)),'red':material('Mars red',(.65,.24,.17)),'gold':material('Thermal gold',(.72,.55,.24)),'ice':material('Polar blue',(.42,.65,.74)),'green':material('Garden green',(.24,.49,.32))}
def box(name,x,y,z,sx,sy,sz,color):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(base_materials[color]);return o
def dome(name,x,y,z,r,sy,color):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=r,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale.z=sy;o.data.materials.append(base_materials[color]);return o
for kind in ['lunar','mars','mining','venus','ice','garden']:
 for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
 trim={'lunar':'blue','mars':'red','mining':'gold','venus':'gold','ice':'ice','garden':'green'}[kind]
 box('Base platform',0,.35,0,32,.7,21,'steel');box('Entry step',0,.2,11.2,5,.4,2,'steel')
 if kind=='venus':
  for x in [-11,11]:
   for z in [-6,6]:box('Raised support',x,3,z,1.3,6,1.3,'steel')
  box('Raised deck',0,6,0,27,.6,17,'white');box('Thermal habitat',0,8.5,0,17,4.5,10,'white');box('Heat shield roof',0,11,0,22,.65,14,trim)
  for i in range(12):box('Access stair',0,.4+i*.5,13.75-i*.5,4,.6,1,'steel')
 elif kind=='mining':
  box('Operations',-6,2.6,-2,11,4.5,9,'white');box('Ore processing',7,2.7,-2,8,4.7,8,'steel');box('Gantery mast',11,6,4,1,11,1,trim);box('Gantry crossbeam',4,11.2,4,15,1,1,trim);box('Drill shaft',-2,5,4,.8,9,.8,'steel');box('Drill suspension',-2,10.2,4,.2,2,.2,'steel')
 elif kind=='mars':
  for x in [-7,7]:box('Pressurized module',x,2.6,-1,10,4.5,9,'white');box('Airlock trim',x,4.9,-1,10.4,.45,9.4,trim)
  box('Connecting tunnel',0,1.8,0,5,2.6,4,'steel');box('Rover shelter',0,2.2,7,10,3,4,trim)
 elif kind=='garden':
  dome('Greenhouse dome',-7,2.2,-1,6,.72,'glass');box('Habitat',7,2.4,-1,9,4,9,'white');box('Greenhouse rim',-7,1,-1,13,.6,12,trim);box('Airlock link',0,1.8,0,4,2.6,4,'white')
 elif kind=='ice':
  box('Insulated habitat',0,3,-1,18,5,10,'white');box('Thermal outer roof',0,5.8,-1,21,.6,12,trim)
  for x in [-12,12]:dome('Storage tank',x,2.4,-2,2.4,1,'steel')
 else:
  dome('Lunar habitation dome',-7,2,-1,5.5,.75,'white');box('Laboratory',7,2.5,-1,9,4.2,9,'white');box('Airlock connector',0,1.8,0,5,2.7,4,'steel')
 windows=[(-8,3.1,2.58),(-5,3.1,2.58),(5,3.1,2.08),(8,3.1,2.08)] if kind=='mining' else [(x,8.7,5.08) for x in [-6,-2,2,6]] if kind=='venus' else [(x,3.1,4.08) for x in [-6,-2,2,6]] if kind=='ice' else [(x,3.1,3.58) for x in ([-8,-5,5,8] if kind=='mars' else [5,8])]
 for x,y,z in windows:box('Front viewport',x,y,z,2.3,1.2,.15,'glass')
 for x in [-11,11]:
  for dx in [-2,2]:box('Solar support',x+dx,1,7,.18,.6,.18,'steel')
  box('Solar frame',x,1.4,7,7,.22,4,'steel');box('Solar panel',x,1.55,7,6.7,.08,3.7,'blue')
 box('Communications mast',13,5,-7,.25,9,.25,'steel');dome('Communications dish',13,9.4,-7,1.8,.3,trim)
 bpy.context.view_layer.update();export(list(bpy.data.objects),'base-'+kind,True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/('assets/blender/base-'+kind+'.blend')),compress=True)
print('WORLD_MODELS',len(profiles),'small bodies and 6 distinct bases')
