#!/home/gjones/mybin/jshost

System.include("Util.js");
System.include("Cod2Gen.js");

function motd()
{
	this.main = function() {
		var dt = new Date();
		var map_name;

		//dt.setDate(dt.getDate() + 1); // to do tomorrow, or later

		map_name = "mp_" + dt.getFullYear() + Util.padNumber(dt.getMonth()+1, 2, '0') + Util.padNumber(dt.getDate(), 2, '0');

		System.out.write("Creating map of the day: " + map_name + "\n");
		Cod2Gen.create("cod2.xml", map_name);

		System.out.write("Clearing zipdir contents.\n");
		System.execute("rm zipdir/mp/*");
		System.execute("rm zipdir/maps/mp/*");

		System.out.write("Moving gsc and arena files to zipdir.\n");
		System.execute("cp " + map_name + ".map zipdir/mp"); // not necessary, but nice
		System.execute("mv " + map_name + ".arena zipdir/mp");
		System.execute("mv " + map_name + ".gsc zipdir/maps/mp");

		System.out.write("Zipping up zipdir.\n");
		System.execute("cd zipdir; zip -r " + map_name + " *");
		
		System.out.write("Moving " + map_name + ".zip to current directory\n");
		System.execute("mv zipdir/" + map_name + ".zip .");

		System.out.write("Done!\n");
	}
}
