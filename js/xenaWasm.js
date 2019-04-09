'use strict';
var wasm = require('ucsc-xena-wasm');

var Module;

function toWASM(arr) {
	var arrWASM = Module._malloc(arr.length * arr.BYTES_PER_ELEMENT),
		u8 = new Uint8Array(arr.buffer);
	Module.HEAPU8.set(u8, arrWASM);
	return arrWASM;
}

var pointerSize = 4;
function marshalList(arrays) {
	var arrWASM = arrays.map(toWASM),
		list = Module._malloc(arrWASM.length * pointerSize);

	arrWASM.forEach(function(a, i) {
		Module.setValue(list + i * pointerSize, a, '*');

	});
	return list;
}

function freeList(list, n) {
	var a;
	for (var i = 0; i < n; ++ i) {
		a = Module.getValue(list + i * pointerSize, '*');
		Module._free(a);
	}
	Module._free(list);
}

// XXX Note that if we return a view of memory over the indiciesW result, we
// can't free it.  We need to allocate the indicies once, then free/allocate if
// the sample count changes.  Or, we have to copy the indicies out before
// freeing. That's what slice() does.
//
// XXX important safety tip: using ALLOW_MEMORY_GROWTH means
// a malloc call can invalidate views, because it grows by
// allocating a new, larger memory space. Perhaps we could
// use a proxy object that recreates views if they become
// obsolete. Or, live with the copy overhead on each call.
// XXX See also SPLIT_MEMORY, which may resolve this problem by
// using a different growth mechanism.

export function fradixSortL16$64(input, indicies) {
	var list = marshalList(input),
		indiciesW = toWASM(indicies),
		N = indicies.length;

	Module.ccall('fradixSortL16_64', null,
		// list, listM, N, indicies
		['number', 'number', 'number', 'number'],
		[list, input.length, N, indiciesW]);

	var r = new Uint32Array(Module.HEAPU8.buffer.slice(indiciesW, indiciesW + 4 * N));
	freeList(list, input.length);
	Module._free(indiciesW);
	return r;
}

export function fradixSort16$64Init() {
	Module.ccall('fradixSort16_64_init', null, [], []);
}

var floatSize = 4;
export function fradixSort16Init() {
	Module.ccall('fradixSort16_init', null, [], []);
}

export function faminmaxInit() {
	Module.ccall('faminmax_init');
}

// Float32Array.from is comically slow, so do this instead.
// Also, consider keeping the data in the wasm heap.
function toFloatArray(arr) {
	var F32 = new Float32Array(arr.length);
	F32.set(arr);
	return F32;
}

export function faminmax(arr) {
	var arrW = toWASM(arr.BYTES_PER_ELEMENT ? arr : toFloatArray(arr));
	var r = Module.ccall('faminmax', 'number', ['number', 'number'],
			[arrW, arr.length]);
	Module._free(arrW);
	return {min: Module.getValue(r, 'float'), max: Module.getValue(r + floatSize, 'float')};
}

export function fameanmedian(arr) {
	var arrW = toWASM(arr.BYTES_PER_ELEMENT ? arr : toFloatArray(arr));
	var r = Module.ccall('fameanmedian', 'number', ['number', 'number'],
			[arrW, arr.length]);
	Module._free(arrW);
	return {mean: Module.getValue(r, 'float'), median: Module.getValue(r + floatSize, 'float')};
}

export function fameanmedianInit() {
	Module.ccall('fameanmedian_init', null, [], []);
}

function allocScale64(domain, range) {
	var scale = Module._malloc(4 + (8 + 3) * 4);
	Module.setValue(scale + 8 * 4, domain.length, 'i32');
	for (var i = 0; i < domain.length; ++i) {
		Module.setValue(scale + i * 8, domain[i], 'double');
		Module.setValue(scale + 36 + i * 3, range[i][0], 'i8');
		Module.setValue(scale + 36 + i * 3 + 1, range[i][1], 'i8');
		Module.setValue(scale + 36 + i * 3 + 2, range[i][2], 'i8');
	}
	return scale;
}

var setPrecision = x => parseFloat(x.toPrecision(2));
// Just for testing. You wouldn't want to call this from js in a loop.
export function getColorLog(domainIn, range, value) {
	var domain = domainIn.map(setPrecision);
	var scale = allocScale64(domain, range);
	var lines = Module._malloc(8 * 6);
	var [r0, r1] = range;
	var ld0 = Math.log2(domain[0]);
	var ld1 = Math.log2(domain[1]);
	var m, b;
	for (var i = 0; i < 3; ++i) {
		m = (r1[i] - r0[i]) / (ld1 - ld0);
		b = r1[i] - m * ld1;
		Module.setValue(lines + i * 8, m, 'double');
		Module.setValue(lines + 3 * 8 + i * 8, b, 'double');
	}
	var r = Module.ccall('get_color_log_as_number', 'number', ['number', 'number'],
			[scale, lines, value]);
	Module._free(scale);
	Module._free(lines);

	return r;
}

// Just for testing. You wouldn't want to call this from js in a loop.
export function getColorLinear(domain, range, value) {
	var scale = allocScale64(domain, range);
	var r = Module.ccall('get_color_linear_as_number', 'number', ['number', 'number', 'number'],
			[scale, value]);
	Module._free(scale);
	return r;
}

// importer for wasm code, to work around the async.

export var loaded = wasm().then(m => {
	Module = m;
	fradixSort16$64Init();
	fradixSort16Init();
	faminmaxInit();
	fameanmedianInit();
});
