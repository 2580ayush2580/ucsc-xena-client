/*global module: false, require: false */
'use strict';

// XXX move Application to views
var Application = require('../Application');
//var Spreadsheet = require('../Spreadsheet');
var React = require('react');
//var _ = require('../underscore_ext');
var {getSpreadsheetContainer} = require('./SpreadsheetContainer');
var Column = require('../Column');
var _ = require('../underscore_ext');
var kmModel = require('../models/km');
var {lookupSample} = require('../models/sample');
var {xenaFieldPaths} = require('../models/fieldSpec');

// At the top-level, we want to pick an Application widget,
// a Spreadsheet widget, and a Column widget. Are those views
// or containers?
//
// For icgc, then, we would pick different ones, e.g. Application
// widget with column hide/show checkboxes.
//
// We need to parameterize Application by Spreadsheet. We could
// make Application take a prop for Spreadsheet. That might
// be a container or a view. Or, we could make Application a 
// high-order component. It would be better to make ApplicationContainer
// a high-order component, passing in Spreadsheet as a prop.
//

// We don't want to create a class in a render method. Rather, we want
// to instantiate a class during render.
// Could pass down a fn that renders a column.
// Could instantiate the columns here.
//
// When using jsx, render looks like
// createElement(Column, {...props}, ...children)
//

// Passing props => jsx functions seems to mess up React tree
// resolution. We could pass a fn (not component) that returns
// jsx. If the fn depends on things *not* in the props of
// the component that calls the function, the component may
// not render at the right time? Or perhaps it will: the fn
// will be re-bound on each call. Unfortunately, this means it
// will *always* re-render. To avoid this we could memoize the
// call to get the bound fn. Ugh.
//
// OR... we could pass the props down. OR, we could render the
// Columns here. To render the columns here, Column needs polymorphic
// methods for menu, at least. Either put in widgets, or hang off the
// react class.
//

// This seems odd. Surely there's a better test?
function hasSurvival(survival) {
	return !! (_.get(survival, 'ev') &&
			   _.get(survival, 'tte') &&
			   _.get(survival, 'patient'));
}

// For geneProbes we will average across probes to compute KM. For
// other types, we can't support multiple fields.
// XXX maybe put in a selector.
function disableKM(column, features, km) {
	var survival = kmModel.pickSurvivalVars(features, km);
	if (!hasSurvival(survival)) {
		return [true, 'No survival data for cohort'];
	}
	if (column.fields.length > 1) {
		return [true, 'Unsupported for multiple genes/ids'];
	}
	return [false, ''];
}

// We check the field length here, before overlaying a probe list from the
// server, and sending to the Application view. XXX Maybe put the result in a selector,
// to avoid passing it far down the component stack.
function supportsGeneAverage({fieldType, fields: {length}}) {
	return ['geneProbes', 'genes'].indexOf(fieldType) >= 0 && length === 1;
}

function getFieldFormat(uuid, columns, data) {
	var columnFields = _.getIn(columns, [uuid, 'fields']),
		label = _.getIn(columns, [uuid, 'fieldLabel']),
		fields = _.getIn(data, [uuid, 'req', 'probes'], columnFields);
	if (fields.length === 1) {                           // 1 gene/probe, or 1 probe in gene: use default field label
		return () => label;
	} else if (fields.length === columnFields.length) {  // n > 1 genes/probes
		return _.identity;
	} else {                                             // n > 1 probes in gene
		return field => `${label} (${field})`;
	}
}

var getLabel = _.curry((datasets, dsID) => {
	var ds = datasets[dsID];
	return ds.label || ds.name;
});

function datasetMeta(column, datasets) {
	return {
		dsIDs: _.map(xenaFieldPaths(column), p => _.getIn(column, [...p, 'dsID'])),
		label: getLabel(datasets)
	};
}

var SpreadsheetContainer = getSpreadsheetContainer(Column);


var ApplicationContainer = React.createClass({
	supportsGeneAverage(uuid) { // XXX could be precomputed in a selector
		var {columns} = this.props.state;
		return supportsGeneAverage(_.get(columns, uuid));
	},
	disableKM(uuid) { // XXX could be precomputed in a selector
		var {columns, features, km} = this.props.state;
		return disableKM(_.get(columns, uuid), features, km);
	},
	fieldFormat: function (uuid) {
		var {columns, data} = this.props.state;
		return getFieldFormat(uuid, columns, data);
	},
	sampleFormat: function (index) {
		var {cohortSamples} = this.props.state;
		return lookupSample(cohortSamples, index);
	},
	datasetMeta: function (uuid) {
		var {columns, datasets} = this.props.state;
		return datasetMeta(_.get(columns, uuid), datasets);
	},
	render() {
		let {state, selector, callback} = this.props,
			computedState = selector(state);
		return (
			<Application
				supportsGeneAverage={this.supportsGeneAverage}
				disableKM={this.disableKM}
				fieldFormat={this.fieldFormat}
				sampleFormat={this.sampleFormat}
				datasetMeta={this.datasetMeta}
				Spreadsheet={SpreadsheetContainer}
				state={computedState}
				callback={callback}/>);
	}
});

module.exports = ApplicationContainer;
