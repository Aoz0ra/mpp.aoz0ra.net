EXT = window.EXT || {_initfunc: []};
	
EXT._initfunc.push(function() {
	var addon = EXT.draw = {__proto__: null};
	addon.lineLife = 25;
	var p = document.createElement("canvas");
	p.id = "drawboard";
	p.style = "position: absolute; top: 0; left: 0; z-index: 400; pointer-events: none;";
	p.width = window.innerWidth;
	p.height = window.innerHeight;
	document.body.appendChild(p);
	var dbctx = p.getContext("2d");
	var shifted = false;
	var clicking = false;
	$(document).on('mousedown', (e)=>{ if(e.shiftKey){ clicking = true; draw(); e.preventDefault(); }});
	$(document).on('mouseup', (e)=>{ clicking = false; });
	$(document).on('keyup keydown', (e)=>{ shifted = e.shiftKey; });

	addon.enabled = true;
	addon.customColor = null;
	addon.ctx = dbctx;	
	addon.onrefresh = [];
	addon.brushSize = 2;
	addon.mutes = [];
	addon.lines = [];
	addon.buf = [{n: "ndraw", v: 0}];
	function resize(){
		p.width = window.innerWidth;
		p.height = window.innerHeight;
	}
	window.addEventListener('resize', resize, false);
	addon.tryFlush = () => {
		if (addon.buf.length > 3) {
			MPP.client.sendArray([{m: "n", t: Date.now(), n: addon.buf}]);
			addon.buf = [{n: "ndraw", v: 0}];
		}
	};
	addon.addToBuffer = msg => {
		addon.buf.push(msg);
		addon.tryFlush();
	};
	addon.onrefresh.push(function(t) {
		if(addon.lines.length){
                        dbctx.clearRect(0,0,window.innerWidth, window.innerHeight);
                        for(var l = 0; l < addon.lines.length; l++){
                        dbctx.globalAlpha = 1;
                        var c=addon.lines[l];
                        dbctx.strokeStyle = c[6];
                        dbctx.lineWidth = c[5];
                        var d = addon.lineLife - (t - c[4]) / 1000;
                        if (d <= 0){
                                addon.lines.splice(l--, 1);
                                continue;
                        }
                        dbctx.globalAlpha = 0.3 * d;
                        dbctx.beginPath();
                        dbctx.moveTo(c[0], c[1]);
                        dbctx.lineTo(c[2], c[3]);
                        dbctx.stroke();
	        	}
		}
	});
	function redraw() {
		if(addon.enabled){
			var t = Date.now();
			for(var x = 0; x < addon.onrefresh.length; x++){
				addon.onrefresh[x](t);
			}
		}
		/*window.requestAnimationFrame(redraw);*/
	}
	/*window.requestAnimationFrame(redraw);*/
	setInterval(redraw, 16);
	/* https://stackoverflow.com/a/8639991 */
	function stringToBytesFaster(str) {
		var ch, st, re = [], j = 0;
		for (var i = 0; i < str.length; i++ ) {
			ch = str.charCodeAt(i);
			if(ch < 127){
			re[j++] = ch & 0xFF;
			} else {
			st = [];
			do {
				st.push(ch & 0xFF);
				ch = ch >> 8;
			} while (ch);
			st = st.reverse();
			for(var k=0;k<st.length; ++k)
				re[j++] = st[k];
			}
		}
		return re;
	}
	function parseLine(str, color, size) {
		var vector = [0, 0, 0, 0, Date.now(), 1, color];
		var bytes = stringToBytesFaster(str);
		vector[0] = Math.round(((100 / 255) * bytes[0] / 100) * window.innerWidth);
		vector[1] = Math.round(((100 / 255) * bytes[1] / 100) * window.innerHeight);
		vector[2] = Math.round(((100 / 255) * bytes[2] / 100) * window.innerWidth);
		vector[3] = Math.round(((100 / 255) * bytes[3] / 100) * window.innerHeight);
		vector[5] = size;
		addon.lines.push(vector);
	}
	function draw() {
		var u = MPP.client.getOwnParticipant();
		u.y = Math.max(Math.min(100, u.y), 0);
		u.x = Math.max(Math.min(100, u.x), 0);
		var lastpos = [u.x, u.y];
		var b = new ArrayBuffer(4);
		var dv = new DataView(b);
		dv.setUint8(0, Math.round(u.x / 100 * 255));
		dv.setUint8(1, Math.round(u.y / 100 * 255));
		function poll() {
			if ((lastpos[0] != u.x || lastpos[1] != u.y) && MPP.noteQuota.spend(4)) {
				u.y = Math.max(Math.min(100, u.y), 0);
				u.x = Math.max(Math.min(100, u.x), 0);
				dv.setUint8(2, Math.round(u.x / 100 * 255));
				dv.setUint8(3, Math.round(u.y / 100 * 255));
				let s = String.fromCharCode.apply(null, new Uint8Array(b));
				let clr = addon.customColor || MPP.client.getOwnParticipant().color;
				addon.addToBuffer({n: s, v: 2, d: 2});// position
				addon.addToBuffer({n: "si" + Math.min(+addon.brushSize, 5), v: 2, d: 2});// size
				addon.addToBuffer({n: parseInt(clr.slice(1), 16).toString(32), v: 2, d: 2});// color
				dv.setUint8(0, Math.round(u.x / 100 * 255));
				dv.setUint8(1, Math.round(u.y / 100 * 255));
				lastpos = [u.x, u.y];
				parseLine(s, clr, Math.min(addon.brushSize, 5));
			}
			if (clicking) setTimeout(poll, 25);
		}
		setTimeout(poll, 25);
	}

	addon.mkline = function(x, y, x2, y2, s, color) {
		if (MPP.noteQuota.spend(4)) {
			if(x<0||y<0||x2<0||y2<0||x>255||y>255||x2>255||y2>255)return;
			var b = new ArrayBuffer(4);
			var dv = new DataView(b);
			dv.setUint8(0, x);
			dv.setUint8(1, y);
			dv.setUint8(2, x2);
			dv.setUint8(3, y2);
			var str = String.fromCharCode.apply(null, new Uint8Array(b));
			var clr = color || addon.customColor || MPP.client.getOwnParticipant().color;
			addon.addToBuffer({n: str, v: 2, d: 2});
			addon.addToBuffer({n: "si" + Math.min(s || 1, 5), v: 2, d: 2});
			addon.addToBuffer({n: parseInt(clr.slice(1), 16), v: 2, d: 2});
			parseLine(str, clr, Math.min(s || 1, 5));
		}
	}
	addon.tohtml = function(c) {
		c = parseInt(c, 32).toString(16);
		return '#' + ('000000' + c).substring(c.length);
	};
	MPP.client.on('n', msg => {
		let notes = msg.n;
		if (notes[0].n == "ndraw" && addon.mutes.indexOf(MPP.client.findParticipantById(msg.p)._id) === -1) {
			notes.shift();
			let toDraw = {pos: null, size: null, color: null};
			let drawi = 0;
			notes.forEach(drawNote => {
				if (drawi == 0) {
					toDraw.pos = drawNote.n;
				} else if (drawi == 1) {
					toDraw.size = +(drawNote.n).slice(2) < 1 ? 1 : Math.min(+(drawNote.n).slice(2), 5);
				} else if (drawi == 2) {
					toDraw.color = (drawNote.n !== undefined && addon.tohtml(drawNote.n)) || MPP.client.findParticipantById(msg.p).color;
					parseLine(toDraw.pos, toDraw.color, toDraw.size);
					drawi = -1;
					toDraw = {pos: null, size: null, color: null};
				}
				drawi++;
			});
		}
	});
	MPP.client.on('c', () => {
		addon.lines = [[0, 0, 0, 0, 0, 0, "#0"]];
	});
});
