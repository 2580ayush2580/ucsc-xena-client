/*jslint browser: true,  nomen: true*/
/*global define: false */

define(["jing_helper", "data", "xenaQuery"], function (jing_helper, data, xenaQuery) {
	'use strict';

	function newHubNode(host) {
		//build checkbox
		var checkbox = data.hostCheckBox(host),
			tmpNode = jing_helper.elt("result2", jing_helper.hrefLink(host + " (connecting)","index.html?host=" + host));
		tmpNode.setAttribute("id","status" + host);
		return jing_helper.elt("h3", checkbox," ",tmpNode);
	}

	data.sessionStorageInitialize();
	var hosts = JSON.parse(sessionStorage.state).allHosts,
	node = jing_helper.sectionNode("hub"),
		newText;

	node.appendChild(jing_helper.elt("h2", "Data Hubs"));
	node.appendChild(jing_helper.elt("br"));
	hosts.forEach(function(host) {
		node.appendChild(newHubNode(host));
		node.appendChild(jing_helper.elt("br"));
		data.updateHostStatus(host);
	});

	newText = document.createElement("INPUT");
	newText.setAttribute("class","tb5");
	newText.setAttribute("id","textHub");
	node.appendChild(jing_helper.elt("italic","Add  "));
	node.appendChild(newText);
	document.body.appendChild(node);

	window.addEventListener("keydown", function(event) {
		if (event.keyCode === 13) {
			var node= document.getElementById("textHub"),
			host = node.value;
			host = host.trim();
			//if host is not start with http(s)
			if (host === "") {return;}

			host = xenaQuery.parse_server(host).url;

			/*
			   if (( host.search("http") !== 0) || ( host.search("://")===-1 ))
			   {
			   host="http://"+host;
			   }
			   */

			if (hosts.indexOf(host) !== -1) {
				node.value ="";
				return;
			}
			node.parentNode.insertBefore(newHubNode(host), node.previousSibling);
			node.parentNode.insertBefore(jing_helper.elt("br"), node.previousSibling);
			hosts.push(host);
			node.value ="";
			data.updateHostStatus(host);
		}
	});
});
