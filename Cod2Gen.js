// Makes maps for COD2

System.include("XML.js");
System.include("MapBuilder.js");
System.include("TerrainGen.js");

function Cod2Gen()
{
	var the = this;
	var scale = 1.0;
	var ww = 10;

	var spawn_types = {
		'camera':'mp_global_intermission',
		'dm':'mp_dm_spawn',
		'ctf_allied':'mp_ctf_spawn_allied',
		'ctf_axis':'mp_ctf_spawn_axis',
		'tdm':'mp_tdm_spawn'		
	};

	function Entity(pos, model, class_name, angles)
	{
		this.pos = pos;		
		this.model = model;
		this.class_name = class_name;
		this.angles = angles;
	}
	
	function entity_write(file, ent)
	{
		var entStr;

		entStr = '{\n' +			
			'"origin" "' + ent.pos.x + ' ' + ent.pos.y + ' ' + ent.pos.z + '"\n';
		
		if (ent.model) {
			entStr += '"model" "' + ent.model + '"\n';
		}
		
		if (ent.class_name) {
			entStr += '"classname" "' + ent.class_name + '"\n';
		}
		
		if (ent.angles) {
			entStr += '"angles" "' + ent.angles[0] + ' ' + ent.angles[1] + ' ' + ent.angles[2] + '"\n';
		}
		
		entStr += '}\n';		
		file.write(entStr);
	}
	
	function point3_write(file, p)
	{
	 	file.write(" ( " + Math.ceil(p.x) + " " + Math.ceil(p.y) + " " + Math.ceil(p.z) + " ) ");
	}

	function terrain_write(file, xml, tp)
	{
		var pts = tp.cells;
		var texture = tp.texture.attributes['txt'] || "caulk";
		var s = new Geom.Point3(tp.size.x / (tp.x_pts-1), tp.size.y / (tp.y_pts-1), tp.size.z);
		
		function place_in_range(val, highval, convert_low, convert_high) {
			return convert_low + (convert_high - convert_low) * (val / highval);
		}
		
		function bogus_texture_values(p)
		{
			var ret = { 'a':0, 'b':0, 'c':0, 'd': 0 };
			
			// These observations are values taken from a single example,
			// and I really have no clue what they represent, but they are
			// probably used for offsets and scaling of the texture
			//
			// increasing x
			// a = 0 - 1920
			// c = -15 - 15
			// 
			// increasing y
			// b = 0 - 2880
			// d = 21.5 - -23.5	
			//

			ret.a = place_in_range(p.x, tp.size.x, 0.0, 1920.0);
			ret.b = place_in_range(p.y, tp.size.y, 0.0, 2880.0);
			ret.c = place_in_range(p.x, tp.size.x, -15.0, 15.0);
			ret.d = place_in_range(p.y, tp.size.y, 21.5, -23.5);
			return ret;
		}
		
		function output_point(p) {
			var abcd;
			var z = p.z;
			if (z >= 10.0) z -= 10.0;
			abcd = bogus_texture_values(p);
			file.write("      v " + (p.x*s.x + tp.p_origin.x) +
				" " + (p.y*s.y + tp.p_origin.y) +
				" " +  (z*s.z + tp.p_origin.z) +
				" t " + abcd.a + " " + abcd.b + " " + abcd.c + " " +  abcd.d + "\n");
		}
		
		file.write(" {\n");
		file.write("  mesh\n");
		file.write("  {\n");
		file.write("   " + texture + "\n");
		file.write("   lightmap_gray\n");
				
		// I have no clue what the 16 and 2 are.
		file.write("   " + tp.x_pts + " " + tp.y_pts + " 16 2\n");

		var pt = new Geom.Point3(0,0,0);
		for (var i=0; i<tp.x_pts; i++) {
			file.write("   (\n");
			for (var j=0; j<tp.y_pts; j++) {
				pt.x = i;
				pt.y = j;
				pt.z = tp.pts[i][j];
				output_point(pt);
			}
			file.write("   )\n");
		}

		file.write("  }\n");
		file.write(" }\n");		
	}

	function plane_write(file, plane, txt_x_scale, txt_y_scale)	
	{
		var txt = plane.texture.attributes['txt'];
		var txt_x_scale = plane.texture.attributes['x_scale'];
		var txt_y_scale = plane.texture.attributes['y_scale'];
		point3_write(file, plane.p0);
		point3_write(file, plane.p1);
		point3_write(file, plane.p2);		
		file.write(txt + " " + txt_x_scale + " " + txt_y_scale + " 0 0 0 0 lightmap_gray 16384 16384 0 0 0 0\n");
	}

	function hh_write(file, hh)
	{
		var planes = [];
		var p;
		var pts = hh.points;

		// top
		p = new Geom.Plane(pts[7], pts[4], pts[5]);
		p.texture = hh.faceTextures.top || hh.texture;
		planes.push(p);

		// right
		p = new Geom.Plane(pts[3], pts[7], pts[6]);
		p.texture = hh.faceTextures.right || hh.texture;
		planes.push(p);

		// back
		p = new Geom.Plane(pts[6], pts[5], pts[1]);
		p.texture = hh.faceTextures.back || hh.texture;
		planes.push(p);

		// left
		p = new Geom.Plane(pts[5], pts[4], pts[0]);
		p.texture = hh.faceTextures.left || hh.texture;
		planes.push(p);

		// front
		p = new Geom.Plane(pts[4], pts[7], pts[3]);
		p.texture = hh.faceTextures.front || hh.texture;
		planes.push(p);

		// bottom
		p = new Geom.Plane(pts[0], pts[3], pts[2]);
		p.texture = hh.faceTextures.bottom || hh.texture;
		planes.push(p);

		file.write("{\n");
		for (var i in planes) {
			plane_write(file, planes[i]);
		}
		file.write("}\n");
	}

	function map_start(mapFile, xml)
	{
		mapFile.write('iwmap 4\n' +
		              '// entity 0\n' +
		              '{\n' +
		              '"_color" "0.95 0.95 1.000000"\n' +
		              '"sundirection" "-35 195 0"\n' +
		              '"suncolor" "0.99 0.98 0.86"\n' +
		              '"sunlight" "1.6"\n' +
		              '"ambient" ".20"\n' +
		              '"sundiffusecolor" "0.94 0.94 1.000000"\n' +
		              '"diffusefraction" ".55"\n' +
		              '"northyaw" "90"\n' +
		              '"classname" "worldspawn"\n');
	}

	function map_write(files, xml, map, maponly)
	{

		map_start(files.map, xml);

		for (var i in map.shapes) {
			var s = map.shapes[i];						
			switch (s.type) {
			case Geom.shapeTypes.hexahedron:
				hh_write(files.map, s);
				break;
			default:
				System.out.write(s.type);
			}
		}				

		for (var i in map.terrainPatches) {
			var tp = map.terrainPatches[i];
			terrain_write(files.map, xml, tp);
		}
		
		files.map.write('}\n');
					
		// handle entities
		
		// intermission camera
		var mp = Geom.Point3.midpoint([map.extents.p1, map.extents.p2]);
		mp.x = map.extents.p1.x + 500;
		var cam = new Entity(mp, null, spawn_types.camera, [ 15, 0, 0 ] );
		entity_write(files.map, cam);
		
		var hq = [];
		
		for (var i in map.objects) {
			var ob = map.objects[i];
			var ent = null;
			if (ob.type == MapBuilder.objectTypes.flag) {
				var flag = (ob.team == 1)? "ctf_flag_allies.map":"ctf_flag_axis.map";
				ent = new Entity(ob.pos, 'prefabs/mp/' + flag, 'misc_prefab');
				entity_write(files.map, ent);
			} else if (ob.type == MapBuilder.objectTypes.spawn) {				
				var sp = (ob.team == 1)? spawn_types.ctf_allied : spawn_types.ctf_axis;
				var pos = Geom.Point3.addXYZ(ob.pos, 0, 0, 20);
				var angles = [];

				angles[0] = 0;
				if (ob.team == 1) {
					angles[1] = 180;
				} else {
					angles[1] = 0;
				}				
				angles[2] = 0;
				
				ent = new Entity(pos, null, sp, angles);
				entity_write(files.map, ent);
				
				var ent2 = new Entity(pos, null, spawn_types.tdm, angles);				
				entity_write(files.map, ent2);
				
				var ent3 = new Entity(pos, null, spawn_types.dm, angles);
				entity_write(files.map, ent3);
				
				// we'll put an hq at every possible spawn point
				hq.push(pos);						
			}			
		}
		
		// skip arena and gsc files if "maponly"
		if (maponly) {
			return;	
		}
		
		// arena file
		files.arena.write(
		'{\n' +
		'  map "' + files.basename + '"\n' +
		'  longname "' + files.basename + '"\n' +
		'  gametype "ctf tdm dm hq"\n' +
		'}');
		
		// gsc file		
		var hq_text = '  if((getcvar("g_gametype") == "hq"))\n' +
						'  {\n'+
						'    level.radio = [];\n';
		for (var i=0; i<hq.length; i++) {
			hq_text += '    level.radio[' + i + '] = spawn("script_model", (' + hq[i].x + ', ' + hq[i].y + ', ' + hq[i].z + '));\n';
		}
		hq_text += '  }\n';		
		
		files.gsc.write(
		'main()\n' +
		'{\n' +
		'  maps\\mp\\_load::main();\n' +
		'\n' +
		'  ambientPlay("ambient_russia");\n' +
		'\n' +
		'  game["allies"] = "american";\n' +
		'  game["axis"] = "german";\n' +
		'  game["attackers"] = "allies";\n' +
		'  game["defenders"] = "axis";\n' +
		'  game["german_soldiertype"] = "normandy";\n' +
		'\n' +
		'  setcvar("r_glowbloomintensity0",".25");\n' +
		'  setcvar("r_glowbloomintensity1",".25");\n' +
		'  setcvar("r_glowskybleedintensity0",".3");\n' +
		hq_text +
		'}');
	}

	the.create = function(xmlfilename, mapname, maponly)
	{
		if (!xmlfilename) {
			throw "Error - must provide XML config file.";			
		}
		if (!mapname) {
			throw "Error - must provide map basename, eg: mp_whatever";			
		}
		
		var xml = XML.parseFile(xmlfilename);
		if (!xml) {
			throw "Error parsing xml";
		}
		
		var files = {};
		
		files.basename = mapname;
		
		files.map = System.openFile(mapname + ".map", "w");
		if (!files.map) {
			throw "Unable to open map file";
		}
		
		files.arena = System.openFile(mapname + ".arena", "w");
		if (!files.arena) {
			throw "Unable to open arena file";
		}
		
		files.gsc = System.openFile(mapname + ".gsc", "w");
		if (!files.gsc) {
			throw "Unable to open gsc file";
		}

		var map = new MapBuilder.Map(xml);

		map_write(files, xml, map, maponly);

		System.out.write("Map stats\n");		
		System.out.write("  Rooms: " + map.stats.totalRooms + "\n");
		System.out.write("  Rooms underground: " + map.stats.roomsBelowGround + "\n");
		System.out.write("  Rooms on ground: " + map.stats.roomsOnGround + "\n");
		System.out.write("  Rooms above ground: " + map.stats.roomsAboveGround + "\n");
		System.out.write("  Supports: " + map.stats.supports + "\n");
		System.out.write("  Exits: " + map.stats.exits + "\n");
		System.out.write("  Exits on ground floor: " + map.stats.exitsGroundFloor + "\n");
		System.out.write("  Ramps: " + map.stats.ramps + "\n");


		files.map.close();
		files.arena.close();
		files.gsc.close();
	}

	the.main = function(xmlfilename, mapname, maponly)
	{
		if (!xmlfilename) {
			System.out.write("Error - must provide XML config file.\n\n");
			return;
		}
		if (!mapname) {
			System.out.write("Error - must provide map basename, eg: mp_whatever\n\n");
			return;
		}
				
		the.create(xmlfilename, mapname, maponly);
	}
}
