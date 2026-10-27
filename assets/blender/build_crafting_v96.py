import bpy,bmesh,math,json
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.66;m['webColor']='#'+''.join('%02x'%int(c*255) for c in color);return m
white=mat('Warm white',(.82,.9,.94));blue=mat('Light blue',(.12,.53,.79));navy=mat('Navy steel',(.055,.14,.22));red=mat('Red accents',(.85,.22,.17));wood=mat('Workbench wood',(.47,.29,.14));glass=mat('Blue glass',(.18,.37,.48));gold=mat('Tool brass',(.93,.65,.16))
def box(name,p,size,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(p[0],-p[2],p[1]));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:mod=o.modifiers.new('Soft corners','BEVEL');mod.width=bevel;mod.segments=1
 return o
# Compact workshop fits the existing 12 x 8 m base/collision footprint.
box('Foundation',(0,.12,0),(12,.24,8),navy,.08)
box('Workshop body',(0,2.1,-.4),(11.6,4.1,6.9),white,.12)
box('Roof fascia',(0,4.4,-.2),(12.6,.45,8.4),blue,.1)
box('Roof cap',(0,4.7,-.5),(10.6,.22,6.1),navy,.08)
for x in [-5.4,5.4]:
 box('Front pillar',(x,2,3.5),(.5,4,.45),blue,.05)
 box('Side window',(x*1.077,2.6,-.4),(.08,1.65,3.6),glass)
 for z in [-2.1,1.3]:box('Window frame',(x*1.085,2.6,z),(.1,1.85,.12),navy)
box('Counter plinth',(0,.75,3.3),(8.8,1.3,1.15),blue,.08)
box('Workbench countertop',(0,1.47,3.5),(9.3,.24,1.8),wood,.08)
box('Tool display recess',(0,2.65,3.08),(8.5,1.85,.12),navy)
# Keep the workshop front clear of decorative tool displays.
for x in [-3.55,3.55]:
 box('Storage cabinet',(x,2.2,3.32),(1.25,1.25,.5),blue,.05)
 box('Cabinet handle',(x,2.2,3.61),(.35,.09,.06),white)
box('Crafting sign backing',(0,4,3.88),(7.6,.82,.14),navy,.06)
bpy.ops.object.text_add(location=(0,-3.98,3.87),rotation=(math.pi/2,0,0));t=bpy.context.object;t.name='CRAFTING title';t.data.body='CRAFTING';t.data.align_x='CENTER';t.data.size=.56;t.data.extrude=.001;t.data.resolution_u=2
try:t.data.font=bpy.data.fonts.load(str(ROOT/'public/fonts/Fredoka-0.ttf'))
except:pass
t.data.materials.append(white);bpy.ops.object.convert(target='MESH')
for x in [-5,5]:box('Red corner trim',(x,4.43,4.04),(.8,.18,.12),red,.02)
# Triangles are merged per material to keep draw calls bounded.
deps=bpy.context.evaluated_depsgraph_get();merged={}
for obj in list(bpy.data.objects):
 if obj.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
 eo=obj.evaluated_get(deps);data=eo.to_mesh();data.calc_loop_triangles();nm=eo.matrix_world.to_3x3().inverted().transposed();m=obj.data.materials[0];p=merged.setdefault(m.name,{'name':m.name,'positions':[],'normals':[],'color':m['webColor'],'metalness':.08,'roughness':.7})
 for tri in data.loop_triangles:
  for li in tri.loops:
   loop=data.loops[li];v=eo.matrix_world@data.vertices[loop.vertex_index].co;n=(nm@loop.normal).normalized();p['positions'] += [round(v.x,5),round(v.z,5),round(-v.y,5)];p['normals'] += [round(n.x,5),round(n.z,5),round(-n.y,5)]
 eo.to_mesh_clear()
model={'name':'Crafting Center','generator':'Blender '+bpy.app.version_string,'meshes':list(merged.values())};(ROOT/'public/models/crafting-center-v96.json').write_text(json.dumps(model,separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/crafting-center-v96.blend'))
def scene_setup(target,scale):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=3;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.film_transparent=False;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.09,.15,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7;scene.view_settings.view_transform='Standard';bpy.ops.object.camera_add(location=target+Vector((12,-18,11)));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;scene.camera=cam
 for pos,energy,size in [((4,-8,14),1800,9),((-7,-2,5),1000,7)]:
  bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=energy;l.data.size=size;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 scene.render.image_settings.file_format='PNG';return scene
scene=scene_setup(Vector((0,0,2.2)),18);scene.render.filepath=str(ROOT/'docs/crafting-center-v96.png');bpy.ops.render.render(write_still=True)
# Game/app icon rendered from the existing Blender rocket source export.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
rocket=json.loads((ROOT/'public/models/rocket.json').read_text());points=[]
for part in rocket['meshes']:
 ps=part['positions'];vertices=[(ps[i],-ps[i+2],ps[i+1]) for i in range(0,len(ps),3)];mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata(vertices,[],[tuple(range(i,i+3)) for i in range(0,len(vertices),3)]);o=bpy.data.objects.new(part['name'],mesh);bpy.context.collection.objects.link(o);o.rotation_euler[0]=math.pi/2;c=part['color'].lstrip('#');m=mat(part['name'],(.84,.2,.17) if 'Orange' in part['name'] else tuple(int(c[i:i+2],16)/255 for i in [0,2,4]));o.data.materials.append(m)
bpy.context.view_layer.update();corners=[o.matrix_world@Vector(c) for o in bpy.context.scene.objects if o.type=='MESH' for c in o.bound_box];lo=Vector(tuple(min(p[i] for p in corners) for i in range(3)));hi=Vector(tuple(max(p[i] for p in corners) for i in range(3)));target=(lo+hi)/2;scene=scene_setup(target,max(hi-lo)*1.35);scene.world.color=(.07,.2,.32);scene.render.filepath=str(ROOT/'public/images/game-icon-v96.png');bpy.ops.render.render(write_still=True)
print('CRAFTING',len(model['meshes']),'batches',sum(len(m['positions'])//9 for m in model['meshes']),'triangles')
