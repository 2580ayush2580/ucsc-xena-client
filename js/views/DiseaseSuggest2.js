'use strict';

var React = require('react');
import Autosuggest from 'react-autosuggest';
import Input from 'react-toolbox/lib/input';
var _ = require('../underscore_ext');
var {deepPureRenderMixin} = require('../react-utils');
require('./GeneSuggest.css'); // XXX rename file
var lcs = require('../lcs');


function toLCWords(str) {
	return str.toLowerCase().split(/[ \t]/);
}

function applyBias(bias, x) {
	return x > 0 ? (x - 1) * bias + 1 : 0;
}

// tag and input are ordered lists of words, from strings that have
// been normalized to lower case, and split on whitespace.
//
// We count each word match. We count multiple word matches more
// strongly than a sum of the word matches. We count ordered
// word matches more strongly than multiple word matches

var multiWordBias = 1.5,
	orderBias = 1.7;
function scoreTag(tag, input) {
	var matches =  _.intersection(tag, input),
		wordBiased = applyBias(multiWordBias, matches.length),
		ordered = matches.length > 0 ? lcs(tag, input) : 0;

	return wordBiased * applyBias(orderBias, ordered);
}

function scoreCohorts(cohortMeta, tags, weights) {
	return tags.reduce((cohorts, tag, i) => {
		var w = weights[i];
		if (w > 0) {
			cohortMeta[tag].forEach(cohort =>
				cohorts[cohort] = (cohorts[cohort] || 0) + w);
		}
		return cohorts;
	}, {});
}

// Return list of cohorts ordered by strength of match to input.
function match(cohortMeta, input) { //eslint-disable-line no-unused-vars
	var tags = Object.keys(cohortMeta),
		normInput = toLCWords(input),
		normTags = tags.map(toLCWords),
		weights = normTags.map(t => scoreTag(t, normInput)),
		cohortScores = scoreCohorts(cohortMeta, tags, weights);

	return Object.keys(cohortScores).sort((c, d) => cohortScores[d] - cohortScores[c]);
}

// match by logical AND, instead of a scoring system
function matchExact(cohortMeta, input) {
	var tags = Object.keys(cohortMeta),
		normInput = toLCWords(input),
		matches = tags.filter(tag => _.contains(normInput, tag.toLowerCase()));
	return _.intersection(...matches.map(t => cohortMeta[t]));
}

// Return the start and end indices of the word in 'value'
// under the cursor position.
function currentWordPosition(value, position) {
	var li = value.slice(0, position).lastIndexOf(' '),
		i = li === -1 ? 0 : li + 1,
		lj = value.slice(position).indexOf(' '),
		j = lj === -1 ? value.length : position + lj;
	return [i, j];
}

// Return the word in 'value' under the cursor position
function currentWord(value, position) {
	var [i, j] = currentWordPosition(value, position);
	return value.slice(i, j);
}

var renderInputComponent = ({ref, onChange, ...props}) => (
	<Input
		ref={el => ref(el && el.getWrappedInstance().inputNode)}
		onChange={(value, ev) => onChange(ev)}
		label='Primary disease or Tissue of Origin'
		{...props} />);

var DiseaseSuggest = React.createClass({
	mixins: [deepPureRenderMixin],
	onSuggestionsFetchRequested({value}) {
		var position = this.refs.autosuggest.input.selectionStart,
			word = currentWord(value, position),
			lcValue = word.toLowerCase(),
			{cohortMeta} = this.props,
			tags = Object.keys(cohortMeta);
		this.setState({
			suggestions: _.filter(tags, t => t.toLowerCase().indexOf(lcValue) === 0)
		});
	},
	onSuggestionsClearRequested() {
		this.setState({suggestions: []});
	},
	getInitialState() {
		return {suggestions: [], value: ""};
	},
	onChange(ev, {newValue, method}) {
		// Don't update the value for 'up' and 'down' keys. If we do update
		// the value, it gives us an in-place view of the suggestion (pasting
		// the value into the input field), but the drawback is that it moves
		// the cursor to the end of the line. This messes up multi-word input.
		// We could try to preserve the cursor position, perhaps by passing a
		// custom input renderer. But for now, just don't update the value for
		// these events.
		if (method !== 'up' && method !== 'down') {
			this.setState({value: newValue});
		}
	},
	onSelect(ev, {suggestionValue}) {
		this.setState({value: suggestionValue});
	},
	onClear() {
		this.setState({value: ""});
	},
	onCohort(ev) {
		this.props.onSelect(ev.target.value);
	},
	shouldRenderSuggestions(value) {
		var position = this.refs.autosuggest.input.selectionStart,
			word = currentWord(value, position);
		return word.length > 0;
	},
	getSuggestionValue(suggestion) {
		var position = this.refs.autosuggest.input.selectionStart,
			value = this.refs.autosuggest.input.value,
			[i, j] = currentWordPosition(value, position);

		// splice the suggestion into the current word
		return value.slice(0, i) + suggestion + value.slice(j);
	},
	render() {
		var {onChange} = this,
			{suggestions, value} = this.state,
			{cohortMeta, cohort} = this.props,
			results = matchExact(cohortMeta, value);

		return (
			<div>
				<Autosuggest
					ref='autosuggest'
					suggestions={suggestions}
					onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
					onSuggestionsClearRequested={this.onSuggestionsClearRequested}
					onSuggestionSelected={this.onSelect}
					getSuggestionValue={this.getSuggestionValue}
					shouldRenderSuggestions={this.shouldRenderSuggestions}
					renderSuggestion={v => <span>{v}</span>}
					renderInputComponent={renderInputComponent}
					inputProps={{value, onChange}}/>
				<button onClick={this.onClear}>x</button>
				<ul>
					{results.map(c => (
						<div>
							<input type='radio' name='cohort' value={c}
								checked={c === cohort}
								onChange={this.onCohort}/>
							<label>{c}</label>
						</div>))}
				</ul>
			</div>);
	}
});

module.exports = DiseaseSuggest;
