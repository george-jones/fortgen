System.include("Geom.js");
System.include("FortGen.js");
System.include("XML.js");
System.include("Util.js");
System.include("Rand.js");

function MapBuilder()
{
	var the = this;

	the.textureTypes = {
		ground:1, // no zero allowed
		exteriorwall:2,
		interiorwall:3,
		stair:4,
		walkway:5,
		caulk:6,
		floor:7,
		ceiling:8,
		support:9,
		gate:10,
		sky:11
	};
	var textureTypes = the.textureTypes; // shorthand to avoid the.textureTypes
	
	the.objectTypes = {
		flag:1,
		spawn:2
	};
	var objectTypes = the.objectTypes; // shorthand to avoid the.objectTypes

	the.TerrainPatch = function(p_origin, x_pts, y_pts, size, texture)
	{
		var that = this;
		that.p_origin = p_origin;		
		that.texture = texture;
		that.size = size;
		that.x_pts = x_pts;
		that.y_pts = y_pts;
		that.pts = TerrainGen.zeroGrid(x_pts, y_pts);		
	}
	
	the.OpenArea = function(p1, p2, team)
	{
		var that = this;
		this.p1 = p1;
		this.p2 = p2;
		this.team = team;	
	}
	
	function getTextureGroup(xml, tt)
	{			
		var txt = "";
		var k = Util.keyFromValue(MapBuilder.textureTypes, tt);
		var txtnode = xml.getChildNamed("textures");		
		if (!txtnode) {
			return null;
		}
		
		var g = txtnode.children;
		var possible = [];
		for (var i in g) {
			if (g[i].attributes['id'] == k) {
				var c = g[i].children;
				for (var j in c) {					
					possible.push(c[j]);				
				}
			}
		}
		
		if (possible.length == 0) {
			return null;
		}
		
		return Rand.pick(possible);
	}	
	
	function getTexture(shape)
	{
		var team = shape.team;
		function tg_to_txt(tg)
		{			
			var ch = tg.children;
			var txt;
			for (var i in ch) {
				if (ch[i].attributes['team'] == team) {
					txt = ch[i];
				}
			}
			if (!txt) {
				txt = ch[0]; // just grab the first one
			}
			return txt;			
		}
		
		if (shape.textureGroup) {
			shape.texture = tg_to_txt(shape.textureGroup);
		}
		
		shape.faceTextures = {};
		if (shape.faceTextureGroups) {			
			for (var k in shape.faceTextureGroups) {
				shape.faceTextures[k] = tg_to_txt(shape.faceTextureGroups[k]);
			}
		}
	}

	the.Wall = function(p1, p2, w, h, tg_int, tg_ext, side)
	{
		var that = this;
		var holes = [];
		var dist = Geom.Point3.dist(p2, p1);
		var len = 0;		
		
		that.dist = dist;
		that.w = w;
		that.h = h;

		that.addHole = function(w1, h1, w2, h2, holeType)
		{
			var h = {'w1': w1, 'h1': h1, 'w2': w2, 'h2': h2, 'type': holeType};
			holes.push(h);
		}
		
		that.getShapes = function()
		{
			var shapes = [];
			var norm = Geom.Point3.sub(p2, p1);
			len = Geom.Point3.magnitude(norm);
			norm = Geom.Point3.unitize(norm);

			// gather all w and h into groups configured to hold unique items.
			var wg = new Util.Group(true);
			var hg = new Util.Group(true);
			wg.addItem(0);
			wg.addItem(len);
			hg.addItem(0);
			hg.addItem(h);
			
			for (var i=0; i<holes.length; i++) {
				wg.addItem(holes[i].w1);
				wg.addItem(holes[i].w2);
				hg.addItem(holes[i].h1);
				hg.addItem(holes[i].h2);
			}			

			var numeric_sort = function(a,b) { return a-b; };
			var w_coords = wg.getItems().sort(numeric_sort);
			var h_coords = hg.getItems().sort(numeric_sort);
			
			// organize into a grid of single-cell groups
			var grid = [];
			var wc;
			var hc;			
			for (var i=0; i<w_coords.length-1; i++) {
				wc = (w_coords[i] + w_coords[i+1]) / 2;
				grid[i] = [];
				for (var j=0; j<h_coords.length-1; j++) {
					var in_hole = false;
					hc = (h_coords[j] + h_coords[j+1]) / 2;
					for (var k=0; k<holes.length && !in_hole; k++) {
						var hole = holes[k];
						if (hole.w1 < wc && hole.h1 < hc && hole.w2 > wc && hole.h2 > hc) {
							in_hole = hole;
						}
					}										
					grid[i][j] = { 'hole':in_hole, 'i1':i, 'j1':j, 'i2':i+1, 'j2':j+1 };					
				}
			}
			
			// merge the groups where possible... 			
			// smear up			
			for (var i=0; i<grid.length; i++) {
				var prev = false;
				var gridi = grid[i];
				for (var j=0; j<gridi.length; j++) {
					var cell = gridi[j];
					if (!prev || prev.hole != cell.hole) {
						prev = cell;
					} else {
						prev.j2 = j+1; // this is the smearing
						gridi[j] = null;
					}
				}
			}			
						
			for (var i=0; i<grid.length; i++) {
				var gridi = grid[i];
				for (var j=0; j<gridi.length; j++) {					
					var cell = gridi[j];
					if (cell) {
						var w1 = w_coords[cell.i1];
						var w2 = w_coords[cell.i2];
						var h1 = h_coords[cell.j1];
						var h2 = h_coords[cell.j2];
						
						///// TODO - support for real doors and windows, not just empty spaces
						if (!cell.hole) {
							var low_v = Geom.Point3.addXYZ(Geom.Point3.add(p1, Geom.Point3.scale(norm, w1)), 0, 0, h1);
							var high_v = Geom.Point3.addXYZ(Geom.Point3.add(p1, Geom.Point3.scale(norm, w2)), 0, 0, h1);							
							var wh = h2-h1;
							var hh = Geom.box(low_v, high_v, w, wh);
							
							if (side == the.Wall.side.interior) {
								hh.textureGroup = tg_int;
							} else {
								hh.textureGroup = tg_ext;
								hh.faceTextureGroups = {};
								hh.faceTextureGroups[Util.keyFromValue(the.Wall.side, side)] = tg_int;
								hh.faceTextureGroups.top = tg_int;
								hh.faceTextureGroups.bottom = tg_int;
							}
							
							shapes.push(hh);
						}
					}
				}
			}
			
			return shapes;
		}
	}
	
	the.Wall.holeTypes = { window:0, door:1 };
	the.Wall.side = { interior:0, left:1, right:2, front:3, back: 4 };

	function YourBasicRoom(room, xml, unit_size, pt, map)
	{
		var ret = { shapes: [], objects: [] };
		var wallwidth = 10;
		var ww = 10;		
		var door_width = 60; // should come from xml
		var door_height = 105; // should come from xml
		var door_node = xml.getChildNamed("door");		
		var outer_tg = getTextureGroup(xml, textureTypes.exteriorwall);
		var inner_tg = getTextureGroup(xml, textureTypes.interiorwall);
		var floor_tg = getTextureGroup(xml, textureTypes.floor);
		var ceiling_tg = getTextureGroup(xml, textureTypes.ceiling);
		var caulk_tg = getTextureGroup(xml, textureTypes.caulk);
		var stair_tg = getTextureGroup(xml, textureTypes.stair);
		var walkway_tg = getTextureGroup(xml, textureTypes.walkway);		
				
		if (door_node) {
			door_width = xml_node_get_int(door_node, 'width');
			door_height = xml_node_get_int(door_node, 'height');
		}
		
		if (room.dirtPlane) {
			ww = 0;	
		}
				
		function grid_pt_to_real_pt(point, wallwidth)
		{
			return Geom.Point3.addXYZ(pt,
				point.x * unit_size.x + ww/2,
				point.y * unit_size.y + ww/2,
				(point.z-1) * unit_size.z);
		}
										
		var p1 = grid_pt_to_real_pt(room.p1);
		var p2 = grid_pt_to_real_pt(Geom.Point3.addXYZ(room.p2, 1, 1, 1));
		
		// get dimensions
		var w = unit_size.x * (1 + room.p2.x - room.p1.x) - ww;
		var l = unit_size.y * (1 + room.p2.y - room.p1.y) - ww;
		var h = unit_size.z * (1 + room.p2.z - room.p1.z) - ww;
		
		function fillingPlane(z, thickness, tg, ftg, del)
		{
			var pt1 = Geom.Point3.addXYZ(p1, del, l/2, z);
			var pt2 = Geom.Point3.addXYZ(p1, w-del, l/2, z);
			var box = Geom.box(pt1, pt2, l-2*del, thickness);
			if (tg) box.textureGroup = tg;
			if (ftg) box.faceTextureGroups = ftg;
			
			ret.shapes.push(box);
		}		
		
		if (room.dirtPlane) {
			fillingPlane(-1, 1, the.ground_tg, { 'bottom': the.caulk_tg }, 0);
			return ret;
		}
				
		var pts = [];

		// operating off the the "bottom" z coordinate.
		pts[0] = Geom.Point3.addXYZ(p1, 0, 0, 0);
		pts[1] = Geom.Point3.addXYZ(p1, 0, l, 0);
		pts[2] = Geom.Point3.addXYZ(p1, w, l, 0);
		pts[3] = Geom.Point3.addXYZ(p1, w, 0, 0);
				
		var walls = [];
		
		walls[0] = new the.Wall(Geom.Point3.addXYZ(pts[0], ww/2, 0, 0), Geom.Point3.addXYZ(pts[3], -1*ww/2, 0, 0), ww, h, inner_tg, outer_tg, the.Wall.side.left);
		walls[1] = new the.Wall(Geom.Point3.addXYZ(pts[0], 0, -1*ww/2, 0), Geom.Point3.addXYZ(pts[1], 0, ww/2, 0), ww, h, inner_tg, outer_tg,  the.Wall.side.right);
		walls[2] = new the.Wall(Geom.Point3.addXYZ(pts[1], ww/2, 0, 0), Geom.Point3.addXYZ(pts[2], -1*ww/2, 0, 0), ww, h, inner_tg, outer_tg,  the.Wall.side.right);
		walls[3] = new the.Wall(Geom.Point3.addXYZ(pts[3], 0, -1*ww/2, 0), Geom.Point3.addXYZ(pts[2], 0, ww/2, 0), ww, h, inner_tg, outer_tg,  the.Wall.side.left);	
						
		var doors = [];
		for (var i in room.connections) {			
			var dp = room.connections[i].path[1];
			doors.push({'pt': dp, 'mainEntrance': false});
		}
		
		if (room.exit) {
			doors.push({'pt': room.exit[1], 'mainEntrance': true});	
		}
		
		var walls_w_doors = [];
		for (var i=0; i<walls.length; i++) {
			walls_w_doors[i] = [ false, false ];
		}		 

		var window_width = 40;
		var window_height = 40;
		var window_z = 30;
		var window_p = 0.45;
		var win_node = xml.getChildNamed("window");
		if (win_node) {
			window_width = xml_node_get_int(win_node, 'width');
			window_height = xml_node_get_int(win_node, 'height');
			window_z = xml_node_get_int(win_node, 'z');
			window_p = xml_node_get_float(win_node, 'p');
		}
						
		// add doorways
		for (var i in doors) {
			var dp = doors[i].pt;
			var tpt = grid_pt_to_real_pt(dp);
			var hole_start;
			var hole_end;
			var wall;
			var off = 0;
			
			if (room.p1.y > dp.y) {
				wall = walls[0];
				hole_start = tpt.x - p1.x + unit_size.x/2 - door_width/2;
				if (room.p1.z == dp.z) {
					walls_w_doors[0][0] = true;
				} else {
					walls_w_doors[0][1] = true;
				}
			} else if (room.p1.x > dp.x) {
				wall = walls[1];
				hole_start = tpt.y - p1.y + unit_size.y/2 - door_width/2;
				if (room.p1.z == dp.z) {
					walls_w_doors[1][0] = true;
				} else {
					walls_w_doors[1][1] = true;
				}
			} else if (room.p2.y < dp.y) {
				wall = walls[2];
				hole_start = tpt.x - p1.x + unit_size.x/2 - door_width/2;				
				if (room.p1.z == dp.z) {
					walls_w_doors[2][0] = true;
				} else {
					walls_w_doors[2][1] = true;
				}				
			} else if (room.p2.x < dp.x) {
				wall = walls[3];
				hole_start = tpt.y - p1.y + unit_size.y/2 - door_width/2;
				if (room.p1.z == dp.z) {
					walls_w_doors[3][0] = true;
				} else {
					walls_w_doors[3][1] = true;
				}
			} else {
				// I'm confused
				System.out.write("Bogus room connection.\n");				
			}
			hole_end = hole_start + door_width;			
			
			if (wall) {
				var dh;
				var z = 0;
				if (dp.z > room.p1.z) {
					z = unit_size.z;	
				}
				
				var max_h = unit_size.z-ww;
				dh = Math.min(door_height, max_h);
				
				// a hole for the door
				wall.addHole(hole_start, z, hole_end, z+dh, the.Wall.holeTypes.door);
				
				// maybe 1 or 2 holes for windows beside the door
				if (hole_start-window_width > 10 && Rand.prob(window_p)) {
					wall.addHole(hole_start-window_width-10, z+window_z, hole_start-10, z+window_z+window_height, the.Wall.holeTypes.window);	
				}
				if (hole_end+window_width+10 < w && Rand.prob(window_p)) {
					wall.addHole(hole_end+10, z+window_z, hole_end+10+window_width, z+window_z+window_height, the.Wall.holeTypes.window);	
				}
			}
		}			
		
		// add windows to wall segments w/o doors		
		var z_coords = [ room.p1.z ];
		if (room.p2.z != room.p1.z) {
			z_coords.push(room.p2.z);
		}		
		for (var k=0; k<z_coords.length; k++) {
			var z_off = (k==1)? unit_size.z : 0;			
			if (map.ground_floor <= z_coords[k]) {
				for (var i=0; i<walls.length; i++) {
					var wall = walls[i];					
					if (!walls_w_doors[i][k]) {
						// see if there is room for two windows.  We'll assume that's the case if there's
						// actually room for four.
						var starts = [];
						if (window_width*4 < wall.dist) {
							starts[0] = wall.dist/4 - window_width/2;
							starts[1] = 3*wall.dist/4 - window_width/2;
						} else {
							starts[0] = wall.dist/2 - window_width/2;
						}
						for (var j=0; j<starts.length; j++) {
							if (Rand.prob(window_p)) {
								wall.addHole(starts[j], window_z+z_off, starts[j]+window_width,
									window_z+z_off+window_height, the.Wall.holeTypes.window);
							}
						}
					}
				}
			}
		}
				
		var all_shapes = [];
		for (var i in walls) {
			var wall = walls[i];
			var s = wall.getShapes();			
			for (var j=0; j<s.length; j++) {
				all_shapes.push(s[j]);
			}
		}
		
		var num_shapes = all_shapes.length;
		for (var i=0; i<num_shapes; i++) {
			var shape;			
			shape = all_shapes[i];			
			if (!shape.textureGroup) {
				shape.textureGroup = outer_tg;
			}
			ret.shapes.push(shape);	
		}
		
		// floor
		fillingPlane(-1, 1, outer_tg,	{ 'top': floor_tg, 'bottom': ceiling_tg }, -1*ww/2);
		
		// ceiling
		fillingPlane(h, ww-1, ceiling_tg, {}, -1*ww/2); // ww
		
		// stairs, if necessary.
		var min_z = 0;
		var max_z = 0;
		for (var i=0; i<room.connections.length; i++) {
			var curr_z = room.connections[i].path[0].z;
			min_z = (i==0)? curr_z : Math.min(curr_z, min_z);
			max_z = (i==0)? curr_z : Math.max(curr_z, max_z);
		}
		if (room.exit) {
			var curr_z = room.exit[0].z;
			min_z = (i==0)? curr_z : Math.min(curr_z, min_z);
			max_z = (i==0)? curr_z : Math.max(curr_z, max_z);
		}
		
		if (room.p1.z != room.p2.z && max_z != room.p1.z) {
			// these should come from the xml file
			var stair_height = 6;			
			var stair_width = 40;
			var stair_node = xml.getChildNamed("stair");
			if (stair_node) {
				stair_height = xml_node_get_int(stair_node, "height");
				stair_width = xml_node_get_int(stair_node, "width");
			}
			var walkway_width = 60;
			var walkway_node = xml.getChildNamed("walkway");
			if (walkway_node) {
				walkway_width = xml_node_get_int(walkway_node, "width");
			}
			
			// figure out the area that would be available if this was a 1x1 room
			//
			//  +-----------------------------+
			//  | walkway at z=unit_size.z    |
			//  |  +-----------------------+  |
			//  |  |          +++|||||||||||  |
			//  |  | landing->+++|||||||||||  |
			//  |  |          ---    ^     |  |
			//  |  |          ---    |     |  |
			//  |  |          ---  xstairs |  |
			//  |  | ystairs->---          |  |
			//  |  |          ---          |  |
			//  |  |          ---          |  |
			//  |  +-----------------------+  |
			//  |                             |
			//  +-----------------------------+
						
			var sarea = {};
			sarea.w = unit_size.x - 2*ww - 2* walkway_width;
			sarea.h = unit_size.y - 2*ww - 2* walkway_width;
			
			// cover the whole floor if the connection is really just between
			// two entrances on the 2nd story
			var floor_split = (min_z != max_z);
			if (floor_split) {				
				if (room.p1.x == room.p2.x || room.p1.y == room.p2.y) {
					room.spawn_second_story = true; // because they are likely to spawn in the ramp otherwise
				}
				
				// only do the L-staircase in a 1x1 room
				if (room.p1.x == room.p2.x && room.p1.y == room.p2.y) {
					var numstairs = Math.ceil((unit_size.z-stair_height) / stair_height); // including the landing
					var xstairs = Math.floor((numstairs-1) / 2);
					var ystairs = numstairs - xstairs - 1;
					
					room.hasStairs = true;
					
					// calculate stair depth based on available area.
					// stair_width here is to account for the landing.
					var sdx = Math.floor((sarea.w - stair_width) / xstairs);
					var sdy = Math.floor((sarea.h - stair_width) / ystairs);
					var stair_depth = Math.min(sdx, sdy);
					
					var pos = new Geom.Point3(0,0,0);			
					var stair_pt1;
					var stair_pt2;
					var stair_box;
					
					// handle ystairs
					pos.x = p2.x - walkway_width - ww - (xstairs*stair_depth + stair_width);
					pos.y = p2.y - walkway_width - ww - (ystairs*stair_depth + stair_width);
					pos.z = p1.z;
					for (var i=0; i<ystairs; i++) {
						stair_pt1 = Geom.Point3.addXYZ(pos, 0, Math.floor(stair_depth/2), 0);
						stair_pt2 = Geom.Point3.addXYZ(stair_pt1, stair_width, 0, 0);
						stair_box = Geom.box(stair_pt1, stair_pt2, stair_depth, stair_height);
						stair_box.textureGroup = stair_tg
						ret.shapes.push(stair_box);
						
						pos.y += stair_depth;
						pos.z += stair_height;
					}
					
					// handle landing
					stair_pt1 = Geom.Point3.addXYZ(pos, 0, Math.floor(stair_width/2), 0);
					stair_pt2 = Geom.Point3.addXYZ(stair_pt1, stair_width, 0, 0);
					stair_box = Geom.box(stair_pt1, stair_pt2, stair_width, stair_height);			
					stair_box.textureGroup = stair_tg;
					ret.shapes.push(stair_box);
					pos.z += stair_height;
		
					// handle xstairs
					pos.x += stair_width;
					for (var i=0; i<xstairs; i++) {
						stair_pt1 = Geom.Point3.addXYZ(pos, Math.floor(stair_depth/2), 0, 0);
						stair_pt2 = Geom.Point3.addXYZ(stair_pt1, 0, stair_width, 0);
						stair_box = Geom.box(stair_pt1, stair_pt2, stair_depth, stair_height);
						stair_box.textureGroup = stair_tg;
						ret.shapes.push(stair_box);
						
						pos.x += stair_depth;
						pos.z += stair_height;
					}
				} else { // for larger room, make a ramp instead of stairs	

					map.stats.ramps++;
							
					// possible sides on which to place the ramp
					var ps = { 'left':-1, 'right':-1, 'top':-1, 'bottom':-1 }; // -1 means NO				
					if (room.p1.x != room.p2.x) {
						ps.top = 0; // 0 means maybe
						ps.bottom = 0;						
					}
					if (room.p1.y != room.p2.y) {
						ps.left = 0;
						ps.right = 0;						
					}
					
					var outpoints = [];
					for (var i=0; i<room.connections.length; i++) {
						var p = room.connections[i].path[1];
						if (p.z == room.p1.z) {
							outpoints.push(p);
						}
					}
					if (room.exit) {
						var p = room.exit[1];
						if (p.z == room.p1.z) {
							outpoints.push(p);
						}
					}
					
					// count up the number of first-level exits on each side.
					// sides with exits should be discouraged as a place with
					// a ramp, or players will be running into ramps a lot.
					for (var i=0; i<outpoints.length; i++) {
						var p = outpoints[i];
						if (p.x < room.p1.x && ps.left != -1) {
							ps.left++;
						} else if (p.x > room.p2.x && ps.right != -1) {
							ps.right++;
						} else if (p.y < room.p1.y && ps.bottom != -1) {
							ps.bottom++;
						} else if (p.y > room.p2.y && ps.top != -1) {
							ps.top++;
						}
					}
															
					// see which sides have the least number of first-level entrances
					var sides = [];
					var smin = -1;
					for (var k in ps) {
						var psk = ps[k];
						if (psk != -1) {
							if (smin == -1 || psk <= smin) {
								if (psk < smin) {									
									sides = [k];
								} else {									
									sides.push(k);								
								}
								smin = psk;								
							}
						}
					}
					
					// if there was a tie, just pick one					
					var side = (sides.length==1)? sides[0] : Rand.pick(sides);
					var rev = Rand.pick([true, false]); // reverse direction
					var off = (rev)? -1 * walkway_width : 0;
					var z1 = (rev)? (unit_size.z - 1) : -1;
					var z2 = (unit_size.z) * (rev ? -1 : 1);					
					var b;
					var bp1;
					var bp2;
					
					room.rampSide = side;
					
					switch (side) {
						case 'bottom':							
							bp1 = Geom.Point3.addXYZ(p1, 2*walkway_width+ww/2+off, 1.5*walkway_width, z1);
							bp2 = Geom.Point3.addXYZ(bp1, w-ww-3*walkway_width, 0, z2);
							b = Geom.box(bp1, bp2, walkway_width, 1);
							break;						
						case 'top':							
							bp1 = Geom.Point3.addXYZ(p1, 2*walkway_width+ww/2+off, l-1.5*walkway_width, z1);
							bp2 = Geom.Point3.addXYZ(bp1, w-ww-3*walkway_width, 0, z2);
							b = Geom.box(bp1, bp2, walkway_width, 1);			
							break;
						case 'left':
							bp1 = Geom.Point3.addXYZ(p1, 1.5*walkway_width+ww/2, 2*walkway_width+off, z1);
							bp2 = Geom.Point3.addXYZ(bp1, 0, l-3*walkway_width, z2);
							b = Geom.box(bp1, bp2, walkway_width, 1);
							break;
						case 'right':
							bp1 = Geom.Point3.addXYZ(p1, w-1.5*walkway_width-ww/2, 2*walkway_width+off, z1);
							bp2 = Geom.Point3.addXYZ(bp1, 0, l-3*walkway_width, z2);
							b = Geom.box(bp1, bp2, walkway_width, 1);
							break;
					}
					if (b) {
						b.textureGroup = walkway_tg;
						ret.shapes.push(b);
					}
				}
			}
	
			// walkways
			var walkpt1;
			var walkpt2;
			var walk;
			
			// bottom			
			walkpt1 = Geom.Point3.addXYZ(p1, ww/2, Math.floor(walkway_width/2)+ww/4, unit_size.z-stair_height);
			walkpt2 = Geom.Point3.addXYZ(walkpt1, w-ww, 0, 0);
			walk = Geom.box(walkpt1, walkpt2, walkway_width-ww/2, stair_height);
			walk.textureGroup = walkway_tg;
			ret.shapes.push(walk);
	
			// top
			walkpt1 = Geom.Point3.addXYZ(walkpt1, 0, l-walkway_width-ww/2, 0);
			walkpt2 = Geom.Point3.addXYZ(walkpt1, w-ww, 0, 0);
			walk = Geom.box(walkpt1, walkpt2, walkway_width-ww/2, stair_height);
			walk.textureGroup = walkway_tg;
			ret.shapes.push(walk);
	
			// left
			walkpt1 = Geom.Point3.addXYZ(p1, ww/2+Math.floor(walkway_width/2), walkway_width, unit_size.z-stair_height);
			walkpt2 = Geom.Point3.addXYZ(walkpt1, 0, l - 2*walkway_width, 0);
			walk = Geom.box(walkpt1, walkpt2, walkway_width, stair_height);
			walk.textureGroup = walkway_tg;
			ret.shapes.push(walk);
		
			// right
			walkpt1 = Geom.Point3.addXYZ(walkpt1, w-walkway_width-ww, 0, 0);
			walkpt2 = Geom.Point3.addXYZ(walkpt1, 0, l - 2*walkway_width, 0);
			walk = Geom.box(walkpt1, walkpt2, walkway_width, stair_height);
			walk.textureGroup = walkway_tg;
			ret.shapes.push(walk);
			
			if (!floor_split) {
				walkpt1 = Geom.Point3.addXYZ(p1, ww/2+walkway_width, l/2, unit_size.z-stair_height);
				walkpt2 = Geom.Point3.addXYZ(walkpt1, w - 2*walkway_width - ww, 0, 0);
				walk = Geom.box(walkpt1, walkpt2, l-2*walkway_width, stair_height);
				walk.textureGroup = walkway_tg;
				ret.shapes.push(walk);
				room.spawn_second_story = true;
			}
		}
		
		var z_plus = 0;
		var spawn_x; 
		var spawn_y; 
		if (room.spawn_second_story) {
			z_plus = unit_size.z;
			spawn_x = Rand.pick([walkway_width/2, w-walkway_width/2]);
			spawn_y = Rand.pick([walkway_width/2, l-walkway_width/2]);
		} else {
			spawn_x = w/2;
			spawn_y = l/2;
		}
				
		if (room.flag_dist == 0) { // this is the flag room			
			var flagpos = Geom.Point3.addXYZ(p1, spawn_x, spawn_y, z_plus);
			var ob = { 'pos':flagpos, type:objectTypes.flag };
			ret.objects.push(ob);
		} else if (!room.dirtPlane) {
			var spawnpos = Geom.Point3.addXYZ(p1, spawn_x, spawn_y, z_plus);
			var ob = { 'pos':spawnpos, type:objectTypes.spawn };
			ret.objects.push(ob);
		}
				
		return ret;
	}

	function xml_to_point(xmlNode)
	{
		var pt = new Geom.Point3(0,0,0);
		pt.x = parseInt(xmlNode.attributes.x, 10);
		pt.y = parseInt(xmlNode.attributes.y, 10);
		pt.z = parseInt(xmlNode.attributes.z, 10);
		return pt;
	}
	
	function xml_node_get_int(xmlNode, attr)
	{
		if (xmlNode) {
			return parseInt(xmlNode.attributes[attr], 10);
		} else {
			return 0;
		}
	}		

	function xml_node_get_float(xmlNode, attr)
	{
		if (xmlNode) {
			return parseFloat(xmlNode.attributes[attr]);
		} else {
			return 0;
		}
	}

	the.Map = function (xml)
	{
		var that = this;
		var fort = new FortGen.Fort(xml, false);
		var xmlfort = xml.getChildNamed("fort");
		var xmlunit = xmlfort.getChildNamed("unit_size");
		var unit_size = xml_to_point(xmlunit);
		var units_separation = 2;  /// todo - get these from xml
		var mountain_units = 2.5;
		var mountain_height = 400;
		var mountain_res1 = 10;
		var mouttain_res2 = 5;		
		var sky_height = 2400;
		
		the.ground_tg = getTextureGroup(xml, textureTypes.ground);
		the.ground_texture = the.ground_tg.children[0];
		the.sky_tg = getTextureGroup(xml, textureTypes.sky);
		the.gate_tg = getTextureGroup(xml, textureTypes.gate);
		the.caulk_tg = getTextureGroup(xml, textureTypes.caulk);
		the.support_tg = getTextureGroup(xml, textureTypes.support);

		that.shapes = [];
		that.objects = [];
		that.terrainPatches = [];
		that.stats = {};
		that.stats.supports = 0;
		that.stats.roomsBelowGround = 0;
		that.stats.roomsOnGround = 0;
		that.stats.roomsAboveGround = 0;
		that.stats.totalRooms = 0;
		that.stats.exits = 0;
		that.stats.exitsGroundFloor = 0;
		that.stats.ramps = 0;
		that.ground_floor = fort.ground_floor;		
		
		// find first interesting x coordinate
		var first_x = -1;
		var last_x = -1;
		var first_y = -1;
		var last_y = -1;
		for (var x=0; x<fort.grid.length; x++) {
			var gx = fort.grid[x];
			for (var y=0; y<gx.length; y++) {
				var gy = gx[y];
				for (var z=0; z<gy.length; z++) {
					if (gy[z] && !gy[z].dirtPlane) {
						if (first_x == -1) {
							first_x = x;
						}						
						last_x = Math.max(last_x, x);
						if (first_y == -1 || y < first_y) {
							first_y = y;
						}
						last_y = Math.max(last_y, y);
					}
				}
			}
		}
		
		// assign handlers		
		for (var i in fort.rooms) {
			var r = fort.rooms[i];
			r.handler = YourBasicRoom;				
		}
		
		var ptA = new Geom.Point3(units_separation*unit_size.x/2 - first_x*unit_size.x,
		                          0, -1 * unit_size.z * (fort.ground_floor-1));
		var ptB = new Geom.Point3(-1*units_separation*unit_size.x/2 + first_x*unit_size.x,
		                          (1+last_y+first_y)*unit_size.y, -1 * unit_size.z * (fort.ground_floor-1));		
		
		function handle_room(r)
		{
			var ret = r.handler(r, xml, unit_size, ptA, that);
			var s = ret.shapes;
			var o = ret.objects;
			for (var j in s) {
				var pts = Util.deepCopy(s[j].points);
				s[j].team = 1;
				getTexture(s[j]);
				that.shapes.push(s[j]);
								
				for (var k in pts) {
					var p = pts[k];
					p.x = ptB.x - (p.x - ptA.x);
					p.y = ptB.y - p.y;
				}	
				var oppositeShape = new Geom.Hexahedron(pts);
				oppositeShape.faceTextureGroups = Util.shallowCopy(s[j].faceTextureGroups);
				oppositeShape.textureGroup = s[j].textureGroup;
				oppositeShape.team = 2;
				getTexture(oppositeShape);				
				that.shapes.push(oppositeShape);
			}
			for (var j in o) {
				o[j].team = 1;
				that.objects.push(o[j]);
				var o_2 = Util.deepCopy(o[j]);
				o_2.team = 2;
				o_2.pos.x *= -1;
				o_2.pos.y = ptB.y - o[j].pos.y;
				that.objects.push(o_2);
			}
		}
		
		// handle all the real rooms
		for (var i in fort.rooms) {
			var r = fort.rooms[i];
									
			if (r.dirtPlane && (r.p1.x < first_x || r.p1.y < first_y || r.p1.x > last_x || r.p1.y > last_y)) {
				continue; // don't put out dirt where we've decided the area is just too boring
			}
			
			if (!r.handler) continue;
			handle_room(r);	
			if (!r.dirtPlane) {
				that.stats.totalRooms++;
				if (r.p1.z < fort.ground_floor) {
					that.stats.roomsBelowGround++;
				} else if (r.p1.z == fort.ground_floor) {
					that.stats.roomsOnGround++;
				} else {
					that.stats.roomsAboveGround++;
				}
				if (r.exit) {
					that.stats.exits++;				
					if (r.exit[0].z == fort.ground_floor) {
						that.stats.exitsGroundFloor++;		
					}
				}
			}
		}
		
		// place supports beneath hanging structures to make them appear less phony
		var walkway_width = 60;
		var walkway_node = xml.getChildNamed("walkway");
		if (walkway_node) {
			walkway_width = xml_node_get_int(walkway_node, "width");
		}
		for (var i=0; i<fort.grid.length; i++) {
			var gi = fort.grid[i];
			for (var j=0; j<gi.length; j++) {
				var gij = gi[j];
				var has_room = false;
				for (var k=gij.length-1; k >= fort.ground_floor; k--) {
					var room = gij[k];					
					if (!room || room.dirtPlane) {
						if (has_room) {
							// make supports here							
							var height_fix = 0;
							if (!gij[k+1]) {
								height_fix = 1;
							}
							
							var pt1 = new Geom.Point3(unit_size.x*(1.25+i-first_x) + walkway_width,
								unit_size.y*j + walkway_width, unit_size.z*(k-fort.ground_floor));
							var pt2 = Geom.Point3.addXYZ(pt1, 0, unit_size.y - 2*walkway_width, 0);							
							var b = Geom.box(pt1, pt2, unit_size.x-2*walkway_width, unit_size.z-1+height_fix);
							b.textureGroup = the.support_tg;
							b.team = 1;
							getTexture(b);						
							that.shapes.push(b);
							
							// opposite side
							var opt1 = Geom.Point3.copy(pt1);
							opt1.x *= -1;
							opt1.y = ptB.y - pt1.y - unit_size.y/2;
							var opt2 = Geom.Point3.addXYZ(opt1, 0, unit_size.y - 2*walkway_width, 0);
							var ob = Geom.box(opt1, opt2, unit_size.x-2*walkway_width, unit_size.z-1+height_fix);
							ob.textureGroup = the.support_tg;
							ob.team = 2;
							getTexture(ob);
							that.shapes.push(ob);
					
							that.stats.supports++;		
						}
					}
					if (room && !room.dirtPlane) {
						has_room = true;
					}
				}
			}
		}
		
		//
		// terrain and extra dirt placement
		// 
		
		// add some dirt planes on the left and right
		for (var j=first_y; j<=last_y; j++) {
			var xarray = [first_x-1, last_x+1];
			for (var i=0; i<xarray.length; i++) {
				var pt = new Geom.Point3(xarray[i], j, fort.ground_floor);
				var r = new FortGen.Room(pt, pt, -1);
				r.dirtPlane = true;
				r.handler = YourBasicRoom;
				handle_room(r);
			}
		}

		// mountains on the bottom
		var bgw = mountain_res1;
		var bgh = mouttain_res2;
		var bo = new Geom.Point3(0, ((first_y-mountain_units)*unit_size.y), 0);
		var bs = new Geom.Point3(unit_size.x*(3+last_x-first_x), unit_size.y*mountain_units, mountain_height);
		var btp = new the.TerrainPatch(bo, bgw, bgh, bs, the.ground_texture);
		
		// fix points to touch the ground
		for (var i=0; i<bgw; i++) {
			btp.pts[i][bgh-1] = 10.0;
			btp.pts[i][bgh-2] = 10.0 + Math.random()/25;
			btp.pts[i][bgh-3] = 10.0 + Math.random()/10;
		}

		// do randomization
		btp.pts = TerrainGen.generate(btp.pts, 3);
		that.terrainPatches.push(btp);

		function mirror_terrain(tp, gw, gh, x_off)
		{
			var opp_pts = [];
			for (var i=0; i<gw; i++) {
				opp_pts[i] = [];
				for (var j=0; j<gh; j++) {
					opp_pts[i][j] = tp.pts[gw-i-1][j];
				}
			}			
			var opp_tp = Util.deepCopy(tp);
			opp_tp.p_origin.x = -1*x_off;
			opp_tp.pts = opp_pts;
			that.terrainPatches.push(opp_tp);			
		}
		
		mirror_terrain(btp, bgw, bgh, bs.x);
								
		// mountains on the top
		var tgw = mountain_res1;
		var tgh = mouttain_res2;
		var to = new Geom.Point3(0, (1+last_y)*unit_size.y, 0);
		var ts = new Geom.Point3(unit_size.x*(3+last_x-first_x), unit_size.y*mountain_units, mountain_height);
		var ttp = new the.TerrainPatch(to, tgw, tgh, ts, the.ground_texture);
		
		// fix points at 0.0 (+10)
		for (var i=0; i<tgw; i++) {
			ttp.pts[i][0] = 10.0;
			ttp.pts[i][1] = 10.0 + Math.random()/25;
			ttp.pts[i][2] = 10.0 + Math.random()/10;
		}		

		// do randomization
		ttp.pts = TerrainGen.generate(ttp.pts, 3);
		that.terrainPatches.push(ttp);
		
		mirror_terrain(ttp, tgw, tgh, ts.x);
				
		// mountains on the right
		var rgw = mouttain_res2;
		var rgh = mountain_res1;
		var ro = Geom.Point3.addXYZ(bo, bs.x, bs.y, 0);
		var rs = new Geom.Point3(unit_size.x*mountain_units, (1+last_y-first_y)*unit_size.y, mountain_height);
		var rtp = new the.TerrainPatch(ro, rgw, rgh, rs, the.ground_texture);

		// fix points to touch the ground
		for (var j=0; j<rgh; j++) {
			rtp.pts[0][j] = 10.0;
			rtp.pts[1][j] = 10.0 + Math.random()/25;
			rtp.pts[2][j] = 10.0 + Math.random()/10;
		}		
		// do randomization
		rtp.pts = TerrainGen.generate(rtp.pts, 3);
		that.terrainPatches.push(rtp);
		
		mirror_terrain(rtp, rgw, rgh, bs.x+rs.x);
		
		// mountains on the bottom right
		var brgw = rgw;
		var brgh = bgh;
		var bro = Geom.Point3.addXYZ(bo, bs.x, 0, 0);
		var brs = new Geom.Point3(unit_size.x*mountain_units, unit_size.y*mountain_units, mountain_height);
		var brtp = new the.TerrainPatch(bro, brgw, brgh, brs, the.ground_texture);
		
		// fix points to align with right mountains
		for (var i=0; i<brgw; i++) {
			var v = 10.0 + rtp.pts[i][0];
			if (v >= 20.0) v -= 10.0;
			brtp.pts[i][brgh-1] = v
		}

		// fix points to align with bottom mountains
		for (var j=0; j<brgh; j++) {
			var v = 10.0 + btp.pts[bgw-1][j];
			if (v >= 20.0) v -= 10.0;			
			brtp.pts[0][j] = v;
		}
		
		// prevent sagging in the corners that could defeat the whole purpose of the mountains -
		// unclimbability
		brtp.pts[brgw-1][0] = 10.8;
		
		// do randomization
		brtp.pts = TerrainGen.generate(brtp.pts, 3);
		that.terrainPatches.push(brtp);
		
		mirror_terrain(brtp, brgw, brgh, bs.x+brs.x);

		// mountains on the top right
		var trgw = rgw;
		var trgh = tgh;
		var tro = Geom.Point3.addXYZ(to, ts.x, 0, 0);
		var trs = new Geom.Point3(unit_size.x*mountain_units, unit_size.y*mountain_units, mountain_height);
		var trtp = new the.TerrainPatch(tro, trgw, trgh, trs, the.ground_texture);
		
		// fix points to align with right mountains
		for (var i=0; i<trgw; i++) {
			var v = 10.0 + rtp.pts[i][rgh-1];
			if (v >= 20.0) v -= 10.0;
			trtp.pts[i][0] = v;
		}

		// fix points to align with top mountains
		for (var j=0; j<trgh; j++) {
			var v = 10.0 + ttp.pts[tgw-1][j];
			if (v >= 20.0) v -= 10.0;			
			trtp.pts[0][j] = v;
		}
		
		// prevent corner sag
		trtp.pts[trgw-1][trgh-1] = 10.8;
		
		// do randomization
		trtp.pts = TerrainGen.generate(trtp.pts, 3);
		that.terrainPatches.push(trtp);
		
		mirror_terrain(trtp, trgw, trgh, ts.x+trs.x);
					
		// make skybox
		var bottom_left = new Geom.Point3(-1*unit_size.x*(last_x-first_x+3+mountain_units)-1, ((first_y-mountain_units)*unit_size.y), 0);
		var top_left = Geom.Point3.addXYZ(bottom_left, 0, unit_size.y*(1+last_y-first_y)+2*mountain_units*unit_size.y, 0);
		var bottom_right = Geom.Point3.copy(bottom_left);
		bottom_right.x *= -1;
		var top_right = Geom.Point3.copy(top_left);
		top_right.x *= -1;
		var mid_bottom_roof = new Geom.Point3(0, bottom_left.y, sky_height/2);
		var mid_top_roof = new Geom.Point3(0, top_left.y, sky_height/2);
		var mid_bottom_floor = new Geom.Point3(0, bottom_left.y, -1*sky_height/2);
		var mid_top_floor = new Geom.Point3(0, top_left.y, -1*sky_height/2);
		
		// left
		var b = Geom.rotatedBox(bottom_left, top_left, 1, sky_height, 0.0);
		b.textureGroup = the.caulk_tg;
		b.faceTextureGroups = { 'right': the.sky_tg };
		getTexture(b);
		that.shapes.push(b);
		
		// right
		var b = Geom.rotatedBox(bottom_right, top_right, 1, sky_height, 0.0);
		b.textureGroup = the.caulk_tg;
		b.faceTextureGroups = { 'left': the.sky_tg };
		getTexture(b);
		that.shapes.push(b);
		
		// back
		var b = Geom.rotatedBox(top_left, top_right, 1, sky_height, 0.0);
		b.textureGroup = the.caulk_tg;
		b.faceTextureGroups = { 'right': the.sky_tg };
		getTexture(b);
		that.shapes.push(b);

		// front
		var b = Geom.rotatedBox(bottom_left, bottom_right, 1, sky_height, 0.0);
		b.textureGroup = the.caulk_tg;
		b.faceTextureGroups = { 'left': the.sky_tg };
		getTexture(b);
		that.shapes.push(b);
		
		// roof		
		var b = Geom.rotatedBox(mid_bottom_roof, mid_top_roof, bottom_right.x-bottom_left.x, 1, 0.0);
		b.textureGroup = the.caulk_tg;
		b.faceTextureGroups = { 'bottom': the.sky_tg };
		getTexture(b);
		that.shapes.push(b);
		
		// floor
		var b = Geom.rotatedBox(mid_bottom_floor, mid_top_floor, bottom_right.x-bottom_left.x, 1, 0.0);
		b.textureGroup = the.caulk_tg;
		b.faceTextureGroups = { 'top': the.sky_tg };
		getTexture(b);
		that.shapes.push(b);		
		
		//
		// info about map extents
		//
		var map_p1 = Geom.Point3.copy(bottom_left);
		var map_p2 = Geom.Point3.copy(top_right);
		map_p2.z = mid_bottom_roof.z;
		that.extents = { 'p1':map_p1, 'p2':map_p2 };
		
		// draw a wall through the middle		
		var pass_num = Rand.range(2,4);
		var pass_depth = Rand.range(10, 150);
		var pass_w = Rand.range(60, 140);
		var pass_h = Rand.range(95, 140);
		var pass_hcap = Rand.range(5, 30);
		var avail_w = (1 + last_y - first_y) * unit_size.y;
		
		pass_num = Math.min(pass_num, Math.floor(avail_w / (1.5*pass_w)));
		
		// make cap
		var pt1 = new Geom.Point3(0, bottom_left.y, pass_h);
		var pt2 = new Geom.Point3(0, top_right.y, pass_h);
		var b = Geom.box(pt1, pt2, pass_depth, pass_hcap);
		b.textureGroup = the.gate_tg;
		getTexture(b);
		that.shapes.push(b);		
		
		var segs = [];
		//segs.push({'start':bottom_left.y, 'end':first_y*unit_size.y});
		//segs.push({'start':(last_y+1)*unit_size.y, 'end':top_right.y});
		
		var w_seg = Math.floor((avail_w - pass_num*pass_w) / (pass_num+1))
		var w1 = first_y*unit_size.y;		
		var w2 = w1 + w_seg;
		for (var i=0; i<pass_num+1; i++) {
			segs.push({'start':w1, 'end':w2});
			w1 = w2 + pass_w;
			w2 = w1 + w_seg;
			if (i==pass_num-1) {
				w2 = (last_y+1)*unit_size.y; // account for rounding errors
			}
		}
		
		for (var i in segs) {
			pt1 = new Geom.Point3(0, segs[i].start, 0);
			pt2 = new Geom.Point3(0, segs[i].end, 0);
			b = Geom.box(pt1, pt2, pass_depth, pass_h);
			b.textureGroup = the.gate_tg;
			getTexture(b);
			that.shapes.push(b);			
		}		
		
		// TODO
		// list of open areas that the caller might want to fill with some stuff to make the outdoors
		// a bit more interesting
		
		// there is always an empty column in front of the fort
		//var i = first_x - 1;
		//var x = 0;
		//for (var j=first_y; j<=last_y; j++) {
			///var p1 = new 
			//var p1 = new Geom.Point3(0, (j-first_y)*unit_size.y, 0);
			//var oa = new the.OpenArea(
		//}
				
	}		


	the.main = function()
	{
	
	}
}
