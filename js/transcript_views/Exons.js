'use strict';
var React = require('react');
var _ = require('../underscore_ext');

import '../../css/transcript_css/exons.css';
var {deepPureRenderMixin} = require('../react-utils');

var width = 700;

function box(type, startsAt, width, multiplyingFactor, strand, pad, label = "") {
	let exon = {
					type: type,
					label: label,
					width: (width * multiplyingFactor) + "px",
					origin: strand === '-' ? "right" : "left",
					position: (startsAt * multiplyingFactor) + pad + "px"
				};
	return exon;
}

function renderExon(exon) {
	let style = {
		width: exon.width,
	};
	style[exon.origin] = exon.position;
	if(exon.type === 'small')
	{
		return (<div className="exons--row--item-small"
						style={style}>
						<span>{exon.label}</span>
					</div>);
	}
	else if(exon.type === 'big')
	{
			return (<div className="exons--row--item-big"
							style={style}>
							<span>{exon.label}</span>
						</div>);
		}
	}

function exonShape(data, exonStarts, exonEnds, cdsStart, cdsEnd, multiplyingFactor, strand, origin) {

	let exonWidth = exonEnds - exonStarts;
	let startsAt = exonStarts - origin;
	if(cdsStart > exonEnds)
	{
		return [box( 'small', startsAt, exonWidth, multiplyingFactor, strand)];
	}
	else if(exonStarts < cdsStart && cdsStart < exonEnds)
	{
		let exonWidth1 = cdsStart - exonStarts;
		let exonWidth2 = exonEnds - cdsStart;
		return [box( 'small', startsAt, exonWidth1, multiplyingFactor, strand),
			box( 'big', (cdsStart - origin), exonWidth2, multiplyingFactor, strand)];
	}
	else if(exonStarts < cdsEnd && cdsEnd < exonEnds)
	{
		let exonWidth1 = cdsEnd - exonStarts;
		let exonWidth2 = exonEnds - cdsEnd;
		return [box( 'big', startsAt, exonWidth1, multiplyingFactor, strand),
			box( 'small', (cdsEnd - origin), exonWidth2, multiplyingFactor, strand)];
	}
	else if(cdsEnd < exonStarts)
	{
		return [box( 'small', startsAt, exonWidth, multiplyingFactor, strand)];
	}
	else
	{
		return [box( 'big', startsAt, exonWidth, multiplyingFactor, strand)];
	}
}

var Exons = React.createClass({
	mixins: [deepPureRenderMixin],
	row(data, multiplyingFactor, origin) {

		return data.map((d, index) => {

			let style = { width: ((d.txEnd - d.txStart) * multiplyingFactor) + "px" };
			style = d.strand === '-' ? _.conj(style, ['right', ((d.txStart - origin) * multiplyingFactor) + "px"])
									 : _.conj(style, ['left', ((d.txStart - origin) * multiplyingFactor) + "px"]);

			return ( <div className="exons--row" id={index}>
						<div className="exons--row--axis"
							 style={style}/>
					{
						_.flatten(_.mmap(d.exonStarts, d.exonEnds, (exonStarts, exonEnds) => {
							return exonShape(data, exonStarts, exonEnds, d.cdsStart, d.cdsEnd, multiplyingFactor, d.strand, origin);
						}))
					}
					</div>
					);
		});
	},

	render() {
		let data = this.props.data ? this.props.data : null;
		let origin = Math.min.apply(Math, _.pluck(data, 'txStart'));
		//multiplying factor used to calculate position and width
		let multiplyingFactor = width / (Math.max.apply(Math, _.pluck(data, 'txEnd')) - origin);

		let rows = this.row(data, multiplyingFactor, origin);

		return (
				<div className="exons">
					{rows}
				</div>
			);
	}
});

module.exports = {
	Exons,
	box,
	renderExon
};
