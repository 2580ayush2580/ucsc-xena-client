/*global require: false, module: false */
'use strict';
var React = require('react');
var {Accordion, Glyphicon, ListGroup, ListGroupItem, Panel} = require('react-bootstrap/lib');
var Select = require('./Select');
var _ = require('../underscore_ext');
var xenaQuery = require('../xenaQuery');
var {deepPureRenderMixin} = require('../react-utils');

require('./DatasetSelect2.css');

// group header for a server
const LOCAL_DOMAIN = 'https://local.xena.ucsc.edu:7223';
const LOCAL_DOMAIN_label  = 'My Computer Hub' ;
const phenotype_dataSubTypeList = ["phenotype","phenotypes", "Phenotype", "Phenotypes"];
const phenotypeGroup_label ="phenotype";

var isLoaded = ds => ds.status === 'loaded';
var filterDatasets = (list, server) =>
	_.filter(list, (ds, dsID) =>
		isLoaded(ds) && server.includes(JSON.parse(dsID).host));
var groupDatasets = (list, server) => _.groupBy(list, ds =>
	server.includes(LOCAL_DOMAIN) ?  LOCAL_DOMAIN_label : ds.dataSubType);

var sortDatasets = (groups) => groups.map(dsGroup => {
	let sortedOptions = _.sortBy(dsGroup.options, ds => ds.label.toLowerCase());
	return _.assoc(dsGroup, 'options', sortedOptions);
});
var sortKeys = keys => _.sortBy(keys, key => key.toLowerCase());
var stripDatasets = list => _.map(list, ds => ({label: ds.label, value: ds.dsID}));
var addIterations = groups =>
	_.map(groups, group =>
		_.extend(group, {iterations: _.countBy(group.options, ds => ds.label)}));

function groupsFromDatasets(datasets, servers) {
	return _.reduce(servers, (allGroups, hub) => {
		let filteredSets = filterDatasets(datasets, hub),
			groupedSets = groupDatasets(filteredSets, hub),
			sortedGroupNames = sortKeys(_.keys(groupedSets));
		sortedGroupNames.forEach(groupName => {
			let dsIndex = _.findKey(allGroups, dsGroup => dsGroup.name === groupName),
				groupMeta = {
					name: groupName,
					options: stripDatasets(groupedSets[groupName])
				};
			allGroups = !dsIndex ? allGroups.concat([groupMeta]) :
					_.updateIn(allGroups, [dsIndex, 'options'], prevOptions =>
						prevOptions.concat(groupMeta.options));
		});
		return allGroups;
	}, []);
}

function makeDs(ds, showPosition, countdown, onSelect, setValue) {
	var {label, value} = ds,
		position = showPosition ? countdown[label] : 0;

	return (
		<ListGroupItem key={label +position} onClick={() => onSelect([value])}
			eventKey={value} href='#'
			className = {`list-group-item-${ (setValue && value === setValue[0])? 'info':'default'}`}>
			{label +(position > 0 ? ` (#${position})` : '')}
		</ListGroupItem>
	);
}

function makeGroup(groupMeta, activeGroupName, onSelect, setValue) {
	var {iterations, name, options} = groupMeta,
		phenoGroup = phenotype_dataSubTypeList.indexOf(name) !==-1,
		header =
			<div className='row'>
				<span className='col-md-11'>
					{name}
				</span>
				<span className='col-md-1 text-muted small'>
					<Glyphicon glyph={activeGroupName === name ? 'triangle-top' : 'triangle-bottom'}/>
				</span>
			</div>;
	if (phenoGroup) {
		return (
			<a href="#" className='customPanel'>
			<div key={name} className={`panel panel-${activeGroupName === 'phenotype'? 'info':'default'}`}>
				<div className='panel-heading'
					onClick={() => onSelect(_.pluck(options, 'value'), name)}>
					<span className="panel-title">phenotype</span>
				</div>
			</div>
			</a>
		)
	} else {
		// - Duplicate elements will have a count number appended to their label
		// - All unique elements (e.g. no duplicates) will NOT have count number appended.
		let counts = _.mapObject(iterations, ds => 1);
		let dsElements = options.map(ds => {
			let showPosition = iterations[ds.label] > 1,
				element = makeDs(ds, showPosition, counts, onSelect, setValue);
			++counts[ds.label];
			return element;
		});

		return (
			<Panel collapsible key={name} eventKey={name} header={header} panelRole={name}>
				<ListGroup fill>{dsElements}</ListGroup>
			</Panel>
		)
	}
}

var DatasetSelect = React.createClass({
	name: 'Dataset',
	getInitialState: function() {
		var {datasets, servers, value} = this.props,
			activeGroup;

		if (value && value.length===1){
			let ds = datasets[value[0]];
			activeGroup = JSON.parse(ds.dsID).host=== LOCAL_DOMAIN ?  LOCAL_DOMAIN_label : ds.dataSubType;
		} else if (value && value.length>1){
			activeGroup = phenotypeGroup_label;
		} else {
			activeGroup='';
		}

		return {
			activeGroup: activeGroup,
			groups: addIterations(sortDatasets(groupsFromDatasets(datasets, servers)))
		};
	},
	componentWillReceiveProps: function(newProps) {
		var keys = ['datasets', 'servers'],
			updated = _.pick(newProps, keys),
			previous = _.pick(this.props, keys);

		if (!_.isEqual(updated, previous)) {
			let {datasets, servers} = updated;
			this.setState({
				groups: addIterations(sortDatasets(groupsFromDatasets(datasets, servers)))
			});
		}
	},
	onSelectDs: function(dsIDs, groupName) {
		if (phenotype_dataSubTypeList.indexOf(groupName)!==-1){
			this.onSetGroup(phenotypeGroup_label);
		}
		this.props.onSelect(dsIDs);
	},
	onSetGroup: function(newGroupName) {
		//change activeGroup when click on a expandable header only
		var groupName = (newGroupName !== this.state.activeGroup || newGroupName ===phenotypeGroup_label) ? newGroupName : '';
		this.setState({activeGroup: groupName});
	},
	mixins: [deepPureRenderMixin],
	render: function () {
		var {datasets, makeLabel, value} = this.props,
			{activeGroup, groups} = this.state;

		var	contentEl =
				<Accordion activeKey={activeGroup} className='form-group' onSelect={this.onSetGroup}>
					{_.map(groups, (groupMeta) =>
						makeGroup(groupMeta, activeGroup, this.onSelectDs, value))
					}
				</Accordion> ;
		return (
			<div>
				{contentEl}
			</div>
		);
	}
});

module.exports = DatasetSelect;
