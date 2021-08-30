function TerrainGen()
{
	var the = this;
	
	// takes a double array of floating point numbers from 0.0 to 1.0.
	// if you want your number to be "sticky", add 10 to it (0.0==> 10.0, 1.0 => 11.0).
	// surely a more elegant solution would be to have an array of cell objects.
	// that would also be much less efficient.
	the.generate = function(cells, s)
	{
			randomize(cells);
			for (var i=0; i<s; i++) {				
				cells = smooth(cells);
			}
			amplify(cells);
			return cells;
	}
	
	function randomize(cells)
	{
		var i;
		var j;
		var ci;
		var val;
		for (i=0; i<cells.length; i++) {
			ci = cells[i];
			for (j=0; j<ci.length; j++) {
				val = ci[j];
				if (val < 10.0) {
					cells[i][j] = Math.random();
				}
			}
		}
	}

	function amplify(cells)
	{
		var vmin = -1;
		var vmax = -1;
		var i;
		var j;
		var v;
		var ci;
		var mult = 0.0;
		
		// determine current range
		for (i=0; i<cells.length; i++) {
			var ci = cells[i];
			for (j=0; j<ci.length; j++) {	
				v = ci[j];
				if (v >= 10.0) v -= 10.0;				
				if (vmin == -1 || v < vmin) {
					vmin = v;
				}
				if (vmax == -1 || v > vmax) {
					vmax = v;
				}				
			}
		}
		
		// perfectly flat.  can't be amplified.
		if (vmax-vmin == 0.0) {
			return;
		}
		
		mult = 1.0 / (vmax - vmin);
		
		for (i=0; i<cells.length; i++) {
			ci = cells[i];
			for (j=0; j<ci.length; j++) {
				v = ci[j];
				if (v <= 1.0) {
					ci[j] = (v - vmin) * mult;					
				}
			}
		}
	}

	function smooth(cells)
	{		
		var ret = [];
		var i;
		var j;
		var k;
		var i_siz;
		var j_siz;
		var i_plus;
		var j_plus;
		var j_minus;
		var vals;
		var w = [ 0.5, 0.1, 0.1, 0.1, 0.1, 0.025, 0.025, 0.025, 0.025 ];
				
		i_siz = cells.length;
		j_siz = cells[0].length;

		for (i=0; i<i_siz; i++) {
			i_plus = (i+1) % i_siz;
			i_minus = (i>0)? (i-1) : 0;
			ret[i] = [];
			for (j=0; j<j_siz; j++) {
				if (cells[i][j] <= 1.0) {
					j_plus = (j+1) % j_siz;
					j_minus = (j>0)? (j-1) : 0;
					vals = [ cells[i][j], cells[i_plus][j], cells[i_minus][j], cells[i][j_plus], cells[i][j_minus],
										cells[i_plus][j_plus], cells[i_plus][j_minus], cells[i_minus][j_plus], cells[i_minus][j_minus] ];
					ret[i][j] = 0.0;
					for (k=0; k<vals.length; k++) {
						var v = vals[k];
						if (v >= 10.0) v -= 10.0;						
						ret[i][j] += w[k] * v;
					}
				} else {
					ret[i][j] = cells[i][j];
				}
			}
		}
		return ret;
	}
	
	the.zeroGrid = function(i, j)
	{
		var ret = [];
		for (var a=0; a<i; a++) {
			ret[a] = [];
			for (var b=0; b<j; b++) {
				ret[a][b] = 0.0;
			}
		}
		return ret;
		
	}
	
	the.main = function()
	{
		System.out.write("Running TerrainGen.zeroGrid(5, 5)\n");
		var g = the.zeroGrid(35, 35);
		System.out.write("  g.length, g[0].length\n");
		System.out.write("  Expect 5, 5\n");
		System.out.write("  Actual " + g.length + ", " + g[0].length + "\n");
		System.out.write("\n");
	
		g[0][0] = 10.5;
			
		System.out.write("Running TerrainGen.generate(g, 15)\n");
		g = the.generate(g, 15);
	}
	
}