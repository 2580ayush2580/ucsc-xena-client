/*jslint browser:true, nomen: true*/
/*global define: false */

define(["xenaQuery", "underscore_ext"], function (xenaQuery, _) {
	//create a ELEMENT_NODE with a tag, and all following argument as a child to this node
	function elt(tag) {
		var node = document.createElement(tag);

		_.each(_.map(_.rest(arguments), function (child) {
			return (typeof child === 'string') ? document.createTextNode(child) : child;
		}), _.bind(node.appendChild, node));
		return node;
	}

	// create a href ELEMENT_NODE
	function hrefLink(text, link) {
		var node = elt("a", text);
		node.setAttribute("href", link);
		return node;
	}

	// create an ELEMENT_NODE with id=<valueId>
	function valueNode(valueId) {
		var node = elt("result", "");
		node.setAttribute("id", valueId);
		return node;
	}

	// create an ELEMENT_NODE with label:<valueId> where valueId a DOM placement holder with id=<valueId>, for filling in the values later
	//  use function like
	//          node = document.getElementById(valueId);
	//          node.appendChild(document.createTextNode(VALUE));
	function labelValueNode(label, valueId) {
		var node = elt("label", label);
		node.appendChild(valueNode(valueId));
		return node;
	}

	//create an ELEMENT_NODE with tag=<section> and id=label
	function sectionNode(label) {
		var node = elt("section");
		node.setAttribute("id", label);
		return node;
	}

	function stripHTML(html) {
		return html.replace(/(<([^>]+)>)/ig, "");
	}

	function stripScripts(html) {
		var div = document.createElement('div'),
			scripts = div.getElementsByTagName('script'),
			i = scripts.length;
		div.innerHTML = html;
		while (i--) {
			scripts[i].parentNode.removeChild(scripts[i]);
		}
		return div.innerHTML;
	}

	//parse url queryString to json
	function queryStringToJSON() {
		var pairs = location.search.slice(1).split('&'),
			result = {};
		pairs.forEach(function (pair) {
			pair = pair.split('=');
			if (pair[0] && pair[1]) {
				result[pair[0]] = decodeURIComponent(pair[1] || '');
			}
		});

		return JSON.parse(JSON.stringify(result));
	}

	function updataDOM_xenaDataSet_sampleN(DOM_id, host, dataset) {
		xenaQuery.dataset_samples(host, dataset).subscribe(function (s) {
			var tag = "result";
			document.getElementById(DOM_id).appendChild(elt(tag, (s.length.toLocaleString())));
		});
	}

	function updateDOM_xenaCohort_sampleN(DOM_id, hosts, cohort) {
		hosts.forEach(function (host) {
			xenaQuery.all_samples(host, cohort).subscribe(function (s) {
				if (s.length !== 0) {
					var node = document.getElementById(DOM_id),
						text;
					if (node.children.length > 0) {
						text = node.lastChild.textContent;
						node.lastChild.textContent = text + "; " + s.length.toLocaleString();
					} else {
						node.appendChild(elt("result", " " + s.length.toLocaleString()));
					}
				}
			});
		});
	}

	return {
		elt: elt,
		hrefLink: hrefLink,
		labelValueNode: labelValueNode,
		valueNode: valueNode,
		sectionNode: sectionNode,
		stripHTML: stripHTML,
		stripScripts: stripScripts,
		updataDOM_xenaDataSet_sampleN: updataDOM_xenaDataSet_sampleN,
		updateDOM_xenaCohort_sampleN: updateDOM_xenaCohort_sampleN,
		queryStringToJSON: queryStringToJSON
	};
});
