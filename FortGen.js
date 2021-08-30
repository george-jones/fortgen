System.include("Geom.js");
System.include("Rand.js");
System.include("Util.js");

function FortGen()
{
	var the = this;

	the.Fort = function(xml, doDisplay) {
		var that = this;

		that.grid = []; // will be a 3D array subscripted [x][y][z], containing Room objects
		that.exits = []; // Point3's for that.gridpoints where that.exits go
		that.rooms = []; // simple array of Room objects
		that.ground_floor;
		that.size = new Geom.Point3(7, 7, 7);
		that.flagPos = new Geom.Point3(3, 3, 3);

		var path_len = 7;
		var prob = {
			path_split: 0.35,
			x_double: 0.25, // chance that room will be double-wide
			y_double: 0.25, // chance that room will be double-long
			z_double: 0.25, // chance that room will be double-tall
			num_exit: [ { w:0.30, num:1 },
			            { w:0.35, num:2 },
			            { w:0.25, num:3 },
			            { w:0.08, num:4 },
			            { w:0.02, num:5 } ]
		};

		that.toString = function() { return "Fort"; }

		function Connection(room, path)
		{
			this.room = room;
			this.path = path;
			this.toString = function () {
				return "Connection";
			}
		}
		Connection.reverse = function(c)
		{
			// create a new connection with reversed path
			var conn = new Connection(c, [c.path[1], c.path[0]]);
			return conn;
		}
	
		// p1 and p2 are Point3 objects defining the extents of the room
		// (always a rectangular prism)
		the.Room = function(p1, p2, flag_dist)
		{
			this.p1 = p1;
			this.p2 = p2;
			this.flag_dist = flag_dist;
			this.num = "X";
	
			// connection to other that.rooms
			this.connections = [];
	
			// Path of a possible exit (array of 2 Point3 objects)
			this.exit = null;
				
			this.connectsTo = function(r) {
				for (var i in this.connections) {
					if (this.connections[i].room == r) return true;
				}
				return false;
			}
	
			this.toString = function() {
				return "Room";
			}
		}
		the.Room.connect = function (r1, r2, path)
		{
			var c = new Connection(r2, path);
			r1.connections.push(c);
			var rev = Connection.reverse(c);
			rev.room = r1;
			r2.connections.push(rev);		
			the.Room.redoFlagDist(r2, r1.flag_dist+1);
		}
		the.Room.redoFlagDist = function (r, fd)
		{
			if (r.flag_dist > fd) {
				r.flag_dist = fd;
				for (var i in r.connections) {
					var r2 = r.connections[i].room;
					if (r2) {
						the.Room.redoFlagDist(r2, fd+1);
					}
				}
			}
		}

		function point_in_bounds(p)
		{
			return (p.x >= 0 && p.y >= 0 && p.z >= 0 &&
			        p.x < that.size.x && p.y < that.size.y && p.z < that.size.z);
		}

		function find_room_space(p)
		{
			var coords = ["x", "y", "z"];
			var to_try = [ [p] ];

			// find all legitimate room sizes
			for (var i in coords) {
				var c = coords[i];
				if (Rand.prob(prob[c + "_double"])) {
					var prev = to_try[to_try.length-1];
					var plen = prev.length;
					var curr = [];
					to_try[to_try.length] = curr;
					for (var t=0; t<plen; t++) {
						var p2 = Geom.Point3.copy(prev[t]);
						var p3 = Geom.Point3.copy(prev[t]);
						p2[c] += -1;
						p3[c] += 1;
						if (point_in_bounds(p2)) {
							curr.push(p2);
						}
						if (point_in_bounds(p3)) {
							curr.push(p3);
						}
					}
				}
			}

			var tlen = to_try.length;
			var p_min;
			var p_max;
			for (var t = tlen-1; t>=0; t--) {
				var tt = to_try[t];
				for (var i = tt.length-1; i>=0; i--) {
					try {
						var p2 = tt[i];
						var p_min = new Geom.Point3(
							Math.min(p.x, p2.x),
							Math.min(p.y, p2.y),
							Math.min(p.z, p2.z));
						var p_max = new Geom.Point3(
							Math.max(p.x, p2.x),
							Math.max(p.y, p2.y),
							Math.max(p.z, p2.z));
						for (var x=p_min.x; x<=p_max.x; x++) {
							for (var y=p_min.y; y<=p_max.y; y++) {
								for (var z=p_min.z; z<=p_max.z; z++) {
									if (that.grid[x][y][z]) {
										throw "X";
									}
								}
							}
						}

						// we made it! we found a room size that is useable
						return [p_min, p_max];

					} catch (ex) { } // just keep going
				}
			}		
			return null;
		}
	
		function insert_room(r)
		{
			that.rooms.push(r);
			r.num = that.rooms.length;

			var p1 = r.p1;
			var p2 = r.p2;

			// place a reference to this room in each grid cell that it occupies
			for (var i=p1.x; i<=p2.x; i++) {
				for (var j=p1.y; j<=p2.y; j++) {
					for (var k=p1.z; k<=p2.z; k++) {
						that.grid[i][j][k] = r;
					}
				}
			}
	
		}

		function place_room(p, prev, path)
		{
			// size doubling in all three dimensions
			// provides some variety in the shapes and sizes of rooms.
			var flag_dist = (prev)? (prev.flag_dist+1) : 0;
			var sp = find_room_space(p);
			if (!sp) {
				if (!prev) {
					throw "Error - no room for flag!\n";
				} else {
					return;
				}
			}

			var p1 = sp[0];
			var p2 = sp[1];
			var r = new the.Room(p1, p2, flag_dist);
	
			insert_room(r);
	
			if (prev) {
				the.Room.connect(prev, r, path);
			}
	
			return r;
		}
	
		function room_extend_path(r, toExit)
		{
			var num_exits = 0;
			var min_exit = 1;
			var max_exit = 2;
			
			if (r.flag_dist == 0) {
				min_exit = 3;
				max_exit = 3;
			}
			num_exits = Rand.prob(prob.path_split) ? max_exit : min_exit;
	
			// get all legitimate extension points on the grid
			var paths = [];
	
			// 4 planes that are the sides of the box (not the top or bottom)
			var coords = [ "x", "y" ];
	
			for (var cidx in coords) {
				var c1 = coords[cidx];
				var pt;
				
				for (var inc = -1; inc < 2; inc += 2) {
					var u_origin;
					var u;
					var v_min;
					var v_max;
					var w_min;
					var w_max;
					var c2;
					var c3;
					switch (c1) {
					case "x":
						if (inc == -1) {
							u = r.p1.x - 1;
							u_origin = r.p1.x;
						} else {
							u = r.p2.x + 1;
							u_origin = r.p2.x;
						}
						v_min = r.p1.y;
						v_max = r.p2.y;
						w_min = r.p1.z;
						w_max = r.p2.z;
						c2 = "y";
						c3 = "z";
						break;
					case "y":
						if (inc == -1) {
							u = r.p1.y - 1;
							u_origin = r.p1.y;
						} else {
							u = r.p2.y + 1;
							u_origin = r.p2.y;
						}
						v_min = r.p1.x;
						v_max = r.p2.x;
						w_min = r.p1.z;
						w_max = r.p2.z;
						c2 = "x";
						c3 = "z";
						break;
					}
			
					for (var v=v_min; v<=v_max; v++) {
						for (var w=w_min; w<=w_max; w++) {
							var o = new Geom.Point3();
							o[c1] = u_origin;
							o[c2] = v;
							o[c3] = w;
	
							var pt = new Geom.Point3();
							pt[c1] = u;
							pt[c2] = v;
							pt[c3] = w;
	
							if (pt.x >= 0 && pt.x < that.size.x &&
							    pt.y >= 0 && pt.y < that.size.y &&
							    pt.z >= 0 && pt.z < that.size.z) {
								var r2 = that.grid[pt.x][pt.y][pt.z];
								if (!r2 || !r2.connectsTo(r)) {
									paths.push([o, pt]);
								}
							}
						}
					}
				}
			}
			
			if (toExit) {
				var path;
				while (paths.length > 0) {
					var pidx = Rand.pickIndex(paths);
					path = paths[pidx];
					var p = path[1];
					if (!that.grid[p.x][p.y][p.z]) {
						break;
					} else {
						paths.splice(pidx, 1);
						path = null;
					}
				}
				if (path) {
					r.exit = path;
					return path;
				} else {
					return null;
				}
			} else {
				
				var new_room_paths = [];
				var connect_paths = [];
				
				for (var i=0; i<paths.length; i++) {
					var path = paths[i];
					var p = path[1];	
					var r2 = that.grid[p.x][p.y][p.z];

					if (r2) {
						connect_paths.push(path);
					} else {
						new_room_paths.push(path);
					}
				}
				
				var usedp = 0;			
				if (new_room_paths.length > 0 && r.flag_dist <= path_len) {
					var newp = num_exits - connect_paths.length;
					if (newp <= 0) newp = 1; // at least one new room path
					for (var e=0; e<newp && e<new_room_paths.length; e++) {
						var path = Rand.pick(new_room_paths);
						var p = path[1];
						var r2 = that.grid[p.x][p.y][p.z];
						if (!r2) {
							var new_room = place_room(p, r, path);
							if (new_room.flag_dist < path_len) {
								room_extend_path(new_room);
							}							
						}
					}
				}
				
				for (var e = 0; e<num_exits-usedp && e<connect_paths.length; e++) {
					var path = Rand.pick(connect_paths);
					var p = path[1];
					var r2 = that.grid[p.x][p.y][p.z];

					if (!r2.connectsTo(r)) {
						the.Room.connect(r, r2, path);
					}
				}
			}
	
		}
	
		function displayTextual()
		{
			if (that.rooms.length == 0) return;
	
			var x_min = that.rooms[0].p1.x;
			var x_max = that.rooms[0].p2.x;
			var y_min = that.rooms[0].p1.y;
			var y_max = that.rooms[0].p2.y;
			var z_min = that.rooms[0].p1.z;
			var z_max = that.rooms[0].p2.z;
	
			for (var i=1; i<that.rooms.length; i++) {
				var r = that.rooms[i];
				if (r.p1.x < x_min) {
					x_min = r.p1.x;
				}
				if (r.p1.y < y_min) {
					y_min = r.p1.y;
				}
				if (r.p1.z < z_min) {
					z_min = r.p1.z;
				}
				if (r.p2.x > x_max) {
					x_max = r.p2.x;
				}
				if (r.p2.y > y_max) {
					y_max = r.p2.y;
				}
				if (r.p2.z > z_max) {
					z_max = r.p2.z;
				}
			}
			
			for (var k=z_min; k<=z_max; k++) {
				System.out.write("(z = " + k + ")\n");
				var r;
	
				System.out.write("     ");
				for (var i=x_min; i<=x_max; i++) {
					System.out.write(Util.padNumber(i, 3, " ", true));
				}
				System.out.write("\n");
				System.out.write("   ");
				for (var i=x_min; i<=x_max; i++) {
					System.out.write("---");
				}
				System.out.write("\n");
	
				for (var j=y_min; j<=y_max; j++) {
					System.out.write(Util.padNumber(j, 3, " ", true));
					System.out.write("| ");
					for (var i=x_min; i<=x_max; i++) {
						r = that.grid[i][j][k];
						if (r) {
							var pad = (r.exit)? "X" : " ";
							if (r.dirtPlane) {
								System.out.write("***");
							} else {
								System.out.write(Util.padNumber(r.num, 3, pad, true));
							}
						} else {
							System.out.write(".  ");
						}
					}
					System.out.write("\n");
				}
				System.out.write("\n");
			}
	
			System.out.write("\nRooms:\n");
			for (var i in that.rooms) {
				var r = that.rooms[i];
				if (r.dirtPlane) continue;
				System.out.write("#" + r.num + ": " + r.p1 + " - " + r.p2 + "\n");
				System.out.write("  Connections:\n");
				for (var j in r.connections) {
					var c = r.connections[j];
					System.out.write("  #" + c.room.num +
					                 " via " + c.path[0] + " - " +
					                 c.path[1] + "\n");
				}
				System.out.write("\n");
			}
		}

		function setExits()
		{
			var numExits = Rand.pickWeighted(prob.num_exit).num;

			// find the rooms furthest from the flag room.  these will be exits.
			var sorted = [];
			for (var i=0; i<that.rooms.length; i++) {
				sorted.push(that.rooms[i]);
			}
			
			sorted.sort(function (r1, r2) { return r2.flag_dist - r1.flag_dist; });
			
			var ne = 0;
			for (var i=0; ne<numExits && i<sorted.length; i++) {
				var r = sorted[i];
				var path = room_extend_path(r, true);
				if (path) {
					that.exits.push(r);
					ne++
				}
			}
		}
	
		function fillGaps()
		{
			// find lowest exit.  This will be the ground floor because it must be
			// accessible from the outside.
			for (var i=0; i<that.exits.length; i++) {
				var r = that.exits[i];
				var z = r.exit[0].z;
				if (i == 0 || z < that.ground_floor) {
					that.ground_floor = z;
				}
			}

			// create a plane at the ground floor to cover up holes above
			// basement rooms
			var z = that.ground_floor;
			if (z >= 0) {
				for (var x=0; x<that.size.x; x++) {
					for (var y=0; y<that.size.y; y++) {
						if (!that.grid[x][y][z]) {
							var pt = new Geom.Point3(x,y,z);
							var r = new the.Room(pt, pt, -1);
							r.dirtPlane = true;
							insert_room(r);
						}
					}
				}
			}
		}

		function generate()
		{
			// create empty grid
			for (var i=0; i<that.size.x; i++) {
				that.grid[i] = [];
				for (var j=0; j<that.size.y; j++) {
					that.grid[i][j] = [];
				}
			}
	
			var flag_room = place_room(that.flagPos);
			if (!flag_room) {
				throw "Unable to place flag room!";
			}			

			room_extend_path(flag_room);
	
			// make sure no rooms were clobbered
			var used = [];
			for (var i=0; i<that.size.x; i++) {
				for (var j=0; j<that.size.y; j++) {
					for (var k=0; k<that.size.z; k++) {
						var r = that.grid[i][j][k];
						if (r) {
							used[r.num] = true;
						}
					}
				}
			}
	
			var missing = [];
			for (var i=1; i<=that.rooms.length; i++) {
				if (!used[i]) {
					missing.push(i);
				}
			}
	
			if (missing.length > 0) {
				System.out.write("Missing: " + missing + "\n");
				displayTextual();
			} else {
				setExits();
				fillGaps();

				if (doDisplay) {
					displayTextual();
				}
			}
		}

		function handleXML() {
			if (!xml) return;

			var f = xml.getChildNamed("fort");
			if (f) {
				var sizeTag = f.getChildNamed("size");
				var flagTag = f.getChildNamed("flag");
				var pathlenTag = f.getChildNamed("path_len");
				var pathsplitTag = f.getChildNamed("path_split");
				var xdubTag = f.getChildNamed("x_double");
				var ydubTag = f.getChildNamed("y_double");
				var zdubTag = f.getChildNamed("z_double");
				var exitsTag = f.getChildNamed("exits");

				function tag_to_point3(t)
				{
					var x = t.attributes["x"];
					var y = t.attributes["y"];
					var z = t.attributes["z"];

					if (!x || !y || !z) {
						throw "Bad tag to Point3 conversion";
					}

					return new Geom.Point3(parseInt(x,10), parseInt(y,10), parseInt(z,10));
				}

				if (sizeTag) {
					that.size = tag_to_point3(sizeTag);
				}

				if (flagTag) {
					that.flagPos = tag_to_point3(flagTag);
				}

				if (pathlenTag) {
					var a = pathlenTag.attributes["value"];
					if (a) {
						path_len = parseInt(a, 10);
					}
				}

				function tag_float_set_prop(t, attr, prop) {
					var a = t.attributes[attr];
					if (a) {
						var flt = parseFloat(a);
						prob[prop] = flt;
					}
				}

				if (pathsplitTag) {
					tag_float_set_prop(pathsplitTag, "p", "path_split");
				}
				if (xdubTag) {
					tag_float_set_prop(xdubTag, "p", "x_double");
				}
				if (ydubTag) {
					tag_float_set_prop(ydubTag, "p", "y_double");
				}
				if (zdubTag) {
					tag_float_set_prop(zdubTag, "p", "z_double");
				}

				if (exitsTag) {
					var eTags = exitsTag.children;
					prob.num_exit = [];
					for (var i=0; i<eTags.length; i++) {
						var weight = parseFloat(eTags[i].attributes["p"]);
						var num = parseInt(eTags[i].attributes["num"], 10);
						prob.num_exit.push({'w':weight, 'num':num });
					}
				}

			}
		}
		handleXML();
		generate();
	}

	the.main = function() {
		System.out.write("Testing FortGen\n\n");
		var fort = new the.Fort(null, true);
	}
}
