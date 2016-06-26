/*global require: false, module: false, window: false */
'use strict';
var React = require('react');
var Grid = require('react-bootstrap/lib/Grid');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var AppControls = require('./AppControls');
var KmPlot = require('./KmPlot');
var ChartView = require('./ChartView');
var _ = require('./underscore_ext');
var xenaQuery = require('./xenaQuery');
var {xenaFieldPaths, signatureField} = require('./models/fieldSpec');
var {getColSpec} = require('./models/datasetJoins');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var SampleSearch = require('./views/SampleSearch');
var {rxEventsMixin} = require('./react-utils');
var Rx = require('rx');
var uuid = require('./uuid');
//var Perf = require('react/addons').addons.Perf;

// should really be in a config file.
var searchHelp = 'http://xena.ghost.io/highlight-filter-help/';

function onAbout(dsID) {
	var [host, dataset] = xenaQuery.parse_host(dsID);
	var url = `../datapages/?dataset=${encodeURIComponent(dataset)}&host=${encodeURIComponent(host)}`;
	window.open(url);
}

var getLabel = _.curry((datasets, dsID) => {
	var ds = datasets[dsID];
	return ds.label || ds.name;
});

var getAbout = (dsID, text) => (
	<MenuItem key={dsID} onSelect={() => onAbout(dsID)}>{text} </MenuItem>);


function aboutDataset(column, datasets) {
	var dsIDs = _.map(xenaFieldPaths(column), p => _.getIn(column, [...p, 'dsID'])),
		label = getLabel(datasets);
	if (dsIDs.length === 0) {
		return null;
	} else if (dsIDs.length === 1) {
		return getAbout(dsIDs[0], 'About the Dataset');
	}
	return [
		<MenuItem key='d0' divider/>,
		<MenuItem key='header' header>About the Datasets</MenuItem>,
		..._.map(dsIDs, dsID => getAbout(dsID, label(dsID))),
		<MenuItem key='d1' divider/>
	];
}

var Application = React.createClass({
	mixins: [rxEventsMixin],
//	onPerf: function () {
//		this.perf = !this.perf;
//		if (this.perf) {
//			console.log("Starting perf");
//			Perf.start();
//		} else {
//			console.log("Stopping perf");
//			Perf.stop();
//			Perf.printInclusive();
//			Perf.printExclusive();
//			Perf.printWasted();
//		}
//	},
	componentWillMount: function () {
		this.events('change');
		this.change = this.ev.change
			.debounce(200)
			.subscribe(this.onSearch);
		// high on 1st change, low after some delay
		this.highlight = this.ev.change
			.map(() => Rx.Observable.return(true).concat(Rx.Observable.return(false).delay(300)))
			.switchLatest()
			.distinctUntilChanged();
	},
	componentWillUnmount: function () {
		this.change.dispose();
		this.highlight.dispose();
	},
	aboutDataset: function (uuid) {
		var {columns, datasets} = this.props.state;
		return aboutDataset(_.get(columns, uuid), datasets);
	},
	onSearch: function (value) {
		var {callback} = this.props;
		callback(['sample-search', value]);
	},
	onFilter: function (matches) {
		var {callback, state: {cohortSamples}} = this.props,
			allSamples = _.flatten(cohortSamples),
			matching = _.map(matches, i => allSamples[i]);
		callback(['sampleFilter', 0 /* cohort */, matching]);
	},
	onFilterZoom: function (samples, matches) {
		var {state: {zoom: {height}}, callback} = this.props,
			toOrder = _.object(samples, _.range(samples.length)),
			index = toOrder[_.min(matches, s => toOrder[s])],
			last = toOrder[_.max(matches, s => toOrder[s])];
		callback(['zoom', {index, height, count: last - index + 1}]);
	},
	onFilterColumn: function (matches) {
		var {state: {datasets, cohortSamples, sampleSearch}, callback} = this.props,
			allSamples = _.flatten(cohortSamples),
			matching = _.map(matches, i => allSamples[i]),
			field = signatureField(`${sampleSearch}`, {
				columnLabel: 'filter',
				valueType: 'coded',
				filter: sampleSearch,
				signature: ['in', matching]
			}),
			colSpec = getColSpec([field], datasets),
			settings = _.assoc(colSpec,
					'width', 100,
					'user', _.pick(colSpec, ['columnLabel', 'fieldLabel']));
		callback(['add-column', uuid(), settings, true]);
	},
	render: function() {
		let {state, Spreadsheet, disableKM, supportsGeneAverage, ...otherProps} = this.props,
			{mode, samplesMatched, sampleSearch, samples} = state,
			matches = _.get(samplesMatched, 'length', samples.length),
			onFilter = (matches < samples.length && matches > 0) ?
				() => this.onFilter(samplesMatched) : null,
			onFilterColumn = (matches < samples.length && matches > 0) ?
				() => this.onFilterColumn(samplesMatched) : null,
			onFilterZoom = (matches < samples.length && matches > 0) ?
				() => this.onFilterZoom(samples, samplesMatched) : null,
			View = {
				heatmap: Spreadsheet,
				chart: ChartView
			}[mode];

		return (
			<Grid onClick={this.onClick}>
			{/*
				<Row>
					<Button onClick={this.onPerf}>Perf</Button>
				</Row>
			*/}
				<Row>
					<Col md={12}>
						<AppControls {...otherProps} appState={state} />
					</Col>
				</Row>
				<Row>
					<Col md={8}>
						<SampleSearch
							help={searchHelp}
							value={sampleSearch}
							matches={matches}
							onFilter={onFilter}
							onZoom={onFilterZoom}
							onCreateColumn={onFilterColumn}
							onChange={this.ev.change}/>
					</Col>
				</Row>
				<View {...otherProps}
					columnProps={{
						supportsGeneAverage: supportsGeneAverage,
						aboutDataset: this.aboutDataset,
						disableKM: disableKM,
						searching: this.highlight,
					}}
					widgetProps={{
						sampleFormat: this.props.sampleFormat,
						fieldFormat: this.props.fieldFormat
					}}
					appState={state} />
				{_.getIn(state, ['km', 'id']) ? <KmPlot
						callback={this.props.callback}
						km={state.km}
						features={state.features} /> : null}
				<div className='chartRoot' style={{display: 'none'}} />
			</Grid>
		);
	}
});

module.exports = Application;
