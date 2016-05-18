/*eslint-env browser */
/*globals require: false, module: false */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var _ = require('./underscore_ext');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var SplitButton = require('react-bootstrap/lib/SplitButton');
var Badge = require('react-bootstrap/lib/Badge');
var Resizable = require('react-resizable').Resizable;
var DefaultTextInput = require('./DefaultTextInput');
var {RefGeneAnnotation} = require('./refGeneExons');
var SpreadSheetHighlight = require('./SpreadSheetHighlight');

// XXX move this?
function download([fields, rows]) {
	var txt = _.map([fields].concat(rows), row => row.join('\t')).join('\n');
	// use blob for bug in chrome: https://code.google.com/p/chromium/issues/detail?id=373182
	var url = URL.createObjectURL(new Blob([txt], { type: 'text/tsv' }));
	var a = document.createElement('a');
	var filename = 'xenaDownload.tsv';
	_.extend(a, { id: filename, download: filename, href: url });
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

var max = (x, y) => x > y ? x : y;
var minWidthSize = (minWidth, {width, height}) => ({width: max(minWidth, width), height});

var ResizeOverlay = React.createClass({
	getInitialState: () => ({zooming: false}),
	onResizeStart: function () {
		var {width, height} = this.props,
			minWidth = this.props.minWidth();
		this.setState({zooming: true, zoomSize: {width, height}, minWidth});
	},
	onResize: function (ev, {size}) {
		var {width, height} = size,
			{minWidth} = this.state;
		this.setState({zoomSize: {width: max(width, minWidth), height}});
	},
	onResizeStop: function (ev, {size}) {
		var {onResizeStop} = this.props,
			{minWidth} = this.state;
		this.setState({zooming: false});
		if (onResizeStop) {
			onResizeStop(minWidthSize(minWidth, size));
		}
	},
	render: function () {
		var {zooming, zoomSize} = this.state;
		// XXX This margin setting really belongs elsewhere.
		return (
			<div className='resizeOverlay' style={{position: 'relative', marginBottom: '5px'}}>
				{zooming ? <div style={{
					width: zoomSize.width,
					height: zoomSize.height,
					position: 'absolute',
					top: 0,
					left: 0,
					zIndex: 999,
					backgroundColor: 'rgba(0,0,0,0.4)'
				}} /> : null}
				<Resizable handleSize={[20, 20]}
					onResizeStop={this.onResizeStop}
					onResize={this.onResize}
					onResizeStart={this.onResizeStart}
					width={this.props.width}
					height={this.props.height}>

					<div style={{position: 'relative', cursor: 'none', zIndex: 0}}>
						{this.props.children}
					</div>
				</Resizable>
			</div>
		);
	}
});

var Column = React.createClass({
	onResizeStop: function (size) {
		this.props.callback(['resize', this.props.id, size]);
	},
	onRemove: function () {
		this.props.callback(['remove', this.props.id]);
	},
	onDownload: function () {
		download(this.props.download());
	},
	onViz: function () {
		this.props.onViz(this.props.id);
	},
	onKm: function () {
		let {callback, id} = this.props;
		callback(['km-open', id]);
	},
	getControlWidth: function () {
		var controlWidth = ReactDOM.findDOMNode(this.refs.controls).getBoundingClientRect().width,
			labelWidth = ReactDOM.findDOMNode(this.refs.label).getBoundingClientRect().width;
		return controlWidth + labelWidth;
	},
	render: function () {
		var {id, label, samples, samplesMatched, callback, plot, legend, column, zoom, menu, data, aboutDataset, disableKM, searching} = this.props,
			{width, columnLabel, fieldLabel, user} = column,
			[kmDisabled, kmTitle] = disableKM(id),
			// move this to state to generalize to other annotations.
			doRefGene = _.get(data, 'refGene'),
			// In FF spans don't appear as event targets. In Chrome, they do.
			// If we omit Sortable-handle here, Chrome will only catch events
			// in the button but not in the span. If we omit Sortable-handle
			// in SplitButton, FF will catch no events, since span doesn't
			// emit any.
			moveIcon = (<span
				className="glyphicon glyphicon-resize-horizontal Sortable-handle"
				aria-hidden="true">
			</span>);

		return (
			<div className='Column' style={{width: width, position: 'relative'}}>
				<br/>
				<SplitButton ref='controls' className='Sortable-handle' title={moveIcon} bsSize='xsmall'>
					{menu}
					{menu && <MenuItem divider />}
					<MenuItem title={kmTitle} onSelect={this.onKm} disabled={kmDisabled}>Kaplan Meier Plot</MenuItem>
					<MenuItem onSelect={this.onDownload}>Download</MenuItem>
					{aboutDataset(id)}
					<MenuItem onSelect={this.onViz}>Viz Settings</MenuItem>
					<MenuItem onSelect={this.onRemove}>Remove</MenuItem>
				</SplitButton>
				<Badge ref='label' style={{fontSize: '100%'}} className='pull-right'>{label}</Badge>
				<br/>
				<DefaultTextInput
					columnID={id}
					callback={callback}
					eventName='columnLabel'
					value={{default: columnLabel, user: user.columnLabel}} />
				<DefaultTextInput
					columnID={id}
					callback={callback}
					eventName='fieldLabel'
					value={{default: fieldLabel, user: user.fieldLabel}} />
				<div style={{height: 20}}>
					{doRefGene ?
						<RefGeneAnnotation
							width={width}
							refGene={_.values(data.refGene)[0]}
							layout={column.layout}
							position={{gene: column.fields[0]}}/> : null}
				</div>

				<ResizeOverlay
					onResizeStop={this.onResizeStop}
					width={width}
					minWidth={this.getControlWidth}
					height={zoom.height}>

					<SpreadSheetHighlight
						animate={searching}
						width={width}
						height={zoom.height}
						samples={samples.slice(zoom.index, zoom.index + zoom.count)}
						samplesMatched={samplesMatched}/>
					{plot}
				</ResizeOverlay>
				{legend}
			</div>
		);
	}
});

module.exports = Column;
