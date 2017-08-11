'use strict';
var React = require('react');
var _ = require('../underscore_ext');
var {allExons, exonGroups, intronRegions} = require('../findIntrons');
var {box, renderExon} = require('./Exons');
import '../../css/transcript_css/exons.css';
var {deepPureRenderMixin} = require('../react-utils');

const width = 700;
const padding = 5;

//assuming intronRegions is a 2D array like so: [[10,30], [70,100]]
function newCoordinates(data, intronRegions, exonGroupGroupBy) {
  var [exonStartsCopy, exonEndsCopy, cdsStartCopy, cdsEndCopy] = [[...data.exonStarts], [...data.exonEnds], data.cdsStart, data.cdsEnd];
  let labels = [];
  let pad = [];
  intronRegions.forEach(intron => {
    data.exonStarts.forEach( (exonStarts, index) => {
      intron[1] <= exonStarts ? ( exonStartsCopy[index] -= (intron[1] - intron[0]),
      exonEndsCopy[index] -= (intron[1] - intron[0]) ) : null;
    });
    intron[1] <= data.cdsStart ? cdsStartCopy -= (intron[1] - intron[0]) : null;
    intron[1] <= data.cdsEnd ? cdsEndCopy -= (intron[1] - intron[0]) : null;
  });
  data.exonStarts.forEach( (exonStarts, index) => {
    exonGroupGroupBy.forEach( (exonGroup, i) => {
      let flag = 0;
      _.sortBy(_.keys(exonGroup)).forEach((key, j) => {
        if(('{"start":' + exonStarts + ',"end":' + data.exonEnds[index] + '}') === key)
        {
          data.strand === '-' ? labels.push(exonGroupGroupBy.length - i + exonGroup.suffix.charAt(_.keys(exonGroup).length - j - 1)) :
          labels.push(i + 1 + exonGroup.suffix.charAt(j - 1));
          if((j === 1 || flag === 0))
          {
            pad[index] = padding * i;
            flag = 1;
          }
          else {
            pad[index] = 0;
          }
        }
      });
    });
  });
  return _.assoc(data, 'exonStarts', exonStartsCopy,
                       'exonEnds', exonEndsCopy,
                       'txStart', exonStartsCopy[0],
                       'txEnd', exonEndsCopy[data.exonCount - 1],
                       'cdsStart', cdsStartCopy,
                       'cdsEnd', cdsEndCopy,
                       'labels', labels,
                       'padding', pad);
}

function exonShape(data, exonStarts, exonEnds, cdsStart, cdsEnd, multiplyingFactor, strand, label, origin, pad, zoom) {
  let exonWidth = exonEnds - exonStarts;
  let startsAt = exonStarts - origin;
  if(cdsStart === cdsEnd)
	{
		return [box( 'small', startsAt, exonWidth, multiplyingFactor, strand, pad, zoom, label)];
	}
	else if(cdsStart > exonEnds)
	{
		return [box( 'small', startsAt, (exonWidth ), multiplyingFactor, strand, pad, zoom, label)];
	}
	else if(exonStarts < cdsStart && cdsStart < exonEnds)
	{
    let exonWidth1 = cdsStart - exonStarts;
    let exonWidth2 = exonEnds - cdsStart;
    // here if-else is only for identifying a suitable box for labeling.
    // labeling is done on the longest of the two boxes.
    if(exonWidth1 < (exonWidth2 ))
		{
      return [box( 'small', startsAt, exonWidth1, multiplyingFactor, strand, pad, zoom),
    box( 'big', (cdsStart - origin), (exonWidth2 ), multiplyingFactor, strand, pad, zoom, label)];
    }
    else
    {
      return [box( 'small', startsAt, exonWidth1, multiplyingFactor, strand, pad, zoom, label),
    box( 'big', (cdsStart - origin), (exonWidth2 ), multiplyingFactor, strand, pad, zoom)];
    }
	}
	else if(exonStarts < cdsEnd && cdsEnd < exonEnds)
	{
    let exonWidth1 = cdsEnd - exonStarts;
    let exonWidth2 = exonEnds - cdsEnd;
    // here if-else is only for identifying a suitable box for labeling.
    // labeling is done on the longest of the two boxes.
    if(exonWidth1 > (exonWidth2 ))
    {
		return [box( 'big', startsAt, exonWidth1, multiplyingFactor, strand, pad, zoom, label),
    box( 'small', (cdsEnd - origin), (exonWidth2 ), multiplyingFactor, strand, pad, zoom)];
    }
    else
    {
		return [box( 'big', startsAt, exonWidth1, multiplyingFactor, strand, pad, zoom),
    box( 'small', (cdsEnd - origin), (exonWidth2 ), multiplyingFactor, strand, pad, zoom, label)];
    }
	}
	else if(cdsEnd < exonStarts)
	{
		return [box( 'small', startsAt, (exonWidth ), multiplyingFactor, strand, pad, zoom, label)];
	}
	else
	{
		return [box( 'big', startsAt, (exonWidth ), multiplyingFactor, strand, pad, zoom, label)];
	}
}

var ExonsOnly = React.createClass({
  mixins: [deepPureRenderMixin],
  row(data, multiplyingFactor, origin) {

		return data.map((d, index) => {
      let extraAxisWidth = Math.max.apply(Math, d.padding) - d.padding[0];
			let style = { width: ((d.txEnd - d.txStart) * multiplyingFactor) + extraAxisWidth + "px"};
			style = d.strand === '-' ? _.conj(style, ['right', ((d.txStart - origin) * multiplyingFactor) + d.padding[0] + "px"])
									 : _.conj(style, ['left', ((d.txStart - origin) * multiplyingFactor) + d.padding[0] + "px"]);
      let rowClass = d.zoom ? "exons--row--zoom" : "exons--row";
			return ( <div className={rowClass} id={index} onClick={() => this.props.getNameZoom(d.name)}>
						<div className="exons--row--axis"
							 style={style}/>
					{
						_.flatten(_.mmap(d.exonStarts, d.exonEnds, d.labels, d.padding, _.range(0, d.exonStarts.length).map(() => d.zoom), (exonStarts, exonEnds, label, pad, zoom) => {
              return _.map(exonShape(data, exonStarts, exonEnds, d.cdsStart, d.cdsEnd, multiplyingFactor, d.strand, label, origin, pad, zoom), renderExon);
						}))
					}
					</div>
					);
		});
  },

  render() {
    let data = this.props.data ? this.props.data : [];
    let allExonsList = allExons(data);
    let exonGroupsList = exonGroups(allExonsList);
    let intronRegionsList = intronRegions(exonGroupsList);
    var exonGroupGroupBy = exonGroupsList.map((exonGroup) => {
      return _.groupBy(exonGroup.exons.map(exon => { return ({json: JSON.stringify(exon), exon}); }), 'json');
    });
    let exonGroupsWidth = width - padding * (exonGroupsList.length - 1);
    exonGroupGroupBy.forEach(group => {
      if(_.keys(group).length === 1)
      {
        _.extend(group, {suffix: ""});
      }
      else
      {
        let suffix = "";
        _.keys(group).forEach((subgroup, j) => {
          subgroup = subgroup;
          if(j <= 25)
          {
              suffix += String.fromCharCode(97 + j);
          }
          else if(j > 25)
          {
              suffix += String.fromCharCode(65 + j - 26);
          }
        });
        _.extend(group, {suffix: suffix});
      }
    });
    let newData = data.map(d => {
      return newCoordinates(d, intronRegionsList, exonGroupGroupBy);
    });
    let origin = Math.min.apply(Math, _.pluck(newData, 'txStart'));
    let multiplyingFactor = exonGroupsWidth / (Math.max.apply(Math, _.pluck(newData, 'txEnd')) - origin);
    // let multiplyingFactor2 = width / (Math.max.apply(Math, _.pluck(newData, 'txEnd')) - origin);
    let rows = this.row(newData, multiplyingFactor, origin);
    return (
      <div className="exons">
        {rows}
      </div>
    );
  }
});

module.exports = ExonsOnly;
