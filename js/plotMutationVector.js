/*eslint-env browser */
/*global require: false, module: false */
'use strict';

var _ = require('./underscore_ext');
var Rx = require('rx');
var React = require('react');
var Column = require('./Column');
var Legend = require('./Legend');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var {deepPureRenderMixin, rxEventsMixin} = require('./react-utils');
var widgets = require('./columnWidgets');
var util = require('./util');
var CanvasDrawing = require('./CanvasDrawing');
var {features} = require('./models/mutationVector');
var {drawMutations, radius} = require('./drawMutations');

// Since we don't set module.exports, but instead register ourselves
// with columWidgets, react-hot-loader can't handle the updates automatically.
// Accept hot loading here.
if (module.hot) {
	module.hot.accept();
	module.hot.accept('./models/mutationVector', () => {
		features = require('./models/mutationVector');
	});
}

// Since there are multiple components in the file we have to use makeHot
// explicitly.
function hotOrNot(component) {
	return module.makeHot ? module.makeHot(component) : component;
}

function drawLegend(feature) {
	var {colors, labels, align} = features[feature].legend;
	return (
		<Legend
			colors={['rgb(255,255,255)', ...colors]}
			labels={['no variant', ...labels]}
			align={align}
			ellipsis='' />
	);
}

function closestNode(nodes, pixPerRow, x, y) {
	var cutoffX = radius,
		cutoffY = pixPerRow / 2.0,
		min = Number.POSITIVE_INFINITY,
		distance;

	return _.reduce(nodes, function (closest, n) {
		if ((Math.abs(y - n.y) < cutoffY) && (x > n.xStart - cutoffX) && (x < n.xEnd + cutoffX)) {
			distance = Math.pow((y - n.y), 2) + Math.pow((x - (n.xStart + n.xEnd) / 2.0), 2);
			if (distance < min) {
				min = distance;
				return n;
			} else {
				return closest;
			}
		}
		else {
			return closest;
		}
	}, undefined);
}

function formatAf(af) {
	return (af === 'NA' || af === '' || af == null) ? null :
		Math.round(af * 100) + '%';
}

var fmtIf = (x, fmt) => x ? fmt(x) : '';
var dropNulls = rows => rows.map(row => row.filter(col => col != null)) // drop empty cols
	.filter(row => row.length > 0); // drop empty rows
var gbURL =  (assembly, pos) => `http://genome.ucsc.edu/cgi-bin/hgTracks?db=${encodeURIComponent(assembly)}&position=${encodeURIComponent(pos)}`;

function sampleTooltip(sampleFormat, data, gene, assembly) {
	var dnaVaf = data.dna_vaf == null ? null : ['labelValue',  'DNA variant allele freq', formatAf(data.dna_vaf)],
		rnaVaf = data.rna_vaf == null ? null : ['labelValue',  'RNA variant allele freq', formatAf(data.rna_vaf)],
		refAlt = data.reference && data.alt && ['value', `${data.reference} to ${data.alt}`],
		pos = data && `${data.chr}:${util.addCommas(data.start)}-${util.addCommas(data.end)}`,
		posURL = ['url',  `${assembly} ${pos}`, gbURL(assembly, pos)],
		effect = ['value', fmtIf(data.effect, x => `${x}, `) +  gene + //eslint-disable-line comma-spacing
					fmtIf(data.amino_acid, x => ` (${x})`)];

	return {
		rows: dropNulls([
			[effect],
			[posURL, refAlt],
			[dnaVaf],
			[rnaVaf]
		]),
		sampleID: sampleFormat(data.sample)
	};
}

function makeRow(fields, sampleGroup, row) {
	let fieldValue;
	if (_.isArray(sampleGroup) && sampleGroup.length === 0) {
		fieldValue = 'no variant';
	}
	if (_.isEmpty(sampleGroup)) {
		sampleGroup = [row];
	}
	return _.flatmap(sampleGroup, row =>
		_.map(fields, f => (row && row[f]) || fieldValue));
}

function tooltip(nodes, samples, sampleFormat, {height, count, index}, gene, assembly, ev) {
	var {x, y} = util.eventOffset(ev),
		pixPerRow = height / count, // XXX also appears in mutationVector
		minppr = Math.max(pixPerRow, 2), // XXX appears multiple places
		node = closestNode(nodes, minppr, x, y);

	return node ?
		sampleTooltip(sampleFormat, node.data, gene, assembly) :
		{sampleID: sampleFormat(samples[Math.floor((y * count / height) + index)])};
}

function getRowFields(rows, sampleGroups) {
	if (_.isEmpty(sampleGroups)) {
		return []; // When no samples exist
	} else if (!_.isEmpty(rows)) {
		return _.keys(rows[0]); // When samples have mutation(s)
	} else {
		return ['sample', 'result']; // default fields for mutation-less columns
	}
}

function formatSamples(sampleFormat, rows) {
	return _.map(rows, r => _.updateIn(r, ['sample'], sampleFormat));
}

var MutationColumn = hotOrNot(React.createClass({
	mixins: [rxEventsMixin, deepPureRenderMixin],
	componentWillMount: function () {
		this.events('mouseout', 'mousemove', 'mouseover');

		// Compute tooltip events from mouse events.
		this.ttevents = this.ev.mouseover
			.filter(ev => util.hasClass(ev.currentTarget, 'Tooltip-target'))
			.selectMany(() => {
				return this.ev.mousemove
					.takeUntil(this.ev.mouseout)
					.map(ev => ({
						data: this.tooltip(ev),
						open: true,
						point: {x: ev.clientX, y: ev.clientY}
					})) // look up current data
					.concat(Rx.Observable.return({open: false}));
			}).subscribe(this.props.tooltip);
	},
	componentWillUnmount: function () {
		this.ttevents.dispose();
	},
	onDownload: function() {
		let {data: {req: {rows}}, samples, index, sampleFormat} = this.props,
			groupedSamples = _.getIn(index, ['bySample']) || [],
			rowFields = getRowFields(rows, groupedSamples),
			allRows = _.map(samples, (sId) => {
				let alternateRow = {sample: sampleFormat(sId)}; // only used for mutation-less samples
				return makeRow(rowFields, formatSamples(sampleFormat, groupedSamples[sId]),
					alternateRow);
			});
		return [rowFields, allRows];
	},

	onMuPit: function () {
		// Construct the url, which will be opened in new window
		let rows = _.getIn(this.props, ['data', 'req', 'rows']),
			uriList = _.uniq(_.map(rows, n => `${n.chr}:${n.start.toString()}`)).join(','),
			url = `http://mupit.icm.jhu.edu/?gm=${uriList}`;

		window.open(url);
	},
	tooltip: function (ev) {
		var {column: {nodes, fields, assembly}, samples, sampleFormat, zoom} = this.props;
		return tooltip(nodes, samples, sampleFormat, zoom, fields[0], assembly, ev);
	},
	render: function () {
		var {column, label, samples, samplesMatched, zoom, data, index, disableKM, aboutDataset, searching} = this.props,
			feature = _.getIn(column, ['sFeature']),
			assembly = _.getIn(column, ['assembly']),
			rightAssembly = (assembly === "hg19" || assembly === "GRCh37") ? true : false,  //MuPIT currently only support hg19
			noMenu = !rightAssembly || (data && _.isEmpty(data.refGene)),
			noData = ( !data ) ? true : false,
			menuItemName = noData ? 'MuPIT View (hg19) Loading' : 'MuPIT View (hg19)';

		// XXX Make plot a child instead of a prop? There's also legend.
		return (
			<Column
				callback={this.props.callback}
				id={this.props.id}
				aboutDataset={aboutDataset}
				disableKM={disableKM}
				download={this.onDownload} //eslint-disable-line no-undef
				label={label}
				samples={samples}
				samplesMatched={samplesMatched}
				searching={searching}
				column={column}
				zoom={zoom}
				menu={noMenu ? null : <MenuItem disabled={noData} onSelect={this.onMuPit}>{menuItemName}</MenuItem>}
				data={data}
				plot={<CanvasDrawing
						ref='plot'
						draw={drawMutations}
						wrapperProps={{
							className: 'Tooltip-target',
							onMouseMove: this.ev.mousemove,
							onMouseOut: this.ev.mouseout,
							onMouseOver: this.ev.mouseover,
							onClick: this.props.onClick
						}}
						feature={feature}
						nodes={column.nodes}
						strand={column.strand}
						width={column.width}
						data={data}
						index={index}
						samples={samples}
						xzoom={column.zoom}
						zoom={zoom}/>}
				legend={drawLegend(feature)}
			/>
		);
	}
}));

var getColumn = props => <MutationColumn {...props} />;

widgets.column.add('mutation', getColumn);
