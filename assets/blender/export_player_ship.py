"""Run: blender -b --disable-autoexec assets/blender/TZG_Player_Ship.blend --python assets/blender/export_player_ship.py"""
import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'
TEXTURES=OUT/'player-ship-textures'
TEXTURES.mkdir(exist_ok=True)
# Blender -Y nose / +Z up -> game -Z nose / +Y up. Preserve handedness.
# Lowest hull face rests at the game's existing 1.39m contact height.
def vec(v):return [-v.x,v.z-1.61,v.y]
def norm(v):return [-v.x,v.z,v.y]
def color(c):
 def srgb(x):return 12.92*x if x<=.0031308 else 1.055*x**(1/2.4)-.055
 return '#'+''.join(f'{round(max(0,min(1,srgb(x)))*255):02x}' for x in c[:3])
def image_for(socket):
 if socket and socket.is_linked:
  n=socket.links[0].from_node
  if n.type=='TEX_IMAGE' and n.image:
   filename=n.image.name.replace(' ','_')
   if n.image.packed_file:(TEXTURES/filename).write_bytes(n.image.packed_file.data)
   else:n.image.save_render(str(TEXTURES/filename))
   return './models/player-ship-textures/'+filename
 return None
materials={}
for m in bpy.data.materials:
 node=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m.node_tree else None
 if not node:continue
 get=lambda key,default:node.inputs[key].default_value if key in node.inputs else default
 texture=image_for(node.inputs.get('Base Color'))
 emission_map=image_for(node.inputs.get('Emission Color'))
 glass='tinted glass' in m.name
 materials[m.name]={'fallbackColor':color(m.diffuse_color),'color':'#ffffff' if texture else color(get('Base Color',m.diffuse_color)),'metalness':float(get('Metallic',0)),'roughness':float(get('Roughness',.5)),'emissive':('#ffffff' if emission_map else color(get('Emission Color',(0,0,0,1)))),'emissiveIntensity':float(get('Emission Strength',0)),'opacity':.32 if glass else 1,'doubleSide':glass or any(x in m.name for x in ['Canopy','Display']),'map':texture,'emissiveMap':emission_map}
# Batch by material for mobile while retaining the source part names/ranges.
out={'generator':'Blender '+bpy.app.version_string,'name':'TZG Player Ship','source':'TZG_Player_Ship.blend','cockpit':[0,.29,-.12],'engineSockets':[[-.7,-.58,4.17],[.7,-.58,4.17]],'meshes':[]}
batches={};deps=bpy.context.evaluated_depsgraph_get()
for obj in sorted(bpy.data.objects,key=lambda o:o.name):
 if obj.type!='MESH' or obj.hide_render:continue
 if hasattr(obj.data,'use_auto_smooth'):obj.data.use_auto_smooth=True
 evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();matrix=evaluated.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
 ranges={}
 for tri in mesh.loop_triangles:
  mat=obj.data.materials[min(tri.material_index,len(obj.data.materials)-1)]
  key=mat.name;batch=batches.setdefault(key,{'name':key,**materials[key],'positions':[],'normals':[],'uvs':[],'sourceParts':[]})
  ranges.setdefault(key,[len(batch['positions'])//3,0])
  for li in tri.loops:
   loop=mesh.loops[li];p=matrix@mesh.vertices[loop.vertex_index].co;n=(normal_matrix@loop.normal).normalized()
   batch['positions'].extend(round(v,5) for v in vec(p));batch['normals'].extend(round(v,5) for v in norm(n));uv=mesh.uv_layers.active.data[li].uv if mesh.uv_layers.active else (0,0);batch['uvs'].extend(round(v,6) for v in uv);ranges[key][1]+=1
 for key,(start,count) in ranges.items():batches[key]['sourceParts'].append({'name':obj.name,'start':start,'count':count})
 evaluated.to_mesh_clear()
out['meshes']=list(batches.values());(OUT/'player-ship.json').write_text(json.dumps(out,separators=(',',':')))
print('EXPORTED',len(out['meshes']),'material batches',sum(len(m['positions'])//9 for m in out['meshes']),'triangles')
