import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=.1,rough=.45):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m['webColor']='#'+''.join(f'{int(x*255):02x}' for x in color);m['metal']=metal;m['rough']=rough;return m
white=material('Ceramic white',(.89,.94,.98));red=material('Launch orange',(.93,.25,.08));blue=material('Sky blue trim',(.08,.62,.9),.3);dark=material('Graphite',(.055,.11,.17),.3);glass=material('Cockpit glass',(.08,.25,.36),.6,.15);steel=material('Polished pick steel',(.66,.84,.91),.7,.25);wood=material('Ash wood',(.42,.25,.12),0,.8);gold=material('Warm brass',(.88,.64,.23),.5);crystal=material('Resource tint',(.35,.79,.94),.2,.4)
def bp(p):return (p[0],-p[2],p[1])
def finish(obj,name,mat,col):
 obj.name=name;obj.data.materials.append(mat)
 for c in list(obj.users_collection):c.objects.unlink(obj)
 col.objects.link(obj);return obj
def box(name,p,d,mat,col,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=bp(p));o=bpy.context.object;o.scale=(d[0],d[2],d[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  m=o.modifiers.new('Soft edges','BEVEL');m.width=bevel;m.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return finish(o,name,mat,col)
def cylinder(name,p,r,depth,mat,col,axis='y',r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=bp(p));o=bpy.context.object
 if axis=='-z':o.rotation_euler.x=-math.pi/2
 if axis=='z':o.rotation_euler.x=math.pi/2
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,mat,col)
def sphere(name,p,scale,mat,col):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=bp(p));o=bpy.context.object;o.scale=(scale[0],scale[2],scale[1])
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,mat,col)
def mesh(name,vertices,faces,mat,col):
 data=bpy.data.meshes.new(name);data.from_pydata([bp(p) for p in vertices],[],faces);data.update();o=bpy.data.objects.new(name,data);col.objects.link(o);data.materials.append(mat);return o
def collection(name):c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
rocket=collection('rocket')
cylinder('White hull',(0,0,-.3),.66,3,white,rocket,'z')
cylinder('Orange nose',(0,0,-2.5),.68,1.5,red,rocket,'-z',.035)
cylinder('Brass collar',(0,0,-1.72),.69,.12,gold,rocket,'z')
cylinder('Tail band',(0,0,1.02),.7,.28,red,rocket,'z')
cylinder('Engine bell',(0,0,1.36),.48,.4,dark,rocket,'z',.36)
sphere('Blue cockpit',(0,.61,-.64),(.38,.16,.61),glass,rocket)
for side in [-1,1]:
 box('Side stripe',(side*.65,0,-.5),(.025,.18,1.8),blue,rocket,.012)
for i in range(4):
 a=i*math.pi/2
 points=[(.57,-.15),(.61,.95),(1.38,1.2),(1.48,.85),(.8,-.3)]
 verts=[]
 for t in [-.065,.065]:
  for r,z in points:verts.append((math.cos(a)*r-math.sin(a)*t,math.sin(a)*r+math.cos(a)*t,z))
 faces=[(0,1,2,3,4),(9,8,7,6,5)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)]
 mesh('Swept fin',verts,faces,red,rocket)
 box('Landing foot',(math.cos(a)*1.22,math.sin(a)*1.22,1.28),(.22,.22,.12),white,rocket,.025)
pick=collection('pickaxe');cylinder('Wood shaft',(0,-.05,0),.028,.87,wood,pick)
for y in [-.29,-.22,-.15]:cylinder('Grip band',(0,y,0),.035,.035,dark,pick)
poly=[(-.43,.24),(-.31,.39),(-.12,.44),(.12,.44),(.32,.36),(.45,.21),(.26,.3),(.1,.34),(-.13,.34),(-.29,.31)]
v=[(x,y,z) for z in [-.05,.05] for x,y in poly];n=len(poly)
mesh('Forged curved head',v,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],steel,pick)
cylinder('Head socket',(0,.34,0),.065,.18,blue,pick)
ore=collection('mineral')
for i,(px,pz,r,h) in enumerate([(0,0,.24,1),(.28,.12,.16,.65),(-.25,.13,.15,.55),(0,-.22,.14,.7)]):
 verts=[(px+math.cos(j*math.tau/5)*r,-.35,pz+math.sin(j*math.tau/5)*r) for j in range(5)]+[(px+math.cos(j*math.tau/5)*r*.85,h-.6,pz+math.sin(j*math.tau/5)*r*.85) for j in range(5)]+[(px+.04,h-.35,pz)]
 faces=[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)]+[(5+j,5+(j+1)%5,10) for j in range(5)]+[(4,3,2,1,0)]
 mesh('Crystal cluster '+str(i),verts,faces,crystal,ore)
trade=collection('trading-hall')
box('Main hall',(0,2.6,0),(12,5.2,8),white,trade,.15)
box('Roof fascia',(0,5.2,0),(12.5,.4,8.5),blue,trade,.12)
box('Roof inset',(0,5.5,0),(10,.25,6),dark,trade,.1)
box('Shop window',(0,2.6,4.05),(9.5,2.3,.12),glass,trade)
box('Counter',(0,1.1,4.4),(10,.45,1.2),blue,trade)
for side in [-1,1]:box('Pillar',(side*5.25,2.5,4.1),(.6,5,.7),dark,trade)
for i in range(3):box('Cargo crate',(-3+i*3,1.75,4.4),(1.1,.9,.75),[red,gold,blue][i],trade,.09)
box('Sign panel',(0,4.55,4.25),(6.8,.8,.18),dark,trade)
# Compact, explicit triangle data keeps the web build independent of third-party loaders.
# Repair winding in the Blender source before exporting closed components.
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
deps=bpy.context.evaluated_depsgraph_get()
for col in [rocket,pick,ore,trade]:
 out={'generator':'Blender '+bpy.app.version_string,'name':col.name,'meshes':[]}
 for obj in col.objects:
  if obj.type!='MESH':continue
  eo=obj.evaluated_get(deps);data=eo.to_mesh();data.calc_loop_triangles();positions=[];normals=[];matrix=eo.matrix_world;nm=matrix.to_3x3().inverted().transposed()
  for tri in data.loop_triangles:
   for li in tri.loops:
    loop=data.loops[li];p=matrix@data.vertices[loop.vertex_index].co;n=(nm@loop.normal).normalized()
    positions.extend([round(p.x,5),round(p.z,5),round(-p.y,5)]);normals.extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
  mat=obj.data.materials[0];out['meshes'].append({'name':obj.name,'positions':positions,'normals':normals,'color':mat['webColor'],'metalness':mat['metal'],'roughness':mat['rough']});eo.to_mesh_clear()
 (ROOT/'public/models'/f'{col.name}.json').write_text(json.dumps(out,separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/zero_gravity_models.blend'))
print('EXPORTED',[(c.name,len(c.objects)) for c in [rocket,pick,ore,trade]])
# A matching inventory thumbnail, rendered from the actual pickaxe mesh.
for col in [rocket,ore,trade]:col.hide_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.film_transparent=True
scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(1.8,-3,1.2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.25;scene.camera=cam
for pos,energy,size in [((2,-3,4),500,3),((-2,-1,1),180,2)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.3,.3,.3);scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'public/models/pickaxe-icon.png');bpy.ops.render.render(write_still=True)
