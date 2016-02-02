/*globals require: false, module: false */

'use strict';

var React = require('react');
var Col = require('react-bootstrap/lib/Col');
var Row = require('react-bootstrap/lib/Row');
var Button = require('react-bootstrap/lib/Button');
var ColumnEdit = require('./columnEdit');
var Sortable = require('./Sortable');
require('react-resizable/css/styles.css');
var _ = require('./underscore_ext');
var widgets = require('./columnWidgets');
var Tooltip = require('Tooltip');
var rxEventsMixin = require('./react-utils').rxEventsMixin;
var meta = require('./meta');
var VizSettings = require('./heatmapVizSettings');
require('./Columns.css'); // XXX switch to js styles
require('./YAxisLabel.css'); // XXX switch to js styles

var YAxisLabel = React.createClass({
	render: function () {
		// XXX would prefer to enforce that these keys are present & destructure
		var height = _.getIn(this.props, ['zoom', 'height']),
			index = _.getIn(this.props, ['zoom', 'index']) || 0,
			count = _.getIn(this.props, ['zoom', 'count']) || 0,
			length = _.getIn(this.props, ['samples', 'length']) || 0,
			fraction = count === length ? '' :
				// babel-eslint/issues/31
				`, showing ${ index } - ${ index + count - 1 }`, // eslint-disable-line comma-spacing
			 text = `Samples (N=${ length }) ${ fraction }`;

	return (
			<div style={{height: height}} className="YAxisWrapper">
				<p style={{width: height}} className="YAxisLabel">{text}</p>
			</div>
		);
	}
});

function zoomIn(pos, samples, zoom) {
	var {count, index} = zoom;
	var nCount = Math.max(1, Math.floor(count / 3)),
		maxIndex = samples - nCount,
		nIndex = Math.max(0, Math.min(Math.round(index + pos * count - nCount / 2), maxIndex));

	return _.merge(zoom, {count: nCount, index: nIndex});
}


function zoomOut(samples, zoom) {
	var {count, index} = zoom;
	var nCount = Math.min(samples, Math.round(count * 3)),
		maxIndex = samples - nCount,
		nIndex = Math.max(0, Math.min(Math.round(index + (count - nCount) / 2), maxIndex));

	return _.merge(zoom, {count: nCount, index: nIndex});
}

function targetPos(ev) {
	var bb = ev.target.getBoundingClientRect();
	return (ev.clientY - bb.top) / ev.target.clientHeight;
}

var Columns = React.createClass({
	// XXX pure render mixin? Check other widgets, too, esp. columns.
	mixins: [rxEventsMixin],
	componentWillMount: function () {
		this.events('tooltip', 'click', 'plotClick', 'plotDoubleClick');

		this.ev.plotClick.filter(ev => ev.shiftKey).subscribe(() => {
			let {callback, appState: {zoom, samples}} = this.props;
			callback(['zoom', zoomOut(samples.length, zoom)]);
		});

		this.ev.plotDoubleClick.subscribe(ev => {
			let {callback, appState: {samples, zoom}} = this.props;
			callback(['zoom', zoomIn(targetPos(ev), samples.length, zoom)]);
		});

		var toggle = this.ev.click.filter(ev => ev[meta.key])
			.map(() => 'toggle');

		this.tooltip = this.ev.tooltip.merge(toggle)
			// If open + user clicks, toggle freeze of display.
			.scan([null, false],
				([tt, frozen], ev) =>
					ev === 'toggle' ? [tt, tt.open && !frozen] : [ev, frozen])
			// Filter frozen events until frozen state changes.
			.distinctUntilChanged(([ev, frozen]) => frozen ? frozen : [ev, frozen])
			.map(([ev, frozen]) => _.assoc(ev, 'frozen', frozen))
			.subscribe(ev => this.setState({tooltip: ev}));
	},
	componentWillUnmount: function () { // XXX refactor into a takeUntil mixin?
		// XXX are there other streams we're leaking? What listens on this.ev.click, etc?
		this.tooltip.dispose();
	},
	getInitialState: function () {
		return {tooltip: {open: false}, openVizSettings: null};
	},
	setOrder: function (order) {
		this.props.callback(['order', order]);
	},
	onViz: function (id) {
		var dsID = _.getIn(this.props.appState, ['columns', id, 'dsID']);
		this.setState({openVizSettings: dsID});
	},
	render: function () {
		var {callback, appState} = this.props;
		// XXX maybe rename index -> indexes?
		var {data, index, zoom, columns, columnOrder, cohort, samples} = appState;
		var {openColumnEdit, openVizSettings} = this.state;
		var height = zoom.height;
		var editor = openColumnEdit ?
			<ColumnEdit
				{...this.props}
				onRequestHide={() => this.setState({openColumnEdit: false})}
			/> : null;
		// XXX parameterize settings on column type
		var settings = openVizSettings ?
			<VizSettings
				dsID={openVizSettings}
				onRequestHide={() => this.setState({openVizSettings: null})}
				callback={callback}
				state={_.getIn(appState, ['vizSettings'])} /> : null;

		// XXX Should we use controllers/paths for accessing state data in
		// the view?
		var columnViews = _.map(columnOrder, id => widgets.column({
			ref: id,
			key: id,
			id: id,
			data: _.getIn(data, [id]),
			index: _.getIn(index, [id]),
			vizSettings: _.getIn(appState, ['vizSettings',
				_.getIn(columns, [id, 'dsID'])]),
			samples: samples,
			zoom: zoom,
			callback: callback,
			tooltip: this.ev.tooltip,
			onViz: this.onViz,
			onClick: this.ev.plotClick,
			onDoubleClick: this.ev.plotDoubleClick,
			column: _.getIn(columns, [id]),
			dataset: _.getIn(appState, ['datasets', 'datasets',
				_.getIn(columns, [id, 'dsID'])])
		}));

		return (
			<div className="Columns">
				<Sortable onClick={this.ev.click} setOrder={this.setOrder}>
					{columnViews}
				</Sortable>
				<div
					style={{height: height}}
					className='addColumn Column'>

					{cohort &&
						<Button
							onClick={() => this.setState({openColumnEdit: true})}
							className='Column-add-button'
							title='Add a column'>
							+
						</Button>}
				</div>
				<div className='crosshairH crosshair' />
				{editor}
				{settings}
				<Tooltip {...this.state.tooltip}/>
			</div>
		);
	}
});

var Spreadsheet = React.createClass({
	render: function () {
		var {appState: {zoom, samples}} = this.props;
		return (
			<Row>
				<Col md={1}>
					<YAxisLabel
						samples={samples}
						zoom={zoom}
					/>
				</Col>
				<Col md={11}><Columns {...this.props}/></Col>
			</Row>
		);
	}
});

module.exports = Spreadsheet;
