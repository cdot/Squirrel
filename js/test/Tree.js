/*eslint-env node, mocha */

var actions = [
    {
	type: "N",
	time: new Date("1 Jan 2000").getTime(),
	path: ["Fine-dining"]
    },
    {
	type: "N",
	time: new Date("1 Jan 2001").getTime(),
	path: [ "Fine-dining", "Caviare" ]
    },
    {
	type: "N",
	time: new Date("1 Jan 2002").getTime(),
	path: [ "Fine-dining", "Caviare", "Beluga" ],
        data: "£6.70 per gram"
    },
    {
        type: "A",
	path: [ "Fine-dining", "Caviare", "Beluga" ],
	time: new Date("1 Jan 2003").getTime(),
        data: new Date("1 Jan 2004").getTime(),
    },
    {
        type: "R",
	path: [ "Fine-dining", "Caviare" ],
	time: new Date("1 Jan 2005").getTime(),
        data: "Caviar"
    },
    {
        type: "E",
	path: [ "Fine-dining", "Caviar", "Beluga" ],
	time: new Date("1 Jan 2006").getTime(),
        data: "£6.70 per gramme"
    },
    {
        type: "X",
	path: [ "Fine-dining", "Caviar", "Beluga" ],
	time: new Date("1 Jan 2007").getTime(),
        data: "If you have to ask, you can't afford it"
    }
];

var undos = [
    "D:Fine-dining @01/01/2000, 00:00:00",
    "D:Fine-dining↘Caviare @01/01/2001, 00:00:00",
    "D:Fine-dining↘Caviare↘Beluga @01/01/2002, 00:00:00",
    "C:Fine-dining↘Caviare↘Beluga @01/01/2003, 00:00:00",
    "R:Fine-dining↘Caviar 'Caviare' @01/01/2005, 00:00:00",
    "E:Fine-dining↘Caviar↘Beluga '£6.70 per gram' @01/01/2006, 00:00:00",
    "X:Fine-dining↘Caviar↘Beluga @01/01/2007, 00:00:00"
];

if (typeof module === "undefined") {
    // Browser only
    
    var assert = chai.assert;

    function compare(a, b) {
        if (a == b)
            return 0;
        return (a < b) ? -1 : 1;
    }

    Squirrel.contextMenu = function(f) {
        return false;
    };

    describe('Tree', function() {
        var $DOMtree, DOMtree;
        
        beforeEach(function() {
            $DOMtree = $("#sites-node");
            $DOMtree
                .tree({
                    is_root: true,
                    compare: compare
                });
            DOMtree = $DOMtree.data("squirrelTree");
        });

        afterEach(function() {
            //        $("#sites-node").find("ul").remove();
        });
        
        it("should play_actions into empty hoard", function() {
	    // Reconstruct a cache from an actions list in an empty hoard
            var h = new Hoard("Test1");
            var undi = 0;
	    h.play_actions(
                actions,
                function (e) {
                    // this:Hoard, e:Action
                    DOMtree.action(e, function undo(e) {
                        assert.equal(Hoard.stringify_action(e), undos[undi++]);
                    });
                });
            
        });
    });
}
