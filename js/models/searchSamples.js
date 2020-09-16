
var _ = require('../underscore_ext').default;
var {parse} = require('./searchParser');
//var {shouldNormalize, shouldLog} = require('./denseMatrix');

var includes = (target, str) => {
	return str.toLowerCase().indexOf(target.toLowerCase()) !== -1;
};

function invert(matches, allSamples) {
	return _.difference(allSamples, matches);
}

function filterSampleIds(cohortSamples, cmp, str) {
	return _.filterIndices(cohortSamples, s => cmp(str, s));
}

function searchSampleIds(cohortSamples, str) {
	return filterSampleIds(cohortSamples, includes, str);
}

function searchSampleIdsExact(cohortSamples, str) {
	return filterSampleIds(cohortSamples, (x, y) => x === y, str);
}

var searchCoded = _.curry((cmp, ctx, search, data) => {
	var {req: {values: [field]}, codes} = data,
		filter = search === 'null' ?
			v => v === null :
			v => _.has(codes, v) && cmp(search, codes[v]);
	return _.filterIndices(field, filter);
});

var tol = 0.01;
var near = _.curry((x, y) => (x === null || y === null) ? y === x : Math.abs(x - y) < tol);

var searchFloat = _.curry((dataField, cmp, ctx, search, data) => {
	var values = _.getIn(data, [dataField, 'values'], [[]]),
		searchVal = search === 'null' ? null : parseFloat(search);

	if (searchVal === null) { // special case for null: handle sub-columns.
		let cols = _.range(values.length),
			rows = _.range(values[0].length);
		return _.filterIndices(rows, i => _.every(cols, j => values[j][i] === null));
	}
	if (isNaN(searchVal) || values.length > 1) {
		// don't try to search strings against floats, and don't try to
		// search sub-columns.
		return [];
	}
	return _.filterIndices(_.map(values[0], cmp(searchVal)), _.identity);
});

var searchMutation = _.curry((cmp, {allSamples}, search, data) => {
	var {req: {rows, samplesInResp}} = data;

	if (search === 'null') {
		return invert(samplesInResp, allSamples);
	}

	// omit 'sample' from the variant search, because it is not stable:
	// it's an index into the sample id list, and so changes after filter.
	let matchingRows = _.filter(rows, row => _.any(row, (v, k) => k !== 'sample' && cmp(search, _.isString(v) ? v : String(v))));
	return _.uniq(_.pluck(matchingRows, 'sample'));
});

var searchMethod = {
	coded: searchCoded(includes),
	float: searchFloat('req', near),
	mutation: searchMutation(includes),
	segmented: searchFloat('avg', near),
	samples: searchSampleIds
};

var eq = _.curry((x, y) => x === y);

var searchExactMethod = {
	coded: searchCoded(eq),
	float: searchFloat('req', eq),
	mutation: searchMutation(eq),
	segmented: searchFloat('avg', eq),
	samples: searchSampleIdsExact
};

var empty = () => [];
var lt = _.curry((x, y) => x !== null && y !== null && y < x);
var le = _.curry((x, y) => x !== null && y !== null && y <= x);
var gt = _.curry((x, y) => x !== null && y !== null && y > x);
var ge = _.curry((x, y) => x !== null && y !== null && y >= x);

var searchLt = {
	coded: empty,
	mutation: empty,
	segmented: searchFloat('avg', lt),
	float: searchFloat('req', lt)
};

var searchLe = {
	coded: empty,
	mutation: empty,
	segmented: searchFloat('avg', le),
	float: searchFloat('req', le)
};

var searchGt = {
	coded: empty,
	mutation: empty,
	segmented: searchFloat('avg', gt),
	float: searchFloat('req', gt)
};

var searchGe = {
	coded: empty,
	mutation: empty,
	segmented: searchFloat('avg', ge),
	float: searchFloat('req', ge)
};

var m = (methods, exp, defaultMethod) => {
	let [type, ...args] = exp,
		method = methods[type];
	return method ? method(...args) : defaultMethod(exp);
};

function searchAll(ctx, methods, search) {
	let {cohortSamples, columns, data} = ctx;
	return _.union(..._.map(columns, (c, key) => methods[c.valueType](ctx, search, data[key])),
				   methods.samples(cohortSamples, search));
}

function evalFieldExp(ctx, expression, column, data) {
	if (!column || !_.get(data, 'req')) {
		return [];
	}
	return m({
		value: search => searchMethod[column.valueType](ctx, search, data),
		'quoted-value': search => searchExactMethod[column.valueType](ctx, search, data),
		ne: exp => invert(evalFieldExp(ctx, exp, column, data), ctx.allSamples),
		lt: search => searchLt[column.valueType](ctx, search, data),
		gt: search => searchGt[column.valueType](ctx, search, data),
		le: search => searchLe[column.valueType](ctx, search, data),
		ge: search => searchGe[column.valueType](ctx, search, data)
	}, expression);
}

// XXX should rename ne to not, since we've implemented it that way.
// Unary ! or NOT can be implemented using the same operation.
function evalexp(ctx, expression) {
	return m({
		value: search => searchAll(ctx, searchMethod, search),
		'quoted-value': search => searchAll(ctx, searchExactMethod, search),
		ne: exp => invert(evalexp(ctx, exp), ctx.allSamples),
		and: (...exprs) => _.intersection(...exprs.map(e => evalexp(ctx, e))),
		or: (...exprs) => _.union(...exprs.map(e => evalexp(ctx, e))),
		group: exp => evalexp(ctx, exp),
		field: (field, exp) => evalFieldExp(ctx, exp, ctx.columns[ctx.fieldMap[field]], ctx.data[ctx.fieldMap[field]])
	}, expression);
}

function treeToString(tree) {
	return m({
		cross: exprs => _.map(exprs, treeToString).join(' ; '),
		value: value => value,
		'quoted-value': value => `"${value}"`,
		and: (...factors) => _.map(factors, treeToString).join(' '),
		or: (...terms) => _.map(terms, treeToString).join(' OR '),
		group: exp => `(${treeToString(exp)})`,
		field: (field, value) => `${field}:${treeToString(value)}`,
		ne: term => `!=${treeToString(term)}`,
		lt: value => `<${value}`,
		gt: value => `>${value}`,
		le: value => `<=${value}`,
		ge: value => `>=${value}`
	}, tree);
}

function evalsearch(ctx, search) {
	var prefix = search.length - search.trimStart().length;
	var expr = parse(search.trim());
	var [/*cross*/, exprs, offsets] = expr;
	return {
		exprs: exprs.map(treeToString),
		matches: exprs.map(exp => evalexp(ctx, exp)),
		offsets: offsets.map(o => o + prefix)
	};
}

const A = 'A'.charCodeAt(0);
var toFieldId = i => String.fromCharCode(i + A);

function createFieldIds(len) {
	return _.times(len, toFieldId);
}

function createFieldMap(columnOrder) {
	return _.object(createFieldIds(columnOrder.length), columnOrder);
}

function searchSamples(search, columns, columnOrder, data, cohortSamples) {
	if (!_.get(search, 'length')) {
		return {exprs: null, matches: null};
	}
	let fieldMap = createFieldMap(columnOrder),
		allSamples = _.range(_.get(cohortSamples, 'length'));
	try {
		return evalsearch({columns, data, fieldMap, cohortSamples, allSamples}, search);
	} catch(e) {
		console.log('parsing error', e);
		return {exprs: [], matches: [[]]};
	}
}

function remapTreeFields(tree, mapping) {
	return m({
		cross: exprs => ['cross', _.map(exprs, t => remapTreeFields(t, mapping))],
		and: (...factors) => ['and', ..._.map(factors, t => remapTreeFields(t, mapping))],
		or: (...terms) => ['or', ..._.map(terms, t => remapTreeFields(t, mapping))],
		group: exp => ['group', remapTreeFields(exp, mapping)],
		field: (field, value) => ['field', _.get(mapping, field, 'XXX'), value]
	}, tree, _.identity);
}

// Remap field ids in search expressions. For example,
//
// oldOrder: [uuid0, uuid1, ...]
// newOrder: [uuid1, uuid0, ...]
// exp: "A:foo B:bar"
// out: "A:bar B:foo"
function remapFields(oldOrder, order, exp) {
	if (!_.get(exp, 'length')) {
		return null;
	}
	try {
		var tree = parse(exp.trim());
	} catch {
		return null;
	}
	var fieldIds = createFieldIds(order.length),
		oldFieldMap = _.invert(createFieldMap(oldOrder)),
		newOrder = _.map(order, uuid => oldFieldMap[uuid]),
		mapping = _.object(newOrder, fieldIds);
	return treeToString(remapTreeFields(tree, mapping));
}

function extendUp({index, count}, pred) {
	var start = index, i;
	for (i = index + 1; i < index + count; ++i) {
		if (pred(start, i)) {
			break;
		}
	}
	return {
		start,
		end: i
	};
}

function extendDown({index, count}, pred) {
	var end = index + count, i;
	for (i = end - 2; i >= index; --i) {
		if (pred(end - 1, i)) {
			break;
		}
	}
	return {
		start: i + 1,
		end,
	};
}

function equalMatrix(data, samples, s0, s1) {
	var values = _.getIn(data, ['req', 'values']);
	return values.length > 1 ? false :
		values[0][samples[s0]] === values[0][samples[s1]];
}

function equalFalse() {
	return false;
}

function equalSegmented(data, samples, s0, s1) {
	var values = _.getIn(data, ['avg', 'values']);
	return values[samples[s0]] === values[samples[s1]];
}


var equalMethod = {
	coded: equalMatrix,
	float: equalMatrix,
	mutation: equalFalse,
	segmented: equalSegmented,
	samples: equalFalse
};

var codeOrNull = (codes, val) => val == null ? 'null' : `"${codes[val]}"`;

function matchEqualCoded(data, samples, id, s) {
	var {req: {values: [field]}, codes} = data;
	return `${id}:=${codeOrNull(codes, field[samples[s]])}`;
}

function matchEqualFloat(data, samples, id, s) {
	if (_.every(data.req.values, field => field[samples[s]] == null)) {
		return `${id}:=null`;
	}
	if (data.req.values.length !== 1) {
		return '';
	}
	var {req: {values: [field]}} = data;
	return `${id}:=${field[samples[s]]}`;
}

function matchEqualSegmented(data, samples, id, s) {
	var {avg: {values: [field]}} = data;
	return `${id}:=${field[samples[s]]}`;
}

function matchEqualMutation() {
	return '';
}

var matchEqualMethod = {
	coded: matchEqualCoded,
	float: matchEqualFloat,
	mutation: matchEqualMutation,
	segmented: matchEqualSegmented,
	samples: matchEqualCoded
};

function matchRangeCoded(data, samples, id, start, end, first) {
	var {req: {values: [field]}, codes} = data,
		matches = _.uniq(_.range(start, end).map(i => field[samples[i]]))
			.map(v => codeOrNull(codes, v)),
		terms = matches.map(c => `${id}:=${c}`).join(' OR ');

	return first || matches.length === 1 ? terms : `(${terms})`;
}

function matchRangeFloat(data, samples, id, start, end) {
	// XXX review meaning of null on multivalued columns
	if (_.every(data.req.values, field => field[samples[start]] == null)) {
		return `${id}:=null`;
	}
	if (data.req.values.length !== 1) {
		return '';
	}
	var {req: {values: [field]}} = data,
		matches = [start, end - 1].map(i => field[samples[i]]),
		max = _.max(matches),
		min = _.min(matches);
	return `${id}:>=${min} ${id}:<=${max}`;
}

function matchRangeMutation(data, samples, id, start/*, end*/) {
	if (data.req.samplesInResp.indexOf(samples[start]) === -1) {
		return `${id}:=null`;
	}
	return '';
}

function matchRangeSegmented(data, samples, id, start, end) {
	if (_.every(data.avg.values, field => field[samples[start]] == null)) {
		return `${id}:=null`;
	}
	var {avg: {values: [field]}} = data,
		matches = [start, end - 1].map(i => field[samples[i]]),
		max = _.max(matches),
		min = _.min(matches);
	return `${id}:>=${min} ${id}:<=${max}`;
}

var matchRangeMethod = {
	coded: matchRangeCoded,
	float: matchRangeFloat,
	mutation: matchRangeMutation,
	segmented: matchRangeSegmented,
	samples: matchRangeCoded
};

var nullMismatchMethod = {
	float: (data, s0, s1) =>
		// XXX review meaning of null on multivalued columns
		(data.req.values[0][s0] == null) !== (data.req.values[0][s1] == null),
	coded: () => false,
	mutation: () => false,
	segmented: (data, s0, s1) =>
		(data.avg.values[0][s0] == null) !== (data.avg.values[0][s1] == null)
};

function pickSamplesFilter(flop, dataIn, samples, columnsIn, id, range) {
	// This weirdness is special handling for drag on sampleID. Normally
	// we don't consider sampleID for the filter range, so we slice(1) the
	// columns and data to skip it. If the user specifically drags on the
	// sampleIDs then we leave it in, but it's the only column. We use
	// the original column count, columnsIn.length, for setting the field id.
	var [columns, data] =
		columnsIn.length === 1 ? [columnsIn, dataIn] :
		[columnsIn.slice(1), dataIn.slice(1)];
	var leftCols = _.initial(columns),
		thisCol = _.last(columns);
	var neq = (mark, i) =>
			nullMismatchMethod[thisCol.valueType](_.last(data), samples[mark], samples[i]) ||
			!_.every(leftCols,
					(column, j) => equalMethod[column.valueType](data[j], samples, mark, i));

	// XXX Note that these methods will behave badly on null data in singlecell branch, due to
	// NaN !== NaN.
	var {start, end} = (flop ? extendDown : extendUp)(range, neq);

	return leftCols.map((column, i) => matchEqualMethod[column.valueType](data[i], samples,
				toFieldId(i + 1), start)).join(' ') + (leftCols.length ? ' ' : '') +
			matchRangeMethod[thisCol.valueType](_.last(data), samples,
					toFieldId(columnsIn.length - 1), start, end, leftCols.length === 0);
}

module.exports = {
	searchSamples,
	treeToString,
	remapFields,
	pickSamplesFilter,
	parse
};
