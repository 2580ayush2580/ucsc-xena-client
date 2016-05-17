/*global require: false, module: false, console: false */
'use strict';

var _ = require('../underscore_ext');
var _s = require('underscore.string');
var {parse} = require('./searchParser');


// Return indices of arr for which fn is true. fn is passed the value and index.
// XXX also appears in models/km. Could move to underscore_ext.
var filterIndices = (arr, fn) => _.range(arr.length).filter(i => fn(arr[i], i));

function searchSampleIds(cohortSamples, str) {
	return filterIndices(_.flatten(cohortSamples), s => s.includes(str));
}

function searchSampleIdsExact(cohortSamples, str) {
	return filterIndices(_.flatten(cohortSamples), s => s === str);
}

var searchCoded = _.curry((cmp, search, data) => {
	var {req: {values: [field]}, codes} = data;
	return filterIndices(field, v => _.has(codes, v) && cmp(search, codes[v]));
});

var tol = 0.001;
var near = _.curry((x, y) => Math.abs(x - y) < tol);

var searchFloat = _.curry((cmp, search, data) => {
	var {req: {values}} = data,
		searchVal = search === 'null' ? null : parseFloat(search);
	if (isNaN(searchVal) || values.length > 1) {
		// don't try to search strings against floats, and don't try to
		// search sub-columns.
		return [];
	}
	return filterIndices(_.map(values[0], cmp(searchVal)), _.identity);
});

var searchMutation = _.curry((cmp, search, data) => {
	var {req: {rows}} = data,
		matchingRows = _.filter(rows, row => _.any(row, v => cmp(search, String(v))));

	return _.uniq(_.pluck(matchingRows, 'sample'));
});

// Similar to es6 String.includes, but params reversed & the browser
// can optimize it.
var includes = (target, str) => str.indexOf(target) !== -1;

var searchMethod = {
	coded: searchCoded(includes),
	float: searchFloat(near),
	mutation: searchMutation(includes),
	samples: searchSampleIds
};

var searchExactMethod = {
	coded: searchCoded((target, value) => value === target),
	float: searchFloat(_.curry((x, y) => x === y)), // XXX does this make sense?
	mutation: searchMutation((target, value) => value === target),
	samples: searchSampleIdsExact
};

var empty = () => [];

var searchLt = {
	coded: empty,
	mutation: empty,
	float: searchFloat(_.curry((x, y) => x !== null && y !== null && y < x))
};

var searchLe = {
	coded: empty,
	mutation: empty,
	float: searchFloat(_.curry((x, y) => x !== null && y !== null && y <= x))
};

var searchGt = {
	coded: empty,
	mutation: empty,
	float: searchFloat(_.curry((x, y) => x !== null && y !== null && y > x))
};

var searchGe = {
	coded: empty,
	mutation: empty,
	float: searchFloat(_.curry((x, y) => x !== null && y !== null && y >= x))
};

var m = (methods, exp, defaultMethod) => {
	let [type, ...args] = exp,
		method = methods[type];
	return method ? method(...args) : defaultMethod(exp);
};

function searchAll(columns, methods, data, search, cohortSamples) {
	return _.union(..._.map(columns, (c, key) => methods[c.valueType](search, data[key])),
				   methods['samples'](cohortSamples, search));
}

function evalFieldExp(expression, column, data) {
	if (!column) {
		return [];
	}
	return m({
		value: search => searchMethod[column.valueType](search, data),
		'quoted-value': search => searchExactMethod[column.valueType](search, data),
		lt: search => searchLt[column.valueType](search, data),
		gt: search => searchGt[column.valueType](search, data),
		le: search => searchLe[column.valueType](search, data),
		ge: search => searchGe[column.valueType](search, data)
	}, expression);
}

function evalexp(expression, columns, data, fieldMap, cohortSamples) {
	return m({
		value: search => searchAll(columns, searchMethod, data, search, cohortSamples),
		'quoted-value': search => searchAll(columns, searchExactMethod, data, search, cohortSamples),
		and: (...exprs) => _.intersection(...exprs.map(e => evalexp(e, columns, data, fieldMap, cohortSamples))),
		or: (...exprs) => _.union(...exprs.map(e => evalexp(e, columns, data, fieldMap, cohortSamples))),
		group: exp => evalexp(exp, columns, data, fieldMap),
		field: (field, exp) => evalFieldExp(exp, columns[fieldMap[field]], data[fieldMap[field]])
	}, expression);
}

function createFieldIds(len) {
	const A = 'A'.charCodeAt(0);
	return _.range(len).map(i => String.fromCharCode(i + A));
}

function createFieldMap(columnOrder) {
	return _.object(createFieldIds(columnOrder.length), columnOrder);
}

function searchSamples(search, columns, columnOrder, data, cohortSamples) { //eslint-disable-line no-unused-vars
	if (!_.get(search, 'length')) {
		return null;
	}
	let fieldMap = createFieldMap(columnOrder);
	try {
		var exp = parse(_s.trim(search));
		return evalexp(exp, columns, data, fieldMap, cohortSamples);
	} catch(e) {
		console.log('parsing error', e);
		return [];
	}
}

function treeToString(tree) {
	return m({
		value: value => value,
		'quoted-value': value => `"${value}"`,
		and: (...factors) => _.map(factors, treeToString).join(' '),
		or: (...terms) => _.map(terms, treeToString).join(' OR '),
		field: (field, value) => `${field}:${treeToString(value)}`,
		lt: value => `<${value}`,
		gt: value => `>${value}`,
		le: value => `<=${value}`,
		ge: value => `>=${value}`
	}, tree);
}

function remapTreeFields(tree, mapping) {
	return m({
		and: (...factors) => ['and', ..._.map(factors, t => remapTreeFields(t, mapping))],
		or: (...terms) => ['or', ..._.map(terms, t => remapTreeFields(t, mapping))],
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
	var fieldIds = createFieldIds(order.length),
		oldFieldMap = _.invert(createFieldMap(oldOrder)),
		newOrder = _.map(order, uuid => oldFieldMap[uuid]),
		mapping = _.object(newOrder, fieldIds),
		tree = parse(_s.trim(exp));
	return treeToString(remapTreeFields(tree, mapping));
}

module.exports = {
	searchSamples,
	treeToString,
	remapFields,
	parse
};
