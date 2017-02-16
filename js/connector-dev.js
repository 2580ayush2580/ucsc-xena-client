'use strict';

var _ = require('./underscore_ext');
var Rx = require('./rx.ext');
require('rx/dist/rx.time');
var React = require('react');
var ReactDOM = require('react-dom');
let {createDevTools} = require('./controllers/devtools');
import LogMonitor from 'redux-devtools-log-monitor';
import DockMonitor from 'redux-devtools-dock-monitor';
const session = require('ucsc-xena-datapages/session');
var nostate = require('./nostate');
var urlParams = require('./urlParams');

function logError(err) {
	if (typeof window === 'object' && typeof window.chrome !== 'undefined') {
		// In Chrome, rethrowing provides better source map support
		setTimeout(() => { throw err; });
	} else {
		console.error(err.stack || err);
	}
}

var unwrapDevState = state => _.last(state.computedStates).state;

function getSavedState(persist) {
	delete sessionStorage.xena; // Free up space & don't try to share with prod.
	if (persist && nostate('debugSession')) {
		try {
			return JSON.parse(sessionStorage.debugSession);
		} catch(err) {
			console.log("Unable to load saved debug session", err);
		}
	}
	return null;
}

module.exports = function({
	Page,
	controller,
	persist,
	initialState,
	serverBus,
	serverCh,
	uiBus,
	uiCh,
	main,
	selector}) {

	var dom = {main},
		updater = ac => uiBus.onNext(ac),
		devBus = new Rx.Subject(),
		devCh = devBus,
		devtoolsVisible = false; // Change this to turn on the debug window at start.

	var DevTools = createDevTools(
		<DockMonitor defaultIsVisible={devtoolsVisible}
				toggleVisibilityKey='ctrl-h' changePositionKey='ctrl-q'>
			<LogMonitor preserveScrollTop={false} expandStateRoot={false}/>
		</DockMonitor>),

		devReducer = DevTools.instrument(controller, initialState),
		savedState = getSavedState(persist),
		devInitialState = devReducer(null, savedState ?
			{type: 'IMPORT_STATE', nextLiftedState: savedState} : {});

	// Shim sessionStorage for code using session.js.
	session.setCallback(updater); // still used by datapages.

	// Side-effects (e.g. async) happen here. Ideally we wouldn't call this
	// from 'scan', since 'scan' should be side-effect free. However we've lost
	// the action by the time scan is complete, so we do it in the scan.
	var inEffectsReducer = false;
	var effectsReducer = (state, ac) => {
		if (inEffectsReducer) {
			throw new Error("Reentry in reducer. Reducers must not invoke actions.");
		}
		inEffectsReducer = true;
		var nextState = devReducer(state, ac);
		if (ac.type === 'PERFORM_ACTION') {
			try {
				controller.postAction(serverBus, unwrapDevState(state),
						unwrapDevState(nextState), ac.action);
			} catch(err) {
				logError(err);
			}
		}
		// We have an implicit async action on page load: 'init'. redux-devtools
		// 'RESET' command will return us to the initial state, but never
		// re-issues async actions (which would break the devtools functionality).
		// This leaves our app in an unusable state after RESET: initial state w/o any
		// way of issuing the 'init' action. The effect is the cohort list never
		// loads. Here we intercept the devtools actions & re-issue 'init' on
		// RESET.
		if (ac.type === 'RESET') {
			uiBus.onNext(['init']);
		}
		inEffectsReducer = false;
		return nextState;
	};

	var devStateObs = Rx.Observable.merge(serverCh, uiCh)
					.map(ac => ({type: 'PERFORM_ACTION', action: ac}))
					.merge(devCh)
					.scan(devInitialState, effectsReducer) // XXX side effects!
					.share();


	// XXX double check that this expression is doing what we want: don't draw faster
	// than rAF.

	// pass the selector into Page, so we catch errors while rendering & can display an error message.
	devStateObs.throttleWithTimeout(0, Rx.Scheduler.requestAnimationFrame)
		.subscribe(devState => {
			return ReactDOM.render(
				<div>
					<Page callback={updater} selector={selector}
							state={unwrapDevState(devState)} />
					<DevTools dispatch={devBus.onNext.bind(devBus)} {...devState} />
				</div>,
				dom.main);
		});

	if (persist) {
		// Save state in sessionStorage on page unload.
		devStateObs.sample(Rx.DOM.fromEvent(window, 'beforeunload'))
			.subscribe(state => sessionStorage.debugSession = JSON.stringify(_.omit(state, 'computedStates')));
	}

	// This causes us to always load cohorts on page load. This is important after
	// setting hubs, for example.
	uiBus.onNext(['init', urlParams()]);
	return dom;
};
